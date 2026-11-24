import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test, beforeEach, afterEach } from "node:test";
import sharp from "sharp";
import { createD1Fixture, insertUser } from "./d1-fixture.mjs";
import { hashPassword } from "../src/lib/password.ts";
import { normalizeStudentAvatar } from "../src/lib/student-profile.ts";
import { AVATAR_KEY_PREFIX, AVATAR_SIZE, MAX_AVATAR_BYTES, MAX_AVATAR_UPLOAD_BYTES } from "../src/lib/student-profile-options.ts";

const require = createRequire(import.meta.url);
const authPath = require.resolve("next-auth");
const nextCachePath = require.resolve("next/cache");
const originalAuth = require("next-auth");
const originalCache = require("next/cache");
let session;
let invalidated;
require.cache[authPath].exports = { ...originalAuth, getServerSession: async () => session };
require.cache[nextCachePath].exports = { ...originalCache, revalidatePath: path => invalidated.push(path) };
const { getCurrentStudentAccount } = await import("../src/lib/student-session.ts");
const { updateStudentProfile } = await import("../src/app/hoc-sinh/thong-tin/actions.ts");
const { GET } = await import("../src/app/api/student-avatars/[id]/route.ts");
require.cache[authPath].exports = originalAuth;
require.cache[nextCachePath].exports = originalCache;

const sampleHash = await hashPassword("local-only-profile-fixture");
const image = await sharp({ create: { width: 480, height: 320, channels: 3, background: "#438f9a" } })
  .jpeg().withMetadata({ orientation: 6 }).toBuffer();
let fixture;
let pupils;
let staff;

beforeEach(() => {
  fixture = createD1Fixture();
  staff = insertUser(fixture.database, { role: "SUPER_ADMIN" });
  fixture.database.prepare("UPDATE users SET email_verified_at = CURRENT_TIMESTAMP").run();
  fixture.database.prepare(`INSERT INTO academic_years (id, school_id, name, starts_on, ends_on)
    VALUES ('year-sample','school-ben-tre','Năm học thử','2026-09-01','2027-05-31')`).run();
  for (const group of ["a", "b"]) {
    fixture.database.prepare(`INSERT INTO classes (id, school_id, academic_year_id, name, slug, grade, created_by)
      VALUES (?, 'school-ben-tre', 'year-sample', ?, ?, 4, ?)`).run("class-"+group, "Lớp mẫu "+group, "class-"+group, staff.id);
  }
  pupils = [seedPupil("1", "a"), seedPupil("2", "b")];
  session = studentSession(pupils[0]);
  invalidated = [];
});
afterEach(() => fixture.restore());

function seedPupil(n, group) {
  const pupil = { id: "fixture-pupil-" + n, enrollment: "fixture-enrollment-" + n, account: "fixture-account-" + n };
  fixture.database.prepare("INSERT INTO students(id,school_id,full_name,student_code) VALUES (?,'school-ben-tre',?,?)")
    .run(pupil.id, "Học sinh giả lập "+n, "TEST-"+n);
  fixture.database.prepare("INSERT INTO student_accounts(id,phone,password_hash,must_change_password) VALUES (?,?,?,0)")
    .run(pupil.account, "090000000"+n, sampleHash);
  fixture.database.prepare("INSERT INTO student_account_students(account_id,student_id) VALUES (?,?)").run(pupil.account,pupil.id);
  fixture.database.prepare(`INSERT INTO student_enrollments(id,student_id,class_id,school_id,academic_year_id,enrolled_on)
    VALUES (?,?,?,'school-ben-tre','year-sample','2026-09-01')`).run(pupil.enrollment,pupil.id,"class-"+group);
  return pupil;
}

function studentSession(pupil, sessionVersion=1) {
  return { user: { kind: "student", studentAccountId: pupil.account, studentSessionVersion: sessionVersion } };
}
function row(pupil) {
  return fixture.database.prepare("SELECT * FROM students WHERE id = ?").get(pupil.id);
}
function form(pupil, overrides={}) {
  const fields = {
    enrollment_id: pupil.enrollment, revision: row(pupil).updated_at,
    display_name: "  Tên mẫu  đã   sửa  ", date_of_birth: "2016-02-29", gender: "FEMALE",
    avatar_intent: "keep", ...overrides,
  };
  const body = new FormData();
  for (const [key, value] of Object.entries(fields)) body.set(key, value);
  return body;
}
const newAvatar = () => new File([image], "sample-photo.jpg", { type: "image/jpeg" });
function read(pupil) {
  return GET(new Request("https://example.test/api/student-avatars/"+pupil.enrollment), { params: Promise.resolve({ id: pupil.enrollment }) });
}

test("avatar uploads produce a bounded square WebP image with no source metadata", async () => {
  const bytes = await normalizeStudentAvatar(newAvatar());
  const meta = await sharp(bytes).metadata();
  assert.equal(meta.format, "webp");
  assert.equal(meta.width, AVATAR_SIZE);
  assert.equal(meta.height, AVATAR_SIZE);
  assert.equal(meta.exif, undefined);
  assert(bytes.length <= MAX_AVATAR_BYTES);
  await assert.rejects(normalizeStudentAvatar(new File([Buffer.alloc(MAX_AVATAR_UPLOAD_BYTES + 1)], "oversize.jpg", { type: "image/jpeg" })));
  await assert.rejects(normalizeStudentAvatar(new File(["not an image"], "fixture.png", { type: "image/png" })));
});

test("the student can update a linked profile and replace or clear a private avatar", async () => {
  const [pupil, other] = pupils;
  const old = row(pupil), unrelated = row(other);
  assert.deepEqual(await updateStudentProfile(form(pupil, { avatar_intent: "replace", avatar: newAvatar() })),
    { success: true, message: "Đã lưu thông tin của em." });
  const updated = row(pupil);
  assert.equal(updated.display_name, "Tên mẫu đã sửa");
  assert.equal(updated.gender, "FEMALE");
  assert.equal(updated.date_of_birth, "2016-02-29");
  assert.equal(updated.full_name, old.full_name);
  assert.equal(updated.student_code, old.student_code);
  assert.notEqual(updated.updated_at, old.updated_at);
  assert.deepEqual(row(other), unrelated);
  assert(updated.avatar_key.startsWith(AVATAR_KEY_PREFIX));
  assert.deepEqual(invalidated, ["/hoc-sinh/thong-tin", "/"]);
  const general = await getCurrentStudentAccount();
  assert.equal(general.students[0].has_avatar, undefined);
  const editor = await getCurrentStudentAccount({ includeProfileEditor: true });
  assert.equal(editor.students[0].has_avatar, 1);
  assert.equal(editor.students[0].profile_updated_at, updated.updated_at);
  for (const account of [general, editor]) assert(!JSON.stringify(account).includes(updated.avatar_key));
  const response = await read(pupil);
  assert.equal(response.status, 200);
  assert.match(response.headers.get("cache-control"), /private, no-store/);
  assert.equal(response.headers.get("content-type"), "image/webp");
  assert.equal((await response.arrayBuffer()).byteLength, Buffer.from(updated.avatar_key.slice(AVATAR_KEY_PREFIX.length), "base64").length);

  assert.equal((await updateStudentProfile(form(pupil, { display_name: "Tên khác" }))).success, true);
  assert.equal(row(pupil).avatar_key, updated.avatar_key, "text-only changes keep the avatar");
  assert.equal((await updateStudentProfile(form(pupil, { avatar_intent: "remove" }))).success, true);
  assert.equal(row(pupil).avatar_key, null);
  assert.equal((await read(pupil)).status, 404);
  const audit = fixture.database.prepare("SELECT details_json FROM audit_logs WHERE action = 'STUDENT_PROFILE_UPDATED'").all();
  assert.equal(audit.length, 3);
  assert(!JSON.stringify(audit).includes("Tên mẫu"));
});

test("private profile edits and image reads refuse guests, other accounts and revoked or stale sessions", async () => {
  const [pupil, other] = pupils;
  assert.equal((await updateStudentProfile(form(pupil, { avatar_intent: "replace", avatar: newAvatar() }))).success, true);
  const before = row(pupil);
  assert.equal((await updateStudentProfile(form(pupil, { revision: "outdated" }))).success, false);
  assert.equal((await updateStudentProfile(form(pupil, { date_of_birth: "2016-02-30" }))).success, false);
  assert.equal((await updateStudentProfile(form(pupil, { date_of_birth: "2999-01-01" }))).success, false);
  assert.equal((await updateStudentProfile(form(pupil, { full_name: "unallowed" }))).success, false);
  for (const actor of [null, { user: { id: staff.id } }, studentSession(other), studentSession(pupil, 2)]) {
    session = actor;
    assert.equal((await read(pupil)).status, 404);
    assert.equal((await updateStudentProfile(form(pupil))).success, false);
  }
  session = studentSession(pupil);
  fixture.database.prepare("UPDATE student_accounts SET must_change_password=1 WHERE id=?").run(pupil.account);
  assert.equal((await read(pupil)).status, 404);
  assert.equal((await updateStudentProfile(form(pupil))).success, false);
  assert.deepEqual(row(pupil), before);
});

test("revocation during an edit prevents both the profile write and its audit record", async () => {
  const pupil = pupils[0];
  const before = row(pupil);
  const fetch = globalThis.fetch;
  globalThis.fetch = (url, options) => {
    if (options.body.includes("UPDATE students SET display_name")) {
      fixture.database.prepare("UPDATE student_accounts SET session_version=2 WHERE id=?").run(pupil.account);
    }
    return fetch(url, options);
  };
  assert.equal((await updateStudentProfile(form(pupil, { avatar_intent: "replace", avatar: newAvatar() }))).success, false);
  assert.deepEqual(row(pupil), before);
  assert.equal(fixture.database.prepare("SELECT count(*) AS n FROM audit_logs WHERE action = 'STUDENT_PROFILE_UPDATED'").get().n, 0);
});

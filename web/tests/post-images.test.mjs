import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { afterEach, beforeEach, test } from "node:test";
import sharp from "sharp";
import {
  getPostImage, MAX_POST_IMAGE_BYTES, MAX_POST_IMAGE_INPUT_BYTES, normalizePostImage,
  PostImageValidationError, postImageUrl,
} from "../src/lib/post-images.ts";
import { createD1Fixture, insertUser } from "./d1-fixture.mjs";

const require = createRequire(import.meta.url);
const authPath = require.resolve("next-auth");
const realAuth = require("next-auth");
let session = null;
require.cache[authPath].exports = { ...realAuth, getServerSession: async () => session };
const { GET } = await import("../src/app/api/post-images/[id]/route.ts");
require.cache[authPath].exports = realAuth;

const imageId = "30d7de2e-2861-4af3-9e38-b2e7e2db2bf7";
const pixels = { create: { width: 80, height: 40, channels: 3, background: "#f4b942" } };
const storedImage = await normalizePostImage(new File([await sharp(pixels).png().toBuffer()], "sample.png", { type: "image/png" }));
const testHash = `scrypt$16384$8$1$${"a".repeat(32)}$${"b".repeat(128)}`;
let fixture;
let admin;
let teacher;
let otherTeacher;

function verifiedUser(options) {
  const user = insertUser(fixture.database, options);
  fixture.database.prepare("UPDATE users SET email_verified_at = ? WHERE id = ?")
    .run("2026-10-16T00:00:00.000Z", user.id);
  return user;
}

beforeEach(() => {
  fixture = createD1Fixture();
  session = null;
  admin = verifiedUser({ role: "SUPER_ADMIN" });
  teacher = verifiedUser({ role: "TEACHER" });
  otherTeacher = verifiedUser({ role: "TEACHER" });
  fixture.database.prepare(`INSERT INTO academic_years (id, school_id, name, starts_on, ends_on)
    VALUES ('image-year', 'school-ben-tre', 'Image fixture year', '2026-09-01', '2027-05-31')`).run();
  for (const classId of ["image-class-a", "image-class-b"]) {
    fixture.database.prepare(`INSERT INTO classes (id, school_id, academic_year_id, name, slug, grade, created_by)
      VALUES (?, 'school-ben-tre', 'image-year', ?, ?, 4, ?)`)
      .run(classId, classId, classId, admin.id);
  }
  fixture.database.prepare(`INSERT INTO class_teachers (class_id, user_id, assigned_by)
    VALUES ('image-class-a', ?, ?), ('image-class-b', ?, ?)`)
    .run(teacher.id, admin.id, otherTeacher.id, admin.id);
  fixture.database.prepare(`INSERT INTO students (id, school_id, full_name)
    VALUES ('image-pupil', 'school-ben-tre', 'Synthetic image pupil')`).run();
  fixture.database.prepare(`INSERT INTO student_enrollments
    (id, student_id, class_id, school_id, academic_year_id, enrolled_on)
    VALUES ('image-enrollment', 'image-pupil', 'image-class-a', 'school-ben-tre', 'image-year', '2026-09-01')`).run();
  fixture.database.prepare(`INSERT INTO student_accounts (id, phone, password_hash, must_change_password)
    VALUES ('image-login', '0900000001', ?, 0)`).run(testHash);
  fixture.database.prepare(`INSERT INTO student_account_students (account_id, student_id)
    VALUES ('image-login', 'image-pupil')`).run();
  fixture.database.prepare(`INSERT INTO post_images
    (id, class_id, uploaded_by, content_type, byte_size, width, height, data_base64)
    VALUES (?, 'image-class-a', ?, ?, ?, ?, ?, ?)`)
    .run(imageId, teacher.id, storedImage.contentType, storedImage.byteSize,
      storedImage.width, storedImage.height, storedImage.dataBase64);
});
afterEach(() => fixture.restore());

function post({ id = "image-post", classId = "image-class-a", status = "PUBLISHED", visibility = "PRIVATE" } = {}) {
  fixture.database.prepare(`INSERT INTO posts
    (id, class_id, author_id, title, body, status, visibility, cover_url, published_at)
    VALUES (?, ?, ?, 'Synthetic cover', 'Synthetic body', ?, ?, ?, ?)`)
    .run(id, classId, admin.id, status, visibility, postImageUrl(imageId),
      status === "PUBLISHED" ? "2026-10-16T00:00:00.000Z" : null);
}

const student = { studentAccountId: "image-login", studentSessionVersion: 1 };

test("JPEG, PNG and WebP pixels are normalized to a bounded WebP with no EXIF", async () => {
  for (const format of ["jpeg", "png", "webp"]) {
    const bytes = await sharp(pixels)[format]().toBuffer();
    const result = await normalizePostImage(new File([bytes], `photo.${format}`, { type: `image/${format}` }));
    const output = Buffer.from(result.dataBase64, "base64");
    assert.equal(result.byteSize, output.length);
    assert.ok(result.byteSize <= MAX_POST_IMAGE_BYTES);
    assert.equal(result.contentType, "image/webp");
    assert.equal((await sharp(output).metadata()).format, "webp");
    assert.equal((await sharp(output).metadata()).exif, undefined);
    assert.deepEqual([result.width, result.height], [80, 40]);
  }
});

test("device photo orientation is applied to pixels and orientation metadata is removed", async () => {
  const original = await sharp(pixels).jpeg().withMetadata({ orientation: 6 }).toBuffer();
  const result = await normalizePostImage(new File([original], "portrait.jpg", { type: "image/jpeg" }));
  const metadata = await sharp(Buffer.from(result.dataBase64, "base64")).metadata();
  assert.deepEqual([result.width, result.height], [40, 80]);
  assert.equal(metadata.orientation, undefined);
  assert.equal(metadata.exif, undefined);
});

test("large dimensions are resized inside 1600 pixels without enlarging smaller photos", async () => {
  const bytes = await sharp({ create: { width: 2400, height: 1800, channels: 3, background: "#77bba8" } }).png().toBuffer();
  const result = await normalizePostImage(new File([bytes], "wide.png", { type: "image/png" }));
  assert.deepEqual([result.width, result.height], [1600, 1200]);
  assert.ok(result.byteSize <= MAX_POST_IMAGE_BYTES);
});

test("oversized upload is rejected before reading file contents", async () => {
  let read = false;
  await assert.rejects(normalizePostImage({ size: MAX_POST_IMAGE_INPUT_BYTES + 1,
    arrayBuffer: async () => { read = true; return new ArrayBuffer(0); } }), PostImageValidationError);
  assert.equal(read, false);
});

test("SVG, spoofed MIME, corrupted pixels, empty input and decompression bombs are rejected", async () => {
  const png = await sharp(pixels).png().toBuffer();
  const huge = await sharp({ create: { width: 5000, height: 4000, channels: 3, background: "white" } }).png().toBuffer();
  const badFiles = [
    new File(["<svg xmlns='http://www.w3.org/2000/svg'><script>alert(1)</script></svg>"], "fake.png", { type: "image/png" }),
    new File([png], "fake.webp", { type: "image/webp" }),
    new File([png.subarray(0, 33)], "truncated.png", { type: "image/png" }),
    new File([], "empty.png", { type: "image/png" }),
    new File([huge], "bomb.png", { type: "image/png" }),
    new File(["GIF89a"], "animated.gif", { type: "image/gif" }),
  ];
  for (const file of badFiles) await assert.rejects(normalizePostImage(file), PostImageValidationError);
});

test("an absent MIME is accepted only when actual supported image bytes decode correctly", async () => {
  const result = await normalizePostImage(new File([await sharp(pixels).png().toBuffer()], "no-extension"));
  assert.equal(result.contentType, "image/webp");
});

test("image paths accept only canonical generated IDs and malformed IDs never query D1", async () => {
  assert.equal(postImageUrl(imageId), `/api/post-images/${imageId}`);
  for (const id of ["../secret", "image-post", "' OR 1=1 --", imageId.toUpperCase(), "", null]) {
    assert.equal(await getPostImage(id), null);
    assert.throws(() => postImageUrl(id), PostImageValidationError);
  }
  assert.equal(fixture.requests.length, 0);
});

test("only current verified Super Admin or assigned teacher can read unreferenced covers", async () => {
  assert.ok(await getPostImage(imageId, { staffId: admin.id }));
  assert.ok(await getPostImage(imageId, { staffId: teacher.id }));
  for (const identity of [{}, student, { staffId: otherTeacher.id }, { staffId: "missing-user" }]) {
    assert.equal(await getPostImage(imageId, identity), null);
  }
  fixture.database.prepare("UPDATE users SET email_verified_at = NULL WHERE id = ?").run(admin.id);
  assert.equal(await getPostImage(imageId, { staffId: admin.id }), null);
  fixture.database.prepare("UPDATE class_teachers SET ended_at = ? WHERE user_id = ?")
    .run("2026-10-16T00:00:00Z", teacher.id);
  assert.equal(await getPostImage(imageId, { staffId: teacher.id }), null);
});

test("anonymous images require a published public post in the exact owning class", async () => {
  post({ classId: "image-class-b", visibility: "PUBLIC" });
  assert.equal(await getPostImage(imageId), null);
  post({ id: "correct-class", visibility: "PUBLIC" });
  assert.deepEqual((await getPostImage(imageId)).bytes, Buffer.from(storedImage.dataBase64, "base64"));
  fixture.database.prepare("UPDATE posts SET status = 'ARCHIVED' WHERE id = 'correct-class'").run();
  assert.equal(await getPostImage(imageId), null);
  fixture.database.prepare("UPDATE posts SET status = 'DRAFT', visibility = 'PUBLIC' WHERE id = 'correct-class'").run();
  assert.equal(await getPostImage(imageId), null);
});

test("an active linked pupil reads only published covers from its enrollment class", async () => {
  post({ status: "DRAFT" });
  assert.equal(await getPostImage(imageId, student), null);
  fixture.database.prepare("UPDATE posts SET status = 'PUBLISHED', published_at = ?")
    .run("2026-10-16T00:00:00.000Z");
  assert.ok(await getPostImage(imageId, student));
  assert.equal(await getPostImage(imageId), null);
  fixture.database.prepare("UPDATE student_enrollments SET status = 'TRANSFERRED', ended_on = '2026-10-16'").run();
  assert.equal(await getPostImage(imageId, student), null);
});

test("student password changes, suspension, unlinking and pupil archive revoke access immediately", async () => {
  post();
  const changes = [
    ["UPDATE student_accounts SET must_change_password = 1", "UPDATE student_accounts SET must_change_password = 0"],
    ["UPDATE student_accounts SET status = 'SUSPENDED'", "UPDATE student_accounts SET status = 'ACTIVE'"],
    ["UPDATE student_accounts SET session_version = 2", "UPDATE student_accounts SET session_version = 1"],
    ["UPDATE students SET archived_at = '2026-10-16T00:00:00Z'", "UPDATE students SET archived_at = NULL"],
  ];
  for (const [revoke, restore] of changes) {
    assert.ok(await getPostImage(imageId, student));
    fixture.database.exec(revoke);
    assert.equal(await getPostImage(imageId, student), null);
    fixture.database.exec(restore);
  }
  fixture.database.exec("DELETE FROM student_account_students");
  assert.equal(await getPostImage(imageId, student), null);
});

test("archiving a school or class hides its images even from Super Admin and public readers", async () => {
  post({ visibility: "PUBLIC" });
  for (const table of ["classes", "schools"]) {
    fixture.database.exec(`UPDATE ${table} SET archived_at = '2026-10-16T00:00:00Z'`);
    for (const identity of [{}, student, { staffId: admin.id }]) assert.equal(await getPostImage(imageId, identity), null);
    fixture.database.exec(`UPDATE ${table} SET archived_at = NULL`);
  }
});

test("staff suspension and role demotion revoke existing image sessions", async () => {
  for (const [column, value] of [["status", "SUSPENDED"], ["role", "PENDING"]]) {
    fixture.database.prepare(`UPDATE users SET ${column} = ? WHERE id = ?`).run(value, admin.id);
    assert.equal(await getPostImage(imageId, { staffId: admin.id }), null);
    fixture.database.prepare("UPDATE users SET status = 'ACTIVE', role = 'SUPER_ADMIN' WHERE id = ?").run(admin.id);
  }
});

test("the image response is raw WebP and cannot remain cached after privacy revocation", async () => {
  post({ visibility: "PUBLIC" });
  const response = await GET(new Request("https://example.test/api/post-images/" + imageId), { params: Promise.resolve({ id: imageId }) });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Content-Type"), "image/webp");
  assert.match(response.headers.get("Cache-Control"), /private.*no-store/);
  assert.equal(response.headers.get("X-Content-Type-Options"), "nosniff");
  assert.equal(response.headers.get("Cross-Origin-Resource-Policy"), "same-origin");
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), Buffer.from(storedImage.dataBase64, "base64"));
  fixture.database.exec("UPDATE posts SET visibility = 'PRIVATE'");
  const revoked = await GET(new Request("https://example.test/api/post-images/" + imageId), { params: Promise.resolve({ id: imageId }) });
  assert.equal(revoked.status, 404);
  assert.match(revoked.headers.get("Cache-Control"), /no-store/);
});

test("the route uses current staff and student identities rather than role claims", async () => {
  session = { user: { id: admin.id, role: "PENDING" } };
  assert.equal((await GET(new Request("https://example.test"), { params: Promise.resolve({ id: imageId }) })).status, 200);
  session = { user: { id: otherTeacher.id, role: "SUPER_ADMIN" } };
  assert.equal((await GET(new Request("https://example.test"), { params: Promise.resolve({ id: imageId }) })).status, 404);
  session = { user: { id: admin.id, kind: "student", studentAccountId: "image-login", studentSessionVersion: 1 } };
  assert.equal((await GET(new Request("https://example.test"), { params: Promise.resolve({ id: imageId }) })).status, 404);
  post();
  assert.equal((await GET(new Request("https://example.test"), { params: Promise.resolve({ id: imageId }) })).status, 200);
  session.user.studentSessionVersion = 0;
  assert.equal((await GET(new Request("https://example.test"), { params: Promise.resolve({ id: imageId }) })).status, 404);
});

test("database faults return a generic non-cacheable response without storage or session details", async () => {
  fixture.database.exec("DROP TABLE post_images");
  const response = await GET(new Request("https://example.test"), { params: Promise.resolve({ id: imageId }) });
  assert.equal(response.status, 503);
  assert.match(response.headers.get("Cache-Control"), /no-store/);
  assert.equal(await response.text(), "");
});

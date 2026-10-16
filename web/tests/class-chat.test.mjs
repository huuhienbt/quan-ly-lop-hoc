import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { afterEach, beforeEach, test } from "node:test";
import { createD1Fixture, insertUser } from "./d1-fixture.mjs";
import { hashPassword } from "../src/lib/password.ts";
import { chatSendSchema } from "../src/lib/chat-schemas.ts";

// Stub only the framework cookie/session edge. All live authorization, SQL,
// rate limits and transactions run against the actual migration schema.
const require = createRequire(import.meta.url);
const authPath = require.resolve("next-auth"), actualAuth = require("next-auth");
let requestSession = null;
require.cache[authPath].exports = { ...actualAuth, getServerSession: async () => requestSession };
const { getChatSnapshot, getTeacherChatStudents, sendChatMessage, hideChatMessage } = await import("../src/lib/class-chat.ts");
const { sendChatMessageAction, hideChatMessageAction } = await import("../src/app/chat-actions.ts");
const { GET } = await import("../src/app/api/class-chat/route.ts");
require.cache[authPath].exports = actualAuth;
const initialTime = new Date("2026-10-16T03:00:00.000Z");
const fixturePasswordHash = await hashPassword("Chat-fixtures-only-2026!");
let fixture, admin, classA, classB, clock;
beforeEach((context) => {
  context.mock.timers.enable({ apis: ["Date"], now: initialTime });
  clock = context.mock.timers;
  fixture = createD1Fixture();
  admin = staff();
  classA = classroom("chat-class-a");
  classB = classroom("chat-class-b");
  requestSession = null;
});
afterEach((context) => { fixture.restore(); context.mock.timers.reset(); });
function staff(options = {}) {
  const user = insertUser(fixture.database, { role: "SUPER_ADMIN", ...options });
  if (options.verified !== false) fixture.database.prepare("UPDATE users SET email_verified_at = ? WHERE id = ?").run(initialTime.toISOString(), user.id);
  return user;
}
function classroom(id) {
  const year = `${id}-year`;
  fixture.database.prepare("INSERT INTO academic_years (id,school_id,name,starts_on,ends_on) VALUES (?,'school-ben-tre',?,'2026-09-01','2027-05-31')").run(year, year);
  fixture.database.prepare("INSERT INTO classes (id,school_id,academic_year_id,name,slug,grade,created_by) VALUES (?,'school-ben-tre',?,?,?,4,?)").run(id, year, id, id, admin.id);
  return { id, year };
}
function teacher(classes = [classA]) {
  const user = staff({ role: "TEACHER" });
  for (const classroom of classes) fixture.database.prepare("INSERT INTO class_teachers (class_id,user_id,assigned_by) VALUES (?,?,?)").run(classroom.id, user.id, admin.id);
  return user;
}
function family(id = "chat-family-a", classroom = classA) {
  const phone = String(900000000 + fixture.database.prepare("SELECT count(*) AS n FROM student_accounts").get().n).padStart(10, "0");
  fixture.database.prepare("INSERT INTO student_accounts (id,phone,password_hash,must_change_password) VALUES (?,?,?,0)").run(id, phone, fixturePasswordHash);
  const student = `${id}-pupil`, enrollment = `${id}-enrollment`;
  fixture.database.prepare("INSERT INTO students (id,school_id,full_name) VALUES (?,'school-ben-tre',?)").run(student, `Synthetic ${student}`);
  fixture.database.prepare("INSERT INTO student_account_students (account_id,student_id) VALUES (?,?)").run(id, student);
  fixture.database.prepare("INSERT INTO student_enrollments (id,student_id,class_id,school_id,academic_year_id,enrolled_on) VALUES (?,?,?,'school-ben-tre',?,'2026-09-01')").run(enrollment, student, classroom.id, classroom.year);
  return { id, student, enrollment, classroom, version: 1 };
}
function studentIdentity(account) { return { mode: "student", accountId: account.id, sessionVersion: account.version }; }
function teacherIdentity(user = admin) { return { mode: "teacher", actorId: user.id }; }
function room(account, privateRoom = false) {
  return { mode: "student", class_id: account.classroom.id, enrollment_id: account.enrollment,
    ...(privateRoom ? { thread_enrollment_id: account.enrollment } : {}) };
}
function staffRoom(classroom = classA, enrollment) {
  return { mode: "teacher", class_id: classroom.id, ...(enrollment ? { thread_enrollment_id: enrollment } : {}) };
}
function advance(milliseconds = 3001) { clock.setTime(Date.now() + milliseconds); }
async function post(account, body = "Em chào thầy và các bạn.", privateRoom = false, key = crypto.randomUUID()) {
  return sendChatMessage(studentIdentity(account), { ...room(account, privateRoom), body, client_message_id: key });
}
function form(value) {
  const data = new FormData();
  for (const [key, field] of Object.entries(value)) if (field !== undefined) data.append(key, String(field));
  return data;
}
function login(account) { requestSession = { user: { kind: "student", studentAccountId: account.id, studentSessionVersion: account.version } }; }
function api(context, extra = "") {
  return GET(new Request(`http://localhost/api/class-chat?${new URLSearchParams(context)}${extra}`));
}
function seed(account, count, { privateRoom = false, offset = 120_000, prefix = "" } = {}) {
  for (let index = 0; index < count; index++) fixture.database.prepare(`INSERT INTO class_chat_messages
    (id,class_id,thread_enrollment_id,sender_kind,sender_account_id,sender_enrollment_id,client_message_id,body,created_at)
    VALUES (?,?,?,'STUDENT',?,?,?,?,?)`).run(
    `seed-${prefix}${account.enrollment}-${privateRoom ? "private" : "class"}-${String(index).padStart(4, "0")}`,
    account.classroom.id, privateRoom ? account.enrollment : null, account.id, account.enrollment, crypto.randomUUID(),
    `Synthetic message ${index}`, new Date(Date.now() - offset + index).toISOString());
}

test("new chat rooms are empty and teacher roster exposes names without login details", async () => {
  const account = family(), other = family("chat-family-b", classB);
  assert.deepEqual(await getChatSnapshot(studentIdentity(account), room(account)), { messages: [], has_more: false });
  const students = await getTeacherChatStudents(admin.id, classA.id);
  assert.deepEqual(students, [{ enrollment_id: account.enrollment, student_name: `Synthetic ${account.student}`, last_message_at: null }]);
  assert.equal(JSON.stringify(students).includes(other.student), false);
  assert.equal(JSON.stringify(students).includes("phone"), false);
});
test("class room is shared with classmates and assigned staff but never another class", async () => {
  const account = family(), peer = family("chat-family-b"), other = family("chat-family-c", classB), educator = teacher();
  const saved = await post(account);
  const own = await getChatSnapshot(studentIdentity(account), room(account));
  assert.equal(own.messages[0].id, saved.id);
  assert.equal(own.messages[0].is_own, true);
  const peerView = await getChatSnapshot(studentIdentity(peer), room(peer));
  assert.equal(peerView.messages[0].is_own, false);
  assert.equal(peerView.messages[0].sender_kind, "STUDENT");
  assert.equal((await getChatSnapshot(teacherIdentity(educator), staffRoom())).messages.length, 1);
  assert.equal((await getChatSnapshot(studentIdentity(other), room(other))).messages.length, 0);
  await assert.rejects(getChatSnapshot(studentIdentity(other), { ...room(other), class_id: classA.id }), { status: 403 });
});
test("private exchanges are visible only to selected pupil and currently assigned class staff", async () => {
  const account = family(), peer = family("chat-family-b"), educator = teacher(), stranger = teacher([classB]);
  await post(account, "Private pupil note", true);
  advance();
  await sendChatMessage(teacherIdentity(educator), { ...staffRoom(classA, account.enrollment), body: "Private teacher reply", client_message_id: crypto.randomUUID() });
  const privateView = await getChatSnapshot(studentIdentity(account), room(account, true));
  assert.deepEqual(privateView.messages.map(({ body }) => body), ["Private pupil note", "Private teacher reply"]);
  assert.equal((await getChatSnapshot(studentIdentity(account), room(account))).messages.length, 0);
  assert.equal((await getChatSnapshot(studentIdentity(peer), room(peer, true))).messages.length, 0);
  await assert.rejects(getChatSnapshot(studentIdentity(peer), { ...room(peer), thread_enrollment_id: account.enrollment }), { status: 400 });
  await assert.rejects(getChatSnapshot(teacherIdentity(stranger), staffRoom(classA, account.enrollment)), { status: 403 });
  await assert.rejects(post(peer, "peer DM", false).then(() => sendChatMessage(studentIdentity(peer), {
    ...room(peer), thread_enrollment_id: account.enrollment, body: "peer DM", client_message_id: crypto.randomUUID(),
  })), { status: 400 });
});
test("siblings on one phone account remain separate private identities and own markers", async () => {
  const first = family(), second = family("chat-family-sibling");
  fixture.database.prepare("UPDATE student_account_students SET account_id=? WHERE student_id=?").run(first.id, second.student);
  const sibling = { ...second, id: first.id };
  await post(first, "First private", true);
  advance();
  await post(sibling, "Second private", true);
  assert.deepEqual((await getChatSnapshot(studentIdentity(first), room(first, true))).messages.map(({ body }) => body), ["First private"]);
  assert.deepEqual((await getChatSnapshot(studentIdentity(sibling), room(sibling, true))).messages.map(({ body }) => body), ["Second private"]);
  advance(); await post(first, "First public");
  assert.equal((await getChatSnapshot(studentIdentity(sibling), room(sibling))).messages[0].is_own, false);
  await assert.rejects(getChatSnapshot(studentIdentity(first), { ...room(first), thread_enrollment_id: sibling.enrollment }), { status: 400 });
});
test("student reads and sends repeat live account version/password/link/enrollment checks", async () => {
  const account = family();
  const cases = [
    ["UPDATE student_accounts SET session_version=2 WHERE id=?", "UPDATE student_accounts SET session_version=1 WHERE id=?", account.id],
    ["UPDATE student_accounts SET must_change_password=1 WHERE id=?", "UPDATE student_accounts SET must_change_password=0 WHERE id=?", account.id],
    ["UPDATE student_accounts SET status='SUSPENDED' WHERE id=?", "UPDATE student_accounts SET status='ACTIVE' WHERE id=?", account.id],
    ["UPDATE students SET archived_at='2026-10-16' WHERE id=?", "UPDATE students SET archived_at=NULL WHERE id=?", account.student],
    ["UPDATE student_enrollments SET status='TRANSFERRED',ended_on='2026-10-16' WHERE id=?", "UPDATE student_enrollments SET status='ACTIVE',ended_on=NULL WHERE id=?", account.enrollment],
  ];
  for (const [revoke, restore, id] of cases) {
    fixture.database.prepare(revoke).run(id);
    await assert.rejects(getChatSnapshot(studentIdentity(account), room(account)), { status: 403 });
    await assert.rejects(post(account), { status: 403 });
    fixture.database.prepare(restore).run(id);
  }
  fixture.database.prepare("DELETE FROM student_account_students WHERE account_id=?").run(account.id);
  await assert.rejects(post(account), { status: 403 });
  assert.equal(fixture.database.prepare("SELECT count(*) AS n FROM class_chat_messages").get().n, 0);
});
test("archive and school year bounds close both common and private rooms", async () => {
  const account = family();
  for (const [table, id] of [["classes", classA.id], ["schools", "school-ben-tre"]]) {
    fixture.database.prepare(`UPDATE ${table} SET archived_at='2026-10-16' WHERE id=?`).run(id);
    await assert.rejects(post(account), { status: 403 });
    await assert.rejects(getTeacherChatStudents(admin.id, classA.id), { status: 403 });
    fixture.database.prepare(`UPDATE ${table} SET archived_at=NULL WHERE id=?`).run(id);
  }
  clock.setTime(new Date("2027-06-01T00:00:00Z").getTime());
  await assert.rejects(post(account, "ended school year", true), { status: 403 });
  await assert.rejects(getChatSnapshot(teacherIdentity(), staffRoom()), { status: 403 });
});
test("revoked/unverified/suspended staff cannot read or write with an existing identity", async () => {
  const educator = teacher();
  const message = { ...staffRoom(), body: "Teacher message", client_message_id: crypto.randomUUID() };
  fixture.database.prepare("UPDATE class_teachers SET ended_at=? WHERE user_id=?").run(initialTime.toISOString(), educator.id);
  await assert.rejects(sendChatMessage(teacherIdentity(educator), message), { status: 403 });
  await assert.rejects(getChatSnapshot(teacherIdentity(educator), staffRoom()), { status: 403 });
  for (const options of [{ role: "PENDING" }, { status: "SUSPENDED" }, { verified: false }]) {
    const user = staff(options);
    await assert.rejects(sendChatMessage(teacherIdentity(user), message), { status: 403 });
    await assert.rejects(getTeacherChatStudents(user.id, classA.id), { status: 403 });
  }
});
test("revocation immediately before the atomic write leaves no message", async () => {
  const account = family(), originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    const payload = JSON.parse(options.body);
    if (Array.isArray(payload) && payload[0].sql.includes("INSERT INTO class_chat_messages")) {
      fixture.database.prepare("UPDATE student_accounts SET session_version=session_version+1 WHERE id=?").run(account.id);
    }
    return originalFetch(url, options);
  };
  await assert.rejects(post(account), { status: 403 });
  assert.equal(fixture.database.prepare("SELECT count(*) AS n FROM class_chat_messages").get().n, 0);
});
test("retries are idempotent even while throttled and changed content/context under one key is rejected", async () => {
  const account = family(), key = crypto.randomUUID();
  const first = await post(account, "Once only", false, key);
  assert.deepEqual(await post(account, "Once only", false, key), first);
  await assert.rejects(post(account, "Different content", false, key), { status: 400 });
  await assert.rejects(post(account, "Once only", true, key), { status: 400 });
  assert.equal(fixture.database.prepare("SELECT count(*) AS n FROM class_chat_messages").get().n, 1);
});
test("database throttle spans rooms and sibling identities and is race-safe", async () => {
  const account = family();
  const results = await Promise.allSettled([post(account, "First"), post(account, "Concurrent", true)]);
  assert.equal(results.filter(({ status }) => status === "fulfilled").length, 1);
  const failure = results.find(({ status }) => status === "rejected");
  assert.equal(failure.reason.status, 429);
  advance(2999);
  await assert.rejects(post(account, "Too soon"), { status: 429 });
  advance(2);
  await post(account, "After gap", true);
  assert.equal(fixture.database.prepare("SELECT count(*) AS n FROM class_chat_messages").get().n, 2);
});
test("minute limit counts hidden messages and independent pupils can send", async () => {
  const account = family(), peer = family("chat-family-b");
  seed(account, 20, { offset: 10_000 });
  fixture.database.prepare("UPDATE class_chat_messages SET hidden_at=?,hidden_by=? WHERE sender_account_id=?").run(initialTime.toISOString(), admin.id, account.id);
  await assert.rejects(post(account), { status: 429 });
  await post(peer);
  advance(60_001);
  await post(account);
});
test("staff hide is audited once, blanks body for every client, and preserves original evidence", async () => {
  const account = family(), educator = teacher(), saved = await post(account, "Hidden evidence");
  const input = { ...staffRoom(), message_id: saved.id };
  await hideChatMessage(teacherIdentity(educator), input);
  await hideChatMessage(teacherIdentity(educator), input);
  for (const view of [await getChatSnapshot(studentIdentity(account), room(account)), await getChatSnapshot(teacherIdentity(educator), staffRoom())]) {
    assert.equal(view.messages[0].is_hidden, true);
    assert.equal(view.messages[0].body, "");
    assert.equal(JSON.stringify(view).includes("Hidden evidence"), false);
  }
  assert.equal(fixture.database.prepare("SELECT body FROM class_chat_messages WHERE id=?").get(saved.id).body, "Hidden evidence");
  const audits = fixture.database.prepare("SELECT * FROM audit_logs WHERE action='CHAT_MESSAGE_HIDDEN'").all();
  assert.equal(audits.length, 1);
  assert.equal(audits[0].actor_user_id, educator.id);
  assert.equal(JSON.stringify(audits).includes("Hidden evidence"), false);
});
test("student/other-class and wrong-thread moderation cannot hide a message", async () => {
  const account = family(), educator = teacher([classB]), saved = await post(account, "Private", true);
  for (const identity of [studentIdentity(account), teacherIdentity(educator)]) {
    await assert.rejects(hideChatMessage(identity, { ...staffRoom(classA, account.enrollment), message_id: saved.id }), { status: 403 });
  }
  await assert.rejects(hideChatMessage(teacherIdentity(), { ...staffRoom(), message_id: saved.id }), { status: 400 });
  assert.equal(fixture.database.prepare("SELECT hidden_at FROM class_chat_messages WHERE id=?").get(saved.id).hidden_at, null);
});
test("failed hide audit rolls back moderation and internal database errors stay private", async () => {
  const account = family(), saved = await post(account);
  fixture.database.exec("CREATE TEMP TRIGGER fail_chat_audit BEFORE INSERT ON audit_logs WHEN NEW.action='CHAT_MESSAGE_HIDDEN' BEGIN SELECT RAISE(ABORT,'PRIVATE_CHAT_SQL'); END");
  requestSession = { user: { id: admin.id } };
  const result = await hideChatMessageAction({ success: false, message: "" }, form({ ...staffRoom(), message_id: saved.id }));
  assert.equal(result.success, false);
  assert.equal(result.message.includes("PRIVATE_CHAT_SQL"), false);
  assert.equal(fixture.database.prepare("SELECT hidden_at FROM class_chat_messages WHERE id=?").get(saved.id).hidden_at, null);
});
test("pagination uses chronological timestamp/id order without leaking another thread cursor", async () => {
  const account = family(), other = family("chat-family-b");
  seed(account, 56);
  seed(other, 4, { privateRoom: true });
  const page = await getChatSnapshot(studentIdentity(account), room(account));
  assert.equal(page.messages.length, 50);
  assert.equal(page.has_more, true);
  assert.equal(page.messages[0].body, "Synthetic message 6");
  const older = await getChatSnapshot(studentIdentity(account), room(account), page.messages[0].id);
  assert.equal(older.messages.length, 6);
  assert.equal(older.has_more, false);
  assert.equal(older.messages[0].body, "Synthetic message 0");
  const privateId = fixture.database.prepare("SELECT id FROM class_chat_messages WHERE thread_enrollment_id=? LIMIT 1").get(other.enrollment).id;
  await assert.rejects(getChatSnapshot(studentIdentity(account), room(account), privateId), { status: 400 });
  await assert.rejects(getChatSnapshot(studentIdentity(account), room(account), "missing"), { status: 400 });
});
test("teacher roster refreshes recent private activity without leaking message previews", async () => {
  const account = family(), peer = family("chat-family-b");
  await post(peer, "PRIVATE_PREVIEW_MUST_NOT_LEAK", true);
  const result = await getChatSnapshot(teacherIdentity(), staffRoom());
  assert.equal(result.students[0].enrollment_id, peer.enrollment);
  assert.equal(result.students[0].last_message_at, initialTime.toISOString());
  assert.equal(result.messages.length, 0);
  assert.equal(JSON.stringify(result).includes("PRIVATE_PREVIEW_MUST_NOT_LEAK"), false);
  assert.equal((await getChatSnapshot(studentIdentity(account), room(account))).students, undefined);
});
test("inclusive history refresh includes its anchor and returns newly hidden status across a latest-page gap", async () => {
  const account = family();
  seed(account, 56);
  const oldPage = await getChatSnapshot(studentIdentity(account), room(account));
  const anchor = oldPage.messages.at(-1).id;
  // A later burst pushes every retained row out of the latest fifty messages.
  advance(180_000);
  seed(account, 60, { offset: 1000, prefix: "later-" });
  await hideChatMessage(teacherIdentity(), { ...staffRoom(), message_id: anchor });
  const refreshed = await getChatSnapshot(studentIdentity(account), room(account), undefined, anchor);
  assert.equal(refreshed.messages.length, 50);
  assert.equal(refreshed.messages.at(-1).id, anchor);
  assert.equal(refreshed.messages.at(-1).is_hidden, true);
  assert.equal(refreshed.messages.at(-1).body, "");
  assert.equal(refreshed.has_more, true);
  assert.equal((await getChatSnapshot(studentIdentity(account), room(account))).messages.some(({ id }) => id === anchor), false);
});
test("inclusive history cursor rejects mixed cursors and another private thread in services and GET", async () => {
  const account = family(), peer = family("chat-family-b");
  const common = await post(account, "Common anchor");
  const privateMessage = await post(peer, "Other private anchor", true);
  await assert.rejects(getChatSnapshot(studentIdentity(account), room(account), common.id, common.id), { status: 400 });
  await assert.rejects(getChatSnapshot(studentIdentity(account), room(account), undefined, privateMessage.id), { status: 400 });
  login(account);
  assert.equal((await api(room(account), `&through_id=${common.id}`)).status, 200);
  assert.equal((await api(room(account), `&through_id=${common.id}&before_id=${common.id}`)).status, 400);
  const denied = await api(room(account), `&through_id=${privateMessage.id}`);
  assert.equal(denied.status, 400);
  assert.equal(JSON.stringify(await denied.json()).includes("Other private anchor"), false);
});
test("message validation normalizes plain text while rejecting empty, oversized, controls and unknown fields", async () => {
  const account = family();
  const input = { ...room(account), body: "  Chào lớp <script>alert('x')</script>  ", client_message_id: crypto.randomUUID() };
  await sendChatMessage(studentIdentity(account), input);
  assert.equal((await getChatSnapshot(studentIdentity(account), room(account))).messages[0].body, "Chào lớp <script>alert('x')</script>");
  for (const changes of [{ body: " \n\t " }, { body: "x".repeat(2001) }, { body: "hi\u0000there" }, { body: "hi\u0007there" }, { client_message_id: "bad" }, { sender_name: "Impersonation" }, { mode: "student", enrollment_id: "" }]) {
    assert.equal(chatSendSchema.safeParse({ ...input, ...changes }).success, false);
  }
});
test("GET session boundaries return safe status and no-store headers for success and errors", async () => {
  const account = family();
  const anonymous = await api(room(account));
  assert.equal(anonymous.status, 401);
  login(account);
  const response = await api(room(account));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { messages: [], has_more: false });
  for (const view of [response, anonymous]) {
    assert.match(view.headers.get("cache-control"), /private.*no-store/);
    assert.equal(view.headers.get("cdn-cache-control"), "no-store");
    assert.equal(view.headers.get("vercel-cdn-cache-control"), "no-store");
    assert.equal(view.headers.get("vary"), "Cookie");
  }
  fixture.database.prepare("UPDATE student_accounts SET must_change_password=1 WHERE id=?").run(account.id);
  assert.equal((await api(room(account))).status, 403);
  fixture.database.prepare("UPDATE student_accounts SET session_version=2 WHERE id=?").run(account.id);
  assert.equal((await api(room(account))).status, 401);
});
test("GET rejects duplicate/mixed/unknown parameters and cross-kind sessions", async () => {
  const account = family(); login(account);
  for (const extra of ["&class_id=other", "&body=private", "&mode=teacher", "&before_id=bad%20cursor"]) {
    assert.equal((await api(room(account), extra)).status, 400);
  }
  assert.equal((await api({ ...staffRoom(), enrollment_id: account.enrollment })).status, 400);
  assert.equal((await api(staffRoom())).status, 401);
  requestSession = { user: { id: admin.id, role: "SUPER_ADMIN" } };
  assert.equal((await api(room(account))).status, 401);
  assert.equal((await api(staffRoom())).status, 200);
});
test("send action uses authenticated identity and rejects malformed forms without side effects", async () => {
  const account = family(), value = { ...room(account), body: "Action hello", client_message_id: crypto.randomUUID() };
  assert.equal((await sendChatMessageAction({ success: false, message: "" }, form(value))).success, false);
  login(account);
  const duplicate = form(value); duplicate.append("body", "dup");
  const unknown = form({ ...value, studentAccountId: account.id });
  const binary = form(value); binary.set("body", new Blob(["hi"]), "message.txt");
  for (const data of [duplicate, unknown, binary]) assert.equal((await sendChatMessageAction({ success: false, message: "" }, data)).success, false);
  const first = await sendChatMessageAction({ success: false, message: "" }, form(value));
  assert.equal(first.success, true);
  const again = await sendChatMessageAction(first, form(value));
  assert.equal(again.message_id, first.message_id);
  assert.equal(fixture.database.prepare("SELECT count(*) AS n FROM class_chat_messages").get().n, 1);
});
test("database statement sizes remain under gateway limits", async () => {
  const account = family();
  await post(account, "Check bounds", true);
  await getChatSnapshot(teacherIdentity(), staffRoom(classA, account.enrollment));
  await getTeacherChatStudents(admin.id, classA.id);
  assert.ok(fixture.requests.every(({ params = [] }) => params.length <= 100));
  assert.deepEqual(fixture.database.prepare("PRAGMA foreign_key_check").all(), []);
});

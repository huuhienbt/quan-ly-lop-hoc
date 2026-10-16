import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import sharp from "sharp";
import {
  archiveContent, getPublicBulletin, getPublicPost, getTeacherContentOverview, savePost,
} from "../src/lib/class-content.ts";
import { postSchema } from "../src/lib/content-schemas.ts";
import { getPostImage, MAX_POST_IMAGE_BYTES, postImageUrl } from "../src/lib/post-images.ts";
import { createD1Fixture, insertUser } from "./d1-fixture.mjs";

// Only synthetic pixels and an isolated in-memory database are used here.
const originalBytes = await sharp({ create: {
  width: 120, height: 60, channels: 3, background: "#4aa696",
} }).jpeg().withMetadata({ orientation: 6 }).toBuffer();
let fixture;
let admin;
let teacher;
let otherTeacher;

function verifiedUser(options = {}) {
  const user = insertUser(fixture.database, options);
  if (options.verified !== false) {
    fixture.database.prepare("UPDATE users SET email_verified_at = ? WHERE id = ?")
      .run("2026-10-16T00:00:00.000Z", user.id);
  }
  return user;
}

beforeEach(() => {
  fixture = createD1Fixture();
  admin = verifiedUser({ role: "SUPER_ADMIN" });
  teacher = verifiedUser({ role: "TEACHER" });
  otherTeacher = verifiedUser({ role: "TEACHER" });
  fixture.database.exec(`INSERT INTO academic_years (id, school_id, name, starts_on, ends_on)
    VALUES ('cover-year', 'school-ben-tre', 'Synthetic cover year', '2026-09-01', '2027-05-31')`);
  for (const classId of ["cover-class-a", "cover-class-b"]) {
    fixture.database.prepare(`INSERT INTO classes
      (id, school_id, academic_year_id, name, slug, grade, created_by)
      VALUES (?, 'school-ben-tre', 'cover-year', ?, ?, 4, ?)`)
      .run(classId, classId, classId, admin.id);
  }
  fixture.database.prepare(`INSERT INTO class_teachers (class_id, user_id, assigned_by)
    VALUES ('cover-class-a', ?, ?), ('cover-class-b', ?, ?)`)
    .run(teacher.id, admin.id, otherTeacher.id, admin.id);
});
afterEach(() => fixture.restore());

function input(overrides = {}) {
  return {
    class_id: "cover-class-a", title: "Synthetic device cover", body: "Synthetic classroom news.",
    kind: "NEWS", category: "GENERAL", cover_url: "", status: "PUBLISHED",
    visibility: "PUBLIC", is_pinned: false, ...overrides,
  };
}

function upload() {
  return new File([originalBytes], "synthetic-camera-photo.jpg", { type: "image/jpeg" });
}

function counts() {
  return Object.fromEntries(["posts", "post_images", "audit_logs"].map((table) => [
    table, fixture.database.prepare(`SELECT count(*) AS n FROM ${table}`).get().n,
  ]));
}

function storedPost(id) {
  return fixture.database.prepare("SELECT * FROM posts WHERE id = ?").get(id);
}

test("saving a device cover commits durable normalized pixels, its post and the audit together", async () => {
  const id = await savePost(teacher.id, input(), upload());
  assert.deepEqual(counts(), { posts: 1, post_images: 1, audit_logs: 1 });
  const post = storedPost(id);
  const image = fixture.database.prepare("SELECT * FROM post_images").get();
  assert.equal(post.cover_url, postImageUrl(image.id));
  assert.equal(image.class_id, post.class_id);
  assert.equal(image.uploaded_by, teacher.id);
  assert.equal(image.content_type, "image/webp");
  const bytes = Buffer.from(image.data_base64, "base64");
  assert.equal(image.byte_size, bytes.length);
  assert.ok(image.byte_size > 0 && image.byte_size <= MAX_POST_IMAGE_BYTES);
  const metadata = await sharp(bytes).metadata();
  assert.equal(metadata.format, "webp");
  assert.equal(metadata.exif, undefined);
  assert.equal(metadata.orientation, undefined);
  assert.deepEqual([metadata.width, metadata.height], [60, 120]);
  assert.deepEqual((await getPostImage(image.id)).bytes, bytes);
  const audit = fixture.database.prepare("SELECT action, entity_id, details_json FROM audit_logs").get();
  assert.equal(audit.action, "POST_CREATED");
  assert.equal(audit.entity_id, id);
  assert.equal(audit.details_json.includes(image.data_base64), false);

  for (const result of [await getPublicPost(id), await getPublicBulletin(), await getTeacherContentOverview(teacher.id)]) {
    const text = JSON.stringify(result);
    assert.ok(text.includes(post.cover_url));
    assert.equal(text.includes(image.data_base64), false);
    assert.equal(text.includes("data_base64"), false);
  }
});

test("editing a post can replace its saved cover while retaining an independently readable stored image", async () => {
  const id = await savePost(teacher.id, input(), upload());
  const oldUrl = storedPost(id).cover_url;
  await savePost(teacher.id, input({ id, title: "Updated synthetic news", visibility: "PRIVATE" }), upload());
  const updated = storedPost(id);
  assert.notEqual(updated.cover_url, oldUrl);
  assert.equal(updated.title, "Updated synthetic news");
  const imageId = updated.cover_url.split("/").at(-1);
  assert.ok(await getPostImage(imageId, { staffId: teacher.id }));
  assert.equal(await getPostImage(imageId), null);
  assert.deepEqual(fixture.database.prepare("SELECT action FROM audit_logs ORDER BY rowid").all()
    .map((row) => row.action), ["POST_CREATED", "POST_UPDATED"]);
});

test("unauthorized upload requests are rejected before reading device bytes", async () => {
  const actors = [
    verifiedUser({ role: "PENDING" }), verifiedUser({ role: "SUPER_ADMIN", verified: false }),
    verifiedUser({ role: "SUPER_ADMIN", status: "SUSPENDED" }),
    verifiedUser({ role: "TEACHER" }), otherTeacher, { id: "unknown-actor" },
  ];
  for (const actor of actors) {
    const file = upload();
    let read = false;
    file.arrayBuffer = async () => { read = true; throw new Error("Unauthorized pixels were read"); };
    await assert.rejects(savePost(actor.id, input(), file));
    assert.equal(read, false);
  }
  assert.deepEqual(counts(), { posts: 0, post_images: 0, audit_logs: 0 });
});

test("losing a teacher assignment during decoding cannot leave a post, image or audit", async () => {
  const file = upload();
  const read = file.arrayBuffer.bind(file);
  let readCount = 0;
  file.arrayBuffer = async () => {
    readCount++;
    fixture.database.prepare("UPDATE class_teachers SET ended_at = ? WHERE user_id = ?")
      .run("2026-10-16T00:00:00.000Z", teacher.id);
    return read();
  };
  await assert.rejects(savePost(teacher.id, input(), file));
  assert.equal(readCount, 1);
  assert.deepEqual(counts(), { posts: 0, post_images: 0, audit_logs: 0 });
});

test("archiving a school or class before saving a cover prevents all upload writes", async () => {
  for (const table of ["classes", "schools"]) {
    fixture.database.exec(`UPDATE ${table} SET archived_at = '2026-10-16T00:00:00.000Z'`);
    await assert.rejects(savePost(admin.id, input(), upload()));
    assert.deepEqual(counts(), { posts: 0, post_images: 0, audit_logs: 0 });
    fixture.database.exec(`UPDATE ${table} SET archived_at = NULL`);
  }
});

test("missing, archived and moved-class edits never leave an orphan image", async () => {
  const id = await savePost(admin.id, input());
  for (const values of [input({ id: "missing-post" }), input({ id, class_id: "cover-class-b" })]) {
    const before = counts();
    await assert.rejects(savePost(admin.id, values, upload()));
    assert.deepEqual(counts(), before);
    assert.equal(storedPost(id).cover_url, null);
  }
  await archiveContent(admin.id, { type: "post", id });
  const before = counts();
  await assert.rejects(savePost(admin.id, input({ id }), upload()));
  assert.deepEqual(counts(), before);
  assert.equal(storedPost(id).status, "ARCHIVED");
});

test("an image insert failure rolls back a new post and every audit entry", async () => {
  fixture.database.exec(`CREATE TRIGGER fail_cover_storage BEFORE INSERT ON post_images
    BEGIN SELECT RAISE(ABORT, 'synthetic storage failure'); END`);
  await assert.rejects(savePost(teacher.id, input(), upload()));
  assert.deepEqual(counts(), { posts: 0, post_images: 0, audit_logs: 0 });
});

test("an image insert failure restores the original post on an attempted edit", async () => {
  const id = await savePost(teacher.id, input({ cover_url: "https://images.example.test/original.jpg" }));
  const original = storedPost(id);
  const before = counts();
  fixture.database.exec(`CREATE TRIGGER fail_cover_storage BEFORE INSERT ON post_images
    BEGIN SELECT RAISE(ABORT, 'synthetic storage failure'); END`);
  await assert.rejects(savePost(teacher.id, input({ id, title: "Should roll back" }), upload()));
  assert.deepEqual(storedPost(id), original);
  assert.deepEqual(counts(), before);
});

test("an audit failure rolls back both device bytes and the post", async () => {
  fixture.database.exec(`CREATE TRIGGER fail_cover_audit BEFORE INSERT ON audit_logs
    BEGIN SELECT RAISE(ABORT, 'synthetic audit failure'); END`);
  await assert.rejects(savePost(teacher.id, input(), upload()));
  assert.deepEqual(counts(), { posts: 0, post_images: 0, audit_logs: 0 });
});

test("existing managed covers can be reused only inside their exact owning classroom", async () => {
  const foreignPost = await savePost(otherTeacher.id, input({ class_id: "cover-class-b", visibility: "PRIVATE" }), upload());
  const foreignUrl = storedPost(foreignPost).cover_url;
  const before = counts();
  for (const actor of [teacher, admin]) {
    await assert.rejects(savePost(actor.id, input({ cover_url: foreignUrl })));
    assert.deepEqual(counts(), before);
  }
  const ownPost = await savePost(teacher.id, input(), upload());
  const ownUrl = storedPost(ownPost).cover_url;
  const imagesBefore = counts().post_images;
  const reusedPost = await savePost(teacher.id, input({ cover_url: ownUrl, title: "Reused own class cover" }));
  assert.equal(storedPost(reusedPost).cover_url, ownUrl);
  assert.equal(counts().post_images, imagesBefore);
});

test("an unowned managed URL cannot create a post or replace an existing cover", async () => {
  const id = await savePost(admin.id, input({ cover_url: "https://images.example.test/existing.png" }));
  const original = storedPost(id);
  const before = counts();
  const missingUrl = postImageUrl("792211bf-a25f-4e75-9c07-50d0337520a9");
  await assert.rejects(savePost(admin.id, input({ cover_url: missingUrl })));
  await assert.rejects(savePost(admin.id, input({ id, cover_url: missingUrl })));
  assert.deepEqual(storedPost(id), original);
  assert.deepEqual(counts(), before);
});

test("external HTTPS covers remain unchanged and clearing a cover stores no image", async () => {
  const url = "https://images.example.test/class-photo.jpg?version=2#cover";
  const id = await savePost(teacher.id, input({ cover_url: url }));
  assert.equal(storedPost(id).cover_url, url);
  assert.equal(counts().post_images, 0);
  await savePost(teacher.id, input({ id, cover_url: "" }));
  assert.equal(storedPost(id).cover_url, null);
  assert.equal(counts().post_images, 0);
});

test("only canonical managed paths or safe HTTPS URLs pass the cover schema", () => {
  const valid = postImageUrl("792211bf-a25f-4e75-9c07-50d0337520a9");
  assert.equal(postSchema.safeParse(input({ cover_url: valid })).success, true);
  for (const cover_url of [
    `${valid}?download=1`, `${valid}#fragment`, `${valid}/extra`, valid.toUpperCase(),
    "/api/post-images/not-a-generated-id", "/images/other.png", "//images.example.test/cover.png",
    "data:image/png;base64,AA==", "blob:https://example.test/photo", "javascript:alert(1)",
    "http://images.example.test/photo.png", "https://username:password@images.example.test/photo.png",
  ]) assert.equal(postSchema.safeParse(input({ cover_url })).success, false, cover_url);
});

test("invalid post fields or invalid image pixels cannot create partial records", async () => {
  const unread = upload();
  let read = false;
  unread.arrayBuffer = async () => { read = true; throw new Error("Invalid post read pixels"); };
  await assert.rejects(savePost(teacher.id, input({ title: "" }), unread));
  assert.equal(read, false);
  await assert.rejects(savePost(teacher.id, input(), new File(["not an image"], "fake.jpg", { type: "image/jpeg" })));
  assert.deepEqual(counts(), { posts: 0, post_images: 0, audit_logs: 0 });
});

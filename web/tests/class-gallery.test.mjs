import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { afterEach, beforeEach, test } from "node:test";
import sharp from "sharp";
import {
  archiveGalleryAlbum, galleryImageUrl, getGalleryAlbum, getGalleryAlbums, getGalleryImage,
  getPublicGalleryAlbums, getTeacherGallery, removeGalleryPhoto, saveGalleryAlbum, uploadGalleryPhoto,
} from "../src/lib/class-gallery.ts";
import { galleryAlbumSchema } from "../src/lib/gallery-schemas.ts";
import { getPostImage } from "../src/lib/post-images.ts";
import { hashPassword } from "../src/lib/password.ts";
import { createD1Fixture, insertUser } from "./d1-fixture.mjs";

const require = createRequire(import.meta.url);
const authPath = require.resolve("next-auth"), cachePath = require.resolve("next/cache");
const realAuth = require("next-auth"), realCache = require("next/cache");
let requestSession = null, revalidations = [];
require.cache[authPath].exports = { ...realAuth, getServerSession: async () => requestSession };
require.cache[cachePath].exports = { ...realCache, revalidatePath: (...args) => revalidations.push(args) };
const actions = await import("../src/app/teacher/gallery-actions.ts");
const { GET: imageGET } = await import("../src/app/api/gallery-images/[id]/route.ts");
require.cache[authPath].exports = realAuth; require.cache[cachePath].exports = realCache;
const passwordHash = await hashPassword("Only-Synthetic-Gallery-Fixtures-2026!");
const jpeg = await sharp({ create: { width: 100, height: 50, channels: 3, background: "#4286a8" } })
  .jpeg().withMetadata({ orientation: 6 }).toBuffer();
let fixture, admin, teacher, otherTeacher;

beforeEach(() => {
  fixture = createD1Fixture(); requestSession = null; revalidations = [];
  admin = staff(); teacher = staff({ role: "TEACHER" }); otherTeacher = staff({ role: "TEACHER" });
  fixture.database.exec(`INSERT INTO academic_years (id, school_id, name, starts_on, ends_on)
    VALUES ('gallery-year', 'school-ben-tre', 'Synthetic gallery year', '2026-09-01', '2027-05-31')`);
  for (const id of ["gallery-class-a", "gallery-class-b"]) {
    fixture.database.prepare(`INSERT INTO classes (id, school_id, academic_year_id, name, slug, grade, created_by)
      VALUES (?, 'school-ben-tre', 'gallery-year', ?, ?, 4, ?)` ).run(id, id, id, admin.id);
  }
  fixture.database.prepare(`INSERT INTO class_teachers (class_id, user_id, assigned_by)
    VALUES ('gallery-class-a', ?, ?), ('gallery-class-b', ?, ?)` ).run(teacher.id, admin.id, otherTeacher.id, admin.id);
});
afterEach(() => fixture.restore());
function staff(options = {}) {
  const user = insertUser(fixture.database, { role: "SUPER_ADMIN", ...options });
  if (options.verified !== false) fixture.database.prepare("UPDATE users SET email_verified_at = '2026-10-18T00:00:00Z' WHERE id = ?").run(user.id);
  return user;
}
function albumInput(overrides = {}) { return { class_id: "gallery-class-a", title: "Synthetic class memories", description: "A fictional event.", ...overrides }; }
function uploadInput(albumId, overrides = {}) { return { class_id: "gallery-class-a", album_id: albumId, caption: "Synthetic classroom photo", client_upload_id: crypto.randomUUID(), ...overrides }; }
function file() { return new File([jpeg], "synthetic.jpg", { type: "image/jpeg" }); }
function counts() { return Object.fromEntries(["albums", "media_assets", "gallery_images", "photos", "audit_logs"].map((table) => [table, fixture.database.prepare(`SELECT count(*) AS n FROM ${table}`).get().n])); }
function family(id = "gallery-family-a", classId = "gallery-class-a") {
  const phone = id.endsWith("a") ? "0900000001" : "0900000002";
  fixture.database.prepare(`INSERT INTO student_accounts (id, phone, password_hash, must_change_password) VALUES (?, ?, ?, 0)` ).run(id, phone, passwordHash);
  fixture.database.prepare("INSERT INTO students (id, school_id, full_name) VALUES (?, 'school-ben-tre', ?)").run(`${id}-pupil`, `Synthetic ${id}`);
  fixture.database.prepare("INSERT INTO student_account_students (account_id, student_id) VALUES (?, ?)").run(id, `${id}-pupil`);
  fixture.database.prepare(`INSERT INTO student_enrollments (id, student_id, class_id, school_id, academic_year_id, enrolled_on)
    VALUES (?, ?, ?, 'school-ben-tre', 'gallery-year', '2026-09-01')`).run(`${id}-enrollment`, `${id}-pupil`, classId);
  return { studentAccountId: id, studentSessionVersion: 1 };
}
function form(input, image) { const result = new FormData(); for (const [key, value] of Object.entries(input)) result.set(key, value); if (image) result.set("image", image); return result; }
const initial = { success: false, message: "" };

test("albums default to private and never expose pupil/account data", async () => {
  family(); const id = await saveGalleryAlbum(teacher.id, albumInput());
  assert.equal((await getTeacherGallery(teacher.id, "gallery-class-a")).albums[0].visibility, "PRIVATE");
  assert.deepEqual(await getPublicGalleryAlbums(), []); assert.deepEqual(await getGalleryAlbums(), []);
  assert.equal(await getGalleryAlbum(id), null);
  const own = await getGalleryAlbum(id, { staffId: teacher.id });
  assert.equal(own.album.description, "A fictional event."); assert.deepEqual(own.photos, []);
  const serialized = JSON.stringify(own);
  for (const secret of ["0900000001", "Synthetic gallery-family-a", "password_hash", "uploaded_by", "created_by"]) assert.equal(serialized.includes(secret), false);
});

test("device upload atomically saves oriented WebP pixels, metadata, photo and audit", async () => {
  const albumId = await saveGalleryAlbum(teacher.id, albumInput());
  const input = uploadInput(albumId); const id = await uploadGalleryPhoto(teacher.id, input, file());
  assert.equal(id, input.client_upload_id);
  assert.deepEqual(counts(), { albums: 1, media_assets: 1, gallery_images: 1, photos: 1, audit_logs: 2 });
  const image = await getGalleryImage(id, { staffId: teacher.id });
  const metadata = await sharp(image.bytes).metadata();
  assert.equal(metadata.format, "webp"); assert.deepEqual([metadata.width, metadata.height], [50, 100]);
  assert.equal(metadata.exif, undefined); assert.equal(metadata.orientation, undefined);
  const result = await getGalleryAlbum(albumId, { staffId: teacher.id });
  assert.equal(result.album.cover_url, galleryImageUrl(id)); assert.equal(result.album.photo_count, 1);
  assert.equal(result.photos[0].url, galleryImageUrl(id));
  assert.equal(JSON.stringify(result).includes("data_base64"), false);
  assert.equal(await getGalleryImage(id), null); assert.equal(await getPostImage(id, { staffId: teacher.id }), null);
  assert.ok(fixture.requests.every(({ params = [] }) => params.length <= 100));
  assert.ok(fixture.requests.every((item) => JSON.stringify(item).length < 1024 * 1024));
});

test("only an explicit public album publishes photos even when its class remains private", async () => {
  const id = await saveGalleryAlbum(teacher.id, albumInput({ visibility: "PUBLIC" }));
  const photo = await uploadGalleryPhoto(teacher.id, uploadInput(id), file());
  assert.equal((await getPublicGalleryAlbums())[0].id, id); assert.ok(await getGalleryImage(photo));
  await saveGalleryAlbum(teacher.id, albumInput({ id, visibility: "PRIVATE" }));
  assert.deepEqual(await getPublicGalleryAlbums(), []); assert.equal(await getGalleryAlbum(id), null);
  assert.equal(await getGalleryImage(photo), null); assert.ok(await getGalleryImage(photo, { staffId: teacher.id }));
});

test("private album reads and bytes require live own-class membership and current changed-password session", async () => {
  const own = family(), other = family("gallery-family-b", "gallery-class-b");
  const id = await saveGalleryAlbum(teacher.id, albumInput());
  const photo = await uploadGalleryPhoto(teacher.id, uploadInput(id), file());
  assert.equal((await getGalleryAlbums(own)).length, 1); assert.ok(await getGalleryImage(photo, own));
  for (const identity of [other, { ...own, studentSessionVersion: 2 }, { studentAccountId: own.studentAccountId, studentSessionVersion: 0 }]) {
    assert.equal(await getGalleryAlbum(id, identity), null); assert.equal(await getGalleryImage(photo, identity), null);
  }
  for (const [table, sql] of [
    ["student_accounts", "must_change_password = 1"], ["student_accounts", "status = 'SUSPENDED'"],
    ["student_enrollments", "status = 'TRANSFERRED', ended_on = '2026-10-18'"], ["students", "archived_at = '2026-10-18'"],
  ]) {
    const original = fixture.database.prepare(`SELECT * FROM ${table} LIMIT 1`).get();
    fixture.database.exec(`UPDATE ${table} SET ${sql}`);
    assert.equal(await getGalleryAlbum(id, own), null); assert.equal(await getGalleryImage(photo, own), null);
    if (table === "student_accounts") fixture.database.prepare("UPDATE student_accounts SET must_change_password = ?, status = ?").run(original.must_change_password, original.status);
    else if (table === "student_enrollments") fixture.database.exec("UPDATE student_enrollments SET status = 'ACTIVE', ended_on = NULL");
    else fixture.database.exec("UPDATE students SET archived_at = NULL");
  }
});

test("unassigned, suspended, unverified and revoked staff cannot edit or read private photos", async () => {
  const id = await saveGalleryAlbum(teacher.id, albumInput()); const photo = await uploadGalleryPhoto(teacher.id, uploadInput(id), file());
  const actors = [otherTeacher, staff({ role: "PENDING" }), staff({ role: "SUPER_ADMIN", verified: false }), staff({ role: "SUPER_ADMIN", status: "SUSPENDED" })];
  for (const actor of actors) {
    const before = counts(); let read = false; const image = file(); image.arrayBuffer = async () => { read = true; throw Error("Unauthorized bytes"); };
    await assert.rejects(uploadGalleryPhoto(actor.id, uploadInput(id), image)); assert.equal(read, false);
    await assert.rejects(saveGalleryAlbum(actor.id, albumInput({ id, title: "Cannot edit" })));
    await assert.rejects(archiveGalleryAlbum(actor.id, { class_id: "gallery-class-a", id }));
    await assert.rejects(removeGalleryPhoto(actor.id, { class_id: "gallery-class-a", album_id: id, id: photo }));
    assert.deepEqual(await getTeacherGallery(actor.id, "gallery-class-a"), { albums: [], photos: [] });
    assert.equal(await getGalleryImage(photo, { staffId: actor.id }), null); assert.deepEqual(counts(), before);
  }
  fixture.database.prepare("UPDATE class_teachers SET ended_at = '2026-10-18' WHERE user_id = ?").run(teacher.id);
  assert.equal(await getGalleryAlbum(id, { staffId: teacher.id }), null); assert.equal(await getGalleryImage(photo, { staffId: teacher.id }), null);
});

test("losing assignment while the image is decoded creates no metadata, pixels, photo or audit", async () => {
  const id = await saveGalleryAlbum(teacher.id, albumInput()); const before = counts();
  const image = file(), read = image.arrayBuffer.bind(image);
  image.arrayBuffer = async () => { fixture.database.prepare("UPDATE class_teachers SET ended_at = '2026-10-18' WHERE user_id = ?").run(teacher.id); return read(); };
  await assert.rejects(uploadGalleryPhoto(teacher.id, uploadInput(id), image)); assert.deepEqual(counts(), before);
});

test("archived class, school and album prevent reads and all subsequent uploads", async () => {
  const id = await saveGalleryAlbum(admin.id, albumInput({ visibility: "PUBLIC" }));
  const photo = await uploadGalleryPhoto(admin.id, uploadInput(id), file());
  for (const table of ["classes", "schools", "albums"]) {
    const before = counts(); fixture.database.exec(`UPDATE ${table} SET archived_at = '2026-10-18'`);
    assert.equal(await getGalleryAlbum(id, { staffId: admin.id }), null); assert.equal(await getGalleryImage(photo, { staffId: admin.id }), null);
    assert.deepEqual(await getPublicGalleryAlbums(), []); await assert.rejects(uploadGalleryPhoto(admin.id, uploadInput(id), file())); assert.deepEqual(counts(), before);
    fixture.database.exec(`UPDATE ${table} SET archived_at = NULL`);
  }
});

test("cross-class album/photo edits and uploads cannot move or create records", async () => {
  const id = await saveGalleryAlbum(admin.id, albumInput()); const photo = await uploadGalleryPhoto(admin.id, uploadInput(id), file());
  const before = counts();
  await assert.rejects(saveGalleryAlbum(admin.id, albumInput({ id, class_id: "gallery-class-b" })));
  await assert.rejects(uploadGalleryPhoto(admin.id, uploadInput(id, { class_id: "gallery-class-b" }), file()));
  await assert.rejects(removeGalleryPhoto(admin.id, { class_id: "gallery-class-b", album_id: id, id: photo }));
  await assert.rejects(archiveGalleryAlbum(admin.id, { class_id: "gallery-class-b", id }));
  assert.deepEqual(counts(), before);
});

test("bad files cannot leave orphan metadata or gallery rows", async () => {
  const id = await saveGalleryAlbum(teacher.id, albumInput()); const before = counts();
  for (const image of [new File([], "empty.jpg", { type: "image/jpeg" }), new File(["<svg/>"] , "wrong.jpg", { type: "image/jpeg" }),
    new File([jpeg], "wrong.png", { type: "image/png" }), new File([new Uint8Array(700 * 1024 + 1)], "big.jpg", { type: "image/jpeg" })]) {
    await assert.rejects(uploadGalleryPhoto(teacher.id, uploadInput(id), image)); assert.deepEqual(counts(), before);
  }
});

test("image/photo/audit failures roll back the whole upload and album timestamp", async () => {
  const id = await saveGalleryAlbum(teacher.id, albumInput());
  for (const table of ["gallery_images", "photos", "audit_logs"]) {
    const before = counts(), timestamp = fixture.database.prepare("SELECT updated_at FROM albums WHERE id = ?").get(id).updated_at;
    fixture.database.exec(`CREATE TEMP TRIGGER fail_gallery_write BEFORE INSERT ON ${table} BEGIN SELECT RAISE(ABORT, 'PRIVATE_GALLERY_SQL_DETAIL'); END`);
    await assert.rejects(uploadGalleryPhoto(teacher.id, uploadInput(id), file())); assert.deepEqual(counts(), before);
    assert.equal(fixture.database.prepare("SELECT updated_at FROM albums WHERE id = ?").get(id).updated_at, timestamp);
    fixture.database.exec("DROP TRIGGER fail_gallery_write");
  }
});

test("a retry after a committed response is lost keeps one photo and one upload audit", async () => {
  const id = await saveGalleryAlbum(teacher.id, albumInput()); const input = uploadInput(id);
  const fetch = globalThis.fetch; let lost = false;
  globalThis.fetch = async (...args) => {
    const response = await fetch(...args);
    if (Array.isArray(JSON.parse(args[1].body)) && !lost) { lost = true; throw new Error("Synthetic lost response after commit"); }
    return response;
  };
  await assert.rejects(uploadGalleryPhoto(teacher.id, input, file())); assert.equal(lost, true);
  globalThis.fetch = fetch;
  const before = counts(); assert.equal(await uploadGalleryPhoto(teacher.id, input, file()), input.client_upload_id);
  assert.deepEqual(counts(), before); assert.equal(before.photos, 1); assert.equal(before.audit_logs, 2);
});

test("a reused upload key cannot change its caption, album, actor, image or restore hidden photo", async () => {
  const id = await saveGalleryAlbum(teacher.id, albumInput()); const second = await saveGalleryAlbum(teacher.id, albumInput({ title: "Another event" }));
  const input = uploadInput(id); const photo = await uploadGalleryPhoto(teacher.id, input, file()); const before = counts();
  for (const changed of [{ caption: "Different" }, { album_id: second }]) await assert.rejects(uploadGalleryPhoto(teacher.id, { ...input, ...changed }, file()));
  await assert.rejects(uploadGalleryPhoto(admin.id, input, file()));
  const otherBytes = await sharp({ create: { width: 40, height: 40, channels: 3, background: "#ff0000" } }).jpeg().toBuffer();
  await assert.rejects(uploadGalleryPhoto(teacher.id, input, new File([otherBytes], "other.jpg", { type: "image/jpeg" })));
  assert.deepEqual(counts(), before);
  await removeGalleryPhoto(teacher.id, { class_id: "gallery-class-a", album_id: id, id: photo });
  await assert.rejects(uploadGalleryPhoto(teacher.id, input, file()));
  assert.equal((await getGalleryAlbum(id, { staffId: teacher.id })).album.photo_count, 0);
});

test("hiding a photo or archiving an album immediately removes bytes and retains audit history", async () => {
  const id = await saveGalleryAlbum(teacher.id, albumInput({ visibility: "PUBLIC" })); const input = uploadInput(id);
  const photo = await uploadGalleryPhoto(teacher.id, input, file());
  await removeGalleryPhoto(teacher.id, { class_id: "gallery-class-a", album_id: id, id: photo });
  assert.equal(await getGalleryImage(photo), null); assert.equal(await getGalleryImage(photo, { staffId: teacher.id }), null);
  assert.equal((await getGalleryAlbum(id)).photos.length, 0);
  await archiveGalleryAlbum(teacher.id, { class_id: "gallery-class-a", id });
  assert.equal(await getGalleryAlbum(id, { staffId: teacher.id }), null); assert.deepEqual(await getPublicGalleryAlbums(), []);
  assert.equal(counts().photos, 1); assert.equal(counts().gallery_images, 1); assert.equal(counts().audit_logs, 4);
  assert.deepEqual(fixture.database.prepare("PRAGMA foreign_key_check").all(), []);
});

test("album edits and archive/photo hides roll back if their audit fails", async () => {
  const id = await saveGalleryAlbum(teacher.id, albumInput({ visibility: "PUBLIC" })); const photo = await uploadGalleryPhoto(teacher.id, uploadInput(id), file());
  fixture.database.exec("CREATE TEMP TRIGGER fail_gallery_audit BEFORE INSERT ON audit_logs BEGIN SELECT RAISE(ABORT, 'SECRET'); END");
  await assert.rejects(saveGalleryAlbum(teacher.id, albumInput({ id, visibility: "PRIVATE" })));
  await assert.rejects(archiveGalleryAlbum(teacher.id, { class_id: "gallery-class-a", id }));
  await assert.rejects(removeGalleryPhoto(teacher.id, { class_id: "gallery-class-a", album_id: id, id: photo }));
  assert.ok(await getGalleryImage(photo)); assert.equal((await getGalleryAlbum(id)).album.visibility, "PUBLIC");
  assert.equal(counts().audit_logs, 2);
});

test("read projections remain bounded and page metadata never includes stored pixels", async () => {
  const id = await saveGalleryAlbum(teacher.id, albumInput({ visibility: "PUBLIC" }));
  const first = await uploadGalleryPhoto(teacher.id, uploadInput(id), file());
  for (let i = 1; i < 65; i++) {
    const cloned = crypto.randomUUID();
    fixture.database.prepare(`INSERT INTO media_assets (id, class_id, uploaded_by, url, mime_type, width, height)
      SELECT ?, class_id, uploaded_by, ?, mime_type, width, height FROM media_assets WHERE id = ?`).run(cloned, galleryImageUrl(cloned), first);
    fixture.database.prepare(`INSERT INTO gallery_images (asset_id, class_id, content_type, byte_size, width, height, sha256, data_base64)
      SELECT ?, class_id, content_type, byte_size, width, height, sha256, data_base64 FROM gallery_images WHERE asset_id = ?`).run(cloned, first);
    fixture.database.prepare(`INSERT INTO photos (id, class_id, album_id, asset_id, caption, sort_order, added_by)
      VALUES (?, 'gallery-class-a', ?, ?, ?, ?, ?)` ).run(cloned, id, cloned, `Synthetic ${i}`, i, teacher.id);
  }
  const page = await getGalleryAlbum(id);
  assert.equal(page.album.photo_count, 65); assert.equal(page.photos.length, 60); assert.equal(page.hasMore, true); assert.equal(page.nextOffset, 60);
  const next = await getGalleryAlbum(id, {}, page.nextOffset);
  assert.equal(next.photos.length, 5); assert.equal(next.hasMore, false); assert.equal(next.nextOffset, null);
  assert.equal(new Set([...page.photos, ...next.photos].map((photo) => photo.id)).size, 65);
  assert.equal((await getTeacherGallery(teacher.id, "gallery-class-a")).photos.length, 60);
  assert.equal(JSON.stringify(page).includes("data_base64"), false);
  for (let i = 0; i < 102; i++) await saveGalleryAlbum(teacher.id, albumInput({ title: `Synthetic album ${i}`, visibility: "PUBLIC" }));
  assert.equal((await getPublicGalleryAlbums(500)).length, 100); assert.equal((await getGalleryAlbums({ staffId: teacher.id })).length, 100);
});

test("invalid identifiers and dates are rejected before SQL, and fractional offsets return no page", async () => {
  const before = fixture.requests.length;
  assert.equal(await getGalleryAlbum("../../secrets"), null); assert.equal(await getGalleryImage("bad-id"), null);
  assert.equal(await getGalleryAlbum("gallery", {}, -1), null); assert.equal(await getGalleryAlbum("gallery", {}, 0.5), null);
  assert.deepEqual(await getGalleryAlbums({}, "../../class"), []); assert.equal(fixture.requests.length, before);
  for (const overrides of [{ event_date: "2026-02-29" }, { event_date: "2026-10-32" }, { title: "  " }, { visibility: "ALL" }, { actor_id: admin.id }]) {
    assert.equal(galleryAlbumSchema.safeParse(albumInput(overrides)).success, false);
    await assert.rejects(saveGalleryAlbum(teacher.id, albumInput(overrides)));
  }
});

test("image routes use live identity and private no-store headers including denied responses", async () => {
  const id = await saveGalleryAlbum(teacher.id, albumInput()); const photo = await uploadGalleryPhoto(teacher.id, uploadInput(id), file());
  const context = { params: Promise.resolve({ id: photo }) };
  let response = await imageGET(new Request("https://example.test/"), context); assert.equal(response.status, 404);
  assert.match(response.headers.get("Cache-Control"), /private, no-store/); assert.equal(response.headers.get("Vary"), "Cookie");
  requestSession = { user: { id: teacher.id } }; response = await imageGET(new Request("https://example.test/"), context);
  assert.equal(response.status, 200); assert.equal(response.headers.get("Content-Type"), "image/webp");
  assert.equal(response.headers.get("X-Content-Type-Options"), "nosniff");
  requestSession = { user: { id: admin.id, kind: "student", studentAccountId: "missing", studentSessionVersion: 1 } };
  assert.equal((await imageGET(new Request("https://example.test/"), context)).status, 404);
});

test("gallery actions reject unauthenticated, duplicate, unknown and unconfirmed form fields", async () => {
  assert.equal((await actions.saveAlbumAction(initial, form(albumInput()))).success, false);
  requestSession = { user: { id: admin.id, kind: "student" } };
  assert.equal((await actions.saveAlbumAction(initial, form(albumInput()))).success, false);
  requestSession = { user: { id: teacher.id } };
  const duplicate = form(albumInput()); duplicate.append("class_id", "gallery-class-b");
  const unknown = form({ ...albumInput(), actor_id: admin.id });
  for (const bad of [duplicate, unknown]) assert.equal((await actions.saveAlbumAction(initial, bad)).success, false);
  assert.deepEqual(counts(), { albums: 0, media_assets: 0, gallery_images: 0, photos: 0, audit_logs: 0 }); assert.deepEqual(revalidations, []);
  const id = await saveGalleryAlbum(teacher.id, albumInput());
  assert.equal((await actions.archiveGalleryAlbumAction(initial, form({ class_id: "gallery-class-a", id }))).success, false);
  assert.equal((await actions.uploadGalleryPhotoAction(initial, form(uploadInput(id)))).success, false);
});

test("actions acknowledge committed writes and do not disclose SQL errors", async () => {
  requestSession = { user: { id: teacher.id } };
  const result = await actions.saveAlbumAction(initial, form(albumInput())); assert.equal(result.success, true); assert.ok(result.album_id);
  const photoInput = uploadInput(result.album_id), upload = await actions.uploadGalleryPhotoAction(initial, form(photoInput, file()));
  assert.equal(upload.success, true); assert.equal(upload.album_id, result.album_id);
  assert.ok(revalidations.some(([path]) => path === "/thu-vien-anh"));
  fixture.database.exec("CREATE TEMP TRIGGER fail_gallery_action BEFORE INSERT ON audit_logs BEGIN SELECT RAISE(ABORT, 'PRIVATE_GALLERY_SQL'); END");
  const before = counts(), failed = await actions.uploadGalleryPhotoAction(initial, form(uploadInput(result.album_id), file()));
  assert.equal(failed.success, false); assert.equal(failed.message.includes("PRIVATE_GALLERY_SQL"), false); assert.deepEqual(counts(), before);
});

import assert from "node:assert/strict";
import { test } from "node:test";
import sharp from "sharp";
import { buildParentLoginSlip, STUDENT_LOGIN_URL } from "../src/lib/parent-login-slip.ts";

const now = Date.parse("2026-11-23T03:34:00.000Z");
const fixture = {
  names: ["Học sinh mẫu A", "Học sinh mẫu B"],
  classroomName: "Lớp Bốn 12",
  schoolName: "Trường Tiểu học Bến Tre",
  phone: "0900000042",
  temporaryPassword: "03752091",
  expiresAt: "2026-11-24T03:34:00.000Z",
};

test("a parent slip keeps the initial zero, includes the local deadline, and is exportable as a PNG", async () => {
  const { svg, filename } = buildParentLoginSlip(fixture, now);
  assert.equal(filename, "phieu-dang-nhap-0042.png");
  for (const label of [fixture.phone, fixture.temporaryPassword, ...fixture.names, "10:34", "24/11/2026", new URL(STUDENT_LOGIN_URL).host]) {
    assert(svg.includes(label));
  }
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  const metadata = await sharp(png).metadata();
  assert.equal(metadata.format, "png");
  assert.equal(metadata.width, 1000);
  assert(metadata.height > 750);
});

test("the downloaded slip contains only the selected account and treats profile names as text", () => {
  const other = { ...fixture, phone: "0900000043", temporaryPassword: "83750400", names: ["<Nhóm C> & Học sinh mẫu C"] };
  const { svg, filename } = buildParentLoginSlip(other, now);
  assert.equal(filename, "phieu-dang-nhap-0043.png");
  assert(svg.includes("&lt;Nhóm C&gt;"));
  assert(svg.includes("&amp;"));
  assert(!/<script|<image|<a\s/.test(svg));
  for (const privateValue of [fixture.phone, fixture.temporaryPassword, ...fixture.names]) {
    assert(!svg.includes(privateValue));
  }
});

test("expired or malformed temporary credentials cannot generate a login slip", () => {
  assert.throws(() => buildParentLoginSlip(fixture, Date.parse(fixture.expiresAt)), /hết hạn/);
  assert.throws(() => buildParentLoginSlip({ ...fixture, expiresAt: "không có hạn" }, now), /hết hạn/);
  assert.throws(() => buildParentLoginSlip({ ...fixture, temporaryPassword: "3752091" }, now), /không hợp lệ/);
});

import "server-only";
import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

const SCRYPT_N = 16_384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_BYTES = 64;
const MAX_MEMORY_BYTES = 64 * 1024 * 1024;
const HASH_PATTERN = /^scrypt\$16384\$8\$1\$((?:[a-f0-9]{2}){16,64})\$([a-f0-9]{128})$/;

function isValidPassword(password: string): boolean {
  return typeof password === "string" && password.length >= 1 && password.length <= 128;
}

function deriveKey(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, KEY_BYTES, {
      N: SCRYPT_N,
      r: SCRYPT_R,
      p: SCRYPT_P,
      maxmem: MAX_MEMORY_BYTES,
    }, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}

export async function hashPassword(password: string): Promise<string> {
  if (!isValidPassword(password)) {
    throw new RangeError("Mật khẩu phải có từ 1 đến 128 ký tự.");
  }
  const salt = randomBytes(16);
  const key = await deriveKey(password, salt);
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt.toString("hex")}$${key.toString("hex")}`;
}

export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  if (!isValidPassword(password) || typeof encoded !== "string") return false;
  const parsed = HASH_PATTERN.exec(encoded);
  if (!parsed || parsed[0] !== encoded) return false;
  const salt = Buffer.from(parsed[1], "hex");
  const expected = Buffer.from(parsed[2], "hex");
  const actual = await deriveKey(password, salt);
  return timingSafeEqual(actual, expected);
}

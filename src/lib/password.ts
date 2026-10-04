import "server-only";
import crypto from "node:crypto";

// Stored as "scrypt$<salt>$<hash>" (hex). scrypt is slow on purpose, so guessing is expensive.
const KEYLEN = 64;

export function hashPassword(password: string) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, KEYLEN).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(password: string, stored: string) {
  const [scheme, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const given = crypto.scryptSync(password, salt, KEYLEN);
  const expected = Buffer.from(hash, "hex");
  return expected.length === given.length && crypto.timingSafeEqual(expected, given);
}

export function passwordProblem(password: string) {
  if (password.length < 8) return "Use at least 8 characters.";
  if (password.length > 200) return "That's too long.";
  return "";
}

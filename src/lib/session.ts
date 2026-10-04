// Sessions: an HMAC-signed cookie "<expiry>.<signature>". The signing secret lives in
// data/session-secret on this computer (never in backups or git); replacing it signs everyone out.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export const SESSION_COOKIE = "session";
export const SESSION_DAYS = 30;

const SECRET_FILE = path.join(process.cwd(), "data", "session-secret");

function readSecret(): string {
  try {
    return fs.readFileSync(SECRET_FILE, "utf8").trim();
  } catch {
    fs.mkdirSync(path.dirname(SECRET_FILE), { recursive: true });
    const secret = crypto.randomBytes(32).toString("hex");
    try {
      fs.writeFileSync(SECRET_FILE, secret, { flag: "wx" }); // don't overwrite one created meanwhile
      return secret;
    } catch {
      return fs.readFileSync(SECRET_FILE, "utf8").trim();
    }
  }
}

/** New secret: every existing session stops working (used when the password changes). */
export function rotateSecret() {
  fs.mkdirSync(path.dirname(SECRET_FILE), { recursive: true });
  fs.writeFileSync(SECRET_FILE, crypto.randomBytes(32).toString("hex"));
}

const sign = (payload: string, secret: string) => crypto.createHmac("sha256", secret).update(payload).digest("base64url");

export function createSessionToken(days = SESSION_DAYS) {
  const exp = Math.floor(Date.now() / 1000) + days * 86400;
  return `${exp}.${sign(`v1.${exp}`, readSecret())}`;
}

export function isValidSession(token: string | undefined) {
  if (!token) return false;
  const [expStr, sig] = token.split(".");
  const exp = Number(expStr);
  if (!exp || !sig || exp < Math.floor(Date.now() / 1000)) return false;
  const expected = Buffer.from(sign(`v1.${exp}`, readSecret()));
  const given = Buffer.from(sig);
  return expected.length === given.length && crypto.timingSafeEqual(expected, given);
}

/** Requests arriving through Cloudflare (the online address) carry this header; local ones don't. */
export function isRemoteRequest(headers: Headers) {
  return headers.has("cf-connecting-ip");
}

export function cookieOptions(headers: Headers) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    // Secure over HTTPS (the Cloudflare address); plain HTTP on the shop network still works.
    secure: headers.get("x-forwarded-proto") === "https",
    path: "/",
    maxAge: SESSION_DAYS * 86400,
  };
}

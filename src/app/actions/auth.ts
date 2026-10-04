"use server";

import { eq } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { settings } from "@/db/schema";
import type { FormState } from "@/lib/form-state";
import { hashPassword, passwordProblem, verifyPassword } from "@/lib/password";
import { cookieOptions, createSessionToken, isRemoteRequest, rotateSecret, SESSION_COOKIE } from "@/lib/session";

const currentHash = () => db.select({ h: settings.ownerPasswordHash }).from(settings).where(eq(settings.id, 1)).get()?.h ?? "";

// Only same-site paths after sign-in (no "//evil.com" redirects).
const safeNext = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "");
  return s.startsWith("/") && !s.startsWith("//") ? s : "/";
};

async function startSession() {
  const h = await headers();
  (await cookies()).set(SESSION_COOKIE, createSessionToken(), cookieOptions(h));
}

/** Turn on sign-in by creating the store password (Settings). Only on the shop computer/network, never online. */
export async function setupPassword(_prev: FormState, fd: FormData): Promise<FormState> {
  if (isRemoteRequest(await headers())) return { error: "Set the password on the shop computer first." };
  if (currentHash()) return { error: "A password is already set. Sign in instead." };
  const password = String(fd.get("password") ?? "");
  const problem = passwordProblem(password);
  if (problem) return { error: problem };
  if (password !== String(fd.get("confirm") ?? "")) return { error: "The two passwords don't match." };
  db.update(settings).set({ ownerPasswordHash: hashPassword(password) }).where(eq(settings.id, 1)).run();
  rotateSecret();
  await startSession();
  // The page re-renders with the change-password form, so confirm with a banner.
  redirect("/settings?signin=on");
}

// Slow down guessing: 8 wrong passwords from one address locks it out for 15 minutes.
const attempts = (globalThis as unknown as { __loginAttempts?: Map<string, { n: number; until: number }> }).__loginAttempts ??
  new Map<string, { n: number; until: number }>();
(globalThis as unknown as { __loginAttempts?: typeof attempts }).__loginAttempts = attempts;

export async function login(_prev: FormState, fd: FormData): Promise<FormState> {
  const h = await headers();
  const who = h.get("cf-connecting-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const now = Date.now();
  const a = attempts.get(who);
  if (a && a.n >= 8 && a.until > now) {
    return { error: `Too many wrong passwords. Try again in ${Math.ceil((a.until - now) / 60000)} minutes.` };
  }
  const stored = currentHash();
  if (!stored) redirect("/setup");
  if (!verifyPassword(String(fd.get("password") ?? ""), stored)) {
    const n = a && a.until > now ? a.n + 1 : 1;
    attempts.set(who, { n, until: now + 15 * 60000 });
    return { error: "Wrong password." };
  }
  attempts.delete(who);
  await startSession();
  redirect(safeNext(fd.get("next")));
}

export async function logout() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}

/** Change the password; every other signed-in device is signed out. */
export async function changePassword(_prev: FormState, fd: FormData): Promise<FormState> {
  const stored = currentHash();
  if (!stored || !verifyPassword(String(fd.get("current") ?? ""), stored)) return { error: "Current password is wrong." };
  const password = String(fd.get("password") ?? "");
  const problem = passwordProblem(password);
  if (problem) return { error: problem };
  if (password !== String(fd.get("confirm") ?? "")) return { error: "The new passwords don't match." };
  db.update(settings).set({ ownerPasswordHash: hashPassword(password) }).where(eq(settings.id, 1)).run();
  rotateSecret();
  await startSession(); // keep this device signed in
  return { ok: "Password changed. Other devices have been signed out." };
}

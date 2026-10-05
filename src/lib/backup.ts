// Backup ZIPs, made and restored entirely in the browser. Same format as the desktop app,
// so backups move freely between devices and versions:
//   backup/database.sqlite   the database (without the files table's bytes, which go below)
//   backup/manifest.json     metadata, row counts and a SHA-256 for every file
//   backup/images/           product images
//   backup/documents/        documents
import { unzipSync, zipSync, type Zippable } from "fflate";
import type { Database } from "sql.js";
import { exportBytes, openScratch, rawDb, replaceDatabase, save } from "@/db";
import migrations from "@/db/migrations.json";
import { idbGet, idbSet } from "./idb";
import pkg from "../../package.json";

const FORMAT = "business-backup";
const FORMAT_VERSION = 1;
const MAX_UNZIPPED_BYTES = 1024 ** 3;
const TABLES = ["products", "customers", "sales", "sale_items", "inventory_movements", "settings"] as const;
const REQUIRED_TABLES = [...TABLES, "__drizzle_migrations"];
const SAFETY_KEY = "safety-backups";
const SAFETY_KEEP = 3;

export type Counts = Record<(typeof TABLES)[number], number>;

export type Manifest = {
  format: typeof FORMAT;
  formatVersion: number;
  createdAt: string;
  appVersion: string;
  schemaVersion: number; // `when` of the newest migration the database has applied
  sourceComputer: string;
  businessName: string;
  database: { file: "database.sqlite"; size: number; sha256: string };
  counts: Counts;
  files: { path: string; size: number; sha256: string }[];
};

export type BackupInfo = {
  token: string;
  manifest: Manifest;
  totalBytes: number;
  imageCount: number;
  documentCount: number;
  warnings: string[];
  current: { businessName: string; counts: Counts };
};

export type Check = { label: string; ok: boolean; detail?: string };

export type SafetyBackup = { name: string; createdAt: string; data: Uint8Array };

export class BackupError extends Error {}

// ---------- helpers ----------

async function sha256(data: Uint8Array) {
  const hash = await crypto.subtle.digest("SHA-256", data as BufferSource);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function localStamp(d = new Date(), withTime = false) {
  const p = (n: number) => String(n).padStart(2, "0");
  const date = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  return withTime ? `${date}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}` : date;
}

const latestMigration = () => (migrations as { folderMillis: number }[]).at(-1)!.folderMillis;

/** "Chrome on Windows", "Safari on iPhone", ... for the manifest's "from" line. */
function deviceName() {
  const ua = navigator.userAgent;
  const browser = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Browser";
  const os = /iPhone/.test(ua) ? "iPhone" : /iPad/.test(ua) ? "iPad" : /Android/.test(ua) ? "Android" : /Windows/.test(ua) ? "Windows" : /Mac OS/.test(ua) ? "Mac" : /Linux/.test(ua) ? "Linux" : "device";
  return `${browser} on ${os}`;
}

const one = <T>(conn: Database, sql: string): T | undefined => {
  const r = conn.exec(sql)[0];
  return r ? (Object.fromEntries(r.columns.map((c, i) => [c, r.values[0][i]])) as T) : undefined;
};

function readCounts(conn: Database): Counts {
  return Object.fromEntries(TABLES.map((t) => [t, one<{ n: number }>(conn, `select count(*) as n from "${t}"`)!.n])) as Counts;
}

const businessNameOf = (conn: Database) =>
  one<{ b: string }>(conn, "select business_name as b from settings where id = 1")?.b ?? "";

const hasTable = (conn: Database, name: string) =>
  !!one(conn, `select 1 as x from sqlite_master where type = 'table' and name = '${name}'`);

/** Rejects absolute paths, "..", and anything outside images/ or documents/. */
function safeEntryPath(p: string) {
  if (p.includes("\\") || p.startsWith("/") || p.split("/").some((s) => s === "" || s === "." || s === "..")) return false;
  if (p.startsWith("images/")) return p.split("/").length === 2; // images are stored flat
  return p.startsWith("documents/");
}

const TYPES: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif", svg: "image/svg+xml" };
const typeOf = (name: string) => TYPES[name.split(".").pop()!.toLowerCase()] ?? "application/octet-stream";

// ---------- export ----------

export async function createBackup(): Promise<{ data: Uint8Array; filename: string; manifest: Manifest }> {
  const snap = await openScratch(exportBytes());
  try {
    const counts = readCounts(snap);
    const businessName = businessNameOf(snap);
    const schemaVersion = one<{ v: number }>(snap, "select max(created_at) as v from __drizzle_migrations")?.v ?? 0;

    const entries: Zippable = { "backup/images/": new Uint8Array(0), "backup/documents/": new Uint8Array(0) };
    const files: Manifest["files"] = [];
    // Stored files go into the ZIP as real files (like the desktop app), not inside the database.
    const stmt = snap.prepare("select name, data from files order by name");
    while (stmt.step()) {
      const [name, data] = stmt.get() as [string, Uint8Array];
      const p = name.startsWith("documents/") ? name : `images/${name}`;
      files.push({ path: p, size: data.length, sha256: await sha256(data) });
      // Images are already compressed; storing them is faster and no bigger.
      entries[`backup/${p}`] = p.startsWith("images/") ? [data, { level: 0 }] : data;
    }
    stmt.free();
    snap.run("delete from files");
    snap.run("vacuum");
    const dbBytes = snap.export();

    const manifest: Manifest = {
      format: FORMAT,
      formatVersion: FORMAT_VERSION,
      createdAt: new Date().toISOString(),
      appVersion: pkg.version,
      schemaVersion,
      sourceComputer: deviceName(),
      businessName,
      database: { file: "database.sqlite", size: dbBytes.length, sha256: await sha256(dbBytes) },
      counts,
      files,
    };
    entries["backup/database.sqlite"] = dbBytes;
    entries["backup/manifest.json"] = new TextEncoder().encode(JSON.stringify(manifest, null, 2));
    return { data: zipSync(entries, { level: 6 }), filename: `business-backup-${localStamp()}.zip`, manifest };
  } finally {
    snap.close();
  }
}

// ---------- validate (never touches the live data) ----------

// The checked backup waits here until the user confirms the restore.
let staged: { token: string; manifest: Manifest; db: Uint8Array; files: { path: string; data: Uint8Array }[] } | null = null;

export async function validateBackup(zip: Uint8Array): Promise<BackupInfo> {
  let files: Record<string, Uint8Array>;
  try {
    let total = 0;
    files = unzipSync(zip, {
      filter: (f) => {
        total += f.originalSize;
        if (total > MAX_UNZIPPED_BYTES) throw new BackupError("Backup is too large to restore in a browser (over 1 GB).");
        return !f.name.endsWith("/");
      },
    });
  } catch (e) {
    if (e instanceof BackupError) throw e;
    throw new BackupError("This file is not a valid ZIP archive.");
  }

  const root = files["backup/manifest.json"] ? "backup/" : files["manifest.json"] ? "" : null;
  if (root === null) throw new BackupError("manifest.json is missing. This is not a business backup file.");

  let manifest: Manifest;
  try {
    manifest = JSON.parse(new TextDecoder().decode(files[`${root}manifest.json`]));
  } catch {
    throw new BackupError("manifest.json is damaged and cannot be read.");
  }
  if (manifest?.format !== FORMAT) throw new BackupError("This ZIP is not a business backup file.");
  if (!(manifest.formatVersion <= FORMAT_VERSION)) {
    throw new BackupError("This backup was made by a newer version of the app. Reload the page to update, then try again.");
  }
  if (!manifest.database || !Array.isArray(manifest.files) || !manifest.counts) {
    throw new BackupError("manifest.json is incomplete.");
  }

  const dbBytes = files[`${root}database.sqlite`];
  if (!dbBytes) throw new BackupError("database.sqlite is missing from the backup.");
  if ((await sha256(dbBytes)) !== manifest.database.sha256) {
    throw new BackupError("database.sqlite is corrupted (checksum does not match).");
  }
  for (const f of manifest.files) {
    if (!safeEntryPath(f.path)) throw new BackupError(`Backup contains an unsafe file path: ${f.path}`);
    const data = files[root + f.path];
    if (!data) throw new BackupError(`File missing from backup: ${f.path}`);
    if (data.length !== f.size || (await sha256(data)) !== f.sha256) {
      throw new BackupError(`File is corrupted (checksum does not match): ${f.path}`);
    }
  }

  let checks: Check[];
  try {
    checks = await inspectDatabase(dbBytes, manifest.counts);
  } catch (e) {
    throw new BackupError(`The backup database could not be read: ${e instanceof Error ? e.message : e}`);
  }
  const failed = checks.find((c) => !c.ok);
  if (failed) throw new BackupError(`Database check failed: ${failed.label}${failed.detail ? ` (${failed.detail})` : ""}`);

  const warnings: string[] = [];
  if (manifest.schemaVersion > latestMigration()) {
    throw new BackupError("This backup was made by a newer version of the app. Reload the page to update, then try again.");
  }
  if (manifest.schemaVersion < latestMigration()) {
    warnings.push("This backup is from an older version of the app. Its database will be upgraded automatically.");
  }

  const live = await openScratch(exportBytes());
  const current = { businessName: businessNameOf(live), counts: readCounts(live) };
  live.close();

  const token = crypto.randomUUID();
  staged = { token, manifest, db: dbBytes, files: manifest.files.map((f) => ({ path: f.path, data: files[root + f.path] })) };
  return {
    token,
    manifest,
    totalBytes: dbBytes.length + manifest.files.reduce((s, f) => s + f.size, 0),
    imageCount: manifest.files.filter((f) => f.path.startsWith("images/")).length,
    documentCount: manifest.files.filter((f) => f.path.startsWith("documents/")).length,
    warnings,
    current,
  };
}

/** Opens a database copy and checks integrity, structure and row counts. */
async function inspectDatabase(bytes: Uint8Array, expected: Counts, opts: { checkMigrations?: boolean } = {}) {
  const checks: Check[] = [];
  const conn = await openScratch(bytes);
  try {
    const integrity = one<{ integrity_check: string }>(conn, "pragma integrity_check")?.integrity_check;
    checks.push({ label: "Database integrity", ok: integrity === "ok", detail: String(integrity) });

    const missing = REQUIRED_TABLES.filter((t) => !hasTable(conn, t));
    checks.push({ label: "All tables present", ok: !missing.length, detail: missing.join(", ") || undefined });
    if (missing.length) return checks;

    const fk = conn.exec("pragma foreign_key_check")[0]?.values.length ?? 0;
    checks.push({ label: "Record links (foreign keys)", ok: fk === 0, detail: fk ? `${fk} broken` : undefined });

    const counts = readCounts(conn);
    for (const t of TABLES) {
      const ok = counts[t] === expected[t];
      checks.push({ label: `${t.replace("_", " ")}: ${counts[t]} rows`, ok, detail: ok ? undefined : `expected ${expected[t]}` });
    }
    if (opts.checkMigrations) {
      const v = one<{ v: number }>(conn, "select max(created_at) as v from __drizzle_migrations")?.v;
      checks.push({ label: "Database schema up to date", ok: v === latestMigration() });
    }
  } finally {
    conn.close();
  }
  return checks;
}

// ---------- restore ----------

let restoring = false;

export async function restoreBackup(token: string): Promise<{ checks: Check[]; safetyBackup: string }> {
  if (!staged || staged.token !== token) throw new BackupError("This backup is no longer prepared. Select the file and check it again.");
  if (restoring) throw new BackupError("A restore is already running.");
  restoring = true;
  const { manifest, db: dbBytes, files } = staged;

  try {
    // 1. Safety backup of the current data, kept on this device, before anything is changed.
    const safety = await createBackup();
    const safetyBackup = `pre-restore-${localStamp(new Date(), true)}.zip`;
    const list = (await idbGet<SafetyBackup[]>(SAFETY_KEY).catch(() => undefined)) ?? [];
    await idbSet(SAFETY_KEY, [{ name: safetyBackup, createdAt: new Date().toISOString(), data: safety.data }, ...list].slice(0, SAFETY_KEEP));
    const previous = exportBytes();

    // 2. Swap it in (migrations upgrade it on open), put the images back inside it, then verify.
    try {
      await replaceDatabase(dbBytes);
      const live = rawDb();
      live.run("begin");
      for (const f of files) {
        const name = f.path.startsWith("images/") ? f.path.slice("images/".length) : f.path;
        live.run("insert or replace into files (name, type, data) values (?, ?, ?)", [name, typeOf(name), f.data]);
      }
      live.run("commit");
      await save();
      const now = exportBytes();
      const checks = await inspectDatabase(now, manifest.counts, { checkMigrations: true });
      const check = await openScratch(now);
      const present = new Set(check.exec("select name from files")[0]?.values.map((v) => String(v[0])) ?? []);
      check.close();
      const missingFiles = manifest.files.filter((f) => !present.has(f.path.startsWith("images/") ? f.path.slice(7) : f.path));
      const imageCount = manifest.files.filter((f) => f.path.startsWith("images/")).length;
      checks.push({
        label: `Images and documents: ${manifest.files.length - missingFiles.length} of ${manifest.files.length} files`,
        ok: missingFiles.length === 0,
        detail: missingFiles.length ? `missing ${missingFiles[0].path}` : `${imageCount} images`,
      });
      const failed = checks.find((c) => !c.ok);
      if (failed) throw new BackupError(`Verification failed: ${failed.label}${failed.detail ? ` (${failed.detail})` : ""}`);
      staged = null;
      return { checks, safetyBackup };
    } catch (e) {
      // 3. Anything went wrong: put the previous data back exactly as it was.
      await replaceDatabase(previous);
      throw new BackupError(`Restore failed and your previous data was kept. ${e instanceof Error ? e.message : String(e)}`);
    }
  } finally {
    restoring = false;
  }
}

// ---------- automatic safety backups (kept in this browser) ----------

export async function listSafetyBackups(): Promise<SafetyBackup[]> {
  return (await idbGet<SafetyBackup[]>(SAFETY_KEY).catch(() => undefined)) ?? [];
}

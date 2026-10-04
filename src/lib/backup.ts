import "server-only";
import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import Database from "better-sqlite3";
import { unzipSync, zipSync, type Zippable } from "fflate";
import {
  closeDb,
  DATA_DIR,
  DB_FILE,
  DOCUMENTS_DIR,
  getDb,
  MIGRATIONS_DIR,
  setDbLocked,
  UPLOAD_DIR,
} from "@/db";
import pkg from "../../package.json";

/*
 * Backup ZIP layout:
 *   backup/database.sqlite   consistent snapshot of data/app.db
 *   backup/manifest.json     metadata, row counts and a SHA-256 for every file
 *   backup/images/           data/uploads (product images)
 *   backup/documents/        data/documents
 */

export const BACKUP_DIR = path.join(DATA_DIR, "backups"); // automatic pre-restore backups
const STAGING_DIR = path.join(DATA_DIR, "restore-staging");
const TMP_DIR = path.join(DATA_DIR, "tmp");

const FORMAT = "business-backup";
const FORMAT_VERSION = 1;
const MAX_UNZIPPED_BYTES = 2 * 1024 ** 3;
const TABLES = ["products", "customers", "sales", "sale_items", "inventory_movements", "settings"] as const;
const REQUIRED_TABLES = [...TABLES, "__drizzle_migrations"];

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

export class BackupError extends Error {}

// ---------- helpers ----------

const sha256 = (data: Uint8Array) => createHash("sha256").update(data).digest("hex");

function localStamp(d = new Date(), withTime = false) {
  const p = (n: number) => String(n).padStart(2, "0");
  const date = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  return withTime ? `${date}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}` : date;
}

function latestMigration(): { when: number; tag: string } {
  const journal = JSON.parse(fs.readFileSync(path.join(MIGRATIONS_DIR, "meta", "_journal.json"), "utf8"));
  return journal.entries.at(-1);
}

/** All files under `dir`, as forward-slash paths relative to it. */
function walk(dir: string, rel = ""): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const r = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) return walk(path.join(dir, e.name), r);
    return e.isFile() ? [r] : [];
  });
}

function readCounts(sqlite: Database.Database): Counts {
  return Object.fromEntries(
    TABLES.map((t) => [t, (sqlite.prepare(`select count(*) as n from "${t}"`).get() as { n: number }).n]),
  ) as Counts;
}

function businessNameOf(sqlite: Database.Database) {
  const row = sqlite.prepare("select business_name from settings where id = 1").get() as
    | { business_name: string }
    | undefined;
  return row?.business_name ?? "";
}

async function rename(from: string, to: string) {
  // Windows can briefly lock files (antivirus, indexer), so retry a few times.
  for (let attempt = 0; ; attempt++) {
    try {
      return await fsp.rename(from, to);
    } catch (e) {
      if (attempt >= 5 || (e as NodeJS.ErrnoException).code === "ENOENT") throw e;
      await new Promise((r) => setTimeout(r, 200 * (attempt + 1)));
    }
  }
}

async function moveIfExists(from: string, to: string) {
  if (fs.existsSync(from)) await rename(from, to);
}

/** Rejects absolute paths, "..", and anything outside images/ or documents/. */
function safeEntryPath(p: string) {
  if (p.includes("\\") || p.startsWith("/") || p.split("/").some((s) => s === "" || s === "." || s === "..")) {
    return false;
  }
  if (p.startsWith("images/")) return p.split("/").length === 2; // images are stored flat
  return p.startsWith("documents/");
}

// ---------- export ----------

export async function createBackup(): Promise<{ data: Uint8Array; filename: string; manifest: Manifest }> {
  await fsp.mkdir(TMP_DIR, { recursive: true });
  const snapshot = path.join(TMP_DIR, `snapshot-${randomUUID()}.sqlite`);
  try {
    // SQLite's online backup gives a consistent copy even while the app is in use.
    await getDb().$client.backup(snapshot);
    const snap = new Database(snapshot);
    snap.pragma("journal_mode = DELETE"); // self-contained single file
    const counts = readCounts(snap);
    const businessName = businessNameOf(snap);
    const schemaVersion =
      (snap.prepare("select max(created_at) as v from __drizzle_migrations").get() as { v: number }).v ?? 0;
    snap.close();

    const dbBytes = new Uint8Array(await fsp.readFile(snapshot));
    const entries: Zippable = {
      "backup/database.sqlite": dbBytes,
      "backup/images/": new Uint8Array(0),
      "backup/documents/": new Uint8Array(0),
    };
    const files: Manifest["files"] = [];
    const add = async (zipDir: "images" | "documents", srcDir: string) => {
      for (const rel of walk(srcDir)) {
        const data = new Uint8Array(await fsp.readFile(path.join(srcDir, ...rel.split("/"))));
        const p = `${zipDir}/${rel}`;
        files.push({ path: p, size: data.length, sha256: sha256(data) });
        // Images are already compressed; storing them is faster and no bigger.
        entries[`backup/${p}`] = zipDir === "images" ? [data, { level: 0 }] : data;
      }
    };
    await add("images", UPLOAD_DIR);
    await add("documents", DOCUMENTS_DIR);

    const manifest: Manifest = {
      format: FORMAT,
      formatVersion: FORMAT_VERSION,
      createdAt: new Date().toISOString(),
      appVersion: pkg.version,
      schemaVersion,
      sourceComputer: os.hostname(),
      businessName,
      database: { file: "database.sqlite", size: dbBytes.length, sha256: sha256(dbBytes) },
      counts,
      files,
    };
    entries["backup/manifest.json"] = new TextEncoder().encode(JSON.stringify(manifest, null, 2));

    return { data: zipSync(entries, { level: 6 }), filename: `business-backup-${localStamp()}.zip`, manifest };
  } finally {
    await fsp.rm(snapshot, { force: true });
  }
}

// ---------- validate (never touches the live data) ----------

export async function validateBackup(zip: Uint8Array): Promise<BackupInfo> {
  let files: Record<string, Uint8Array>;
  try {
    let total = 0;
    files = unzipSync(zip, {
      filter: (f) => {
        total += f.originalSize;
        if (total > MAX_UNZIPPED_BYTES) throw new BackupError("Backup is too large to restore (over 2 GB).");
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
    throw new BackupError("This backup was made by a newer version of the app. Update the app, then try again.");
  }
  if (!manifest.database || !Array.isArray(manifest.files) || !manifest.counts) {
    throw new BackupError("manifest.json is incomplete.");
  }

  const dbBytes = files[`${root}database.sqlite`];
  if (!dbBytes) throw new BackupError("database.sqlite is missing from the backup.");
  if (sha256(dbBytes) !== manifest.database.sha256) {
    throw new BackupError("database.sqlite is corrupted (checksum does not match).");
  }
  for (const f of manifest.files) {
    if (!safeEntryPath(f.path)) throw new BackupError(`Backup contains an unsafe file path: ${f.path}`);
    const data = files[root + f.path];
    if (!data) throw new BackupError(`File missing from backup: ${f.path}`);
    if (data.length !== f.size || sha256(data) !== f.sha256) {
      throw new BackupError(`File is corrupted (checksum does not match): ${f.path}`);
    }
  }

  // Stage everything in its own folder; only the staged copy is inspected.
  await fsp.rm(STAGING_DIR, { recursive: true, force: true }); // drop any earlier, unfinished attempt
  const token = randomUUID();
  const dir = path.join(STAGING_DIR, token);
  try {
    await fsp.mkdir(path.join(dir, "uploads"), { recursive: true });
    await fsp.mkdir(path.join(dir, "documents"), { recursive: true });
    await fsp.writeFile(path.join(dir, "app.db"), dbBytes);
    for (const f of manifest.files) {
      const [top, ...rest] = f.path.split("/");
      const target = path.join(dir, top === "images" ? "uploads" : "documents", ...rest);
      await fsp.mkdir(path.dirname(target), { recursive: true });
      await fsp.writeFile(target, files[root + f.path]);
    }

    const checks = inspectDatabase(path.join(dir, "app.db"), manifest.counts);
    const failed = checks.find((c) => !c.ok);
    if (failed) throw new BackupError(`Database check failed: ${failed.label}${failed.detail ? ` (${failed.detail})` : ""}`);

    const warnings: string[] = [];
    const appSchema = latestMigration().when;
    if (manifest.schemaVersion > appSchema) {
      throw new BackupError("This backup was made by a newer version of the app. Update the app, then try again.");
    }
    if (manifest.schemaVersion < appSchema) {
      warnings.push("This backup is from an older version of the app. Its database will be upgraded automatically.");
    }

    const live = getDb().$client;
    const info: BackupInfo = {
      token,
      manifest,
      totalBytes: dbBytes.length + manifest.files.reduce((s, f) => s + f.size, 0),
      imageCount: manifest.files.filter((f) => f.path.startsWith("images/")).length,
      documentCount: manifest.files.filter((f) => f.path.startsWith("documents/")).length,
      warnings,
      current: { businessName: businessNameOf(live), counts: readCounts(live) },
    };
    await fsp.writeFile(path.join(dir, "manifest.json"), JSON.stringify(manifest));
    return info;
  } catch (e) {
    await fsp.rm(dir, { recursive: true, force: true });
    if (e instanceof BackupError) throw e;
    throw new BackupError(`The backup database could not be read: ${e instanceof Error ? e.message : e}`);
  }
}

/** Opens a database file and checks integrity, structure and row counts. */
function inspectDatabase(file: string, expected: Counts, opts: { checkMigrations?: boolean } = {}): Check[] {
  const checks: Check[] = [];
  const sqlite = new Database(file, { fileMustExist: true });
  try {
    const integrity = sqlite.pragma("integrity_check", { simple: true });
    checks.push({ label: "Database integrity", ok: integrity === "ok", detail: String(integrity) });

    const tables = new Set(
      (sqlite.prepare("select name from sqlite_master where type = 'table'").all() as { name: string }[]).map(
        (r) => r.name,
      ),
    );
    const missing = REQUIRED_TABLES.filter((t) => !tables.has(t));
    checks.push({ label: "All tables present", ok: !missing.length, detail: missing.join(", ") || undefined });
    if (missing.length) return checks;

    const fk = sqlite.pragma("foreign_key_check") as unknown[];
    checks.push({ label: "Record links (foreign keys)", ok: fk.length === 0, detail: fk.length ? `${fk.length} broken` : undefined });

    const counts = readCounts(sqlite);
    for (const t of TABLES) {
      const ok = counts[t] === expected[t];
      checks.push({ label: `${t.replace("_", " ")}: ${counts[t]} rows`, ok, detail: ok ? undefined : `expected ${expected[t]}` });
    }
    if (opts.checkMigrations) {
      const v = (sqlite.prepare("select max(created_at) as v from __drizzle_migrations").get() as { v: number }).v;
      checks.push({ label: "Database schema up to date", ok: v === latestMigration().when });
    }
  } finally {
    sqlite.close();
  }
  return checks;
}

// ---------- restore ----------

const g = globalThis as unknown as { __restoring?: boolean };

export async function restoreBackup(token: string): Promise<{ checks: Check[]; safetyBackup: string }> {
  if (!/^[0-9a-f-]{36}$/.test(token)) throw new BackupError("Invalid restore request.");
  const staged = path.join(STAGING_DIR, token);
  if (!fs.existsSync(path.join(staged, "manifest.json"))) {
    throw new BackupError("This backup is no longer prepared. Select the file and check it again.");
  }
  if (g.__restoring) throw new BackupError("A restore is already running.");
  g.__restoring = true;

  try {
    const manifest: Manifest = JSON.parse(await fsp.readFile(path.join(staged, "manifest.json"), "utf8"));

    // 1. Safety backup of the current data, before anything is changed.
    const safety = await createBackup();
    await fsp.mkdir(BACKUP_DIR, { recursive: true });
    const safetyBackup = `pre-restore-${localStamp(new Date(), true)}.zip`;
    await fsp.writeFile(path.join(BACKUP_DIR, safetyBackup), safety.data);

    // 2. Swap: current data moves aside, staged data moves in.
    const old = path.join(DATA_DIR, `restore-old-${Date.now()}`);
    const live = [
      { cur: DB_FILE, stg: path.join(staged, "app.db"), name: "app.db" },
      { cur: `${DB_FILE}-wal`, stg: null, name: "app.db-wal" },
      { cur: `${DB_FILE}-shm`, stg: null, name: "app.db-shm" },
      { cur: UPLOAD_DIR, stg: path.join(staged, "uploads"), name: "uploads" },
      { cur: DOCUMENTS_DIR, stg: path.join(staged, "documents"), name: "documents" },
    ];

    setDbLocked(true);
    let swapped = false;
    try {
      closeDb();
      await fsp.mkdir(old, { recursive: true });
      for (const f of live) await moveIfExists(f.cur, path.join(old, f.name));
      swapped = true;
      for (const f of live) if (f.stg) await rename(f.stg, f.cur);
      setDbLocked(false);

      // 3. Reopen (applies any newer migrations) and verify what was restored.
      getDb();
      const checks = inspectDatabase(DB_FILE, manifest.counts, { checkMigrations: true });
      const missingFiles = manifest.files.filter((f) => {
        const [top, ...rest] = f.path.split("/");
        return !fs.existsSync(path.join(top === "images" ? UPLOAD_DIR : DOCUMENTS_DIR, ...rest));
      });
      const imageCount = manifest.files.filter((f) => f.path.startsWith("images/")).length;
      checks.push({
        label: `Images and documents: ${manifest.files.length - missingFiles.length} of ${manifest.files.length} files`,
        ok: missingFiles.length === 0,
        detail: missingFiles.length ? `missing ${missingFiles[0].path}` : `${imageCount} images`,
      });
      const failed = checks.find((c) => !c.ok);
      if (failed) throw new BackupError(`Verification failed: ${failed.label}${failed.detail ? ` (${failed.detail})` : ""}`);

      await fsp.rm(old, { recursive: true, force: true });
      await fsp.rm(STAGING_DIR, { recursive: true, force: true });
      return { checks, safetyBackup };
    } catch (e) {
      // 4. Anything went wrong: put the previous data back exactly as it was.
      setDbLocked(true);
      try {
        closeDb();
      } catch {}
      if (swapped) {
        for (const f of live) {
          if (fs.existsSync(path.join(old, f.name))) {
            await fsp.rm(f.cur, { recursive: true, force: true });
            await rename(path.join(old, f.name), f.cur);
          }
        }
      } else {
        for (const f of live) await moveIfExists(path.join(old, f.name), f.cur);
      }
      await fsp.rm(old, { recursive: true, force: true });
      setDbLocked(false);
      const code = (e as NodeJS.ErrnoException).code;
      const msg =
        code === "EPERM" || code === "EBUSY" || code === "EACCES"
          ? "A file in the data folder is in use by another program (for example antivirus, a backup tool, or an open image). Close it and try again."
          : e instanceof Error
            ? e.message
            : String(e);
      throw new BackupError(`Restore failed and your previous data was kept. ${msg}`);
    }
  } finally {
    setDbLocked(false);
    g.__restoring = false;
  }
}

// ---------- automatic backups ----------

export function listSafetyBackups() {
  if (!fs.existsSync(BACKUP_DIR)) return [];
  return fs
    .readdirSync(BACKUP_DIR)
    .filter((f) => f.endsWith(".zip"))
    .map((name) => {
      const st = fs.statSync(path.join(BACKUP_DIR, name));
      return { name, size: st.size, createdAt: st.mtime.toISOString() };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function currentSummary() {
  const live = getDb().$client;
  return {
    counts: readCounts(live),
    imageCount: walk(UPLOAD_DIR).length,
    documentCount: walk(DOCUMENTS_DIR).length,
  };
}

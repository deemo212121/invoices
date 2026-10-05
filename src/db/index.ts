// The database runs inside the browser: SQLite (sql.js, WebAssembly) in memory, saved to this
// device's IndexedDB after every change. Nothing is sent to a server, so every device or browser
// has its own separate store. Moving data between devices goes through backup ZIPs.
import initSqlJs, { type Database, type SqlJsStatic } from "sql.js";
import { drizzle, type SQLJsDatabase } from "drizzle-orm/sql-js";
import type { MigrationMeta } from "drizzle-orm/migrator";
import * as schema from "./schema";
import migrations from "./migrations.json";
import { idbDelete, idbGet, idbSet } from "@/lib/idb";

export type DB = SQLJsDatabase<typeof schema>;

const DB_KEY = "database";
const SAVE_DELAY = 150; // ms after the last change

let SQL: SqlJsStatic | null = null;
let sqlite: Database | null = null;
let real: DB | null = null;

/** Loads the SQLite engine once. */
export async function sqlEngine() {
  SQL ??= await initSqlJs({ locateFile: () => "/sql-wasm.wasm" });
  return SQL;
}

// ---------- change tracking: re-render screens and save after every write ----------

let version = 0;
const listeners = new Set<() => void>();
let dirty = false;
let saveTimer: ReturnType<typeof setTimeout> | undefined;
let bumpQueued = false;
let saving: Promise<void> = Promise.resolve();
export let persistent = true; // false when this browser won't let us store data (private mode)

export function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => void listeners.delete(fn);
}
export const getVersion = () => version;

function bump() {
  if (bumpQueued) return;
  bumpQueued = true;
  queueMicrotask(() => {
    bumpQueued = false;
    version++;
    for (const l of listeners) l();
  });
}

function onWrite() {
  dirty = true;
  bump();
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => void save(), SAVE_DELAY);
}

// Other tabs of this app on the same device: reload when one of them saves.
const channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("invoices-db") : null;
channel?.addEventListener("message", async () => {
  if (dirty) return; // our own unsaved change wins; it is saved in a moment
  const bytes = await idbGet<Uint8Array>(DB_KEY);
  if (bytes) swapIn(load(bytes));
});

/** Applies per-connection settings; needed after opening and after every export (which reopens). */
function configure(conn: Database) {
  conn.run("PRAGMA foreign_keys = ON");
  conn.updateHook(onWrite);
}

/** Writes the database to IndexedDB now. */
export function save(): Promise<void> {
  clearTimeout(saveTimer);
  if (!dirty || !sqlite) return saving;
  dirty = false;
  const bytes = exportBytes();
  saving = saving
    .then(() => idbSet(DB_KEY, bytes))
    .then(() => {
      persistent = true;
      channel?.postMessage("saved");
    })
    .catch(() => {
      persistent = false;
      bump();
    });
  return saving;
}

// Save before the tab closes or goes to the background (phones may kill it without warning).
if (typeof window !== "undefined") {
  const flush = () => void save();
  window.addEventListener("pagehide", flush);
  document.addEventListener("visibilitychange", () => document.visibilityState === "hidden" && flush());
}

// ---------- open / replace ----------

function migrate(d: DB) {
  // Same migrator and bookkeeping table as the desktop app, so its backups restore here.
  const internal = d as unknown as { dialect: { migrate: (m: MigrationMeta[], s: unknown, c: object) => void }; session: unknown };
  internal.dialect.migrate(migrations as MigrationMeta[], internal.session, { migrationsFolder: "" });
  d.insert(schema.settings).values({ id: 1, currencySymbol: "₱" }).onConflictDoNothing().run();
}

function load(bytes?: Uint8Array) {
  const conn = new SQL!.Database(bytes);
  conn.run("PRAGMA foreign_keys = ON");
  const d = drizzle(conn, { schema });
  migrate(d);
  return { conn, d };
}

function swapIn({ conn, d }: { conn: Database; d: DB }) {
  const old = sqlite;
  configure(conn);
  sqlite = conn;
  real = d;
  old?.close();
  bump();
}

/** Opens this device's database. `isNew` is true the first time (nothing saved yet). */
export async function openDatabase(): Promise<{ isNew: boolean }> {
  if (real) return { isNew: false };
  await sqlEngine();
  let bytes: Uint8Array | undefined;
  try {
    bytes = await idbGet<Uint8Array>(DB_KEY);
  } catch {
    persistent = false;
  }
  swapIn(load(bytes));
  // Ask the browser not to clear our storage when space runs low.
  navigator.storage?.persist?.().catch(() => {});
  return { isNew: !bytes };
}

/** Replaces the whole database (restore, start over) and saves it straight away. */
export async function replaceDatabase(bytes?: Uint8Array) {
  await sqlEngine();
  clearTimeout(saveTimer);
  swapIn(load(bytes));
  dirty = true;
  await save();
}

/** Removes everything this app stored on this device. */
export async function deleteDeviceData() {
  clearTimeout(saveTimer);
  dirty = false;
  await idbDelete(DB_KEY);
  channel?.postMessage("deleted");
}

/** The whole database as a SQLite file. */
export function exportBytes() {
  const bytes = sqlite!.export();
  configure(sqlite!); // export() reopens the connection, which drops these settings
  return bytes;
}

/** A separate, throwaway database (for checking backups); close it when done. */
export async function openScratch(bytes?: Uint8Array) {
  return new (await sqlEngine()).Database(bytes);
}

/** The raw sql.js connection, for the few things Drizzle can't do (binary files). */
export function rawDb() {
  if (!sqlite) throw new Error("The database is not open yet.");
  return sqlite;
}

// Always forwards to the current connection, so modules keep working after a restore.
export const db: DB = new Proxy({} as DB, {
  get(_target, key) {
    if (!real) throw new Error("The database is not open yet.");
    const value = Reflect.get(real, key, real);
    return typeof value === "function" ? value.bind(real) : value;
  },
});

import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "./schema";

export const DATA_DIR = path.join(process.cwd(), "data");
export const DB_FILE = path.join(DATA_DIR, "app.db");
export const UPLOAD_DIR = path.join(DATA_DIR, "uploads");
export const DOCUMENTS_DIR = path.join(DATA_DIR, "documents");
export const MIGRATIONS_DIR = path.join(process.cwd(), "drizzle");

/** Absolute path of an uploaded file; strips any directory parts from the name. */
export function uploadPath(name: string) {
  return path.join(process.cwd(), "data", "uploads", path.basename(name));
}

export type DB = BetterSQLite3Database<typeof schema> & { $client: Database.Database };

function open(): DB {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  fs.mkdirSync(DOCUMENTS_DIR, { recursive: true });
  const sqlite = new Database(DB_FILE);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: MIGRATIONS_DIR });
  db.insert(schema.settings).values({ id: 1, currencySymbol: "₱" }).onConflictDoNothing().run();
  return db;
}

// One connection, reused across hot reloads in development. It can be closed and
// reopened so a backup restore can swap the database file underneath it.
const g = globalThis as unknown as { __db?: DB; __dbLocked?: boolean };

export function getDb(): DB {
  if (g.__dbLocked) throw new Error("A backup restore is in progress. Try again in a moment.");
  return (g.__db ??= open());
}

/** Flushes the WAL into the main file and closes the connection. */
export function closeDb() {
  if (!g.__db) return;
  g.__db.$client.pragma("wal_checkpoint(TRUNCATE)");
  g.__db.$client.close();
  g.__db = undefined;
}

/** While locked, every database access throws instead of reopening the file. */
export function setDbLocked(locked: boolean) {
  g.__dbLocked = locked;
}

// Always forwards to the current connection, so modules keep working after a restore.
export const db: DB = new Proxy({} as DB, {
  get(_target, key) {
    const real = getDb();
    const value = Reflect.get(real, key, real);
    return typeof value === "function" ? value.bind(real) : value;
  },
});

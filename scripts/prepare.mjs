// Runs before `next dev` and `next build`:
// 1. copies the SQLite engine (WebAssembly) into public/ so the browser can load it;
// 2. bundles the SQL migrations into src/db/migrations.json, because the browser can't read drizzle/.
import fs from "node:fs";
import { readMigrationFiles } from "drizzle-orm/migrator";

fs.copyFileSync("node_modules/sql.js/dist/sql-wasm-browser.wasm", "public/sql-wasm.wasm");

const migrations = readMigrationFiles({ migrationsFolder: "drizzle" });
fs.writeFileSync("src/db/migrations.json", JSON.stringify(migrations));
console.log(`prepare: sql-wasm.wasm copied, ${migrations.length} migrations bundled`);

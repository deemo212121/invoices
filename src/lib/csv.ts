import Papa from "papaparse";

type Cell = string | number | boolean | null | undefined;

// Spreadsheet apps run text starting with these as formulas; prefix with ' so it stays text.
const FORMULA_START = /^[=+\-@\t\r]/;

function escapeText(v: string) {
  return FORMULA_START.test(v) ? `'${v}` : v;
}

/** Builds a CSV string. Text cells are formula-escaped; numbers are written as-is. */
export function toCsv(headers: string[], rows: Cell[][]) {
  const data = rows.map((r) => r.map((v) => (typeof v === "string" ? escapeText(v) : (v ?? ""))));
  // BOM so Excel detects UTF-8 (accents, ₱, etc.).
  return "\uFEFF" + Papa.unparse({ fields: headers, data }, { newline: "\r\n" });
}

export function csvResponse(csv: string, filename: string) {
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

/** "Cost Price", "cost_price" and "costPrice" all become "costprice". */
export function normalizeHeader(h: string) {
  return h.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export type ParsedCsv = { headers: string[]; rows: { line: number; values: Record<string, string> }[] };

/** Parses CSV text; keys of `values` are normalized headers. */
export function parseCsv(text: string): ParsedCsv {
  const result = Papa.parse<string[]>(text.replace(/^\uFEFF/, ""), { skipEmptyLines: "greedy" });
  // Delimiter errors only mean a one-column file (comma assumed), which is fine.
  const fatal = result.errors.find((e) => e.type === "Quotes");
  if (fatal) throw new Error(`CSV could not be read (row ${(fatal.row ?? 0) + 1}): ${fatal.message}`);
  const [head, ...body] = result.data;
  if (!head) throw new Error("The file is empty.");
  const headers = head.map((h) => normalizeHeader(h));
  return {
    headers,
    rows: body.map((cells, i) => ({
      line: i + 2, // 1-based, counting the header row
      values: Object.fromEntries(
        headers.map((h, j) => {
          const v = (cells[j] ?? "").trim();
          // Undo the formula escape applied on export.
          return [h, v.startsWith("'") && FORMULA_START.test(v.slice(1)) ? v.slice(1) : v];
        }),
      ),
    })),
  };
}

const pad = (n: number) => String(n).padStart(2, "0");

export function localDateStamp() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Stored UTC timestamp → local "YYYY-MM-DD HH:MM:SS", which spreadsheets read as a date. */
export function localDateTime(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

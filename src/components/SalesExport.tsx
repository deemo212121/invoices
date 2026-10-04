"use client";

import { useState } from "react";

export function SalesExport() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const qs = new URLSearchParams({ ...(from && { from }), ...(to && { to }) }).toString();
  const href = (type: string) => `/api/csv/${type}${qs ? `?${qs}` : ""}`;

  return (
    <div className="space-y-2 border-t border-zinc-100 pt-3">
      <div className="text-sm font-medium">Sales</div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="label">From</span>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="input" />
        </label>
        <label className="text-sm">
          <span className="label">To</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="input" />
        </label>
        <a href={href("sales")} className="btn-secondary">
          Sales (one row per invoice)
        </a>
        <a href={href("sale-items")} className="btn-secondary">
          Sale items (one row per product sold)
        </a>
      </div>
      <p className="text-xs text-zinc-500">Leave dates empty to export all sales.</p>
    </div>
  );
}

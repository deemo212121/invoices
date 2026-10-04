"use client";

import { Printer } from "lucide-react";

export function PrintButton() {
  return (
    <button onClick={() => window.print()} className="btn">
      <Printer className="size-4" /> Print
    </button>
  );
}

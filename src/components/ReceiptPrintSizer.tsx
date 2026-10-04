"use client";

import { useEffect, useState } from "react";

const PX_PER_MM = 96 / 25.4;

/**
 * Receipts print on a roll: the page must be exactly the roll width and as long as the receipt.
 * CSS can't say "as long as the content", so measure the receipt right before printing
 * (Print button or Ctrl+P) and set the page size to match.
 */
export function ReceiptPrintSizer({ widthMm }: { widthMm: number }) {
  const [heightMm, setHeightMm] = useState(200);

  useEffect(() => {
    const measure = () => {
      const el = document.querySelector<HTMLElement>("[data-receipt]");
      if (el) setHeightMm(Math.ceil(el.offsetHeight / PX_PER_MM) + 4);
    };
    measure();
    window.addEventListener("beforeprint", measure);
    return () => window.removeEventListener("beforeprint", measure);
  }, []);

  return <style>{`@page { size: ${widthMm}mm ${heightMm}mm; margin: 0; }`}</style>;
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/settings", label: "Business" },
  { href: "/settings/backup", label: "Backup & Restore" },
  { href: "/settings/csv", label: "CSV Import/Export" },
  { href: "/settings/marketplaces", label: "Marketplaces" },
];

export function SettingsTabs() {
  const pathname = usePathname();
  return (
    <nav className="scroll-thin -mx-4 flex gap-1 overflow-x-auto border-b border-zinc-200 px-4 sm:mx-0 sm:px-0">
      {TABS.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          data-tour={`tab-${t.href.split("/")[2] ?? "business"}`}
          className={`-mb-px shrink-0 border-b-2 px-4 py-2 text-sm whitespace-nowrap ${
            pathname === t.href
              ? "border-zinc-900 font-medium text-zinc-900"
              : "border-transparent text-zinc-600 hover:text-zinc-900"
          }`}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}

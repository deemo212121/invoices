"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Boxes,
  Compass,
  FileText,
  LayoutDashboard,
  type LucideIcon,
  Menu,
  Package,
  Settings,
  ShoppingCart,
  Store,
  Users,
  X,
} from "lucide-react";
import { startTour } from "./GuidedTour";

const ALL: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/pos", label: "Point of Sale", icon: ShoppingCart },
  { href: "/products", label: "Products", icon: Package },
  { href: "/inventory", label: "Inventory", icon: Boxes },
  { href: "/customers", label: "Customers", icon: Users },
  { href: "/invoices", label: "Invoices", icon: FileText },
  { href: "/tiktok", label: "TikTok Shop", icon: Store },
  { href: "/settings", label: "Settings", icon: Settings },
];

const TABS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/", label: "Home", icon: LayoutDashboard },
  { href: "/pos", label: "Sell", icon: ShoppingCart },
  { href: "/products", label: "Products", icon: Package },
  { href: "/invoices", label: "Invoices", icon: FileText },
];

const tourId = (href: string) => (href === "/" ? "nav-home" : `nav-${href.slice(1)}`);

/** Phone navigation: top bar with a menu drawer, and a bottom tab bar. Hidden on large screens. */
export function MobileNav({ businessName }: { businessName: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const active = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  // Close the drawer whenever the page changes.
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setOpen(false);
  }
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <div className="lg:hidden print:hidden">
      {/* Top bar */}
      <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-white/5 bg-zinc-950 px-4 text-white">
        <button onClick={() => setOpen(true)} className="-ml-1 grid size-9 place-items-center rounded-lg hover:bg-white/10" aria-label="Open menu">
          <Menu className="size-5" />
        </button>
        <div className="grid size-7 place-items-center rounded-lg bg-gradient-to-br from-amber-200 via-amber-400 to-amber-600 text-[11px] font-bold text-zinc-950">
          {businessName
            .replace(/\(.*?\)/g, "")
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .map((w) => w[0]?.toUpperCase())
            .join("")}
        </div>
        <span className="truncate text-sm font-semibold">{businessName}</span>
      </header>

      {/* Drawer */}
      {open && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-zinc-950/60 backdrop-blur-[2px]" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-zinc-950 text-zinc-400 shadow-2xl">
            <div className="flex items-center justify-between px-5 py-5">
              <span className="truncate text-sm font-semibold text-white">{businessName}</span>
              <button onClick={() => setOpen(false)} className="grid size-9 place-items-center rounded-lg hover:bg-white/10" aria-label="Close menu">
                <X className="size-5" />
              </button>
            </div>
            <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3">
              {ALL.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] transition ${
                    active(href) ? "bg-white/10 font-medium text-white" : "hover:bg-white/5 hover:text-zinc-100"
                  }`}
                >
                  <Icon className={`size-5 ${active(href) ? "text-amber-300" : "text-zinc-500"}`} strokeWidth={1.75} />
                  {label}
                  {href === "/tiktok" && (
                    <span className="ml-auto rounded-full bg-amber-300/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-300">SOON</span>
                  )}
                </Link>
              ))}
            </nav>
            <div className="px-3 pb-6">
              <button
                onClick={() => {
                  setOpen(false);
                  startTour();
                }}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] hover:bg-white/5 hover:text-zinc-100"
              >
                <Compass className="size-5 text-zinc-500" strokeWidth={1.75} />
                Take the tour
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Bottom tab bar */}
      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-zinc-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        {TABS.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            data-tour={tourId(href)}
            className={`flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${active(href) ? "text-zinc-900" : "text-zinc-400"}`}
          >
            <Icon className="size-5" strokeWidth={active(href) ? 2.2 : 1.75} />
            {label}
          </Link>
        ))}
        <button onClick={() => setOpen(true)} className="flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium text-zinc-400">
          <Menu className="size-5" strokeWidth={1.75} />
          Menu
        </button>
      </nav>
    </div>
  );
}

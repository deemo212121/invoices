"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { startTour } from "./GuidedTour";
import { logout } from "@/app/actions/auth";
import {
  Boxes,
  Compass,
  LogOut,
  FileText,
  LayoutDashboard,
  type LucideIcon,
  Package,
  Settings,
  ShoppingCart,
  Store,
  Users,
} from "lucide-react";

const NAV: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/pos", label: "Point of Sale", icon: ShoppingCart },
  { href: "/products", label: "Products", icon: Package },
  { href: "/inventory", label: "Inventory", icon: Boxes },
  { href: "/customers", label: "Customers", icon: Users },
  { href: "/invoices", label: "Invoices", icon: FileText },
  { href: "/tiktok", label: "TikTok Shop", icon: Store },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar({
  businessName,
  vatRegistered,
  tiktokConnected,
  signInOn,
}: {
  businessName: string;
  vatRegistered: boolean;
  tiktokConnected: boolean;
  signInOn: boolean;
}) {
  const pathname = usePathname();
  const active = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  const initials = businessName
    .replace(/\(.*?\)/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");

  return (
    <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col bg-zinc-950 text-zinc-400 lg:flex print:hidden">
      <div className="flex items-center gap-3 px-5 py-6">
        <div className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-amber-200 via-amber-400 to-amber-600 text-sm font-bold text-zinc-950 shadow-lg shadow-amber-500/20">
          {initials || "IN"}
        </div>
        <div className="min-w-0">
          <div className="line-clamp-2 text-sm leading-snug font-semibold text-white">{businessName}</div>
          <div className="text-xs text-zinc-500">{vatRegistered ? "VAT-registered" : "Non-VAT"}</div>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 px-3">
        {NAV.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            data-tour={href === "/" ? "nav-home" : `nav-${href.slice(1)}`}
            className={`group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
              active(href) ? "bg-white/10 font-medium text-white" : "hover:bg-white/5 hover:text-zinc-100"
            }`}
          >
            <Icon
              className={`size-[18px] ${active(href) ? "text-amber-300" : "text-zinc-500 group-hover:text-zinc-300"}`}
              strokeWidth={1.75}
            />
            {label}
            {href === "/tiktok" && !tiktokConnected && (
              <span className="ml-auto rounded-full bg-amber-300/15 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-amber-300">
                SOON
              </span>
            )}
          </Link>
        ))}
      </nav>

      <div className="space-y-3 px-3 pb-5">
        <button
          onClick={startTour}
          data-tour="tour-restart"
          className="group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-zinc-400 transition hover:bg-white/5 hover:text-zinc-100"
        >
          <Compass className="size-[18px] text-zinc-500 group-hover:text-amber-300" strokeWidth={1.75} />
          Take the tour
        </button>
        {signInOn && (
        <form action={logout}>
          <button className="group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-zinc-400 transition hover:bg-white/5 hover:text-zinc-100">
            <LogOut className="size-[18px] text-zinc-500 group-hover:text-zinc-300" strokeWidth={1.75} />
            Sign out
          </button>
        </form>
        )}
        <div className="px-3 text-[11px] text-zinc-600">Works offline · data stays on this computer</div>
      </div>
    </aside>
  );
}

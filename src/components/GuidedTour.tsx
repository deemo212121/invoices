"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MousePointerClick, Sparkles, X } from "lucide-react";

// First-run walkthrough. Everything outside the highlighted element is blocked; "click" steps
// continue only when the highlighted element itself is clicked (so people learn by doing).

type Step = {
  target?: string; // data-tour id; omitted = centered card
  title: string;
  body: string;
  action: "click" | "next";
  href?: string; // menu steps: page to open when the menu item isn't visible (e.g. on a phone)
};

const STEPS: Step[] = [
  {
    title: "Welcome to your store",
    body: "Take a one-minute tour of selling, stock, invoices and backups. You'll click through it yourself.",
    action: "next",
  },
  { target: "nav-pos", title: "Start selling", body: "Every walk-in sale happens here. Click Point of Sale.", action: "click", href: "/pos" },
  { target: "pos-product", title: "Add a product", body: "Tap a product to put it in the sale. Scanning a barcode works too.", action: "click" },
  {
    target: "pos-cart",
    title: "The current sale",
    body: "Change quantities with − and +, or remove an item. Prices already include VAT.",
    action: "next",
  },
  {
    target: "pos-senior",
    title: "Senior citizen & PWD",
    body: "Turn this on for the 5% discount on basic necessities. The ₱125 weekly limit per ID is tracked for you.",
    action: "next",
  },
  {
    target: "pos-charge",
    title: "Charge",
    body: "Charging completes the sale: stock goes down and a numbered Sales Invoice is created. (We won't charge during the tour.)",
    action: "next",
  },
  { target: "nav-products", title: "Your catalog", body: "Click Products to see everything you sell.", action: "click", href: "/products" },
  {
    target: "products-add",
    title: "Add products",
    body: "Name, SKU, barcode, prices, image, and VAT / senior-discount flags. Or import a CSV.",
    action: "next",
  },
  {
    target: "products-labels",
    title: "Barcode labels",
    body: "Print barcode stickers on A4 sheets or a thermal label printer. Products without a barcode get one generated.",
    action: "next",
  },
  { target: "nav-inventory", title: "Stock", body: "Click Inventory.", action: "click", href: "/inventory" },
  {
    target: "inventory-form",
    title: "Record stock changes",
    body: "Deliveries, returns, damaged items and counts. Every change is logged, so stock always adds up.",
    action: "next",
  },
  { target: "nav-invoices", title: "Invoices", body: "Click Invoices.", action: "click", href: "/invoices" },
  {
    target: "invoices-list",
    title: "Every sale's invoice",
    body: "Every sale gets a numbered Sales Invoice. Search by number or customer.",
    action: "next",
  },
  { target: "invoices-first", title: "Open an invoice", body: "Click this invoice to open it.", action: "click" },
  {
    target: "invoice-paper",
    title: "A4 or thermal receipt",
    body: "Print on an A4 page, or as an 80mm or 58mm receipt for thermal printers. The PDF follows your choice, and it's remembered.",
    action: "next",
  },
  {
    target: "nav-tiktok",
    title: "TikTok Shop: coming soon",
    body: "TikTok orders and stock will sync here automatically once TikTok approves the connection.",
    action: "next",
  },
  { target: "nav-settings", title: "Settings", body: "Click Settings to set up your business.", action: "click", href: "/settings" },
  {
    target: "settings-vat",
    title: "VAT-registered or Non-VAT",
    body: "Choose how tax appears on invoices, and fill in your TIN and address below.",
    action: "next",
  },
  { target: "tab-backup", title: "Backups", body: "Click Backup & Restore.", action: "click", href: "/settings/backup" },
  {
    target: "backup-download",
    title: "One-click backup",
    body: "Your store lives only in this browser. Download a backup ZIP often: it moves your store to another device and saves you if the browser is cleared.",
    action: "next",
  },
  {
    title: "You're all set",
    body: "That's the tour. You can take it again any time from \"Take the tour\" at the bottom of the sidebar (in the Menu on a phone).",
    action: "next",
  },
];

// Bump the version when the steps change, so everyone sees the updated guide once.
const KEY = "guided-tour-v2";
const PAD = 8;
const read = () => {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return "done"; // storage blocked: never trap anyone in the tour
  }
};
const write = (v: string) => {
  try {
    localStorage.setItem(KEY, v);
  } catch {}
};

type Rect = { top: number; left: number; width: number; height: number };

export function GuidedTour() {
  const router = useRouter();
  const [step, setStep] = useState<number | null>(null);
  // Position of the highlighted element, tagged with the step it was measured for.
  const [tracked, setTracked] = useState<{ step: number; rect: Rect | null; missing: boolean }>({
    step: -1,
    rect: null,
    missing: false,
  });
  const card = useRef<HTMLDivElement>(null);
  const [cardSize, setCardSize] = useState({ w: 340, h: 180 });

  // Start on first visit; resume an unfinished tour after a reload; restart on request.
  useEffect(() => {
    // Deferred so the first render matches the server (storage only exists in the browser).
    const t = setTimeout(() => {
      const saved = read();
      if (saved === null) setStep(0);
      else if (saved !== "done" && Number.isInteger(Number(saved))) setStep(Number(saved));
    }, 300);
    const restart = () => setStep(0);
    window.addEventListener("start-tour", restart);
    return () => {
      clearTimeout(t);
      window.removeEventListener("start-tour", restart);
    };
  }, []);

  const finish = useCallback(() => {
    write("done");
    setStep(null);
  }, []);

  const next = useCallback(() => {
    setStep((s) => {
      if (s === null) return s;
      if (s + 1 >= STEPS.length) {
        write("done");
        return null;
      }
      write(String(s + 1));
      return s + 1;
    });
  }, []);

  const current = step !== null ? STEPS[step] : null;

  // Find and track the highlighted element (it may appear after a page change).
  useEffect(() => {
    if (!current?.target || step === null) return;
    let scrolled = false;
    const started = Date.now();
    const measure = () => {
      // The same target can exist twice (sidebar and mobile bar); use the one that is visible.
      const all = [...document.querySelectorAll<HTMLElement>(`[data-tour="${current.target}"]`)];
      const el = all.find((e) => e.getClientRects().length > 0 && e.getBoundingClientRect().width > 0);
      // Let the page reveal what the tour needs (e.g. open the cart sheet on a phone).
      window.dispatchEvent(new CustomEvent("tour:reveal", { detail: current.target }));
      if (!el) {
        // Present but hidden (e.g. the desktop sidebar on a phone): no point waiting.
        setTracked({ step, rect: null, missing: all.length > 0 || Date.now() - started > 5000 });
        return;
      }
      if (!scrolled) {
        scrolled = true;
        const r = el.getBoundingClientRect();
        const tall = r.height > window.innerHeight * 0.7;
        // Tall elements (like a long table): only make sure their top is in view.
        if (tall ? r.top < 0 || r.top > window.innerHeight * 0.5 : r.top < 0 || r.bottom > window.innerHeight) {
          el.scrollIntoView({ block: tall ? "start" : "center", behavior: "smooth" });
        }
      }
      const r = el.getBoundingClientRect();
      setTracked((prev) =>
        prev.step === step &&
        prev.rect &&
        Math.abs(prev.rect.top - r.top) < 0.5 &&
        Math.abs(prev.rect.left - r.left) < 0.5 &&
        prev.rect.width === r.width &&
        prev.rect.height === r.height
          ? prev
          : { step, rect: { top: r.top, left: r.left, width: r.width, height: r.height }, missing: false },
      );
    };
    measure();
    const t = setInterval(measure, 120);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      clearInterval(t);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [current, step]);

  // "Click" steps advance when the highlighted element itself is clicked (the click still happens).
  useEffect(() => {
    if (!current || current.action !== "click" || !current.target) return;
    const onClick = (e: MouseEvent) => {
      const hit = [...document.querySelectorAll(`[data-tour="${current.target}"]`)].some(
        (el) => e.target instanceof Node && el.contains(e.target),
      );
      if (hit) setTimeout(next, 0);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [current, next]);

  useLayoutEffect(() => {
    if (card.current) setCardSize({ w: card.current.offsetWidth, h: card.current.offsetHeight });
  }, [step, tracked]);

  if (!current || step === null) return null;
  const live = tracked.step === step && !!current.target;
  const rect = live ? tracked.rect : null;
  const missing = live && tracked.missing;
  // Waiting for the next page to show its element: keep the card hidden instead of jumping.
  const waiting = !!current.target && !rect && !missing;
  const goThere = missing && current.action === "click" && current.href;

  const vw = typeof window === "undefined" ? 1280 : window.innerWidth;
  const vh = typeof window === "undefined" ? 800 : window.innerHeight;
  // Kept inside the screen, so a long table doesn't push the highlight (and the card's room) off it.
  const hole = rect
    ? (() => {
        const top = Math.max(4, rect.top - PAD);
        const bottom = Math.min(vh - 4, rect.top + rect.height + PAD);
        const left = Math.max(4, rect.left - PAD);
        const right = Math.min(vw - 4, rect.left + rect.width + PAD);
        return { top, left, width: Math.max(0, right - left), height: Math.max(0, bottom - top) };
      })()
    : null;

  // Card placement: beside sidebar items, otherwise below (or above when there's no room).
  const cardW = Math.min(340, vw - 32);
  let cardStyle: React.CSSProperties;
  if (vw < 640) {
    // Phones: a sheet at the top or bottom, whichever side of the highlight has more room.
    const low = hole && hole.top > vh - (hole.top + hole.height);
    cardStyle = low ? { top: 16, left: 16 } : { top: vh - cardSize.h - 16, left: 16 };
  } else if (!hole) {
    cardStyle = { top: vh / 2 - cardSize.h / 2, left: vw / 2 - cardSize.w / 2 };
  } else {
    const gap = 14;
    let top: number;
    let left: number;
    if (hole.left + hole.width < 280 && hole.width < 260) {
      left = hole.left + hole.width + gap;
      top = hole.top + hole.height / 2 - cardSize.h / 2;
    } else if (hole.top + hole.height + gap + cardSize.h < vh - 16) {
      top = hole.top + hole.height + gap;
      left = hole.left + hole.width / 2 - cardSize.w / 2;
    } else if (hole.top - gap - cardSize.h > 16) {
      top = hole.top - gap - cardSize.h;
      left = hole.left + hole.width / 2 - cardSize.w / 2;
    } else {
      // Tall element: sit inside the viewport next to it.
      top = vh - cardSize.h - 24;
      left = hole.left - cardSize.w - gap > 16 ? hole.left - cardSize.w - gap : vw - cardSize.w - 24;
    }
    cardStyle = {
      top: Math.min(Math.max(16, top), vh - cardSize.h - 16),
      left: Math.min(Math.max(16, left), vw - cardSize.w - 16),
    };
  }

  const shade = "fixed bg-zinc-950/65 transition-all duration-200";
  const total = STEPS.length - 2; // welcome and finish aren't counted

  return (
    <div className="print:hidden" role="dialog" aria-modal="true" aria-label="Guided tour">
      {hole ? (
        <>
          {/* Four panels around the highlight block every click outside it. */}
          <div className={shade} style={{ top: 0, left: 0, right: 0, height: Math.max(0, hole.top), zIndex: 60 }} />
          <div className={shade} style={{ top: hole.top + hole.height, left: 0, right: 0, bottom: 0, zIndex: 60 }} />
          <div className={shade} style={{ top: hole.top, left: 0, width: Math.max(0, hole.left), height: hole.height, zIndex: 60 }} />
          <div
            className={shade}
            style={{ top: hole.top, left: hole.left + hole.width, right: 0, height: hole.height, zIndex: 60 }}
          />
          {/* Glow ring; on "next" steps it also blocks the element itself. */}
          <div
            className={`fixed rounded-xl ring-2 ring-amber-300 shadow-[0_0_0_6px_rgba(252,211,77,0.25),0_0_32px_rgba(252,211,77,0.35)] transition-all duration-200 ${
              current.action === "click" ? "pointer-events-none animate-pulse" : ""
            }`}
            style={{ ...hole, zIndex: 61 }}
          />
        </>
      ) : (
        <div className="fixed inset-0 bg-zinc-950/65 backdrop-blur-[2px]" style={{ zIndex: 60 }} />
      )}

      <div
        ref={card}
        className={`fixed rounded-2xl bg-white p-5 shadow-2xl ring-1 ring-zinc-900/10 transition-all duration-200 ${
          waiting ? "pointer-events-none opacity-0" : "opacity-100"
        }`}
        style={{ ...cardStyle, width: cardW, zIndex: 62 }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-medium text-amber-600">
            <Sparkles className="size-3.5" />
            {step === 0 || step === STEPS.length - 1 ? "Guided tour" : `Step ${step} of ${total}`}
          </div>
          <button onClick={finish} className="-m-1 rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700" aria-label="End tour">
            <X className="size-4" />
          </button>
        </div>
        <h3 className="mt-2 text-base font-semibold tracking-tight text-zinc-900">{current.title}</h3>
        <p className="mt-1 text-sm leading-relaxed text-zinc-600">
          {goThere
            ? current.body.replace(/^Click [^.]*\.\s*/, "") || "It's in the menu. Tap “Take me there” to open it."
            : missing
              ? current.action === "next"
                ? current.body // just information: no need to point at it
                : "This part isn't on screen right now. You can skip ahead."
              : current.body}
        </p>

        {step > 0 && step < STEPS.length - 1 && (
          <div className="mt-4 h-1 overflow-hidden rounded-full bg-zinc-100">
            <div className="h-full rounded-full bg-amber-400 transition-all" style={{ width: `${(step / total) * 100}%` }} />
          </div>
        )}

        <div className="mt-4 flex items-center justify-between gap-3">
          {step === 0 ? (
            <button onClick={finish} className="text-sm text-zinc-500 hover:text-zinc-900">
              Skip
            </button>
          ) : step < STEPS.length - 1 ? (
            <button onClick={finish} className="text-sm text-zinc-500 hover:text-zinc-900">
              Skip tour
            </button>
          ) : (
            <span />
          )}
          {goThere ? (
            <button
              onClick={() => {
                router.push(current.href!);
                next();
              }}
              className="btn h-9"
            >
              Take me there
            </button>
          ) : current.action === "click" && !missing ? (
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
              <MousePointerClick className="size-4" /> Click the highlighted item
            </span>
          ) : (
            <button onClick={next} className="btn h-9">
              {step === 0 ? "Start tour" : step === STEPS.length - 1 ? "Finish" : "Next"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/** Restarts the tour from anywhere. */
export function startTour() {
  window.dispatchEvent(new Event("start-tour"));
}

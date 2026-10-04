import { getSettings } from "@/lib/data";

// Sign-in screens: no sidebar, just the store name and a centred card.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const name = getSettings().businessName;
  const initials = name
    .replace(/\(.*?\)/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
  return (
    <div className="relative grid min-h-dvh place-items-center overflow-hidden bg-zinc-950 px-4 py-10">
      <div className="pointer-events-none absolute -top-40 -right-32 size-[28rem] rounded-full bg-amber-400/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -left-32 size-[28rem] rounded-full bg-fuchsia-500/10 blur-3xl" />
      <div className="relative w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="grid size-14 place-items-center rounded-2xl bg-gradient-to-br from-amber-200 via-amber-400 to-amber-600 text-lg font-bold text-zinc-950 shadow-lg shadow-amber-500/20">
            {initials || "IN"}
          </div>
          <div className="mt-4 text-lg font-semibold text-white">{name}</div>
        </div>
        {children}
      </div>
    </div>
  );
}

/** "Log in with TikTok": opens TikTok Shop's own seller login, then returns here connected. */
export function TikTokLoginButton({ ready, light = false }: { ready: boolean; light?: boolean }) {
  const base = `inline-flex h-12 items-center gap-3 rounded-xl px-5 text-[15px] font-semibold transition ${
    light ? "bg-white text-zinc-900 hover:bg-zinc-100" : "bg-zinc-950 text-white hover:bg-zinc-800"
  }`;
  const icon = (
    <svg viewBox="0 0 24 24" className="size-5" fill="currentColor" aria-hidden>
      <path d="M16.6 3c.4 2 1.9 3.6 3.9 3.9v3.2a7.4 7.4 0 0 1-3.9-1.2v6.3a5.8 5.8 0 1 1-5.8-5.8c.3 0 .6 0 .9.1v3.3a2.6 2.6 0 1 0 1.7 2.4V3h3.2Z" />
    </svg>
  );
  if (!ready) {
    return (
      <span className={`${base} pointer-events-none opacity-40`} title="Save the App Key and App Secret first">
        {icon} Log in with TikTok
      </span>
    );
  }
  return (
    <a href="/api/tiktok/connect" className={base}>
      {icon} Log in with TikTok
    </a>
  );
}

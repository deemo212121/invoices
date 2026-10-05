import { AppShell } from "@/components/AppShell";

// The app: sidebar (desktop), top bar + tab bar (phones), guided tour. Runs entirely in the browser.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}

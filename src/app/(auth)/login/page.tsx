import { redirect } from "next/navigation";
import { getSettings } from "@/lib/data";
import { LoginForm } from "@/components/AuthForms";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  // No password yet: sign-in is off, so just open the app (online visitors are stopped by proxy.ts).
  if (!getSettings().ownerPasswordHash) redirect("/");
  const { next } = await searchParams;
  return <LoginForm next={next?.startsWith("/") && !next.startsWith("//") ? next : "/"} />;
}

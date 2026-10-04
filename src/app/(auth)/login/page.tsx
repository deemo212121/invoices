import { redirect } from "next/navigation";
import { getSettings } from "@/lib/data";
import { LoginForm } from "@/components/AuthForms";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  if (!getSettings().ownerPasswordHash) redirect("/setup");
  const { next } = await searchParams;
  return <LoginForm next={next?.startsWith("/") && !next.startsWith("//") ? next : "/"} />;
}

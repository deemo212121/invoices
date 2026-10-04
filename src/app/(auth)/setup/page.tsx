import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Globe } from "lucide-react";
import { getSettings } from "@/lib/data";
import { isRemoteRequest } from "@/lib/session";

// Shown on the online address while no store password exists. On the shop computer the app is
// open without a password, so this page just sends you to the dashboard.
export default async function SetupPage() {
  if (getSettings().ownerPasswordHash) redirect("/login");
  if (!isRemoteRequest(await headers())) redirect("/");
  return (
    <div className="rounded-2xl bg-white p-6 text-center shadow-2xl">
      <Globe className="mx-auto size-8 text-zinc-400" strokeWidth={1.5} />
      <h1 className="mt-3 font-semibold">Online access is off</h1>
      <p className="mt-1 text-sm text-zinc-500">
        To use the store from outside, set a store password on the shop computer in{" "}
        <span className="font-medium text-zinc-700">Settings → Store password</span>. Then sign in here.
      </p>
    </div>
  );
}

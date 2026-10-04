import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { MonitorSmartphone } from "lucide-react";
import { getSettings } from "@/lib/data";
import { isRemoteRequest } from "@/lib/session";
import { SetupForm } from "@/components/AuthForms";

// The password can only be created on the shop computer/network, so nobody online can claim it first.
export default async function SetupPage() {
  if (getSettings().ownerPasswordHash) redirect("/login");
  if (isRemoteRequest(await headers())) {
    return (
      <div className="rounded-2xl bg-white p-6 text-center shadow-2xl">
        <MonitorSmartphone className="mx-auto size-8 text-zinc-400" strokeWidth={1.5} />
        <h1 className="mt-3 font-semibold">Not set up yet</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Open the app on the shop computer first and create the store password there. Then sign in here.
        </p>
      </div>
    );
  }
  return <SetupForm />;
}

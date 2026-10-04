import { CheckCircle2 } from "lucide-react";
import { getSettings } from "@/lib/data";
import { SettingsForm } from "@/components/SettingsForm";
import { ChangePasswordForm, SetupForm } from "@/components/AuthForms";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ signin?: string }> }) {
  const { signin } = await searchParams;
  const s = getSettings();
  return (
    <>
      {signin === "on" && s.ownerPasswordHash && (
        <p className="flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800 ring-1 ring-emerald-600/15">
          <CheckCircle2 className="size-4 shrink-0" />
          Sign-in is on. Use the store password on your phone and the online address. This computer stays signed in.
        </p>
      )}
      <p className="text-sm text-zinc-500">Business information printed on every invoice.</p>
      <SettingsForm settings={s} />
      {s.ownerPasswordHash ? <ChangePasswordForm /> : <SetupForm />}
    </>
  );
}

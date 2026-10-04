import { getSettings } from "@/lib/data";
import { SettingsForm } from "@/components/SettingsForm";
import { ChangePasswordForm } from "@/components/AuthForms";

export default function SettingsPage() {
  return (
    <>
      <p className="text-sm text-zinc-500">Business information printed on every invoice.</p>
      <SettingsForm settings={getSettings()} />
      <ChangePasswordForm />
    </>
  );
}

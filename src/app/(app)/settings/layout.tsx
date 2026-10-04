import { SettingsTabs } from "@/components/SettingsTabs";

export default function SettingsLayout({ children }: LayoutProps<"/settings">) {
  return (
    <div className="max-w-5xl space-y-4">
      <h1 className="page-title">Settings</h1>
      <SettingsTabs />
      {children}
    </div>
  );
}

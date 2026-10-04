import { getSettings } from "@/lib/data";
import { Sidebar } from "@/components/Sidebar";
import { MarketplaceAutoSync } from "@/components/MarketplaceAutoSync";
import { GuidedTour } from "@/components/GuidedTour";
import { MobileNav } from "@/components/MobileNav";
import { getConnection } from "@/lib/tiktok/client";

// The signed-in app: sidebar (desktop), top bar + tab bar (phones), guided tour.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  const s = getSettings();
  const tiktok = getConnection();
  const tiktokConnected = !!tiktok.accessToken && !!tiktok.shopCipher;
  return (
    <div className="min-h-full lg:flex">
      <Sidebar
        businessName={s.businessName}
        vatRegistered={s.vatRegistered}
        tiktokConnected={tiktokConnected}
        signInOn={!!s.ownerPasswordHash}
      />
      <MarketplaceAutoSync enabled={tiktok.autoSync && !!tiktok.accessToken} />
      <MobileNav businessName={s.businessName} tiktokConnected={tiktokConnected} signInOn={!!s.ownerPasswordHash} />
      <GuidedTour />
      <main className="min-w-0 flex-1 px-4 pt-5 pb-28 sm:px-6 lg:px-8 lg:py-6 print:p-0">{children}</main>
    </div>
  );
}

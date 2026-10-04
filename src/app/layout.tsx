import type { Metadata } from "next";
import "@fontsource-variable/inter";
import "./globals.css";
import { getSettings } from "@/lib/data";
import { Sidebar } from "@/components/Sidebar";
import { MarketplaceAutoSync } from "@/components/MarketplaceAutoSync";
import { GuidedTour } from "@/components/GuidedTour";
import { MobileNav } from "@/components/MobileNav";
import { getConnection } from "@/lib/tiktok/client";

// Every page reads live data from the local database.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Inventory & Invoicing",
  description: "Local inventory, point of sale and invoicing",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  const s = getSettings();
  const tiktok = getConnection();
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full lg:flex">
        <Sidebar
          businessName={s.businessName}
          vatRegistered={s.vatRegistered}
          tiktokConnected={!!tiktok.accessToken && !!tiktok.shopCipher}
        />
        <MarketplaceAutoSync enabled={tiktok.autoSync && !!tiktok.accessToken} />
        <MobileNav businessName={s.businessName} tiktokConnected={!!tiktok.accessToken && !!tiktok.shopCipher} />
        <GuidedTour />
        <main className="min-w-0 flex-1 px-4 pt-5 pb-28 sm:px-6 lg:px-8 lg:py-6 print:p-0">{children}</main>
      </body>
    </html>
  );
}

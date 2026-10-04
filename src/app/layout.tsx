import type { Metadata } from "next";
import "@fontsource-variable/inter";
import "./globals.css";

// Every page reads live data from the local database.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Inventory & Invoicing",
  description: "Local inventory, point of sale and invoicing",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}

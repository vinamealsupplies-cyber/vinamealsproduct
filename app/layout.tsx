import type { Metadata } from "next";
import { Suspense } from "react";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

// Header uses cookies/session — force dynamic so Next never static-bails mid-render.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  // Real domain so OG/Twitter images resolve correctly when sharing.
  metadataBase: new URL("https://vinamealsupplies.com"),
  title: {
    default: "Vinameals — Real food make your life",
    template: "%s | Vinameals"
  },
  description:
    "Vinameals supplies pantry staples, frozen favorites, snacks, sauces, and beverages to homes and businesses across the United States. Retail and wholesale, pickup or shipping.",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "32x32" },
      { url: "/logo-mark.png", type: "image/png", sizes: "512x512" }
    ],
    apple: "/apple-touch-icon.png"
  },
  openGraph: {
    title: "Vinameals — Real food make your life",
    description: "Pantry, frozen, snack, sauce, and beverage favorites for homes and businesses.",
    images: ["/logo-vinameals.jpg"],
    type: "website"
  }
};

function HeaderFallback() {
  return <header className="site-header" aria-hidden="true" style={{ minHeight: 120 }} />;
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <Suspense fallback={<HeaderFallback />}>
          <SiteHeader />
        </Suspense>
        <main>{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}

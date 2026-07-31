import type { Metadata } from "next";
import "./globals.css";

// Root shell only — no shop header/footer here so /admin is a separate chrome.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
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

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

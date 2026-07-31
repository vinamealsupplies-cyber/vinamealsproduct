import { Suspense } from "react";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

function HeaderFallback() {
  return <header className="site-header" aria-hidden="true" style={{ minHeight: 120 }} />;
}

/**
 * Storefront chrome only (shop, cart, account, login…).
 * Admin lives under /admin with its own layout — no shop header/footer there.
 */
export default function StorefrontLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Suspense fallback={<HeaderFallback />}>
        <SiteHeader />
      </Suspense>
      <main>{children}</main>
      <SiteFooter />
    </>
  );
}

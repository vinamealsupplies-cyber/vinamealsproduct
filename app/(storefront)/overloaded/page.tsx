import Link from "next/link";
import type { Metadata } from "next";
import { SITE_OVERLOADED_MESSAGE } from "@/lib/user-facing-error";

export const metadata: Metadata = {
  title: "Please try again shortly",
  robots: { index: false, follow: false }
};

/** Friendly page when the site/worker is overloaded. */
export default function OverloadedPage() {
  return (
    <div className="page-shell shell narrow-page">
      <div className="empty-state large overload-state">
        <div className="overload-badge" aria-hidden="true">
          !
        </div>
        <h1>Website overloaded</h1>
        <p>{SITE_OVERLOADED_MESSAGE}</p>
        <div className="checkout-actions-row">
          <Link className="button primary" href="/">
            Back to home
          </Link>
          <Link className="button secondary" href="/products">
            Browse products
          </Link>
        </div>
      </div>
    </div>
  );
}

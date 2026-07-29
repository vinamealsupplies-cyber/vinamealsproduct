import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { ShieldCheck, Star, UserRound } from "lucide-react";
import { CartAccountBridge } from "@/components/cart-account-bridge";
import { CartLink } from "@/components/cart-link";
import { CategoryMenu } from "@/components/category-menu";
import { HeaderSearch } from "@/components/header-search";
import { getViewer } from "@/lib/auth";
import { getStorefrontCategories } from "@/lib/data/categories";
import type { CategoryNode } from "@/lib/category-types";
import type { Viewer } from "@/lib/auth";

/**
 * Keep header work minimal for Cloudflare Free CPU limits.
 * Open-order badge is skipped here (was an extra DB hit on every page).
 */
export async function SiteHeader() {
  let viewer: Viewer | null = null;
  let categories: CategoryNode[] = [];

  // Sequential is fine; allSettled avoids one failure blanking the whole shell.
  const [viewerResult, categoriesResult] = await Promise.allSettled([
    getViewer(),
    getStorefrontCategories()
  ]);
  if (viewerResult.status === "fulfilled") viewer = viewerResult.value;
  if (categoriesResult.status === "fulfilled") categories = categoriesResult.value;

  const cartUserId = viewer && !viewer.demo ? viewer.id : null;

  return (
    <header className="site-header">
      <CartAccountBridge userId={cartUserId} />
      <div className="announcement-bar">
        <div className="shell announcement-inner">
          <span>Fresh finds for everyday meals</span>
          <span className="announcement-separator" aria-hidden="true">
            •
          </span>
          <span>Wholesale accounts available</span>
        </div>
      </div>
      <div className="shell header-main">
        <Link className="brand" href="/" aria-label="Vinameals home">
          <Image
            className="brand-logo"
            src="/logo-vinameals.png"
            alt="Vinameals"
            width={640}
            height={350}
            priority
          />
        </Link>

        <Suspense fallback={<div className="header-search" aria-hidden="true" />}>
          <HeaderSearch />
        </Suspense>

        <nav className="header-actions" aria-label="Account navigation">
          {viewer?.isStaff ? (
            <Link className="header-action admin-link" href="/admin">
              <ShieldCheck size={19} aria-hidden="true" />
              <span>Admin</span>
            </Link>
          ) : viewer?.isSeller ? (
            <Link className="header-action admin-link" href="/admin">
              <ShieldCheck size={19} aria-hidden="true" />
              <span>Seller</span>
            </Link>
          ) : null}
          <Link
            className="header-action"
            href={viewer ? "/account#purchase-history" : "/login"}
            aria-label={viewer ? "Account" : "Sign in"}
          >
            <UserRound size={19} aria-hidden="true" />
            <span className="header-account-label">{viewer ? "Account" : "Sign in"}</span>
          </Link>
          <CartLink />
        </nav>
      </div>

      <div className="category-strip">
        <div className="shell category-strip-inner">
          <Link href="/products" prefetch={false}>
            Shop all
          </Link>
          <CategoryMenu categories={categories} />
          <Link href="/products?sort=newest" prefetch={false}>
            New arrivals
          </Link>
          <Link className="nav-sale-link" href="/products?sale=1" prefetch={false}>
            <Star className="sale-star-blink" size={15} aria-hidden="true" fill="currentColor" />
            Sale
          </Link>
          <Link href="/wholesale">Business customers</Link>
        </div>
      </div>
    </header>
  );
}

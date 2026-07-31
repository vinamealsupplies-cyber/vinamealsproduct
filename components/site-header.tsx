import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { ShieldCheck, Star } from "lucide-react";
import { AccountMenu } from "@/components/account-menu";
import { CartAccountBridge } from "@/components/cart-account-bridge";
import { CartLink } from "@/components/cart-link";
import { CategoryMenu } from "@/components/category-menu";
import { HeaderSearch } from "@/components/header-search";
import { getViewer } from "@/lib/auth";
import { getOwnBusinessAccount } from "@/lib/data/business-account";
import { getStorefrontCategories } from "@/lib/data/categories";
import type { CategoryNode } from "@/lib/category-types";
import { isSupabaseAdminConfigured } from "@/lib/env";
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

  // Business đã được duyệt thì bỏ mục "application" khỏi menu (không còn gì để
  // xin nữa). Chỉ 1 select 1 dòng theo index, và CHỈ khi đã đăng nhập — khách
  // vào trang không tốn thêm round-trip nào. Vẫn xem lại được ở /account.
  let businessApproved = false;
  if (viewer && !viewer.demo && isSupabaseAdminConfigured()) {
    const business = await getOwnBusinessAccount(viewer.id).catch(() => null);
    businessApproved = Boolean(business?.isBusiness);
  }

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
            <Link
              className="header-action admin-link"
              href="/admin"
              title="Open admin workspace (no shop chrome)"
            >
              <ShieldCheck size={19} aria-hidden="true" />
              <span>Admin</span>
            </Link>
          ) : viewer?.isSeller ? (
            <Link
              className="header-action admin-link"
              href="/admin"
              title="Open seller workspace (no shop chrome)"
            >
              <ShieldCheck size={19} aria-hidden="true" />
              <span>Seller</span>
            </Link>
          ) : null}
          <AccountMenu
            signedIn={Boolean(viewer)}
            fullName={viewer?.fullName}
            email={viewer?.email}
            showBusinessApplication={!businessApproved}
            canAccessAdmin={Boolean(viewer?.canAccessAdmin)}
            adminLabel={viewer?.isSeller ? "Seller workspace" : "Admin"}
          />
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

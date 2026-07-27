import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { ShieldCheck, UserRound } from "lucide-react";
import { CartLink } from "@/components/cart-link";
import { CategoryMenu } from "@/components/category-menu";
import { HeaderSearch } from "@/components/header-search";
import { getViewer } from "@/lib/auth";
import { getStorefrontCategories } from "@/lib/data/categories";

export async function SiteHeader() {
  const [viewer, categories] = await Promise.all([getViewer(), getStorefrontCategories()]);

  return (
    <header className="site-header">
      <div className="announcement-bar">
        <div className="shell announcement-inner">
          <span>Fresh finds for everyday meals</span>
          <span className="announcement-separator" aria-hidden="true">•</span>
          <span>Wholesale accounts available</span>
        </div>
      </div>
      <div className="shell header-main">
        <Link className="brand" href="/" aria-label="Vinameals home">
          {/* PNG nền trong suốt để logo không thành hộp chữ nhật trên nền kem
              của header. Bản .jpg (có nền) vẫn giữ cho thẻ Open Graph, vì ảnh
              trong suốt lên mạng xã hội thường bị nền đen. */}
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
          ) : null}
          <Link className="header-action" href={viewer ? "/account" : "/login"}>
            <UserRound size={19} aria-hidden="true" />
            <span>{viewer ? "Account" : "Sign in"}</span>
          </Link>
          <CartLink />
        </nav>
      </div>

      <div className="category-strip">
        <div className="shell category-strip-inner">
          {/* Shop all: URL sạch — catalog clear search/category/sort. */}
          <Link href="/products" prefetch={false}>
            Shop all
          </Link>
          <CategoryMenu categories={categories} />
          <Link href="/products?sort=newest">New arrivals</Link>
          <Link href="/wholesale">Business customers</Link>
        </div>
      </div>
    </header>
  );
}

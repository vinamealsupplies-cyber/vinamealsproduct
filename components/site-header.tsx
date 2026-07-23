import Image from "next/image";
import Link from "next/link";
import { ChevronDown, Search, ShieldCheck, ShoppingBag, UserRound } from "lucide-react";
import { getViewer } from "@/lib/auth";
import { categories } from "@/lib/sample-data";

export async function SiteHeader() {
  const viewer = await getViewer();

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

        <form className="header-search" action="/products" method="get" role="search">
          <Search size={18} aria-hidden="true" />
          <input name="q" type="search" placeholder="Search products" aria-label="Search products" />
          <button type="submit">Search</button>
        </form>

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
          <Link className="header-action" href="/cart" aria-label="Cart with zero items">
            <ShoppingBag size={19} aria-hidden="true" />
            <span>Cart</span>
            <span className="cart-count">0</span>
          </Link>
        </nav>
      </div>

      <div className="category-strip">
        <div className="shell category-strip-inner">
          <Link href="/products">Shop all</Link>
          <details className="category-menu">
            <summary>
              Categories <ChevronDown size={16} aria-hidden="true" />
            </summary>
            <div className="category-dropdown">
              {categories.map((category) => (
                <div className="category-group" key={category.slug}>
                  <Link className="category-parent" href={`/products?category=${category.slug}`}>
                    {category.name}
                  </Link>
                  {category.children.map((child) => (
                    <Link key={child} href={`/products?q=${encodeURIComponent(child)}`}>
                      {child}
                    </Link>
                  ))}
                </div>
              ))}
              <div className="category-promo">
                <span>For cafés and markets</span>
                <strong>Wholesale pricing</strong>
                <Link href="/wholesale">Learn more</Link>
              </div>
            </div>
          </details>
          <Link href="/products?sort=newest">New arrivals</Link>
          <Link href="/products?category=frozen">Frozen favorites</Link>
          <Link href="/products?category=snacks">Snacks</Link>
          <Link href="/wholesale">Business customers</Link>
        </div>
      </div>
    </header>
  );
}

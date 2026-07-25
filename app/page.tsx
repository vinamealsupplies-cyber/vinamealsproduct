import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Building2, PackageCheck, Search, Sparkles } from "lucide-react";
import { ProductCard } from "@/components/product-card";
import { getStorefrontCategories } from "@/lib/data/categories";
import { getProducts } from "@/lib/data/products";

export default async function HomePage() {
  const [products, categories] = await Promise.all([getProducts(), getStorefrontCategories()]);
  const featured = products.filter((product) => product.featured).slice(0, 3);
  return (
    <>
      <section className="hero-section">
        <div className="shell hero-grid">
          <div className="hero-copy">
            <span className="kicker"><Sparkles size={16} /> Colorful food, easy ordering</span>
            <h1>Bright favorites for every shelf and table.</h1>
            <p>Shop pantry staples, frozen favorites, snacks, sauces, and beverages for home or business.</p>
            <div className="hero-actions">
              <Link className="button primary" href="/products">Shop all products <ArrowRight size={17} /></Link>
              <Link className="button secondary" href="/wholesale">Explore wholesale</Link>
            </div>
            <div className="hero-points">
              <span><PackageCheck size={18} /> Live inventory ready</span>
              <span><Search size={18} /> Search by product or SKU</span>
              <span><Building2 size={18} /> Business accounts</span>
            </div>
          </div>
          <div className="hero-visual" aria-label="Featured food products">
            <div className="hero-orbit orbit-one" />
            <div className="hero-orbit orbit-two" />
            <div className="hero-product hero-product-main">
              <Image src="/products/tropical-mango.svg" alt="Tropical Mango Slices" fill priority sizes="(max-width: 900px) 70vw, 32vw" />
            </div>
            <div className="hero-product hero-product-small top">
              <Image src="/products/chili-crisp.svg" alt="Golden Chili Crisp" fill priority sizes="180px" />
            </div>
            <div className="hero-product hero-product-small bottom">
              <Image src="/products/coconut-water.svg" alt="Pure Coconut Water" fill priority sizes="180px" />
            </div>
            <div className="hero-sticker"><strong>Fresh</strong><span>new finds</span></div>
          </div>
        </div>
      </section>

      <section className="section shell">
        <div className="section-heading split-heading">
          <div><span className="kicker">Browse your way</span><h2>Shop by category</h2></div>
          <Link className="text-link" href="/products">View all products <ArrowRight size={16} /></Link>
        </div>
        <div className="category-card-grid">
          {categories.map((category, index) => (
            // Chỉ có 5 tone màu nên xoay vòng khi danh mục nhiều hơn 5.
            <Link className={`category-card category-tone-${(index % 5) + 1}`} href={`/products?category=${category.slug}`} key={category.id}>
              <span className="category-card-number">{String(index + 1).padStart(2, "0")}</span>
              <div>
                <h3>{category.name}</h3>
                <p>{category.children.length ? category.children.map((child) => child.name).join(" · ") : "Browse products"}</p>
              </div>
              <ArrowRight size={20} />
            </Link>
          ))}
        </div>
      </section>

      <section className="section featured-section">
        <div className="shell">
          <div className="section-heading split-heading">
            <div><span className="kicker">Customer favorites</span><h2>Featured products</h2></div>
            <Link className="text-link" href="/products?sort=featured">See the collection <ArrowRight size={16} /></Link>
          </div>
          <div className="product-grid featured-grid">
            {featured.map((product) => <ProductCard key={product.id} product={product} />)}
          </div>
        </div>
      </section>

      <section className="section shell wholesale-banner">
        <div>
          <span className="kicker light">Built for growing businesses</span>
          <h2>Wholesale ordering without the spreadsheet shuffle.</h2>
          <p>Separate wholesale pricing, approved tax-exempt status, invoices, balances, and customer history in one account.</p>
          <Link className="button light" href="/wholesale">Open a business account <ArrowRight size={17} /></Link>
        </div>
      </section>
    </>
  );
}

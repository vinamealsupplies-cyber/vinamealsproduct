import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Building2, PackageCheck, Search, Sparkles } from "lucide-react";
import { ProductCard } from "@/components/product-card";
import { categories, products } from "@/lib/sample-data";

export default function HomePage() {
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
            <Link className={`category-card category-tone-${index + 1}`} href={`/products?category=${category.slug}`} key={category.slug}>
              <span className="category-card-number">0{index + 1}</span>
              <div><h3>{category.name}</h3><p>{category.children.join(" · ")}</p></div>
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
        <div className="wholesale-stats">
          <article><strong>2</strong><span>customer price levels</span></article>
          <article><strong>10</strong><span>images per product</span></article>
          <article><strong>1</strong><span>inventory source of truth</span></article>
        </div>
      </section>

      <section className="section shell process-section">
        <div className="section-heading centered"><span className="kicker">Simple by design</span><h2>Find it, order it, track it.</h2></div>
        <div className="process-grid">
          <article><span>01</span><h3>Discover</h3><p>Search product names, browse categories, and sort the catalog your way.</p></article>
          <article><span>02</span><h3>Choose</h3><p>Review a rich product gallery with up to 10 images and an optional video.</p></article>
          <article><span>03</span><h3>Manage</h3><p>Account and admin tools keep customers, invoices, products, and inventory connected.</p></article>
        </div>
      </section>
    </>
  );
}

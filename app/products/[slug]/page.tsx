import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Building2, Check, ChevronRight, Minus, Plus, Truck } from "lucide-react";
import { ProductGallery } from "@/components/product-gallery";
import { ProductCard } from "@/components/product-card";
import { getProductBySlug, products } from "@/lib/sample-data";
import { usd } from "@/lib/format";

export function generateStaticParams() {
  return products.map((product) => ({ slug: product.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const product = getProductBySlug(slug);
  return product ? { title: product.name, description: product.shortDescription } : { title: "Product not found" };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = getProductBySlug(slug);
  if (!product) notFound();
  const related = products.filter((item) => item.id !== product.id && item.category === product.category).slice(0, 3);
  const fallback = products.filter((item) => item.id !== product.id).slice(0, 3);

  return (
    <div className="page-shell shell">
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <Link href="/">Home</Link><ChevronRight size={14} /><Link href="/products">Products</Link><ChevronRight size={14} /><span>{product.name}</span>
      </nav>
      <section className="product-detail-grid">
        <ProductGallery media={product.media} productName={product.name} />
        <div className="product-detail-copy">
          <span className="kicker">{product.category}</span>
          <h1>{product.name}</h1>
          <p className="product-detail-lead">{product.shortDescription}</p>
          <div className="detail-price-row"><strong>{usd.format(product.price)}</strong><span>Retail price</span></div>
          <div className="detail-stock"><Check size={17} /> {product.stock} units available <span>SKU {product.sku}</span></div>
          <p className="product-description">{product.description}</p>
          <div className="quantity-label">Quantity</div>
          <div className="purchase-row">
            <div className="quantity-control" aria-label="Quantity selector preview"><button type="button" aria-label="Decrease quantity"><Minus size={16} /></button><span>1</span><button type="button" aria-label="Increase quantity"><Plus size={16} /></button></div>
            <button className="button primary add-to-cart" type="button">Add to cart</button>
          </div>
          <p className="payment-note">Cart UI is included for planning. Checkout and payment processing are intentionally scheduled for a later phase.</p>
          <div className="detail-benefits">
            <article><Truck size={21} /><div><strong>Delivery workflow ready</strong><span>Add shipping rates and fulfillment rules before launch.</span></div></article>
            <article><Building2 size={21} /><div><strong>Buying for a business?</strong><span>Wholesale pricing and approved tax-exempt treatment are evaluated separately.</span></div></article>
          </div>
        </div>
      </section>
      <section className="section related-products">
        <div className="section-heading"><span className="kicker">Keep exploring</span><h2>You may also like</h2></div>
        <div className="product-grid">{(related.length ? related : fallback).map((item) => <ProductCard key={item.id} product={item} />)}</div>
      </section>
    </div>
  );
}

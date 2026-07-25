import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Building2, Check, ChevronRight, Truck } from "lucide-react";
import { AddToCart } from "@/components/add-to-cart";
import { ProductGallery } from "@/components/product-gallery";
import { ProductCard } from "@/components/product-card";
import { getProducts } from "@/lib/data/products";
import { usd } from "@/lib/format";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const product = (await getProducts()).find((item) => item.slug === slug);
  return product ? { title: product.name, description: product.shortDescription } : { title: "Product not found" };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const products = await getProducts();
  const product = products.find((item) => item.slug === slug);
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
          <AddToCart productId={product.id} stock={product.stock} />
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

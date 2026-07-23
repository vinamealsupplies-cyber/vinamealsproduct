import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, PackageCheck } from "lucide-react";
import type { Product } from "@/lib/sample-data";
import { usd } from "@/lib/format";

export function ProductCard({ product }: { product: Product }) {
  const image = product.media.find((item) => item.type === "image" && item.src);
  const lowStock = product.stock > 0 && product.stock <= 10;

  return (
    <article className="product-card">
      <Link className="product-card-image" href={`/products/${product.slug}`}>
        {image?.src ? (
          <Image src={image.src} alt={image.alt} fill sizes="(max-width: 640px) 80vw, (max-width: 1100px) 40vw, 25vw" />
        ) : (
          <div className="image-placeholder">Image coming soon</div>
        )}
        <span className="product-card-action">View product <ArrowUpRight size={16} /></span>
        {product.featured ? <span className="product-badge">Featured</span> : null}
      </Link>
      <div className="product-card-body">
        <div className="eyebrow-row">
          <span>{product.category}</span>
          <span className={lowStock ? "stock-label low" : "stock-label"}>
            <PackageCheck size={14} aria-hidden="true" />
            {product.stock > 0 ? (lowStock ? `Only ${product.stock} left` : "In stock") : "Out of stock"}
          </span>
        </div>
        <h3><Link href={`/products/${product.slug}`}>{product.name}</Link></h3>
        <p>{product.shortDescription}</p>
        <div className="product-price-row">
          <strong>{usd.format(product.price)}</strong>
          <Link href={`/products/${product.slug}`}>Details</Link>
        </div>
      </div>
    </article>
  );
}

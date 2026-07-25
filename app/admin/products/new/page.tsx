import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { AdminPageHeader } from "@/components/admin-page-header";
import { ProductForm } from "@/components/product-form";
import { getCategoryTree } from "@/lib/data/categories";

export default async function NewProductPage() {
  const categories = await getCategoryTree();
  return (
    <>
      <AdminPageHeader eyebrow="Catalog" title="Add product" description="Create the customer-facing product, sellable SKU, prices, inventory settings, and media." action={<Link className="button secondary" href="/admin/products"><ChevronLeft size={17} /> Back to products</Link>} />
      <ProductForm categories={categories} />
    </>
  );
}

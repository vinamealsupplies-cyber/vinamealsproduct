import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { AdminPageHeader } from "@/components/admin-page-header";
import { ProductForm } from "@/components/product-form";
import { requireAdminAccessPage } from "@/lib/auth";
import { getAdminProductById } from "@/lib/data/admin-products";
import { getCategoryTree } from "@/lib/data/categories";

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await requireAdminAccessPage();
  const { id } = await params;
  const [product, categories] = await Promise.all([getAdminProductById(id), getCategoryTree()]);
  if (!product) notFound();

  return (
    <>
      <AdminPageHeader
        eyebrow="Catalog"
        title={product.name}
        description={`SKU ${product.sku || "—"} · status ${product.status}`}
        action={
          <Link className="button secondary" href="/admin/products">
            <ChevronLeft size={17} /> Back to products
          </Link>
        }
      />
      <ProductForm categories={categories} product={product} isSeller={viewer.isSeller} />
    </>
  );
}

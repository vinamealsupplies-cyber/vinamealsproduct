import Link from "next/link";
import { FileSpreadsheet, Plus } from "lucide-react";
import { AdminPageHeader } from "@/components/admin-page-header";
import { ProductManager } from "@/components/product-manager";
import { requireAdminAccessPage } from "@/lib/auth";
import { getAdminProductList } from "@/lib/data/admin-products";

export const metadata = { title: "Products" };

export default async function AdminProductsPage() {
  // Seller + staff: list / add / edit. Delete forever = manager only.
  const viewer = await requireAdminAccessPage();
  const products = await getAdminProductList();

  return (
    <>
      <AdminPageHeader
        eyebrow="Catalog"
        title="Products"
        description={
          viewer.isSeller
            ? "Thêm và chỉnh sản phẩm cho bán hằng ngày. Mọi thay đổi được ghi log cho admin."
            : "Add, search, price, and maintain products. Archived items stay under the Archived tab — edit or restore anytime."
        }
        action={
          <div className="button-row">
            {viewer.isStaff ? (
              <Link className="button secondary" href="/admin/imports">
                <FileSpreadsheet size={17} /> Import Excel
              </Link>
            ) : null}
            <Link className="button primary" href="/admin/products/new">
              <Plus size={17} /> Add product
            </Link>
          </div>
        }
      />
      <ProductManager
        products={products}
        canDeleteForever={Boolean(viewer.isManager)}
        isSeller={viewer.isSeller}
      />
    </>
  );
}

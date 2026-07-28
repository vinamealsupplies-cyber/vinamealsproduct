import { AdminPageHeader } from "@/components/admin-page-header";
import { AddCategoryHeaderButton, CategoryManager } from "@/components/category-manager";
import { requireStaffPage } from "@/lib/auth";
import { getCategoryTree, toParentOptions } from "@/lib/data/categories";

export default async function CategoriesPage() {
  await requireStaffPage();
  const tree = await getCategoryTree();
  const parents = toParentOptions(tree);

  return (
    <>
      <AdminPageHeader
        eyebrow="Catalog"
        title="Categories"
        description="Create nested categories and control the dropdown order shown in the storefront."
        action={<AddCategoryHeaderButton />}
      />
      <CategoryManager tree={tree} parents={parents} />
    </>
  );
}

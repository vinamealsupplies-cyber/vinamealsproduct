import "server-only";

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { createPublicClient } from "@/lib/supabase/public";

// Categories đọc từ Supabase. Dùng SSR client (cookie session) để staff thấy
// cả category đang ẩn — RLS `categories_public_read` chỉ trả is_active cho
// người thường, còn staff thấy tất cả.

export type CategoryRow = {
  id: string;
  parentId: string | null;
  name: string;
  slug: string;
  sortOrder: number;
  isActive: boolean;
};

export type CategoryNode = CategoryRow & { children: CategoryRow[] };

type DbRow = {
  id: string;
  parent_id: string | null;
  name: string;
  slug: string;
  sort_order: number;
  is_active: boolean;
};

function mapRow(row: DbRow): CategoryRow {
  return {
    id: row.id,
    parentId: row.parent_id,
    name: row.name,
    slug: row.slug,
    sortOrder: row.sort_order,
    isActive: row.is_active
  };
}

function buildTree(data: DbRow[] | null): CategoryNode[] {
  const rows = (data ?? []).map(mapRow);
  const parents = rows.filter((row) => !row.parentId);
  const childrenByParent = new Map<string, CategoryRow[]>();
  for (const row of rows) {
    if (!row.parentId) continue;
    const bucket = childrenByParent.get(row.parentId) ?? [];
    bucket.push(row);
    childrenByParent.set(row.parentId, bucket);
  }

  return parents.map((parent) => ({ ...parent, children: childrenByParent.get(parent.id) ?? [] }));
}

const SELECT_COLUMNS = "id, parent_id, name, slug, sort_order, is_active";

/** Cây category cho khu admin — staff thấy cả category đang ẩn. */
export async function getCategoryTree(): Promise<CategoryNode[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("categories")
    .select(SELECT_COLUMNS)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) throw new Error(`Failed to load categories: ${error.message}`);
  return buildTree(data as DbRow[] | null);
}

/**
 * Cây category cho storefront (menu header). Dùng anon client — không đụng
 * cookie nên không ép request thành dynamic, và chỉ trả category đang hiện.
 * cache() để nhiều component trong cùng một request dùng chung 1 query.
 */
export const getStorefrontCategories = cache(async (): Promise<CategoryNode[]> => {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("categories")
    .select(SELECT_COLUMNS)
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  // Menu điều hướng không đáng để làm sập cả trang nếu DB lỗi tạm thời.
  if (error) return [];
  return buildTree(data as DbRow[] | null);
});

/** Danh sách category gốc (phẳng) để đổ vào ô chọn "Parent". */
export function toParentOptions(tree: CategoryNode[]): CategoryRow[] {
  return tree.map((node) => ({
    id: node.id,
    parentId: node.parentId,
    name: node.name,
    slug: node.slug,
    sortOrder: node.sortOrder,
    isActive: node.isActive
  }));
}

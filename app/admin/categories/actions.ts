"use server";

import { revalidatePath } from "next/cache";
import { getViewer } from "@/lib/auth";
import { callerKey, checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import type { CategoryFormState } from "@/lib/data/category-form";

// Server actions cho quản lý category. Ghi bằng SSR client (session của staff
// đang đăng nhập) nên RLS `categories_staff_all` là lớp chặn thật — guard
// getViewer() ở đây chỉ để báo lỗi sớm và rõ ràng cho UI.
// Lưu ý: file "use server" chỉ export async function — type/hằng của form nằm
// ở lib/data/category-form.ts.

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function readForm(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const rawSlug = String(formData.get("slug") ?? "").trim();
  const parentId = String(formData.get("parentId") ?? "").trim();
  const sortOrderRaw = String(formData.get("sortOrder") ?? "").trim();
  const sortOrder = Number.parseInt(sortOrderRaw, 10);

  const taxRaw = String(formData.get("taxCategory") ?? "grocery").trim();
  const taxCategory =
    taxRaw === "general" || taxRaw === "prepared_food" ? taxRaw : "grocery";

  return {
    name,
    slug: slugify(rawSlug || name),
    parentId: parentId || null,
    sortOrder: Number.isFinite(sortOrder) ? sortOrder : 0,
    isActive: formData.get("isActive") !== null,
    taxCategory
  };
}

function friendlyError(message: string) {
  if (message.includes("categories_slug_key") || message.includes("duplicate key")) {
    return "That slug is already used by another category. Pick a different one.";
  }
  if (message.includes("categories_not_self_parent")) {
    return "A category cannot be its own parent.";
  }
  if (message.includes("row-level security") || message.includes("permission denied")) {
    return "Your account does not have permission to change categories.";
  }
  return message;
}

async function requireStaff() {
  const viewer = await getViewer();
  return viewer?.isStaff ? viewer : null;
}

/** Chặn tài khoản staff bị chiếm dụng spam ghi hàng loạt vào catalog. */
async function withinMutationLimit() {
  return checkRateLimit(await callerKey("admin-category"), RATE_LIMITS.mutation);
}

const RATE_LIMITED: CategoryFormState = {
  status: "error",
  message: "Too many changes in a short time. Wait a minute and try again."
};

function revalidate() {
  // "layout" để menu Categories trên header (nằm ở root layout) cũng được
  // dựng lại trên mọi route, không chỉ trang đang xem.
  revalidatePath("/", "layout");
  revalidatePath("/admin/categories");
}

export async function createCategoryAction(
  _prevState: CategoryFormState,
  formData: FormData
): Promise<CategoryFormState> {
  if (!(await requireStaff())) {
    return { status: "error", message: "Staff access is required." };
  }
  if (!(await withinMutationLimit())) return RATE_LIMITED;

  const input = readForm(formData);
  if (!input.name) return { status: "error", message: "Category name is required." };
  if (!input.slug) return { status: "error", message: "Slug is required (letters and numbers)." };

  const supabase = await createClient();
  const { error } = await supabase.from("categories").insert({
    name: input.name,
    slug: input.slug,
    parent_id: input.parentId,
    sort_order: input.sortOrder,
    is_active: input.isActive,
    tax_category: input.taxCategory
  });

  if (error) return { status: "error", message: friendlyError(error.message) };

  revalidate();
  return { status: "success", message: `Added “${input.name}”.` };
}

export async function updateCategoryAction(
  _prevState: CategoryFormState,
  formData: FormData
): Promise<CategoryFormState> {
  if (!(await requireStaff())) {
    return { status: "error", message: "Staff access is required." };
  }
  if (!(await withinMutationLimit())) return RATE_LIMITED;

  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { status: "error", message: "Missing category id." };

  const input = readForm(formData);
  if (!input.name) return { status: "error", message: "Category name is required." };
  if (!input.slug) return { status: "error", message: "Slug is required (letters and numbers)." };
  if (input.parentId === id) return { status: "error", message: "A category cannot be its own parent." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("categories")
    .update({
      name: input.name,
      slug: input.slug,
      parent_id: input.parentId,
      sort_order: input.sortOrder,
      is_active: input.isActive,
      tax_category: input.taxCategory
    })
    .eq("id", id);

  if (error) return { status: "error", message: friendlyError(error.message) };

  revalidate();
  return { status: "success", message: `Saved “${input.name}”.` };
}

"use server";

import { revalidatePath } from "next/cache";
import { getViewer } from "@/lib/auth";
import { callerKey, checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AdminFormState } from "@/lib/data/admin-form";

// CRUD chi phí. Theo RLS `expenses_staff_all` thì chi phí thuộc quyền manager
// (dữ liệu tài chính), nên tất cả action ở đây đều yêu cầu manager.

function fail(message: string): AdminFormState {
  return { status: "error", message };
}

async function guard(scope: string) {
  const viewer = await getViewer();
  if (!viewer?.isManager) return { viewer: null, error: fail("Manager access is required.") };
  if (!(await checkRateLimit(await callerKey(scope, viewer.id), RATE_LIMITS.mutation))) {
    return { viewer: null, error: fail("Too many changes in a short time. Wait a minute and try again.") };
  }
  return { viewer, error: null };
}

function readForm(formData: FormData) {
  const text = (name: string, max = 200) => String(formData.get(name) ?? "").trim().slice(0, max) || null;
  const amount = Number.parseFloat(String(formData.get("amount") ?? ""));
  const taxAmount = Number.parseFloat(String(formData.get("taxAmount") ?? "0"));

  return {
    expenseDate: String(formData.get("expenseDate") ?? "").trim(),
    categoryId: String(formData.get("categoryId") ?? "").trim(),
    newCategory: text("newCategory", 80),
    vendorName: text("vendorName"),
    description: String(formData.get("description") ?? "").trim().slice(0, 300),
    amount: Number.isFinite(amount) ? amount : NaN,
    taxAmount: Number.isFinite(taxAmount) ? taxAmount : 0,
    paymentMethod: text("paymentMethod", 60),
    notes: text("notes", 1000)
  };
}

function validate(input: ReturnType<typeof readForm>) {
  if (!input.description) return "Description is required.";
  if (!Number.isFinite(input.amount) || input.amount <= 0) return "Enter an amount greater than 0.";
  if (input.taxAmount < 0) return "Tax amount cannot be negative.";
  if (!input.expenseDate) return "Pick a date.";
  if (!input.categoryId && !input.newCategory) return "Choose a category or type a new one.";
  return null;
}

/** Bảng expenses bắt buộc có category, nên tên gõ mới sẽ được tạo tại chỗ. */
async function resolveCategoryId(input: ReturnType<typeof readForm>) {
  const supabase = createAdminClient();
  if (input.newCategory) {
    const { data: existing } = await supabase
      .from("expense_categories")
      .select("id")
      .ilike("name", input.newCategory)
      .maybeSingle();
    if (existing) return existing.id;

    const { data, error } = await supabase
      .from("expense_categories")
      .insert({ name: input.newCategory })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return data.id;
  }
  return input.categoryId;
}

function revalidate() {
  revalidatePath("/admin/expenses");
  revalidatePath("/admin");
  revalidatePath("/admin/reports");
}

export async function createExpenseAction(_prev: AdminFormState, formData: FormData): Promise<AdminFormState> {
  const { viewer, error: denied } = await guard("admin-expense");
  if (denied) return denied;

  const input = readForm(formData);
  const invalid = validate(input);
  if (invalid) return fail(invalid);

  try {
    const categoryId = await resolveCategoryId(input);
    const { error } = await createAdminClient().from("expenses").insert({
      expense_category_id: categoryId,
      expense_date: input.expenseDate,
      vendor_name: input.vendorName,
      description: input.description,
      amount: input.amount,
      tax_amount: input.taxAmount,
      payment_method: input.paymentMethod,
      notes: input.notes,
      created_by: viewer!.id
    });
    if (error) return fail(error.message);
  } catch (error) {
    return fail(error instanceof Error ? error.message : "The expense could not be saved.");
  }

  revalidate();
  return { status: "success", message: `Added “${input.description}”.` };
}

export async function updateExpenseAction(_prev: AdminFormState, formData: FormData): Promise<AdminFormState> {
  const { error: denied } = await guard("admin-expense");
  if (denied) return denied;

  const id = String(formData.get("id") ?? "").trim();
  if (!id) return fail("Missing expense id.");

  const input = readForm(formData);
  const invalid = validate(input);
  if (invalid) return fail(invalid);

  try {
    const categoryId = await resolveCategoryId(input);
    const { error } = await createAdminClient()
      .from("expenses")
      .update({
        expense_category_id: categoryId,
        expense_date: input.expenseDate,
        vendor_name: input.vendorName,
        description: input.description,
        amount: input.amount,
        tax_amount: input.taxAmount,
        payment_method: input.paymentMethod,
        notes: input.notes
      })
      .eq("id", id);
    if (error) return fail(error.message);
  } catch (error) {
    return fail(error instanceof Error ? error.message : "The expense could not be saved.");
  }

  revalidate();
  return { status: "success", message: `Saved “${input.description}”.` };
}

export async function deleteExpenseAction(_prev: AdminFormState, formData: FormData): Promise<AdminFormState> {
  const { error: denied } = await guard("admin-expense");
  if (denied) return denied;

  const id = String(formData.get("id") ?? "").trim();
  if (!id) return fail("Missing expense id.");

  const { error } = await createAdminClient().from("expenses").delete().eq("id", id);
  if (error) return fail(error.message);

  revalidate();
  return { status: "success", message: "Expense deleted." };
}

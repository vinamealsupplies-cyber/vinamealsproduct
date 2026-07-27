import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

// Chi phí cho khu admin. RLS `expenses_staff_all` yêu cầu manager, nhưng trang
// đọc bằng service role để hiển thị kèm tên danh mục ổn định; quyền được kiểm
// tra ở tầng trang/action.

export type ExpenseCategory = { id: string; name: string };

export type AdminExpense = {
  id: string;
  expenseDate: string;
  categoryId: string;
  categoryName: string;
  vendorName: string | null;
  description: string;
  amount: number;
  taxAmount: number;
  paymentMethod: string | null;
  notes: string | null;
};

type DbExpense = {
  id: string;
  expense_date: string;
  expense_category_id: string;
  vendor_name: string | null;
  description: string;
  amount: number | string;
  tax_amount: number | string;
  payment_method: string | null;
  notes: string | null;
  expense_categories: { name: string } | null;
};

function num(value: number | string | null | undefined) {
  const parsed = typeof value === "string" ? Number.parseFloat(value) : value;
  return typeof parsed === "number" && Number.isFinite(parsed) ? parsed : 0;
}

export async function getExpensesForStaff(): Promise<AdminExpense[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("expenses")
    .select(
      "id, expense_date, expense_category_id, vendor_name, description, amount, tax_amount, payment_method, notes, expense_categories ( name )"
    )
    .order("expense_date", { ascending: false });

  if (error) throw new Error(`Failed to load expenses: ${error.message}`);

  return ((data ?? []) as unknown as DbExpense[]).map((row) => ({
    id: row.id,
    expenseDate: row.expense_date,
    categoryId: row.expense_category_id,
    categoryName: row.expense_categories?.name ?? "Uncategorized",
    vendorName: row.vendor_name,
    description: row.description,
    amount: num(row.amount),
    taxAmount: num(row.tax_amount),
    paymentMethod: row.payment_method,
    notes: row.notes
  }));
}

export async function getExpenseCategories(): Promise<ExpenseCategory[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("expense_categories")
    .select("id, name")
    .eq("is_active", true)
    .order("name");
  return (data ?? []) as ExpenseCategory[];
}

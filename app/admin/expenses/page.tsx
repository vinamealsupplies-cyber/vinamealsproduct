import { AdminPageHeader } from "@/components/admin-page-header";
import { ExpenseManager } from "@/components/expense-manager";
import { requireStaffPage } from "@/lib/auth";
import { getExpenseCategories, getExpensesForStaff } from "@/lib/data/expenses";

export const metadata = { title: "Expenses" };

export default async function ExpensesPage() {
  await requireStaffPage();
  const [expenses, categories] = await Promise.all([getExpensesForStaff(), getExpenseCategories()]);

  return (
    <>
      <AdminPageHeader
        eyebrow="Costs"
        title="Expenses"
        description="Record operating costs separately from product cost of goods sold for complete profit reporting."
      />
      <ExpenseManager expenses={expenses} categories={categories} />
    </>
  );
}

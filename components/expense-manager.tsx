"use client";

import { useActionState, useState } from "react";
import { Pencil, Plus, Save, Trash2, X } from "lucide-react";
import {
  createExpenseAction,
  deleteExpenseAction,
  updateExpenseAction
} from "@/app/admin/expenses/actions";
import { initialAdminFormState, type AdminFormState } from "@/lib/data/admin-form";
import type { AdminExpense, ExpenseCategory } from "@/lib/data/expenses";
import { formatDate, usd } from "@/lib/format";

function today() {
  return new Date().toISOString().slice(0, 10);
}

function ExpenseFields({
  expense,
  categories
}: {
  expense?: AdminExpense;
  categories: ExpenseCategory[];
}) {
  return (
    <>
      <div className="form-grid two-columns">
        <label>
          Date *
          <input name="expenseDate" type="date" required defaultValue={expense?.expenseDate ?? today()} />
        </label>
        <label>
          Amount (USD) *
          <input
            name="amount"
            type="number"
            min="0.01"
            step="0.01"
            required
            defaultValue={expense?.amount ?? ""}
            placeholder="186.50"
          />
        </label>
        <label>
          Category
          <select name="categoryId" defaultValue={expense?.categoryId ?? ""}>
            <option value="">{categories.length ? "Select category" : "No categories yet"}</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </select>
        </label>
        <label>
          …or new category
          <input name="newCategory" defaultValue="" placeholder="Delivery and shipping" />
        </label>
        <label className="full-width">
          Description *
          <input name="description" required defaultValue={expense?.description ?? ""} placeholder="Wholesale delivery route" />
        </label>
        <label>
          Vendor
          <input name="vendorName" defaultValue={expense?.vendorName ?? ""} placeholder="Local Freight Co." />
        </label>
        <label>
          Tax amount
          <input name="taxAmount" type="number" min="0" step="0.01" defaultValue={expense?.taxAmount ?? 0} />
        </label>
        <label>
          Payment method
          <input name="paymentMethod" defaultValue={expense?.paymentMethod ?? ""} placeholder="Card ending 4242" />
        </label>
        <label className="full-width">
          Notes
          <textarea name="notes" rows={2} maxLength={1000} defaultValue={expense?.notes ?? ""} />
        </label>
      </div>
      <p className="field-hint">Typing a new category creates it. Leave it blank to use the selected one.</p>
    </>
  );
}

export function ExpenseManager({
  expenses,
  categories
}: {
  expenses: AdminExpense[];
  categories: ExpenseCategory[];
}) {
  const [editing, setEditing] = useState<AdminExpense | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState<AdminExpense | null>(null);
  const [addedCount, setAddedCount] = useState(0);
  const [notice, setNotice] = useState<AdminFormState>(initialAdminFormState);

  const [, createAction, creating] = useActionState(
    async (prev: AdminFormState, formData: FormData) => {
      const result = await createExpenseAction(prev, formData);
      setNotice(result);
      if (result.status === "success") setAddedCount((count) => count + 1);
      return result;
    },
    initialAdminFormState
  );

  const [, updateAction, updating] = useActionState(
    async (prev: AdminFormState, formData: FormData) => {
      const result = await updateExpenseAction(prev, formData);
      setNotice(result);
      if (result.status === "success") setEditing(null);
      return result;
    },
    initialAdminFormState
  );

  const [, deleteAction, deleting] = useActionState(
    async (prev: AdminFormState, formData: FormData) => {
      const result = await deleteExpenseAction(prev, formData);
      setNotice(result);
      if (result.status === "success") setConfirmingDelete(null);
      return result;
    },
    initialAdminFormState
  );

  const total = expenses.reduce((sum, expense) => sum + expense.amount, 0);

  return (
    <div className="category-admin-layout">
      <section className="form-card">
        <div className="form-card-heading">
          <div>
            <h2>Recorded expenses</h2>
            <p>
              {expenses.length} entr{expenses.length === 1 ? "y" : "ies"} · {usd.format(total)} total
            </p>
          </div>
        </div>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Category</th>
                <th>Vendor</th>
                <th>Description</th>
                <th className="numeric">Amount</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {expenses.map((expense) => (
                <tr key={expense.id}>
                  <td>{formatDate(expense.expenseDate)}</td>
                  <td>{expense.categoryName}</td>
                  <td>{expense.vendorName ?? "—"}</td>
                  <td>{expense.description}</td>
                  <td className="numeric">{usd.format(expense.amount)}</td>
                  <td className="row-actions">
                    <button
                      type="button"
                      onClick={() => {
                        setNotice(initialAdminFormState);
                        setConfirmingDelete(null);
                        setEditing(expense);
                      }}
                    >
                      <Pencil size={14} aria-hidden="true" /> Edit
                    </button>
                    <button
                      type="button"
                      className="danger"
                      onClick={() => {
                        setNotice(initialAdminFormState);
                        setEditing(null);
                        setConfirmingDelete(expense);
                      }}
                    >
                      <Trash2 size={14} aria-hidden="true" /> Delete
                    </button>
                  </td>
                </tr>
              ))}
              {!expenses.length ? (
                <tr>
                  <td className="empty-table" colSpan={6}>
                    No expenses recorded yet. Add the first one on the right.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <aside className="form-card compact-form-card">
        <h2>{editing ? "Edit expense" : "Add expense"}</h2>

        {notice.status !== "idle" ? (
          <div className={notice.status === "success" ? "form-success" : "form-error"} role="status">
            {notice.message}
          </div>
        ) : null}

        {confirmingDelete ? (
          <form action={deleteAction}>
            <input type="hidden" name="id" value={confirmingDelete.id} />
            <div className="legal-callout compact">
              <h2>Delete this expense?</h2>
              <p>
                {formatDate(confirmingDelete.expenseDate)} · {confirmingDelete.description} ·{" "}
                {usd.format(confirmingDelete.amount)}. This cannot be undone.
              </p>
            </div>
            <div className="button-row">
              <button className="button danger" type="submit" disabled={deleting}>
                <Trash2 size={16} aria-hidden="true" /> {deleting ? "Deleting…" : "Delete"}
              </button>
              <button className="button secondary" type="button" onClick={() => setConfirmingDelete(null)}>
                <X size={16} aria-hidden="true" /> Cancel
              </button>
            </div>
          </form>
        ) : editing ? (
          <form action={updateAction} key={editing.id}>
            <input type="hidden" name="id" value={editing.id} />
            <ExpenseFields expense={editing} categories={categories} />
            <div className="button-row">
              <button className="button primary" type="submit" disabled={updating}>
                <Save size={17} aria-hidden="true" /> {updating ? "Saving…" : "Save changes"}
              </button>
              <button className="button secondary" type="button" onClick={() => setEditing(null)}>
                <X size={16} aria-hidden="true" /> Cancel
              </button>
            </div>
          </form>
        ) : (
          <form action={createAction} key={addedCount}>
            <ExpenseFields categories={categories} />
            <button className="button primary" type="submit" disabled={creating}>
              <Plus size={17} aria-hidden="true" /> {creating ? "Adding…" : "Add expense"}
            </button>
          </form>
        )}
      </aside>
    </div>
  );
}

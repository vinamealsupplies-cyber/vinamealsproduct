"use client";

import { useActionState, useState } from "react";
import { Pencil, Plus, Save, Search, Trash2, X } from "lucide-react";
import {
  createCustomerAction,
  deleteCustomerAction,
  updateCustomerAction
} from "@/app/admin/customers/actions";
import { initialAdminFormState, type AdminFormState } from "@/lib/data/admin-form";
import type { AdminCustomer } from "@/lib/data/customers";

const TYPES = [
  { value: "retail", label: "Retail" },
  { value: "wholesale", label: "Wholesale" },
  { value: "guest", label: "Guest" }
];

const STATUSES = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "blocked", label: "Blocked" }
];

function displayName(customer: AdminCustomer) {
  const person = [customer.firstName, customer.lastName].filter(Boolean).join(" ");
  return customer.companyName || person || "Unnamed customer";
}

function CustomerFields({ customer }: { customer?: AdminCustomer }) {
  const [customerType, setCustomerType] = useState(customer?.customerType ?? "retail");

  return (
    <div className="form-grid two-columns">
      <label>
        First name
        <input name="firstName" defaultValue={customer?.firstName ?? ""} placeholder="Jane" />
      </label>
      <label>
        Last name
        <input name="lastName" defaultValue={customer?.lastName ?? ""} placeholder="Doe" />
      </label>
      <label className="full-width">
        Company
        <input name="companyName" defaultValue={customer?.companyName ?? ""} placeholder="Sunrise Market LLC" />
      </label>
      <label>
        Email
        <input name="email" type="email" defaultValue={customer?.email ?? ""} placeholder="orders@business.example" />
      </label>
      <label>
        Phone
        <input name="phone" defaultValue={customer?.phone ?? ""} placeholder="(714) 555-0134" />
      </label>
      <label>
        Type
        <select
          name="customerType"
          value={customerType}
          onChange={(e) => setCustomerType(e.target.value as AdminCustomer["customerType"])}
        >
          {TYPES.map((type) => (
            <option key={type.value} value={type.value}>{type.label}</option>
          ))}
        </select>
      </label>
      <label>
        Status
        <select name="status" defaultValue={customer?.status ?? "active"}>
          {STATUSES.map((status) => (
            <option key={status.value} value={status.value}>{status.label}</option>
          ))}
        </select>
      </label>
      {customerType === "wholesale" ? (
        <>
          <label>
            Wholesale unlock by
            <select
              name="wholesaleMinKind"
              defaultValue={customer?.wholesaleMinKind ?? "quantity"}
            >
              <option value="quantity">Minimum quantity (items)</option>
              <option value="amount">Minimum order amount (USD)</option>
            </select>
          </label>
          <label>
            Minimum value
            <input
              name="wholesaleMinValue"
              type="number"
              min={0.01}
              step="any"
              required
              defaultValue={customer?.wholesaleMinValue ?? 12}
              placeholder="e.g. 12 or 150"
            />
            <span className="field-hint">
              Customer only gets wholesale prices after the cart reaches this quantity or amount.
            </span>
          </label>
        </>
      ) : (
        <>
          <input type="hidden" name="wholesaleMinKind" value="" />
          <input type="hidden" name="wholesaleMinValue" value="" />
        </>
      )}
      <label className="full-width">
        Notes
        <textarea name="notes" rows={3} maxLength={1000} defaultValue={customer?.notes ?? ""} />
      </label>
    </div>
  );
}

export function CustomerManager({ customers, canDelete }: { customers: AdminCustomer[]; canDelete: boolean }) {
  const [editing, setEditing] = useState<AdminCustomer | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState<AdminCustomer | null>(null);
  const [query, setQuery] = useState("");
  const [addedCount, setAddedCount] = useState(0);
  const [notice, setNotice] = useState<AdminFormState>(initialAdminFormState);

  // setState đặt trong action wrapper (không phải effect) để tránh cascading render.
  const [, createAction, creating] = useActionState(
    async (prev: AdminFormState, formData: FormData) => {
      const result = await createCustomerAction(prev, formData);
      setNotice(result);
      if (result.status === "success") setAddedCount((count) => count + 1);
      return result;
    },
    initialAdminFormState
  );

  const [, updateAction, updating] = useActionState(
    async (prev: AdminFormState, formData: FormData) => {
      const result = await updateCustomerAction(prev, formData);
      setNotice(result);
      if (result.status === "success") setEditing(null);
      return result;
    },
    initialAdminFormState
  );

  const [, deleteAction, deleting] = useActionState(
    async (prev: AdminFormState, formData: FormData) => {
      const result = await deleteCustomerAction(prev, formData);
      setNotice(result);
      if (result.status === "success") setConfirmingDelete(null);
      return result;
    },
    initialAdminFormState
  );

  function select(customer: AdminCustomer | null) {
    setNotice(initialAdminFormState);
    setConfirmingDelete(null);
    setEditing(customer);
  }

  const needle = query.trim().toLowerCase();
  const visible = needle
    ? customers.filter((customer) =>
        [
          customer.customerNumber,
          customer.firstName,
          customer.lastName,
          customer.companyName,
          customer.email,
          customer.phone
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(needle))
      )
    : customers;

  return (
    <div className="category-admin-layout">
      <section className="form-card">
        <div className="form-card-heading">
          <div>
            <h2>Customer list</h2>
            <p>{customers.length} customer{customers.length === 1 ? "" : "s"} in the database.</p>
          </div>
        </div>

        <label className="table-search">
          <Search size={17} aria-hidden="true" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            type="search"
            placeholder="Search name, company, email, or number"
          />
        </label>

        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Customer no.</th>
                <th>Name</th>
                <th>Company</th>
                <th>Type</th>
                <th>Status</th>
                <th>Tax exempt</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visible.map((customer) => (
                <tr key={customer.id}>
                  <td>{customer.customerNumber ?? "—"}</td>
                  <td>
                    {[customer.firstName, customer.lastName].filter(Boolean).join(" ") || "—"}
                    {customer.hasLogin ? <span className="field-hint">Has sign-in</span> : null}
                  </td>
                  <td>{customer.companyName ?? "—"}</td>
                  <td>
                    <span className={`status-pill status-${customer.customerType}`}>{customer.customerType}</span>
                    {customer.customerType === "wholesale" && customer.wholesaleMinKind ? (
                      <span className="field-hint">
                        min{" "}
                        {customer.wholesaleMinKind === "quantity"
                          ? `${customer.wholesaleMinValue} items`
                          : `$${Number(customer.wholesaleMinValue ?? 0).toFixed(2)}`}
                      </span>
                    ) : null}
                  </td>
                  <td>
                    <span className={`status-pill status-${customer.status}`}>{customer.status}</span>
                  </td>
                  <td>
                    <span className={`status-pill status-${customer.taxExemptStatus.replaceAll("_", "-")}`}>
                      {customer.taxExemptStatus.replaceAll("_", " ")}
                    </span>
                  </td>
                  <td className="row-actions">
                    <button type="button" onClick={() => select(customer)}>
                      <Pencil size={14} aria-hidden="true" /> Edit
                    </button>
                    {canDelete ? (
                      <button
                        type="button"
                        className="danger"
                        onClick={() => {
                          setNotice(initialAdminFormState);
                          setEditing(null);
                          setConfirmingDelete(customer);
                        }}
                      >
                        <Trash2 size={14} aria-hidden="true" /> Delete
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
              {!visible.length ? (
                <tr>
                  <td className="empty-table" colSpan={7}>
                    {customers.length ? "No customers match that search." : "No customers yet."}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <aside className="form-card compact-form-card">
        <h2>{editing ? `Edit ${displayName(editing)}` : "Add customer"}</h2>

        {notice.status !== "idle" ? (
          <div className={notice.status === "success" ? "form-success" : "form-error"} role="status">
            {notice.message}
          </div>
        ) : null}

        {confirmingDelete ? (
          <form action={deleteAction}>
            <input type="hidden" name="id" value={confirmingDelete.id} />
            <div className="legal-callout compact">
              <h2>Delete {displayName(confirmingDelete)}?</h2>
              <p>
                This permanently removes the customer record, its addresses, and any tax exemption
                applications. Customers with orders or invoices cannot be deleted.
              </p>
            </div>
            <div className="button-row">
              <button className="button danger" type="submit" disabled={deleting}>
                <Trash2 size={16} aria-hidden="true" /> {deleting ? "Deleting…" : "Delete permanently"}
              </button>
              <button className="button secondary" type="button" onClick={() => setConfirmingDelete(null)}>
                <X size={16} aria-hidden="true" /> Cancel
              </button>
            </div>
          </form>
        ) : editing ? (
          <form action={updateAction} key={editing.id}>
            <input type="hidden" name="id" value={editing.id} />
            <CustomerFields key={editing.id} customer={editing} />
            <div className="button-row">
              <button className="button primary" type="submit" disabled={updating}>
                <Save size={17} aria-hidden="true" /> {updating ? "Saving…" : "Save changes"}
              </button>
              <button className="button secondary" type="button" onClick={() => select(null)}>
                <X size={16} aria-hidden="true" /> Cancel
              </button>
            </div>
          </form>
        ) : (
          <form action={createAction} key={addedCount}>
            <CustomerFields key={`new-${addedCount}`} />
            <button className="button primary" type="submit" disabled={creating}>
              <Plus size={17} aria-hidden="true" /> {creating ? "Adding…" : "Add customer"}
            </button>
          </form>
        )}
      </aside>
    </div>
  );
}

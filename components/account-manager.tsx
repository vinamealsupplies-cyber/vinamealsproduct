"use client";

import { useActionState, useState } from "react";
import { Pencil, Save, Search, X } from "lucide-react";
import { updateAccountAction } from "@/app/admin/accounts/actions";
import { initialAdminFormState, type AdminFormState } from "@/lib/data/admin-form";
import {
  ACCOUNT_STATUSES,
  APP_ROLES,
  type AdminAccount,
  type AppRole
} from "@/lib/roles";

function displayName(account: AdminAccount) {
  return account.fullName || account.email || "Unnamed account";
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric"
    });
  } catch {
    return iso;
  }
}

export function AccountManager({
  accounts,
  currentUserId
}: {
  accounts: AdminAccount[];
  currentUserId: string;
}) {
  const [editing, setEditing] = useState<AdminAccount | null>(null);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | AppRole>("all");
  const [notice, setNotice] = useState<AdminFormState>(initialAdminFormState);

  const [, updateAction, updating] = useActionState(
    async (prev: AdminFormState, formData: FormData) => {
      const result = await updateAccountAction(prev, formData);
      setNotice(result);
      if (result.status === "success") setEditing(null);
      return result;
    },
    initialAdminFormState
  );

  function select(account: AdminAccount | null) {
    setNotice(initialAdminFormState);
    setEditing(account);
  }

  const needle = query.trim().toLowerCase();
  const visible = accounts.filter((account) => {
    if (roleFilter !== "all" && account.role !== roleFilter) return false;
    if (!needle) return true;
    return [account.email, account.fullName, account.phone, account.role, account.status]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(needle));
  });

  const roleCounts = APP_ROLES.reduce(
    (acc, role) => {
      acc[role.value] = accounts.filter((a) => a.role === role.value).length;
      return acc;
    },
    {} as Record<AppRole, number>
  );

  return (
    <div className="category-admin-layout">
      <section className="form-card">
        <div className="form-card-heading">
          <div>
            <h2>Account list</h2>
            <p>
              {accounts.length} account{accounts.length === 1 ? "" : "s"} with sign-in access.
            </p>
          </div>
        </div>

        <div className="status-filter-tabs" role="tablist" aria-label="Filter by role">
          <button
            type="button"
            className={roleFilter === "all" ? "active" : ""}
            onClick={() => setRoleFilter("all")}
          >
            All <span className="filter-count">{accounts.length}</span>
          </button>
          {APP_ROLES.map((role) => (
            <button
              key={role.value}
              type="button"
              className={roleFilter === role.value ? "active" : ""}
              onClick={() => setRoleFilter(role.value)}
            >
              {role.label} <span className="filter-count">{roleCounts[role.value]}</span>
            </button>
          ))}
        </div>

        <label className="table-search">
          <Search size={17} aria-hidden="true" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            type="search"
            placeholder="Search email, name, phone, or role"
          />
        </label>

        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Joined</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visible.map((account) => {
                const isYou = account.id === currentUserId;
                return (
                  <tr key={account.id}>
                    <td>
                      {account.fullName || "—"}
                      {isYou ? <span className="field-hint">You</span> : null}
                    </td>
                    <td>{account.email ?? "—"}</td>
                    <td>
                      <span className={`status-pill status-${account.role}`}>{account.role}</span>
                    </td>
                    <td>
                      <span className={`status-pill status-${account.status}`}>{account.status}</span>
                    </td>
                    <td>{formatDate(account.createdAt)}</td>
                    <td className="row-actions">
                      <button type="button" onClick={() => select(account)}>
                        <Pencil size={14} aria-hidden="true" /> Edit
                      </button>
                    </td>
                  </tr>
                );
              })}
              {!visible.length ? (
                <tr>
                  <td className="empty-table" colSpan={6}>
                    {accounts.length ? "No accounts match that filter." : "No accounts yet."}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <aside className="form-card compact-form-card">
        <h2>{editing ? `Edit ${displayName(editing)}` : "Select an account"}</h2>

        {notice.status !== "idle" ? (
          <div className={notice.status === "success" ? "form-success" : "form-error"} role="status">
            {notice.message}
          </div>
        ) : null}

        {editing ? (
          <form action={updateAction} key={editing.id}>
            <input type="hidden" name="id" value={editing.id} />
            <div className="form-grid">
              <label className="full-width">
                Full name
                <input name="fullName" defaultValue={editing.fullName ?? ""} placeholder="Jane Doe" />
              </label>
              <label className="full-width">
                Email
                <input value={editing.email ?? ""} disabled readOnly />
                <span className="field-hint">Email comes from the sign-in provider; change it there if needed.</span>
              </label>
              <label className="full-width">
                Phone
                <input name="phone" defaultValue={editing.phone ?? ""} placeholder="(714) 555-0134" />
              </label>
              <label className="full-width">
                Role
                {editing.id === currentUserId ? (
                  <input type="hidden" name="role" value={editing.role} />
                ) : null}
                <select
                  name={editing.id === currentUserId ? undefined : "role"}
                  defaultValue={editing.role}
                  disabled={editing.id === currentUserId}
                >
                  {APP_ROLES.map((role) => (
                    <option key={role.value} value={role.value}>
                      {role.label}
                    </option>
                  ))}
                </select>
                {editing.id === currentUserId ? (
                  <span className="field-hint">You cannot change your own role here.</span>
                ) : null}
              </label>
              <label className="full-width">
                Status
                {editing.id === currentUserId ? (
                  <input type="hidden" name="status" value={editing.status} />
                ) : null}
                <select
                  name={editing.id === currentUserId ? undefined : "status"}
                  defaultValue={editing.status}
                  disabled={editing.id === currentUserId}
                >
                  {ACCOUNT_STATUSES.map((status) => (
                    <option key={status.value} value={status.value}>
                      {status.label}
                    </option>
                  ))}
                </select>
                {editing.id === currentUserId ? (
                  <span className="field-hint">You cannot disable your own account.</span>
                ) : null}
              </label>
            </div>
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
          <p className="muted-copy">
            Pick an account from the list to change role, status, name, or phone. Only admins can use
            this page.
          </p>
        )}
      </aside>
    </div>
  );
}

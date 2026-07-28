"use client";

import { Fragment, useMemo, useState } from "react";
import { Search } from "lucide-react";
import type { AuditLogEntry } from "@/lib/data/audit-log";
import { formatDate } from "@/lib/format";

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch {
    return formatDate(iso);
  }
}

function staffLabel(entry: AuditLogEntry): string {
  const metaName =
    typeof entry.metadata?.actorName === "string" ? entry.metadata.actorName.trim() : "";
  return entry.actorName?.trim() || metaName || entry.actorEmail || "—";
}

function staffEmail(entry: AuditLogEntry): string | null {
  if (entry.actorEmail) return entry.actorEmail;
  const meta =
    typeof entry.metadata?.actorEmail === "string" ? entry.metadata.actorEmail.trim() : "";
  return meta || null;
}

function staffRole(entry: AuditLogEntry): string | null {
  return typeof entry.metadata?.actorRole === "string" && entry.metadata.actorRole
    ? String(entry.metadata.actorRole)
    : null;
}

function summarize(entry: AuditLogEntry) {
  const meta = entry.metadata ?? {};
  const orderNumber = typeof meta.orderNumber === "string" ? meta.orderNumber : null;
  const customerLabel = typeof meta.customerLabel === "string" ? meta.customerLabel : null;
  const sku = typeof meta.sku === "string" ? meta.sku : null;
  const who = staffLabel(entry);
  const bits = [`By ${who}`, entry.action, entry.entityType];
  if (orderNumber) bits.push(`#${orderNumber}`);
  if (customerLabel) bits.push(customerLabel);
  if (sku) bits.push(sku);
  if (entry.entityId) bits.push(entry.entityId.slice(0, 8));
  return bits.join(" · ");
}

export function ActivityLogViewer({ entries }: { entries: AuditLogEntry[] }) {
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<number | null>(null);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return entries;
    return entries.filter((entry) =>
      [
        entry.action,
        entry.entityType,
        entry.entityId,
        entry.actorEmail,
        entry.actorName,
        staffLabel(entry),
        JSON.stringify(entry.metadata),
        JSON.stringify(entry.beforeData),
        JSON.stringify(entry.afterData)
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle))
    );
  }, [entries, query]);

  return (
    <section className="form-card">
      <div className="form-card-heading">
        <div>
          <h2>Activity log</h2>
          <p>
            {entries.length} recent action{entries.length === 1 ? "" : "s"} — each change records
            which staff member edited products, orders, inventory, or customers.
          </p>
        </div>
      </div>

      <label className="table-search">
        <Search size={17} aria-hidden="true" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          type="search"
          placeholder="Search staff name, action, order, SKU…"
        />
      </label>

      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>When</th>
              <th>Staff</th>
              <th>Action</th>
              <th>Entity</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {visible.map((entry) => {
              const name = staffLabel(entry);
              const email = staffEmail(entry);
              const role = staffRole(entry);
              const orderNumber =
                typeof entry.metadata?.orderNumber === "string"
                  ? entry.metadata.orderNumber
                  : null;
              const customerLabel =
                typeof entry.metadata?.customerLabel === "string"
                  ? entry.metadata.customerLabel
                  : null;

              return (
                <Fragment key={entry.id}>
                  <tr>
                    <td>{formatTime(entry.createdAt)}</td>
                    <td>
                      <strong className="audit-staff-name">{name}</strong>
                      {email && email !== name ? (
                        <span className="field-hint">{email}</span>
                      ) : null}
                      {role ? (
                        <span className={`status-pill status-${role}`}>{role}</span>
                      ) : null}
                    </td>
                    <td>
                      <code className="audit-action">{entry.action}</code>
                    </td>
                    <td>
                      {entry.entityType}
                      {orderNumber ? (
                        <span className="field-hint">#{orderNumber}</span>
                      ) : customerLabel ? (
                        <span className="field-hint">{customerLabel}</span>
                      ) : entry.entityId ? (
                        <span className="field-hint">{entry.entityId.slice(0, 8)}…</span>
                      ) : null}
                    </td>
                    <td className="row-actions">
                      <button
                        type="button"
                        onClick={() => setExpanded(expanded === entry.id ? null : entry.id)}
                      >
                        {expanded === entry.id ? "Hide" : "Details"}
                      </button>
                    </td>
                  </tr>
                  {expanded === entry.id ? (
                    <tr className="audit-detail-row">
                      <td colSpan={5}>
                        <p className="field-hint">{summarize(entry)}</p>
                        <div className="audit-json-grid">
                          <div>
                            <strong>Before</strong>
                            <pre>{JSON.stringify(entry.beforeData, null, 2)}</pre>
                          </div>
                          <div>
                            <strong>After</strong>
                            <pre>{JSON.stringify(entry.afterData, null, 2)}</pre>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
            {!visible.length ? (
              <tr>
                <td className="empty-table" colSpan={5}>
                  {entries.length ? "No log rows match that search." : "No activity logged yet."}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}

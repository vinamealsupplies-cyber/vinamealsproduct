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

function summarize(entry: AuditLogEntry) {
  const meta = entry.metadata ?? {};
  const orderNumber = typeof meta.orderNumber === "string" ? meta.orderNumber : null;
  const sku = typeof meta.sku === "string" ? meta.sku : null;
  const bits = [entry.action, entry.entityType];
  if (orderNumber) bits.push(`#${orderNumber}`);
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
            {entries.length} recent action{entries.length === 1 ? "" : "s"} — who changed products,
            orders, inventory, customers.
          </p>
        </div>
      </div>

      <label className="table-search">
        <Search size={17} aria-hidden="true" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          type="search"
          placeholder="Search action, user, order, SKU…"
        />
      </label>

      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>When</th>
              <th>Who</th>
              <th>Action</th>
              <th>Entity</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {visible.map((entry) => (
              <Fragment key={entry.id}>
                <tr>
                  <td>{formatTime(entry.createdAt)}</td>
                  <td>
                    {entry.actorName || entry.actorEmail || "—"}
                    {entry.actorEmail && entry.actorName ? (
                      <span className="field-hint">{entry.actorEmail}</span>
                    ) : null}
                    {typeof entry.metadata?.actorRole === "string" ? (
                      <span className={`status-pill status-${entry.metadata.actorRole}`}>
                        {String(entry.metadata.actorRole)}
                      </span>
                    ) : null}
                  </td>
                  <td>
                    <code className="audit-action">{entry.action}</code>
                  </td>
                  <td>
                    {entry.entityType}
                    {entry.entityId ? (
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
            ))}
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

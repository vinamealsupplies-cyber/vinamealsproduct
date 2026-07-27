"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Archive, Pencil, RotateCcw, Search, Trash2, X } from "lucide-react";
import {
  archiveProductAction,
  deleteProductForeverAction,
  restoreProductAction
} from "@/app/admin/products/actions";
import { initialAdminFormState, type AdminFormState } from "@/lib/data/admin-form";
import type { AdminProduct } from "@/lib/data/admin-products";
import { integer, usd } from "@/lib/format";

const STATUS_COPY: Record<string, string> = {
  draft: "Draft",
  active: "Active",
  archived: "Archived"
};

export function ProductManager({
  products,
  canDeleteForever
}: {
  products: AdminProduct[];
  canDeleteForever: boolean;
}) {
  const [query, setQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [confirming, setConfirming] = useState<{ product: AdminProduct; mode: "archive" | "forever" } | null>(null);
  const [notice, setNotice] = useState<AdminFormState>(initialAdminFormState);

  function wrap(action: (prev: AdminFormState, formData: FormData) => Promise<AdminFormState>) {
    return async (prev: AdminFormState, formData: FormData) => {
      const result = await action(prev, formData);
      setNotice(result);
      if (result.status === "success") setConfirming(null);
      return result;
    };
  }

  const [, archiveAction, archiving] = useActionState(wrap(archiveProductAction), initialAdminFormState);
  const [, restoreAction, restoring] = useActionState(wrap(restoreProductAction), initialAdminFormState);
  const [, deleteAction, deleting] = useActionState(wrap(deleteProductForeverAction), initialAdminFormState);

  const needle = query.trim().toLowerCase();
  const visible = products
    .filter((product) => (showArchived ? true : product.status !== "archived"))
    .filter((product) =>
      needle
        ? [product.name, product.sku, product.categoryName].some((value) =>
            String(value).toLowerCase().includes(needle)
          )
        : true
    );

  const archivedCount = products.filter((product) => product.status === "archived").length;

  return (
    <>
      {notice.status !== "idle" ? (
        <div className={notice.status === "success" ? "form-success" : "form-error"} role="status">
          {notice.message}
        </div>
      ) : null}

      {confirming ? (
        <div className="form-card">
          {confirming.mode === "archive" ? (
            <form action={archiveAction}>
              <input type="hidden" name="id" value={confirming.product.id} />
              <div className="legal-callout compact">
                <h2>Archive {confirming.product.name}?</h2>
                <p>
                  It disappears from the storefront but keeps its SKU, stock records, and sales history. You can
                  restore it at any time.
                </p>
              </div>
              <div className="button-row">
                <button className="button primary" type="submit" disabled={archiving}>
                  <Archive size={16} aria-hidden="true" /> {archiving ? "Archiving…" : "Archive product"}
                </button>
                <button className="button secondary" type="button" onClick={() => setConfirming(null)}>
                  <X size={16} aria-hidden="true" /> Cancel
                </button>
              </div>
            </form>
          ) : (
            <form action={deleteAction}>
              <input type="hidden" name="id" value={confirming.product.id} />
              <div className="legal-callout compact">
                <h2>Delete {confirming.product.name} forever?</h2>
                <p>
                  This permanently removes the product, its SKU, images, and stock balance. It cannot be undone.
                  {confirming.product.hasMovements
                    ? " This product has inventory movement history, so the database will refuse the delete — keep it archived instead."
                    : ""}
                </p>
              </div>
              <div className="button-row">
                <button className="button danger" type="submit" disabled={deleting}>
                  <Trash2 size={16} aria-hidden="true" /> {deleting ? "Deleting…" : "Delete forever"}
                </button>
                <button className="button secondary" type="button" onClick={() => setConfirming(null)}>
                  <X size={16} aria-hidden="true" /> Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      ) : null}

      <div className="data-table-card">
        <div className="table-toolbar">
          <label className="table-search">
            <Search size={17} aria-hidden="true" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              type="search"
              placeholder="Search product name, SKU, or category"
            />
          </label>
          <div className="toolbar-side">
            <span>{visible.length} shown</span>
            {archivedCount ? (
              <button type="button" className="text-link" onClick={() => setShowArchived((value) => !value)}>
                {showArchived ? "Hide" : "Show"} archived ({archivedCount})
              </button>
            ) : null}
          </div>
        </div>

        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>SKU</th>
                <th>Category</th>
                <th className="numeric">Retail</th>
                <th className="numeric">Wholesale</th>
                <th className="numeric">On hand</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visible.map((product) => (
                <tr key={product.id}>
                  <td>
                    {product.name}
                    {product.featured ? <span className="field-hint">Featured</span> : null}
                  </td>
                  <td>{product.sku || "—"}</td>
                  <td>{product.categoryName}</td>
                  <td className="numeric">{usd.format(product.retailPrice)}</td>
                  <td className="numeric">
                    {product.wholesalePrice == null ? "—" : usd.format(product.wholesalePrice)}
                  </td>
                  <td className="numeric">{integer.format(product.onHand)}</td>
                  <td>
                    <span className={`status-pill status-${product.status}`}>
                      {STATUS_COPY[product.status] ?? product.status}
                    </span>
                  </td>
                  <td className="row-actions">
                    <Link href={`/admin/products/${product.id}`}>
                      <Pencil size={14} aria-hidden="true" /> Edit
                    </Link>
                    {product.status === "archived" ? (
                      <>
                        <form action={restoreAction} className="inline-form">
                          <input type="hidden" name="id" value={product.id} />
                          <button type="submit" disabled={restoring}>
                            <RotateCcw size={14} aria-hidden="true" /> Restore
                          </button>
                        </form>
                        {canDeleteForever ? (
                          <button
                            type="button"
                            className="danger"
                            onClick={() => {
                              setNotice(initialAdminFormState);
                              setConfirming({ product, mode: "forever" });
                            }}
                          >
                            <Trash2 size={14} aria-hidden="true" /> Delete forever
                          </button>
                        ) : null}
                      </>
                    ) : (
                      <button
                        type="button"
                        className="danger"
                        onClick={() => {
                          setNotice(initialAdminFormState);
                          setConfirming({ product, mode: "archive" });
                        }}
                      >
                        <Archive size={14} aria-hidden="true" /> Archive
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {!visible.length ? (
                <tr>
                  <td className="empty-table" colSpan={8}>
                    {products.length ? "No products match that search." : "No products yet."}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

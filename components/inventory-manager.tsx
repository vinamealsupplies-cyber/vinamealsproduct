"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import {
  ArrowDownAZ,
  ArrowUpDown,
  Boxes,
  DollarSign,
  History,
  Save,
  Search,
  SlidersHorizontal,
  X
} from "lucide-react";
import {
  adjustInventoryAction,
  fetchVariantHistory,
  updateInventoryPricingAction
} from "@/app/admin/inventory/actions";
import { initialAdminFormState, type AdminFormState } from "@/lib/data/admin-form";
import type { InventoryRow, MovementRow } from "@/lib/data/inventory";
import { formatDate, integer, usd } from "@/lib/format";

const STATUS_COPY: Record<string, string> = {
  in_stock: "In stock",
  low_stock: "Low stock",
  out_of_stock: "Out of stock"
};

type SortKey =
  | "productName"
  | "sku"
  | "locationCode"
  | "onHand"
  | "available"
  | "costPrice"
  | "retailPrice"
  | "inventoryValue"
  | "stockStatus";

const SORT_COLUMNS: { key: SortKey; label: string; align?: "right" }[] = [
  { key: "productName", label: "Product" },
  { key: "sku", label: "SKU" },
  { key: "locationCode", label: "Location" },
  { key: "onHand", label: "On hand", align: "right" },
  { key: "available", label: "Available", align: "right" },
  { key: "costPrice", label: "Cost", align: "right" },
  { key: "retailPrice", label: "Retail", align: "right" },
  { key: "inventoryValue", label: "Value", align: "right" },
  { key: "stockStatus", label: "Status" }
];

function sortValue(row: InventoryRow, key: SortKey): string | number {
  switch (key) {
    case "productName":
      return `${row.productName} ${row.variantName}`.toLowerCase();
    case "sku":
      return row.sku.toLowerCase();
    case "locationCode":
      return row.locationCode.toLowerCase();
    case "stockStatus":
      return row.stockStatus;
    default:
      return row[key];
  }
}

export function InventoryManager({
  rows,
  movements
}: {
  rows: InventoryRow[];
  movements: MovementRow[];
}) {
  const [selected, setSelected] = useState<InventoryRow | null>(null);
  const [notice, setNotice] = useState<AdminFormState>(initialAdminFormState);
  const [mode, setMode] = useState<"delta" | "set">("delta");
  // Lịch sử của riêng món đang chọn, tải khi bấm chọn dòng.
  const [history, setHistory] = useState<MovementRow[] | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("productName");
  const [ascending, setAscending] = useState(true);

  // Sau khi server revalidate (đổi giá / số lượng), đồng bộ panel với dữ liệu
  // mới để form và bảng không lệch nhau.
  useEffect(() => {
    if (!selected) return;
    const fresh = rows.find(
      (row) => row.variantId === selected.variantId && row.locationId === selected.locationId
    );
    if (fresh) setSelected(fresh);
  }, [rows]); // eslint-disable-line react-hooks/exhaustive-deps -- only re-sync when server rows refresh

  async function selectRow(row: InventoryRow) {
    setNotice(initialAdminFormState);
    setMode("delta");
    setSelected(row);
    setHistory(null);
    setLoadingHistory(true);
    const result = await fetchVariantHistory(row.variantId, row.locationId);
    setHistory(result.ok ? result.movements : []);
    setLoadingHistory(false);
  }

  async function refreshHistory() {
    if (!selected) return;
    const result = await fetchVariantHistory(selected.variantId, selected.locationId);
    setHistory(result.ok ? result.movements : []);
  }

  const [, adjustAction, adjusting] = useActionState(
    async (prev: AdminFormState, formData: FormData) => {
      const result = await adjustInventoryAction(prev, formData);
      setNotice(result);
      // Giữ nguyên món đang chọn và nạp lại lịch sử để thấy ngay dòng vừa ghi.
      if (result.status === "success") await refreshHistory();
      return result;
    },
    initialAdminFormState
  );

  const [, pricingAction, savingPricing] = useActionState(
    async (prev: AdminFormState, formData: FormData) => {
      const result = await updateInventoryPricingAction(prev, formData);
      setNotice(result);
      return result;
    },
    initialAdminFormState
  );

  const totalValue = rows.reduce((sum, row) => sum + row.inventoryValue, 0);
  const lowStock = rows.filter((row) => row.stockStatus !== "in_stock").length;

  const visibleRows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = needle
      ? rows.filter((row) =>
          [row.productName, row.variantName, row.sku, row.locationCode, row.categoryName, row.stockStatus]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(needle))
        )
      : rows;

    return [...filtered].sort((a, b) => {
      const left = sortValue(a, sortKey);
      const right = sortValue(b, sortKey);
      if (typeof left === "number" && typeof right === "number") {
        return ascending ? left - right : right - left;
      }
      const result = String(left).localeCompare(String(right), undefined, { numeric: true });
      return ascending ? result : -result;
    });
  }, [ascending, query, rows, sortKey]);

  function changeSort(key: SortKey) {
    if (key === sortKey) setAscending((value) => !value);
    else {
      setSortKey(key);
      setAscending(true);
    }
  }

  return (
    <div className="category-admin-layout">
      <section className="form-card">
        <div className="form-card-heading">
          <div>
            <h2>Stock on hand</h2>
            <p>
              {rows.length} SKU{rows.length === 1 ? "" : "s"} · {usd.format(totalValue)} inventory value ·{" "}
              {lowStock} needing attention
            </p>
          </div>
        </div>

        <div className="table-toolbar inventory-table-toolbar">
          <label className="table-search">
            <Search size={17} aria-hidden="true" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              type="search"
              placeholder="Search product, SKU, location, category…"
            />
          </label>
          <span className="toolbar-side">
            {visibleRows.length} shown
            {query.trim() ? ` of ${rows.length}` : ""}
          </span>
        </div>

        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                {SORT_COLUMNS.map((column) => (
                  <th className={column.align === "right" ? "numeric" : ""} key={column.key}>
                    <button type="button" onClick={() => changeSort(column.key)}>
                      {column.label}
                      {sortKey === column.key ? (
                        <ArrowDownAZ className={ascending ? "" : "sort-desc"} size={15} aria-hidden="true" />
                      ) : (
                        <ArrowUpDown size={14} aria-hidden="true" />
                      )}
                    </button>
                  </th>
                ))}
                <th />
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row) => (
                <tr
                  key={`${row.variantId}-${row.locationId}`}
                  className={[
                    row.productStatus === "archived" ? "row-archived" : "",
                    row.stockStatus === "out_of_stock" ? "row-out-of-stock" : ""
                  ]
                    .filter(Boolean)
                    .join(" ") || undefined}
                >
                  <td>
                    {row.productName}
                    <span className="field-hint">
                      {row.variantName}
                      {row.productStatus === "archived" ? " · Archived" : ""}
                    </span>
                  </td>
                  <td>{row.sku}</td>
                  <td>{row.locationCode}</td>
                  <td className="numeric">{integer.format(row.onHand)}</td>
                  <td className="numeric">{integer.format(row.available)}</td>
                  <td className="numeric">{usd.format(row.costPrice)}</td>
                  <td className="numeric">{usd.format(row.retailPrice)}</td>
                  <td className="numeric">{usd.format(row.inventoryValue)}</td>
                  <td>
                    <span className={`status-pill status-${row.stockStatus.replaceAll("_", "-")}`}>
                      {STATUS_COPY[row.stockStatus] ?? row.stockStatus}
                    </span>
                    {row.productStatus === "archived" ? (
                      <span className="field-hint">Product archived</span>
                    ) : null}
                  </td>
                  <td className="row-actions">
                    <button type="button" onClick={() => selectRow(row)}>
                      <SlidersHorizontal size={14} aria-hidden="true" /> Adjust
                    </button>
                  </td>
                </tr>
              ))}
              {!rows.length ? (
                <tr>
                  <td className="empty-table" colSpan={10}>
                    No inventory records yet. Add a product with an opening quantity first.
                  </td>
                </tr>
              ) : null}
              {rows.length && !visibleRows.length ? (
                <tr>
                  <td className="empty-table" colSpan={10}>
                    No products match “{query.trim()}”.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <aside className="form-card compact-form-card">
        <h2>{selected ? `Adjust ${selected.sku}` : "Inventory ledger"}</h2>

        {notice.status !== "idle" ? (
          <div className={notice.status === "success" ? "form-success" : "form-error"} role="status">
            {notice.message}
          </div>
        ) : null}

        {selected ? (
          <>
            <form action={adjustAction} key={`${selected.variantId}-adjust`}>
              <input type="hidden" name="variantId" value={selected.variantId} />
              <input type="hidden" name="locationId" value={selected.locationId} />
              <input type="hidden" name="sku" value={selected.sku} />
              <input type="hidden" name="currentOnHand" value={selected.onHand} />
              <input type="hidden" name="mode" value={mode} />

              <p className="field-hint">
                {selected.productName} · currently {integer.format(selected.onHand)} on hand
              </p>

              <div className="toggle-row">
                <button
                  type="button"
                  className={mode === "delta" ? "active" : ""}
                  onClick={() => setMode("delta")}
                >
                  Add / remove
                </button>
                <button
                  type="button"
                  className={mode === "set" ? "active" : ""}
                  onClick={() => setMode("set")}
                >
                  Set counted total
                </button>
              </div>

              <label>
                {mode === "delta" ? "Change (use -5 to remove)" : "Counted quantity"}
                <input
                  name="quantity"
                  type="number"
                  step="1"
                  required
                  defaultValue=""
                  placeholder={mode === "delta" ? "-5" : String(selected.onHand)}
                />
              </label>
              <label>
                Reason *
                <input name="reason" required placeholder="Cycle count correction" />
              </label>

              <div className="button-row">
                <button className="button primary" type="submit" disabled={adjusting}>
                  <Boxes size={17} aria-hidden="true" /> {adjusting ? "Posting…" : "Post adjustment"}
                </button>
                <button className="button secondary" type="button" onClick={() => setSelected(null)}>
                  <X size={16} aria-hidden="true" /> Cancel
                </button>
              </div>
            </form>

            <form
              action={pricingAction}
              key={`${selected.variantId}-pricing-${selected.costPrice}-${selected.retailPrice}`}
              className="stacked-form"
            >
              <input type="hidden" name="variantId" value={selected.variantId} />
              <input type="hidden" name="sku" value={selected.sku} />
              <h3 className="panel-subheading">
                <DollarSign size={15} aria-hidden="true" /> Pricing
              </h3>
              <p className="field-hint">
                Giá nhập (unit cost) và giá bán (retail). Đổi trên SKU — áp dụng mọi kho. Inventory value =
                on hand × cost.
              </p>
              <label>
                Unit cost / giá nhập (USD)
                <input
                  name="costPrice"
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  defaultValue={selected.costPrice}
                />
              </label>
              <label>
                Retail price / giá bán (USD)
                <input
                  name="retailPrice"
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  defaultValue={selected.retailPrice}
                />
              </label>
              <button className="button secondary" type="submit" disabled={savingPricing}>
                <Save size={16} aria-hidden="true" /> {savingPricing ? "Saving…" : "Save pricing"}
              </button>
            </form>

            {/* Lịch sử thay đổi của đúng món đang chọn, kèm người thực hiện. */}
            <div className="stacked-form">
              <h3 className="panel-subheading">
                <History size={15} aria-hidden="true" /> Change history
              </h3>
              {loadingHistory ? (
                <p className="field-hint">Loading history…</p>
              ) : history && history.length ? (
                <ul className="upload-file-list">
                  {history.map((movement) => (
                    <li key={movement.id}>
                      <strong>
                        {movement.quantityChange > 0 ? "+" : ""}
                        {integer.format(movement.quantityChange)} · {movement.movementType}
                      </strong>
                      <span className="field-hint">
                        {formatDate(movement.createdAt)} · by {movement.changedBy}
                        {movement.reason ? ` · ${movement.reason}` : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="field-hint">No recorded changes for this item yet.</p>
              )}
            </div>
          </>
        ) : (
          <>
            <p className="field-hint">
              Quantities change only through the movement ledger, so every number can be explained. Select
              Adjust on a row to post a correction.
            </p>
            <ul className="upload-file-list">
              {movements.map((movement) => (
                <li key={movement.id}>
                  <strong>
                    {movement.quantityChange > 0 ? "+" : ""}
                    {integer.format(movement.quantityChange)} · {movement.sku}
                  </strong>
                  <span className="field-hint">
                    {formatDate(movement.createdAt)} · {movement.movementType} · by {movement.changedBy}
                    {movement.reason ? ` · ${movement.reason}` : ""}
                  </span>
                </li>
              ))}
              {!movements.length ? <li>No movements recorded yet.</li> : null}
            </ul>
          </>
        )}
      </aside>
    </div>
  );
}

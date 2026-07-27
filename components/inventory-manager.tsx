"use client";

import { useActionState, useEffect, useState } from "react";
import { Boxes, DollarSign, History, Save, SlidersHorizontal, X } from "lucide-react";
import {
  adjustInventoryAction,
  fetchVariantHistory,
  updateInventoryPricingAction,
  updateReorderPointAction
} from "@/app/admin/inventory/actions";
import { initialAdminFormState, type AdminFormState } from "@/lib/data/admin-form";
import type { InventoryRow, MovementRow } from "@/lib/data/inventory";
import { formatDate, integer, usd } from "@/lib/format";

const STATUS_COPY: Record<string, string> = {
  in_stock: "In stock",
  low_stock: "Low stock",
  out_of_stock: "Out of stock"
};

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

  // Sau khi server revalidate (đổi giá / số lượng / reorder), đồng bộ panel
  // với dữ liệu mới để form và bảng không lệch nhau.
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

  const [, reorderAction, savingReorder] = useActionState(
    async (prev: AdminFormState, formData: FormData) => {
      const result = await updateReorderPointAction(prev, formData);
      setNotice(result);
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
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>SKU</th>
                <th>Location</th>
                <th className="numeric">On hand</th>
                <th className="numeric">Available</th>
                <th className="numeric">Cost</th>
                <th className="numeric">Retail</th>
                <th className="numeric">Value</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`${row.variantId}-${row.locationId}`}>
                  <td>
                    {row.productName}
                    <span className="field-hint">{row.variantName}</span>
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

            <form
              action={reorderAction}
              key={`${selected.variantId}-reorder-${selected.reorderPoint}`}
              className="stacked-form"
            >
              <input type="hidden" name="variantId" value={selected.variantId} />
              <input type="hidden" name="locationId" value={selected.locationId} />
              <label>
                Reorder point
                <input name="reorderPoint" type="number" min="0" step="1" defaultValue={selected.reorderPoint} />
              </label>
              <button className="button secondary" type="submit" disabled={savingReorder}>
                <Save size={16} aria-hidden="true" /> {savingReorder ? "Saving…" : "Save reorder point"}
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

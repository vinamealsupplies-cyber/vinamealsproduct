"use client";

import { Fragment, useActionState, useEffect, useRef, useState } from "react";
import { Check, Save } from "lucide-react";
import { createProductAction, updateProductAction } from "@/app/admin/products/actions";
import { ProductMediaUploader } from "@/components/product-media-uploader";
import { initialAdminFormState, type AdminFormState } from "@/lib/data/admin-form";
import type { CategoryNode } from "@/lib/data/categories";
import type { AdminProduct } from "@/lib/data/admin-products";

// Form dùng chung cho thêm mới và chỉnh sửa.
// Edit: Save xong → nút "Saved"; chỉ hiện lại "Save changes" khi form dirty.

/** Chuỗi ổn định từ toàn bộ field (kể cả checkbox unchecked). */
function serializeForm(form: HTMLFormElement) {
  const parts: string[] = [];
  for (const el of Array.from(form.elements)) {
    if (
      !(el instanceof HTMLInputElement) &&
      !(el instanceof HTMLSelectElement) &&
      !(el instanceof HTMLTextAreaElement)
    ) {
      continue;
    }
    if (!el.name || el.disabled) continue;
    if (el instanceof HTMLInputElement) {
      if (el.type === "file") continue;
      if (el.type === "checkbox" || el.type === "radio") {
        parts.push(`${el.name}=${el.checked ? "1" : "0"}`);
        continue;
      }
    }
    parts.push(`${el.name}=${el.value}`);
  }
  return parts.sort().join("\n");
}

export function ProductForm({
  categories,
  product
}: {
  categories: CategoryNode[];
  product?: AdminProduct;
}) {
  const isEdit = Boolean(product);
  const formRef = useRef<HTMLFormElement>(null);
  const baselineRef = useRef("");
  // Create: cho submit ngay. Edit: chỉ khi đã sửa so với baseline.
  const [dirty, setDirty] = useState(!isEdit);
  const [saved, setSaved] = useState(false);

  const [state, formAction, pending] = useActionState(
    async (prev: AdminFormState, formData: FormData) => {
      const action = isEdit ? updateProductAction : createProductAction;
      const result = await action(prev, formData);
      // Save xong → chốt baseline mới và khoá nút "Saved" cho tới khi user sửa
      // tiếp. Đặt ngay trong action (không dùng effect) vì setState trong effect
      // gây cascading render.
      if (result.status === "success") {
        const form = formRef.current;
        if (form) baselineRef.current = serializeForm(form);
        setDirty(false);
        setSaved(true);
      }
      return result;
    },
    initialAdminFormState
  );

  // Chốt baseline sau khi form đã render (chỉ ghi vào ref, không setState).
  // `dirty`/`saved` đã đúng sẵn từ giá trị khởi tạo, và mỗi product là một route
  // riêng nên component luôn mount lại khi đổi sản phẩm.
  useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    baselineRef.current = serializeForm(form);
  }, [isEdit, product?.id]);

  function recomputeDirty() {
    const form = formRef.current;
    if (!form) return;
    const next = serializeForm(form) !== baselineRef.current;
    setDirty(next);
    if (next) setSaved(false);
  }

  const showSaved = isEdit && saved && !dirty && !pending;
  const canSubmit = pending ? false : isEdit ? dirty : true;

  return (
    <form
      ref={formRef}
      className="admin-form"
      action={formAction}
      onInput={recomputeDirty}
      onChange={recomputeDirty}
    >
      {product ? <input type="hidden" name="id" value={product.id} /> : null}
      {product?.variantId ? <input type="hidden" name="variantId" value={product.variantId} /> : null}

      {state.status !== "idle" ? (
        <div className={state.status === "success" ? "form-success" : "form-error"} role="status">
          {state.message}
        </div>
      ) : null}

      <section className="form-card">
        <div className="form-card-heading">
          <div>
            <h2>Product information</h2>
            <p>Customer-facing content is written in English.</p>
          </div>
          <span className="required-note">* Required</span>
        </div>
        <div className="form-grid two-columns">
          <label>
            Product name *
            <input required name="name" defaultValue={product?.name ?? ""} placeholder="Example: Tropical Mango Slices" />
          </label>
          <label>
            Slug
            <input
              name="slug"
              pattern="[a-z0-9-]*"
              defaultValue={product?.slug ?? ""}
              placeholder="Leave blank to use the name"
            />
          </label>
          <label className="full-width">
            Short description *
            <input
              required
              name="shortDescription"
              maxLength={180}
              defaultValue={product?.shortDescription ?? ""}
              placeholder="One clear sentence for product cards."
            />
          </label>
          <label className="full-width">
            Description
            <textarea
              name="description"
              rows={6}
              defaultValue={product?.description ?? ""}
              placeholder="Ingredients, serving ideas, package details, and storage notes."
            />
          </label>
          <label>
            Category
            <select name="categoryId" defaultValue={product?.categoryId ?? ""}>
              <option value="">No category</option>
              {categories.map((category) => (
                <Fragment key={category.id}>
                  <option value={category.id}>{category.name}</option>
                  {category.children.map((child) => (
                    <option value={child.id} key={child.id}>
                      &nbsp;&nbsp;— {child.name}
                    </option>
                  ))}
                </Fragment>
              ))}
            </select>
          </label>
          <label>
            Status *
            <select required name="status" defaultValue={product?.status ?? "draft"}>
              <option value="draft">Draft</option>
              <option value="active">Active</option>
              <option value="archived">Archived</option>
            </select>
          </label>
        </div>
      </section>

      <section className="form-card">
        <div className="form-card-heading">
          <div>
            <h2>Variant, price, and inventory</h2>
            <p>Each sellable variant receives its own SKU and inventory balance.</p>
          </div>
        </div>
        <div className="form-grid three-columns">
          <label>
            Variant name *
            <input required name="variantName" defaultValue={product?.variantName ?? ""} placeholder="8 oz bag" />
          </label>
          <label>
            SKU *
            <input required name="sku" defaultValue={product?.sku ?? ""} placeholder="MANGO-8OZ" />
          </label>
          <label>
            Barcode
            <input name="barcode" defaultValue={product?.barcode ?? ""} placeholder="Optional UPC or EAN" />
          </label>
          <label>
            Retail price (USD) *
            <input
              required
              name="retailPrice"
              type="number"
              min="0"
              step="0.01"
              defaultValue={product?.retailPrice ?? ""}
              placeholder="8.99"
            />
          </label>
          <label>
            Sale price (USD)
            <input
              name="salePrice"
              type="number"
              min="0"
              step="0.01"
              defaultValue={product?.salePrice ?? ""}
              placeholder="Leave blank for no sale"
            />
          </label>
          <label>
            Wholesale price (USD)
            <input
              name="wholesalePrice"
              type="number"
              min="0"
              step="0.01"
              defaultValue={product?.wholesalePrice ?? ""}
              placeholder="6.25"
            />
          </label>
          <label>
            Unit cost (USD) *
            <input
              required
              name="costPrice"
              type="number"
              min="0"
              step="0.01"
              defaultValue={product?.costPrice ?? ""}
              placeholder="3.40"
            />
          </label>
          <p className="field-hint full-width">
            Sale price is optional. When set lower than retail, the storefront shows retail struck through and charges
            the sale price in cart totals.
          </p>
          {isEdit ? (
            <label>
              On hand (read-only)
              <input value={product?.onHand ?? 0} readOnly disabled />
            </label>
          ) : (
            <label>
              Opening quantity
              <input name="openingQuantity" type="number" min="0" step="1" defaultValue="0" />
            </label>
          )}
          <label>
            Location code
            <input name="locationCode" defaultValue="MAIN" />
          </label>
        </div>
        {isEdit ? (
          <p className="field-hint">
            Stock quantity is corrected from Inventory so every change is recorded in the movement ledger.
          </p>
        ) : null}
        <div className="checkbox-row">
          <label>
            <input type="checkbox" name="trackInventory" defaultChecked={product?.trackInventory ?? true} /> Track
            inventory
          </label>
          <label>
            <input type="checkbox" name="taxable" defaultChecked={product?.taxable ?? true} /> Taxable item
          </label>
          <label>
            <input type="checkbox" name="featured" defaultChecked={product?.featured ?? false} /> Featured product
          </label>
        </div>
      </section>

      <section className="form-card">
        <ProductMediaUploader />
      </section>

      <div className="sticky-form-actions">
        {showSaved ? (
          <button className="button secondary button-saved" type="button" disabled>
            <Check size={17} aria-hidden="true" /> Saved
          </button>
        ) : (
          <button className="button primary" type="submit" disabled={!canSubmit}>
            <Save size={17} aria-hidden="true" />
            {pending ? "Saving…" : isEdit ? "Save changes" : "Create product"}
          </button>
        )}
      </div>
    </form>
  );
}

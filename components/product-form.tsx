"use client";

import { useState } from "react";
import { Save } from "lucide-react";
import { ProductMediaUploader } from "@/components/product-media-uploader";
import { categories } from "@/lib/sample-data";

export function ProductForm() {
  const [saved, setSaved] = useState(false);

  return (
    <form className="admin-form" onSubmit={(event) => { event.preventDefault(); setSaved(true); }}>
      {saved ? <div className="form-success" role="status">Form validation passed in starter mode. Connect the product mutation endpoint before production use.</div> : null}
      <section className="form-card">
        <div className="form-card-heading"><div><h2>Product information</h2><p>Customer-facing content is written in English.</p></div><span className="required-note">* Required</span></div>
        <div className="form-grid two-columns">
          <label>Product name *<input required name="name" placeholder="Example: Tropical Mango Slices" /></label>
          <label>Slug *<input required name="slug" pattern="[a-z0-9-]+" placeholder="tropical-mango-slices" /></label>
          <label className="full-width">Short description *<input required name="shortDescription" maxLength={180} placeholder="One clear sentence for product cards." /></label>
          <label className="full-width">Description *<textarea required name="description" rows={6} placeholder="Ingredients, serving ideas, package details, and storage notes." /></label>
          <label>Category *
            <select required name="category" defaultValue="">
              <option value="" disabled>Select category</option>
              {categories.map((category) => <option value={category.slug} key={category.slug}>{category.name}</option>)}
            </select>
          </label>
          <label>Status *<select required name="status" defaultValue="draft"><option value="draft">Draft</option><option value="active">Active</option><option value="archived">Archived</option></select></label>
        </div>
      </section>

      <section className="form-card">
        <div className="form-card-heading"><div><h2>Variant, price, and inventory</h2><p>Each sellable variant receives its own SKU and inventory balance.</p></div></div>
        <div className="form-grid three-columns">
          <label>Variant name *<input required name="variantName" placeholder="8 oz bag" /></label>
          <label>SKU *<input required name="sku" placeholder="MANGO-8OZ" /></label>
          <label>Barcode<input name="barcode" placeholder="Optional UPC or EAN" /></label>
          <label>Retail price (USD) *<input required name="retailPrice" type="number" min="0" step="0.01" placeholder="8.99" /></label>
          <label>Wholesale price (USD)<input name="wholesalePrice" type="number" min="0" step="0.01" placeholder="6.25" /></label>
          <label>Unit cost (USD) *<input required name="costPrice" type="number" min="0" step="0.01" placeholder="3.40" /></label>
          <label>Opening quantity<input name="openingQuantity" type="number" min="0" step="1" defaultValue="0" /></label>
          <label>Reorder point<input name="reorderPoint" type="number" min="0" step="1" defaultValue="0" /></label>
          <label>Location code<input name="locationCode" defaultValue="MAIN" /></label>
        </div>
        <div className="checkbox-row">
          <label><input type="checkbox" name="trackInventory" defaultChecked /> Track inventory</label>
          <label><input type="checkbox" name="taxable" defaultChecked /> Taxable item</label>
          <label><input type="checkbox" name="featured" /> Featured product</label>
        </div>
      </section>

      <section className="form-card">
        <ProductMediaUploader />
      </section>

      <div className="sticky-form-actions">
        <button className="button secondary" type="button">Save as draft</button>
        <button className="button primary" type="submit"><Save size={17} /> Validate product</button>
      </div>
    </form>
  );
}

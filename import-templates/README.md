# Product import files

## Files

- `product-import-template.xlsx`: primary workbook with Instructions, Products, and hidden Lists sheets.
- `product-import-example.csv`: the same sample rows in CSV form for mapping/reference. The starter preview endpoint accepts `.xlsx` only.
- `implementation-backlog.xlsx`: editable project backlog with phases, priorities, dependencies, owners, estimates, and status dropdowns.

Regenerate workbooks after header changes:

```bash
python3 tools/create_workbooks.py
```

This updates both `import-templates/` and `public/templates/product-import-template.xlsx` (download link in Admin).

## Required product headers

`operation`, `product_handle`, `product_name`, `sku`, `retail_price`, `cost_price`.

## Current column layout (matches app data)

| Group | Columns |
|---|---|
| Identity | `operation`, `product_handle`, `product_name`, `slug`, `short_description`, `description`, `category_path` |
| Variant | `variant_name`, `sku`, `barcode`, `attributes_json` |
| Pricing | `retail_price`, **`sale_price`**, `wholesale_price`, `cost_price` |
| Inventory | `track_inventory`, `opening_quantity`, `location_code` |
| Status | `taxable`, `unit`, `weight_oz`, **`status`** (`draft`/`active`/`archived`), **`featured`** |
| Media | `image_url_1`…`image_url_10`, `video_url` |

### Notes

- **`sale_price`**: optional. When set must be **lower than** `retail_price`. Storefront shows retail struck through and charges sale.
- **`status`**: prefer this over legacy `active` TRUE/FALSE (still accepted in preview for old files).
- **`reorder_point`**: removed from the template. Still accepted as a legacy column but **ignored** (not imported).
- Do not rename headers. One row per sellable SKU. Repeat `product_handle` for variants of the same product.
- At most 10 image URL columns. `image_url_1` is the cover.

The app currently implements **validation preview** only. Commit should go through a transaction/RPC, audit log, and opening inventory as an inventory movement (not a direct balance write).

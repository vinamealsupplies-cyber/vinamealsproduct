# Product import (simple)

## Required columns only

| Column | Meaning |
|---|---|
| `product_name` | Tên sản phẩm |
| `retail_price` | Giá bán (USD) |
| `inventory` | Số lượng tồn ban đầu (số nguyên ≥ 0) |

## What the system creates automatically

- Product UUID (database)
- `product_handle` + `slug` from the name + random suffix
- `sku` (e.g. `SKU-A1B2C3`) unless you pass an optional `sku` column
- Status `active`, no category, no images

Products **without a category** only show under **Shop all**. Assign a category later in Admin → Products if you want them in the Categories menu.

## Optional columns

`sale_price`, `cost_price`, `sku`, `short_description`, `status` (`draft`|`active`|`archived`)

## Files

- `product-import-template.xlsx` — also copied to `public/templates/` for Admin download
- `product-import-example.csv` — same sample data as CSV

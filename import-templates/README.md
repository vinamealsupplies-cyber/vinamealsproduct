# Product import files

## Files

- `product-import-template.xlsx`: primary workbook with Instructions, Products, and hidden Lists sheets.
- `product-import-example.csv`: the same sample rows in CSV form for mapping/reference. The starter preview endpoint accepts `.xlsx` only.
- `implementation-backlog.xlsx`: editable project backlog with phases, priorities, dependencies, owners, estimates, and status dropdowns.

## Required product headers

`operation`, `product_handle`, `product_name`, `sku`, `retail_price`, and `cost_price`.

Do not rename headers. Use one row per sellable SKU. Repeat `product_handle` for variants that belong to the same product. A product supports at most 10 image URLs. `image_url_1` is the cover image. Columns named `image_url_11` or higher are rejected; unrelated unknown columns are reported and ignored by preview.

The starter implements validation preview only. Production import should commit through a transaction/RPC, write an audit record, use idempotency keys, and create opening inventory as an inventory movement rather than writing the balance directly.

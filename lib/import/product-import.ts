import ExcelJS from "exceljs";
import { randomBytes } from "crypto";

/**
 * Import tối giản — chỉ 3 cột bắt buộc:
 *   product_name | retail_price | inventory
 *
 * Hệ thống tự sinh: id (uuid DB), product_handle, slug, sku.
 * Không category → chỉ hiện ở Shop all. Ảnh/video upload sau.
 * Cột thừa (legacy template) được bỏ qua.
 */
export const productImportHeaders = ["product_name", "retail_price", "inventory"] as const;

/** Cột tùy chọn — nếu có thì dùng. */
const OPTIONAL_HEADERS = new Set([
  "sale_price",
  "cost_price",
  "sku",
  "short_description",
  "status"
]);

export type SimpleImportRow = {
  rowNumber: number;
  productName: string;
  retailPrice: number;
  inventory: number;
  salePrice: number | null;
  costPrice: number;
  sku: string | null;
  shortDescription: string;
  status: "draft" | "active" | "archived";
  /** Giá trị đã chuẩn hoá để commit / preview. */
  generatedHandle: string;
  generatedSlug: string;
  generatedSku: string;
  errors: string[];
  warnings: string[];
};

export type ImportPreviewResult = {
  worksheet: string;
  unknownHeaders: string[];
  totalRows: number;
  validRows: number;
  warningRows: number;
  errorRows: number;
  operationCounts: { create: number; update: number; upsert: number };
  rows: Array<{
    rowNumber: number;
    values: Record<string, string | number | boolean | object | null>;
    errors: string[];
    warnings: string[];
  }>;
  /** Dữ liệu sạch cho commit (chỉ row không lỗi). */
  commitRows: SimpleImportRow[];
};

function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value).trim();
  }
  if (value instanceof Date) return value.toISOString();
  if ("text" in value && typeof value.text === "string") return value.text.trim();
  if ("result" in value && value.result !== undefined && value.result !== null) {
    return String(value.result).trim();
  }
  return String(value).trim();
}

function parseNumber(value: string) {
  if (value === "") return null;
  const cleaned = value.replace(/[$,\s]/g, "");
  const number = Number(cleaned);
  return Number.isFinite(number) ? number : null;
}

export function slugifyName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "product";
}

export function makeUniqueSuffix() {
  return randomBytes(3).toString("hex"); // 6 hex chars
}

export async function parseProductWorkbook(buffer: Buffer): Promise<ImportPreviewResult> {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("'comments'") || message.includes("comments")) {
      throw new Error(
        "This workbook stores cell comments in a layout the importer cannot read. Open it in Excel, remove comments (or re-save as .xlsx), then upload again."
      );
    }
    throw new Error("The workbook could not be opened. Make sure it is a valid .xlsx file.");
  }

  const worksheet = workbook.getWorksheet("Products") ?? workbook.worksheets[0];
  if (!worksheet) throw new Error("The workbook does not contain a worksheet.");

  const headerMap = new Map<string, number>();
  const duplicateHeaders = new Set<string>();
  worksheet.getRow(1).eachCell({ includeEmpty: true }, (cell, columnNumber) => {
    const header = cellText(cell.value).toLowerCase().replace(/\s+/g, "_");
    if (!header) return;
    // Alias thân thiện
    const normalized =
      header === "name" || header === "product" || header === "tên" || header === "ten_san_pham"
        ? "product_name"
        : header === "price" || header === "giá" || header === "gia" || header === "gia_ban"
          ? "retail_price"
          : header === "qty" ||
              header === "quantity" ||
              header === "stock" ||
              header === "on_hand" ||
              header === "opening_quantity" ||
              header === "ton_kho" ||
              header === "tồn_kho"
            ? "inventory"
            : header;

    if (headerMap.has(normalized)) duplicateHeaders.add(normalized);
    else headerMap.set(normalized, columnNumber);
  });

  if (duplicateHeaders.size) {
    throw new Error(`Duplicate headers: ${Array.from(duplicateHeaders).join(", ")}`);
  }

  const required = ["product_name", "retail_price", "inventory"] as const;
  const missing = required.filter((h) => !headerMap.has(h));
  if (missing.length) {
    throw new Error(
      `Missing required headers: ${missing.join(", ")}. Template only needs: product_name, retail_price, inventory.`
    );
  }

  const known = new Set<string>([...productImportHeaders, ...OPTIONAL_HEADERS]);
  // Legacy full template columns — ignore silently
  const legacyIgnored = new Set([
    "operation",
    "product_handle",
    "slug",
    "description",
    "category_path",
    "variant_name",
    "barcode",
    "attributes_json",
    "wholesale_price",
    "track_inventory",
    "location_code",
    "taxable",
    "unit",
    "weight_oz",
    "active",
    "featured",
    "video_url",
    "reorder_point",
    ...Array.from({ length: 10 }, (_, i) => `image_url_${i + 1}`)
  ]);

  const unknownHeaders = Array.from(headerMap.keys())
    .filter((h) => !known.has(h) && !legacyIgnored.has(h))
    .sort();

  if (worksheet.rowCount > 5001) {
    throw new Error("At most 5,000 data rows per import.");
  }

  const usedSkus = new Set<string>();
  const usedHandles = new Set<string>();
  const commitRows: SimpleImportRow[] = [];
  const previewRows: ImportPreviewResult["rows"] = [];

  for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    const get = (header: string) => {
      const col = headerMap.get(header);
      return col ? cellText(row.getCell(col).value) : "";
    };

    const productName = get("product_name");
    const retailRaw = get("retail_price");
    const inventoryRaw = get("inventory");
    if (!productName && !retailRaw && !inventoryRaw) continue;

    const errors: string[] = [];
    const warnings: string[] = [];

    if (!productName) errors.push("product_name is required");
    if (productName.length > 200) errors.push("product_name must be 200 characters or fewer");

    const retailPrice = parseNumber(retailRaw);
    if (retailPrice === null || retailPrice < 0) {
      errors.push("retail_price must be a number ≥ 0");
    }

    const inventory = parseNumber(inventoryRaw);
    if (inventory === null || inventory < 0 || Math.floor(inventory) !== inventory) {
      errors.push("inventory must be a whole number ≥ 0");
    }

    const salePrice = parseNumber(get("sale_price"));
    if (get("sale_price")) {
      if (salePrice === null || salePrice < 0) errors.push("sale_price must be blank or ≥ 0");
      else if (retailPrice !== null && salePrice >= retailPrice) {
        errors.push("sale_price must be lower than retail_price");
      }
    }

    let costPrice = parseNumber(get("cost_price"));
    if (get("cost_price") && (costPrice === null || costPrice < 0)) {
      errors.push("cost_price must be blank or ≥ 0");
    }
    if (costPrice === null) costPrice = 0;

    const statusRaw = get("status").toLowerCase();
    let status: "draft" | "active" | "archived" = "active";
    if (statusRaw) {
      if (!["draft", "active", "archived"].includes(statusRaw)) {
        errors.push("status must be draft, active, or archived");
      } else {
        status = statusRaw as "draft" | "active" | "archived";
      }
    }

    const shortDescription = get("short_description") || productName.slice(0, 180);
    const providedSku = get("sku");

    // Auto IDs
    const base = slugifyName(productName);
    let suffix = makeUniqueSuffix();
    let generatedHandle = `${base}-${suffix}`;
    while (usedHandles.has(generatedHandle)) {
      suffix = makeUniqueSuffix();
      generatedHandle = `${base}-${suffix}`;
    }
    usedHandles.add(generatedHandle);
    const generatedSlug = generatedHandle;

    let generatedSku = providedSku || `SKU-${suffix.toUpperCase()}`;
    if (providedSku) {
      const key = providedSku.toLowerCase();
      if (usedSkus.has(key)) errors.push("sku is duplicated in this file");
      usedSkus.add(key);
      generatedSku = providedSku;
    } else {
      while (usedSkus.has(generatedSku.toLowerCase())) {
        generatedSku = `SKU-${makeUniqueSuffix().toUpperCase()}`;
      }
      usedSkus.add(generatedSku.toLowerCase());
    }

    warnings.push("No category — product only appears under Shop all until categorized.");
    warnings.push("Images/video can be added later in Admin → Products.");

    const inv = inventory === null ? 0 : Math.floor(inventory);

    const simple: SimpleImportRow = {
      rowNumber,
      productName,
      retailPrice: retailPrice ?? 0,
      inventory: inv,
      salePrice: get("sale_price") ? salePrice : null,
      costPrice: costPrice ?? 0,
      sku: providedSku || null,
      shortDescription,
      status,
      generatedHandle,
      generatedSlug,
      generatedSku,
      errors,
      warnings
    };

    if (errors.length === 0) commitRows.push(simple);

    previewRows.push({
      rowNumber,
      values: {
        product_name: productName,
        retail_price: retailPrice,
        inventory: inv,
        sale_price: simple.salePrice,
        cost_price: simple.costPrice,
        status: simple.status,
        sku: simple.generatedSku,
        product_handle: simple.generatedHandle,
        slug: simple.generatedSlug,
        operation: "CREATE"
      },
      errors,
      warnings
    });
  }

  return {
    worksheet: worksheet.name,
    unknownHeaders,
    totalRows: previewRows.length,
    validRows: previewRows.filter((r) => r.errors.length === 0).length,
    warningRows: previewRows.filter((r) => r.errors.length === 0 && r.warnings.length > 0).length,
    errorRows: previewRows.filter((r) => r.errors.length > 0).length,
    operationCounts: {
      create: previewRows.filter((r) => r.errors.length === 0).length,
      update: 0,
      upsert: 0
    },
    rows: previewRows,
    commitRows
  };
}

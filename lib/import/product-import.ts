import ExcelJS from "exceljs";

/**
 * Headers khớp product_variants / products hiện tại:
 * - sale_price (khuyến mãi, optional, phải < retail_price)
 * - status: draft | active | archived (ưu tiên hơn active TRUE/FALSE)
 * - reorder_point: legacy, chấp nhận nhưng bỏ qua (cột không còn dùng trên UI)
 */
export const productImportHeaders = [
  "operation",
  "product_handle",
  "product_name",
  "slug",
  "short_description",
  "description",
  "category_path",
  "variant_name",
  "sku",
  "barcode",
  "attributes_json",
  "retail_price",
  "sale_price",
  "wholesale_price",
  "cost_price",
  "track_inventory",
  "opening_quantity",
  "location_code",
  "taxable",
  "unit",
  "weight_oz",
  "status",
  "active",
  "featured",
  "image_url_1",
  "image_url_2",
  "image_url_3",
  "image_url_4",
  "image_url_5",
  "image_url_6",
  "image_url_7",
  "image_url_8",
  "image_url_9",
  "image_url_10",
  "video_url"
] as const;

/** Cột cũ vẫn đọc được để file mẫu trước đây không bị “unknown header”. */
const LEGACY_HEADERS = new Set(["reorder_point"]);

const STATUSES = new Set(["draft", "active", "archived"]);

export type ImportPreviewRow = {
  rowNumber: number;
  values: Record<string, string | number | boolean | object | null>;
  errors: string[];
  warnings: string[];
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

function parseBoolean(value: string) {
  const normalized = value.toLowerCase();
  if (["true", "yes", "y", "1"].includes(normalized)) return true;
  if (["false", "no", "n", "0"].includes(normalized)) return false;
  return null;
}

function parseNumber(value: string) {
  if (value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function validateHttpsUrl(value: string, label: string, errors: string[]) {
  try {
    const parsedUrl = new URL(value);
    if (parsedUrl.protocol !== "https:") errors.push(`${label} must use HTTPS`);
  } catch {
    errors.push(`${label} is not a valid URL`);
  }
}

function resolveStatus(rawStatus: string, rawActive: string): {
  status: string | null;
  error?: string;
  warning?: string;
} {
  if (rawStatus) {
    const status = rawStatus.toLowerCase();
    if (!STATUSES.has(status)) {
      return { status: null, error: "status must be draft, active, or archived" };
    }
    return { status };
  }
  if (rawActive) {
    const active = parseBoolean(rawActive);
    if (active === null) return { status: null, error: "active must be TRUE or FALSE when status is blank" };
    return {
      status: active ? "active" : "draft",
      warning: "active is legacy — prefer status (draft|active|archived)"
    };
  }
  return { status: "active" };
}

export async function parseProductWorkbook(buffer: Buffer) {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("'comments'") || message.includes("comments")) {
      throw new Error(
        "This workbook stores cell comments in a layout the importer cannot read. Open it in Excel, remove the cell comments (or re-save as .xlsx), then upload again."
      );
    }
    throw new Error("The workbook could not be opened. Make sure it is a valid .xlsx file.");
  }
  const worksheet = workbook.getWorksheet("Products") ?? workbook.worksheets[0];
  if (!worksheet) throw new Error("The workbook does not contain a worksheet.");

  const headerMap = new Map<string, number>();
  const duplicateHeaders = new Set<string>();
  worksheet.getRow(1).eachCell({ includeEmpty: true }, (cell, columnNumber) => {
    const header = cellText(cell.value).toLowerCase();
    if (!header) return;
    if (headerMap.has(header)) duplicateHeaders.add(header);
    else headerMap.set(header, columnNumber);
  });
  if (duplicateHeaders.size) {
    throw new Error(`Duplicate headers: ${Array.from(duplicateHeaders).join(", ")}`);
  }

  const oversizedImageHeaders = Array.from(headerMap.keys()).filter((header) => {
    const match = /^image_url_(\d+)$/.exec(header);
    return match ? Number(match[1]) > 10 : false;
  });
  if (oversizedImageHeaders.length) {
    throw new Error(`A product supports at most 10 image columns. Remove: ${oversizedImageHeaders.join(", ")}`);
  }

  const allowedHeaders = new Set<string>([...productImportHeaders, ...LEGACY_HEADERS]);
  const unknownHeaders = Array.from(headerMap.keys())
    .filter((header) => !allowedHeaders.has(header))
    .sort();
  const missingHeaders = ["operation", "product_handle", "product_name", "sku", "retail_price", "cost_price"].filter(
    (header) => !headerMap.has(header)
  );

  if (missingHeaders.length) {
    throw new Error(`Missing required headers: ${missingHeaders.join(", ")}`);
  }

  if (worksheet.rowCount > 5001) {
    throw new Error("The Products sheet can contain at most 5,000 data rows per import.");
  }

  const seenSkus = new Set<string>();
  const seenBarcodes = new Set<string>();
  const productDefinitions = new Map<string, { name: string; slug: string; categoryPath: string }>();
  const rows: ImportPreviewRow[] = [];
  const fileWarnings: string[] = [];
  if (headerMap.has("reorder_point")) {
    fileWarnings.push("Column reorder_point is ignored (no longer used). Remove it from new templates.");
  }

  // Include every header found so legacy columns can still be read for warnings.
  const readHeaders = Array.from(
    new Set([...productImportHeaders, ...Array.from(headerMap.keys())])
  );

  for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    const raw: Record<string, string> = {};
    for (const header of readHeaders) {
      const column = headerMap.get(header);
      raw[header] = column ? cellText(row.getCell(column).value) : "";
    }

    if (!raw.product_handle && !raw.product_name && !raw.sku) continue;

    const errors: string[] = [];
    const warnings: string[] = [...fileWarnings];
    const operation = raw.operation.toUpperCase();
    if (!["CREATE", "UPDATE", "UPSERT"].includes(operation)) {
      errors.push("operation must be CREATE, UPDATE, or UPSERT");
    }
    if (!raw.product_handle) errors.push("product_handle is required");
    if (!raw.product_name) errors.push("product_name is required");
    if (!raw.sku) errors.push("sku is required");

    if (raw.product_handle.length > 120) errors.push("product_handle must be 120 characters or fewer");
    if (raw.product_handle && !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(raw.product_handle)) {
      errors.push("product_handle may contain letters, numbers, periods, underscores, and hyphens only");
    }
    if (raw.product_name.length > 200) errors.push("product_name must be 200 characters or fewer");
    if (raw.sku.length > 120) errors.push("sku must be 120 characters or fewer");
    if (raw.barcode.length > 120) errors.push("barcode must be 120 characters or fewer");
    if (raw.slug.length > 200) errors.push("slug must be 200 characters or fewer");
    if (raw.slug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(raw.slug)) {
      errors.push("slug must use lowercase letters, numbers, and single hyphens only");
    }

    const normalizedSku = raw.sku.toLowerCase();
    if (normalizedSku && seenSkus.has(normalizedSku)) errors.push("sku is duplicated in this file");
    if (normalizedSku) seenSkus.add(normalizedSku);

    const normalizedBarcode = raw.barcode.toLowerCase();
    if (normalizedBarcode && seenBarcodes.has(normalizedBarcode)) errors.push("barcode is duplicated in this file");
    if (normalizedBarcode) seenBarcodes.add(normalizedBarcode);

    if (raw.category_path) {
      const segments = raw.category_path.split(">").map((segment) => segment.trim());
      if (segments.some((segment) => !segment)) errors.push("category_path contains an empty category segment");
    }

    const productKey = raw.product_handle.toLowerCase();
    if (productKey) {
      const existing = productDefinitions.get(productKey);
      const current = { name: raw.product_name, slug: raw.slug, categoryPath: raw.category_path };
      if (!existing) productDefinitions.set(productKey, current);
      else {
        if (existing.name && current.name && existing.name !== current.name) {
          warnings.push("product_name differs from another row with the same product_handle");
        }
        if (existing.slug && current.slug && existing.slug !== current.slug) {
          warnings.push("slug differs from another row with the same product_handle");
        }
        if (existing.categoryPath && current.categoryPath && existing.categoryPath !== current.categoryPath) {
          warnings.push("category_path differs from another row with the same product_handle");
        }
      }
    }

    const retailPrice = parseNumber(raw.retail_price);
    const salePrice = parseNumber(raw.sale_price ?? "");
    const wholesalePrice = parseNumber(raw.wholesale_price);
    const costPrice = parseNumber(raw.cost_price);
    const openingQuantity = parseNumber(raw.opening_quantity);
    const weightOz = parseNumber(raw.weight_oz);

    if (retailPrice === null || retailPrice < 0) errors.push("retail_price must be a number greater than or equal to 0");
    if (raw.sale_price) {
      if (salePrice === null || salePrice < 0) {
        errors.push("sale_price must be blank or greater than or equal to 0");
      } else if (retailPrice !== null && salePrice >= retailPrice) {
        errors.push("sale_price must be lower than retail_price");
      }
    }
    if (raw.wholesale_price && (wholesalePrice === null || wholesalePrice < 0)) {
      errors.push("wholesale_price must be blank or greater than or equal to 0");
    }
    if (costPrice === null || costPrice < 0) errors.push("cost_price must be a number greater than or equal to 0");
    if (raw.opening_quantity && (openingQuantity === null || openingQuantity < 0)) {
      errors.push("opening_quantity must be blank or greater than or equal to 0");
    }
    if (raw.weight_oz && (weightOz === null || weightOz < 0)) {
      errors.push("weight_oz must be blank or greater than or equal to 0");
    }
    if (retailPrice !== null && costPrice !== null && retailPrice < costPrice) {
      warnings.push("retail_price is below cost_price");
    }
    if (salePrice !== null && costPrice !== null && salePrice < costPrice) {
      warnings.push("sale_price is below cost_price");
    }
    if (wholesalePrice !== null && costPrice !== null && wholesalePrice < costPrice) {
      warnings.push("wholesale_price is below cost_price");
    }
    if (wholesalePrice !== null && retailPrice !== null && wholesalePrice > retailPrice) {
      warnings.push("wholesale_price is greater than retail_price");
    }
    if (raw.reorder_point) {
      warnings.push("reorder_point is ignored and not imported");
    }

    const trackInventory = parseBoolean(raw.track_inventory || "true");
    const taxable = parseBoolean(raw.taxable || "true");
    const featured = raw.featured ? parseBoolean(raw.featured) : false;
    if (trackInventory === null) errors.push("track_inventory must be TRUE or FALSE");
    if (taxable === null) errors.push("taxable must be TRUE or FALSE");
    if (raw.featured && featured === null) errors.push("featured must be TRUE or FALSE when provided");

    const statusResult = resolveStatus(raw.status ?? "", raw.active ?? "");
    if (statusResult.error) errors.push(statusResult.error);
    if (statusResult.warning) warnings.push(statusResult.warning);

    if (trackInventory === false && (openingQuantity ?? 0) > 0) {
      errors.push("opening_quantity must be 0 when track_inventory is FALSE");
    }
    if ((openingQuantity ?? 0) > 0 && !raw.location_code) {
      warnings.push("location_code is blank; the commit step must use the configured default location");
    }

    let attributes: object = {};
    if (raw.attributes_json) {
      try {
        const parsed: unknown = JSON.parse(raw.attributes_json);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          errors.push("attributes_json must be a JSON object");
        } else {
          attributes = parsed;
        }
      } catch {
        errors.push("attributes_json is invalid JSON");
      }
    }

    const imageUrls = Array.from({ length: 10 }, (_, index) => ({
      label: `image_url_${index + 1}`,
      value: raw[`image_url_${index + 1}`]
    })).filter((item) => Boolean(item.value));
    imageUrls.forEach((item) => validateHttpsUrl(item.value, item.label, errors));
    if (raw.video_url) validateHttpsUrl(raw.video_url, "video_url", errors);
    if (imageUrls.length === 0) {
      warnings.push("No image URLs were provided; the product should remain draft until media is added.");
    }

    rows.push({
      rowNumber,
      values: {
        ...raw,
        operation,
        retail_price: retailPrice,
        sale_price: raw.sale_price ? salePrice : null,
        wholesale_price: wholesalePrice,
        cost_price: costPrice,
        opening_quantity: openingQuantity ?? 0,
        weight_oz: weightOz,
        track_inventory: trackInventory,
        taxable,
        featured: featured ?? false,
        status: statusResult.status,
        attributes_json: attributes
      },
      errors,
      warnings
    });
  }

  return {
    worksheet: worksheet.name,
    unknownHeaders,
    totalRows: rows.length,
    validRows: rows.filter((row) => row.errors.length === 0).length,
    warningRows: rows.filter((row) => row.errors.length === 0 && row.warnings.length > 0).length,
    errorRows: rows.filter((row) => row.errors.length > 0).length,
    operationCounts: {
      create: rows.filter((row) => row.values.operation === "CREATE").length,
      update: rows.filter((row) => row.values.operation === "UPDATE").length,
      upsert: rows.filter((row) => row.values.operation === "UPSERT").length
    },
    rows
  };
}

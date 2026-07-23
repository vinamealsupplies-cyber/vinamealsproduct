#!/usr/bin/env node
/**
 * Sinh lib/tax/jurisdictions.generated.ts TỪ file migration SQL.
 *
 * Nguồn chân lý là SQL trong supabase/migrations — bảng trong database mới là
 * cái tính tiền thật. File TS chỉ dùng cho giao diện khi chưa nối Supabase.
 * Chạy lại script này mỗi khi sửa seed thuế để hai bên không lệch nhau.
 *
 *   node scripts/sync-tax-data.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const migration = join(root, "supabase/migrations/20260723090600_sales_tax_by_city.sql");
const outFile = join(root, "lib/tax/jurisdictions.generated.ts");

const sql = readFileSync(migration, "utf8");
const rows = [];

// 5a: (state, city, general, grocery, notes)
const withNotes = /\(\s*'([A-Z]{2})'\s*,\s*'([^']*)'\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*'((?:[^']|'')*)'\s*\)/g;
for (const m of sql.matchAll(withNotes)) {
  rows.push({
    state: m[1],
    city: m[2],
    general: Number(m[3]),
    grocery: Number(m[4]),
    notes: m[5].replace(/''/g, "'")
  });
}

// 5b: (state, city, general, grocery)
const withoutNotes = /\(\s*'([A-Z]{2})'\s*,\s*'([^']*)'\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)\s*\)/g;
for (const m of sql.matchAll(withoutNotes)) {
  if (rows.some((r) => r.state === m[1] && r.city === m[2])) continue;
  rows.push({ state: m[1], city: m[2], general: Number(m[3]), grocery: Number(m[4]) });
}

rows.sort((a, b) =>
  a.state === b.state ? a.city.localeCompare(b.city) : a.state.localeCompare(b.state)
);

const body = rows
  .map((r) => {
    const notes = r.notes ? `, notes: ${JSON.stringify(r.notes)}` : "";
    return `  { state: "${r.state}", city: ${JSON.stringify(r.city)}, general: ${r.general}, grocery: ${r.grocery}${notes} }`;
  })
  .join(",\n");

const output = `// FILE NÀY ĐƯỢC SINH TỰ ĐỘNG — ĐỪNG SỬA TAY.
// Nguồn: supabase/migrations/20260723090600_sales_tax_by_city.sql
// Sinh lại bằng: node scripts/sync-tax-data.mjs
//
// Số liệu là ƯỚC LƯỢNG KHỞI ĐIỂM, chưa được xác minh với cơ quan thuế của bang.

export type TaxJurisdiction = {
  /** Mã bang hai chữ, ví dụ "CA". */
  state: string;
  /** Tên thành phố, hoặc "*" nghĩa là mức mặc định của cả bang. */
  city: string;
  /** Thuế suất hàng hoá thường, dạng thập phân (0.095 = 9.5%). */
  general: number;
  /** Thuế suất hàng tạp hoá đủ điều kiện. */
  grocery: number;
  notes?: string;
};

export const taxJurisdictions: TaxJurisdiction[] = [
${body}
];

export const taxJurisdictionCount = ${rows.length};
export const taxStateCount = ${new Set(rows.map((r) => r.state)).size};
export const taxCityCount = ${rows.filter((r) => r.city !== "*").length};
`;

mkdirSync(dirname(outFile), { recursive: true });
writeFileSync(outFile, output);
console.log(
  `Đã sinh ${rows.length} dòng thuế (${new Set(rows.map((r) => r.state)).size} bang, ` +
    `${rows.filter((r) => r.city !== "*").length} thành phố) -> lib/tax/jurisdictions.generated.ts`
);

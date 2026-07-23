import { taxJurisdictions, type TaxJurisdiction } from "@/lib/tax/jurisdictions.generated";

export type TaxCategory = "grocery" | "prepared_food" | "general";

export type TaxResult = {
  /** Tiền thuế, đã làm tròn 2 số lẻ. */
  taxAmount: number;
  /** Thuế suất áp dụng, dạng thập phân. */
  rate: number;
  /** Nhãn vùng đã khớp, ví dụ "Los Angeles, CA". */
  label: string | null;
  /** Khớp theo cấp nào. */
  matchedOn: "city" | "state_default" | "no_jurisdiction" | "no_amount";
  jurisdiction: TaxJurisdiction | null;
};

function normalize(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

/**
 * Tra vùng thuế theo địa chỉ. Ưu tiên thành phố khớp tên, không có thì lùi về
 * mức mặc định của bang. Giữ đúng thứ tự ưu tiên của
 * `public.resolve_tax_jurisdiction` trong database.
 */
export function resolveJurisdiction(
  stateCode: string | null | undefined,
  city?: string | null
): TaxJurisdiction | null {
  const state = normalize(stateCode).toUpperCase();
  if (!state) return null;

  const inState = taxJurisdictions.filter((row) => row.state === state);
  if (inState.length === 0) return null;

  const cityKey = normalize(city);
  if (cityKey) {
    const cityMatch = inState.find((row) => normalize(row.city) === cityKey);
    if (cityMatch) return cityMatch;
  }

  return inState.find((row) => row.city === "*") ?? null;
}

export function rateFor(row: TaxJurisdiction, category: TaxCategory) {
  // prepared_food chưa có mức riêng thì dùng mức hàng thường, giống hàm SQL.
  return category === "grocery" ? row.grocery : row.general;
}

/**
 * Tính tiền thuế cho một khoản tiền theo địa chỉ.
 *
 * Đây là bản dùng cho giao diện khi chưa nối Supabase. Khi đã nối, tính tiền
 * THẬT phải gọi `public.calculate_sales_tax` trong database — bảng thuế ở đó
 * mới là nguồn chân lý và sửa được từ trang Admin.
 */
export function calculateSalesTax(
  amount: number,
  stateCode: string | null | undefined,
  city?: string | null,
  category: TaxCategory = "grocery"
): TaxResult {
  if (!Number.isFinite(amount) || amount <= 0 || !stateCode) {
    return { taxAmount: 0, rate: 0, label: null, matchedOn: "no_amount", jurisdiction: null };
  }

  const row = resolveJurisdiction(stateCode, city);
  if (!row) {
    return { taxAmount: 0, rate: 0, label: null, matchedOn: "no_jurisdiction", jurisdiction: null };
  }

  const rate = rateFor(row, category);
  return {
    taxAmount: Math.round(amount * rate * 100) / 100,
    rate,
    label: row.city === "*" ? `${row.state} (state default)` : `${row.city}, ${row.state}`,
    matchedOn: row.city === "*" ? "state_default" : "city",
    jurisdiction: row
  };
}

export function formatRate(rate: number) {
  return `${(rate * 100).toFixed(3).replace(/\.?0+$/, "")}%`;
}

/** Danh sách bang có trong bảng thuế, để đổ vào dropdown. */
export const taxStates = Array.from(new Set(taxJurisdictions.map((row) => row.state))).sort();

/** Các thành phố có mức riêng của một bang. */
export function citiesForState(stateCode: string) {
  return taxJurisdictions
    .filter((row) => row.state === stateCode.toUpperCase() && row.city !== "*")
    .map((row) => row.city)
    .sort();
}

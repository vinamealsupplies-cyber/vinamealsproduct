import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

// Khách hàng cho khu admin. Đọc bằng service role vì bảng customers chỉ cấp
// cột hạn chế cho `authenticated`, còn màn quản trị cần thấy đầy đủ (ghi chú,
// trạng thái miễn thuế, tài khoản đăng nhập gắn kèm). Trang gọi hàm này đã qua
// gate staff ở app/admin/layout.tsx.

export type CustomerType = "retail" | "wholesale" | "guest";
export type CustomerStatus = "active" | "inactive" | "blocked";
export type WholesaleMinKind = "quantity" | "amount";

export type AdminCustomer = {
  id: string;
  customerNumber: string | null;
  firstName: string | null;
  lastName: string | null;
  companyName: string | null;
  email: string | null;
  phone: string | null;
  customerType: CustomerType;
  status: CustomerStatus;
  notes: string | null;
  taxExemptStatus: string;
  /** @deprecated legacy min threshold — no longer used for storefront. */
  wholesaleMinKind: WholesaleMinKind | null;
  wholesaleMinValue: number | null;
  /** Order-level discount % for business offline orders. */
  businessDiscountPercent: number | null;
  /** Có tài khoản đăng nhập gắn kèm hay không — ảnh hưởng tới việc được xoá. */
  hasLogin: boolean;
  createdAt: string;
};

type DbCustomer = {
  id: string;
  customer_number: string | null;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  email: string | null;
  phone: string | null;
  customer_type: CustomerType;
  status: CustomerStatus;
  notes: string | null;
  tax_exempt_status: string;
  wholesale_min_kind: WholesaleMinKind | null;
  wholesale_min_value: number | string | null;
  business_discount_percent: number | string | null;
  auth_user_id: string | null;
  created_at: string;
};

function numOrNull(value: number | string | null | undefined): number | null {
  if (value == null || value === "") return null;
  const parsed = typeof value === "string" ? Number.parseFloat(value) : value;
  return typeof parsed === "number" && Number.isFinite(parsed) ? parsed : null;
}

function mapCustomer(row: DbCustomer): AdminCustomer {
  return {
    id: row.id,
    customerNumber: row.customer_number,
    firstName: row.first_name,
    lastName: row.last_name,
    companyName: row.company_name,
    email: row.email,
    phone: row.phone,
    customerType: row.customer_type,
    status: row.status,
    notes: row.notes,
    taxExemptStatus: row.tax_exempt_status,
    wholesaleMinKind:
      row.wholesale_min_kind === "quantity" || row.wholesale_min_kind === "amount"
        ? row.wholesale_min_kind
        : null,
    wholesaleMinValue: numOrNull(row.wholesale_min_value),
    businessDiscountPercent: numOrNull(row.business_discount_percent),
    hasLogin: Boolean(row.auth_user_id),
    createdAt: row.created_at
  };
}

export async function getCustomersForStaff(): Promise<AdminCustomer[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("customers")
    .select(
      "id, customer_number, first_name, last_name, company_name, email, phone, customer_type, status, notes, tax_exempt_status, wholesale_min_kind, wholesale_min_value, business_discount_percent, auth_user_id, created_at"
    )
    .order("customer_number", { ascending: true });

  if (error) throw new Error(`Failed to load customers: ${error.message}`);
  return ((data ?? []) as DbCustomer[]).map(mapCustomer);
}

/** Số đơn hàng / hoá đơn đang tham chiếu — dùng để giải thích khi không xoá được. */
export async function countCustomerReferences(customerId: string) {
  const supabase = createAdminClient();
  const [orders, invoices] = await Promise.all([
    supabase.from("sales_orders").select("id", { count: "exact", head: true }).eq("customer_id", customerId),
    supabase.from("invoices").select("id", { count: "exact", head: true }).eq("customer_id", customerId)
  ]);
  return { orders: orders.count ?? 0, invoices: invoices.count ?? 0 };
}

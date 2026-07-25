import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export type ApplicationStatus = "pending" | "approved" | "rejected";

export type TaxExemptionDocument = {
  id: string;
  objectKey: string;
  contentType: string;
  bytes: number;
  originalFilename: string | null;
};

export type TaxExemptionApplication = {
  id: string;
  customerId: string;
  contactName: string;
  businessName: string;
  email: string;
  phone: string;
  status: ApplicationStatus;
  reviewNote: string | null;
  reviewedAt: string | null;
  createdAt: string;
  documents: TaxExemptionDocument[];
};

type DbDocument = {
  id: string;
  object_key: string;
  content_type: string;
  bytes: number | string;
  original_filename: string | null;
};

type DbApplication = {
  id: string;
  customer_id: string;
  contact_name: string;
  business_name: string;
  email: string;
  phone: string;
  status: ApplicationStatus;
  review_note: string | null;
  reviewed_at: string | null;
  created_at: string;
  tax_exemption_documents: DbDocument[] | null;
};

const SELECT = `id, customer_id, contact_name, business_name, email, phone, status,
   review_note, reviewed_at, created_at,
   tax_exemption_documents ( id, object_key, content_type, bytes, original_filename )`;

function mapApplication(row: DbApplication): TaxExemptionApplication {
  return {
    id: row.id,
    customerId: row.customer_id,
    contactName: row.contact_name,
    businessName: row.business_name,
    email: row.email,
    phone: row.phone,
    status: row.status,
    reviewNote: row.review_note,
    reviewedAt: row.reviewed_at,
    createdAt: row.created_at,
    documents: (row.tax_exemption_documents ?? []).map((doc) => ({
      id: doc.id,
      objectKey: doc.object_key,
      contentType: doc.content_type,
      bytes: typeof doc.bytes === "string" ? Number.parseInt(doc.bytes, 10) : doc.bytes,
      originalFilename: doc.original_filename
    }))
  };
}

// Các hàm "own" nhận authUserId đã được getViewer() xác minh và lọc tường minh
// theo id đó. Không tạo thêm Supabase client thứ hai trong cùng request: hai
// client cùng xoay refresh token khiến client sau mất phiên và RLS trả 0 dòng.
// RLS vẫn là lớp chặn cho mọi truy cập trực tiếp bằng khoá anon/authenticated.

/** Hồ sơ khách hàng gắn với tài khoản đang đăng nhập. */
export async function getOwnCustomer(authUserId: string) {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("customers")
    .select("id, first_name, last_name, company_name, email, phone, tax_exempt_status")
    .eq("auth_user_id", authUserId)
    .maybeSingle();
  return data;
}

/** Đơn của chính khách đang đăng nhập, mới nhất trước. */
export async function getOwnApplications(authUserId: string): Promise<TaxExemptionApplication[]> {
  const supabase = createAdminClient();
  const { data: customer } = await supabase
    .from("customers")
    .select("id")
    .eq("auth_user_id", authUserId)
    .maybeSingle();
  if (!customer) return [];

  const { data, error } = await supabase
    .from("tax_exemption_applications")
    .select(SELECT)
    .eq("customer_id", customer.id)
    .order("created_at", { ascending: false });

  if (error) return [];
  return ((data ?? []) as unknown as DbApplication[]).map(mapApplication);
}

/** Danh sách đơn cho admin. Dùng service role để đọc kèm tài liệu ổn định. */
export async function getApplicationsForStaff(): Promise<TaxExemptionApplication[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("tax_exemption_applications")
    .select(SELECT)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Failed to load applications: ${error.message}`);
  return ((data ?? []) as unknown as DbApplication[]).map(mapApplication);
}

export async function getApplicationForStaff(id: string): Promise<TaxExemptionApplication | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("tax_exemption_applications")
    .select(SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return null;
  return mapApplication(data as unknown as DbApplication);
}

/** Số đơn đang chờ + id đơn mới nhất — dùng cho popup thông báo của admin. */
export async function getPendingApplicationSummary() {
  const supabase = createAdminClient();
  const { data, count } = await supabase
    .from("tax_exemption_applications")
    .select("id, business_name, created_at", { count: "exact" })
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1);

  const latest = data?.[0];
  return {
    pendingCount: count ?? 0,
    latestId: latest?.id ?? null,
    latestBusinessName: latest?.business_name ?? null
  };
}

import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

// Tiêu đề mẫu cho hộp thư hỗ trợ. Mẫu MẶC ĐỊNH nằm trong code (luôn có, không xoá
// được), phần nhân viên tự thêm lưu trong app_settings key "email.subject_templates"
// (dùng chung cho cả team — hộp thư support@ là hộp chung).

export const SUBJECT_TEMPLATES_SETTING_KEY = "email.subject_templates";

const DEFAULT_SUBJECT_TEMPLATES = [
  "Về đơn hàng của bạn",
  "Cập nhật vận chuyển đơn hàng",
  "Xác nhận thanh toán",
  "Phản hồi yêu cầu hỗ trợ",
  "Cập nhật tài khoản doanh nghiệp",
  "Thông báo hàng về"
] as const;

const MAX_CUSTOM = 50;
const MAX_LEN = 200;

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim().slice(0, MAX_LEN) : "";
}

/** Gộp mẫu mặc định + mẫu tự thêm, bỏ trùng (không phân biệt hoa/thường). */
function merge(custom: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of [...DEFAULT_SUBJECT_TEMPLATES, ...custom]) {
    const value = clean(item);
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}

async function readCustom(): Promise<string[]> {
  try {
    const { data } = await createAdminClient()
      .from("app_settings")
      .select("value")
      .eq("key", SUBJECT_TEMPLATES_SETTING_KEY)
      .maybeSingle();
    const value = data?.value;
    return Array.isArray(value) ? value.map(clean).filter(Boolean) : [];
  } catch {
    return [];
  }
}

export async function listSubjectTemplates(): Promise<string[]> {
  return merge(await readCustom());
}

/** Thêm một tiêu đề tự tạo vào danh sách dùng chung. Trả về danh sách mới (đã gộp). */
export async function addSubjectTemplate(
  subject: string,
  updatedBy: string | null
): Promise<{ ok: true; templates: string[] } | { ok: false; error: string }> {
  const value = clean(subject);
  if (!value) return { ok: false, error: "Tiêu đề đang trống." };

  const existing = await readCustom();
  const isDefault = DEFAULT_SUBJECT_TEMPLATES.some(
    (t) => t.toLowerCase() === value.toLowerCase()
  );
  const isDup = existing.some((t) => t.toLowerCase() === value.toLowerCase());

  // Mẫu đã có (mặc định hoặc đã lưu) thì không lưu lại, chỉ trả danh sách hiện tại.
  if (isDefault || isDup) return { ok: true, templates: merge(existing) };

  const next = [value, ...existing].slice(0, MAX_CUSTOM);
  const { error } = await createAdminClient().from("app_settings").upsert(
    {
      key: SUBJECT_TEMPLATES_SETTING_KEY,
      value: next,
      is_public: false,
      description: "Tiêu đề email mẫu do nhân viên tự thêm (hộp thư hỗ trợ)",
      updated_by: updatedBy,
      updated_at: new Date().toISOString()
    },
    { onConflict: "key" }
  );
  if (error) return { ok: false, error: error.message };
  return { ok: true, templates: merge(next) };
}

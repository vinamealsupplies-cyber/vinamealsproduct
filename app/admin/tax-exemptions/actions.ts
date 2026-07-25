"use server";

import { revalidatePath } from "next/cache";
import { getViewer } from "@/lib/auth";
import { callerKey, checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createTaxDocumentDownloadUrl } from "@/lib/tax-exemption/storage";
import type { TaxExemptionFormState } from "@/lib/data/tax-exemption-form";

// Quyết định miễn thuế là thao tác nhạy cảm → chỉ manager/admin.
// RLS (tax_exemption_applications_manager_update) là lớp chặn thật; kiểm tra ở
// đây để báo lỗi sớm và để service role không vô tình bỏ qua phân quyền.

async function requireManager() {
  const viewer = await getViewer();
  return viewer?.isManager ? viewer : null;
}

export async function decideTaxExemption(
  _prev: TaxExemptionFormState,
  formData: FormData
): Promise<TaxExemptionFormState> {
  const viewer = await requireManager();
  if (!viewer) return { status: "error", message: "Manager access is required." };

  if (!(await checkRateLimit(await callerKey("tax-decision", viewer.id), RATE_LIMITS.mutation))) {
    return { status: "error", message: "Too many decisions in a short time. Wait a minute." };
  }

  const applicationId = String(formData.get("applicationId") ?? "").trim();
  const decision = String(formData.get("decision") ?? "").trim();
  const note = String(formData.get("reviewNote") ?? "").trim().slice(0, 500);

  if (!applicationId) return { status: "error", message: "Missing application id." };
  if (decision !== "approved" && decision !== "rejected") {
    return { status: "error", message: "Choose approve or reject." };
  }

  const supabase = createAdminClient();
  const { data: application } = await supabase
    .from("tax_exemption_applications")
    .select("id, customer_id, business_name, status")
    .eq("id", applicationId)
    .maybeSingle();

  if (!application) return { status: "error", message: "Application not found." };
  if (application.status !== "pending") {
    return { status: "error", message: "This application was already reviewed." };
  }

  const reviewedAt = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("tax_exemption_applications")
    .update({ status: decision, review_note: note || null, reviewed_by: viewer.id, reviewed_at: reviewedAt })
    .eq("id", applicationId);

  if (updateError) return { status: "error", message: updateError.message };

  // customers là nguồn sự thật cho trạng thái miễn thuế của khách.
  const { error: customerError } = await supabase
    .from("customers")
    .update({
      tax_exempt_status: decision,
      tax_exempt_reason: note || null,
      tax_exempt_verified_by: viewer.id,
      tax_exempt_verified_at: reviewedAt
    })
    .eq("id", application.customer_id);

  if (customerError) return { status: "error", message: customerError.message };

  revalidatePath("/admin/tax-exemptions");
  revalidatePath(`/admin/tax-exemptions/${applicationId}`);
  revalidatePath("/account/tax-exemption");
  // Thẻ trạng thái miễn thuế nằm ở trang tài khoản — thiếu dòng này thì khách
  // vẫn thấy "Not requested" sau khi đã được duyệt.
  revalidatePath("/account");

  return {
    status: "success",
    message: `${decision === "approved" ? "Approved" : "Rejected"} ${application.business_name}.`
  };
}

/**
 * Phát hành link xem tài liệu, sống 2 phút, chỉ cho manager/admin.
 * File không bao giờ được phục vụ công khai.
 */
export async function getDocumentLink(documentId: string) {
  const viewer = await requireManager();
  if (!viewer) return { ok: false as const, message: "Manager access is required." };

  if (!(await checkRateLimit(await callerKey("tax-doc", viewer.id), RATE_LIMITS.upload))) {
    return { ok: false as const, message: "Too many download requests. Wait a minute." };
  }

  const supabase = createAdminClient();
  const { data: document } = await supabase
    .from("tax_exemption_documents")
    .select("object_key, content_type, original_filename")
    .eq("id", documentId)
    .maybeSingle();

  if (!document) return { ok: false as const, message: "Document not found." };

  try {
    const { url, expiresInSeconds } = await createTaxDocumentDownloadUrl({
      key: document.object_key,
      filename: document.original_filename,
      contentType: document.content_type
    });
    return { ok: true as const, url, expiresInSeconds };
  } catch (error) {
    return { ok: false as const, message: error instanceof Error ? error.message : "Link failed." };
  }
}

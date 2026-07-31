"use server";

import { revalidatePath } from "next/cache";
import { getViewer } from "@/lib/auth";
import { isTaxDocumentStorageConfigured } from "@/lib/env";
import { callerKey, checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkUploadedFile, MAX_FILES, ACCEPTED_LABEL } from "@/lib/tax-exemption/file-guard";
import { putTaxDocument } from "@/lib/tax-exemption/storage";
import type { TaxExemptionFormState } from "@/lib/data/tax-exemption-form";

// Khách nộp đơn xin miễn thuế kèm giấy tờ chứng minh.
//
// Thứ tự kiểm tra cố ý đặt "rẻ trước, đắt sau": đăng nhập → rate limit →
// trường bắt buộc → mới đọc và soi từng byte file.

function fail(message: string): TaxExemptionFormState {
  return { status: "error", message };
}

function readField(formData: FormData, name: string, max = 160) {
  return String(formData.get(name) ?? "").trim().slice(0, max);
}

export async function submitTaxExemptionApplication(
  _prev: TaxExemptionFormState,
  formData: FormData
): Promise<TaxExemptionFormState> {
  const viewer = await getViewer();
  if (!viewer) return fail("Sign in to submit a tax exemption application.");

  if (!(await checkRateLimit(await callerKey("tax-exemption", viewer.id), RATE_LIMITS.upload))) {
    return fail("Too many submissions. Wait a minute and try again.");
  }

  if (!isTaxDocumentStorageConfigured()) {
    return fail("Document storage is not configured yet. Contact support.");
  }

  const contactName = readField(formData, "contactName");
  const businessName = readField(formData, "businessName");
  const email = readField(formData, "email");
  const phone = readField(formData, "phone", 40);

  if (!contactName || !businessName || !email || !phone) {
    return fail("Name, business name, email, and phone are all required.");
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return fail("Enter a valid email address.");

  const uploads = formData.getAll("documents").filter((item): item is File => item instanceof File && item.size > 0);
  if (!uploads.length) return fail(`Attach your exemption certificate. Accepted: ${ACCEPTED_LABEL}.`);
  if (uploads.length > MAX_FILES) return fail(`Attach at most ${MAX_FILES} files.`);

  // Soi magic bytes — chặn file đổi đuôi.
  const checked = [];
  for (const upload of uploads) {
    const result = checkUploadedFile({
      name: upload.name,
      size: upload.size,
      buffer: await upload.arrayBuffer()
    });
    if (!result.ok) return fail(result.message);
    checked.push(result.file);
  }

  // Danh tính đã được getViewer() xác minh (JWT hợp lệ), nên tra cứu hồ sơ
  // khách theo đúng viewer.id bằng service role thay vì tạo thêm một Supabase
  // client thứ hai: hai client trong cùng một request có thể cùng xoay refresh
  // token, client sau mất phiên và RLS trả về 0 dòng.
  const admin = createAdminClient();
  const { data: customer } = await admin
    .from("customers")
    .select("id")
    .eq("auth_user_id", viewer.id)
    .maybeSingle();
  if (!customer) return fail("No customer profile is linked to this account yet.");

  const { data: application, error: insertError } = await admin
    .from("tax_exemption_applications")
    .insert({
      customer_id: customer.id,
      contact_name: contactName,
      business_name: businessName,
      email,
      phone
    })
    .select("id")
    .single();

  if (insertError) {
    if (insertError.code === "23505") {
      return fail("You already have an application waiting for review.");
    }
    return fail(insertError.message);
  }

  // Đưa file lên bucket private rồi ghi nhận. Nếu bước này hỏng thì xoá đơn để
  // không để lại đơn rỗng không có giấy tờ.
  try {
    for (const file of checked) {
      const stored = await putTaxDocument(customer.id, file);
      const { error: docError } = await admin.from("tax_exemption_documents").insert({
        application_id: application.id,
        object_key: stored.key,
        content_type: stored.contentType,
        bytes: stored.bytes,
        original_filename: file.originalFilename
      });
      if (docError) throw new Error(docError.message);
    }

    // customers.tax_exempt_status không nằm trong cột khách được phép sửa nên
    // cập nhật bằng service role sau khi đã xác thực quyền sở hữu ở trên.
    await admin.from("customers").update({ tax_exempt_status: "pending" }).eq("id", customer.id);
  } catch (error) {
    await createAdminClient().from("tax_exemption_applications").delete().eq("id", application.id);
    return fail(error instanceof Error ? error.message : "The documents could not be stored.");
  }

  revalidatePath("/account/tax-exemption");
  revalidatePath("/account");
  revalidatePath("/admin/tax-exemptions");

  return {
    status: "success",
    message: "Application submitted. Our team will review your documents and update your account."
  };
}

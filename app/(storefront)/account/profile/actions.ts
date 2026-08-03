"use server";

import { revalidatePath } from "next/cache";
import { getViewer } from "@/lib/auth";
import type { AdminFormState } from "@/lib/data/admin-form";
import { normalizeUsPhone } from "@/lib/data/us-states";
import { callerKey, checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createPublicClient } from "@/lib/supabase/public";

function fail(message: string): AdminFormState {
  return { status: "error", message };
}

/**
 * Đổi mật khẩu: xác minh mật khẩu HIỆN TẠI (client anon, không đụng session),
 * rồi đặt mật khẩu mới qua admin. Bắt buộc biết mật khẩu cũ.
 */
export async function changePasswordAction(
  _prev: AdminFormState,
  formData: FormData
): Promise<AdminFormState> {
  const viewer = await getViewer();
  if (!viewer || viewer.demo) return fail("Đăng nhập bằng tài khoản thật để đổi mật khẩu.");
  if (!viewer.email) return fail("Tài khoản không có email — không xác minh được mật khẩu.");
  if (!(await checkRateLimit(await callerKey("password-change", viewer.id), RATE_LIMITS.mutation))) {
    return fail("Thử quá nhiều lần. Đợi một phút rồi thử lại.");
  }

  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!currentPassword) return fail("Nhập mật khẩu hiện tại.");
  if (newPassword.length < 8) return fail("Mật khẩu mới phải ít nhất 8 ký tự.");
  if (newPassword !== confirmPassword) return fail("Mật khẩu mới nhập lại không khớp.");
  if (newPassword === currentPassword) return fail("Mật khẩu mới phải khác mật khẩu hiện tại.");

  // Xác minh mật khẩu hiện tại (client publishable, persistSession=false → không
  // tạo cookie/session mới cho người dùng).
  const pub = createPublicClient();
  const { error: verifyError } = await pub.auth.signInWithPassword({
    email: viewer.email,
    password: currentPassword
  });
  if (verifyError) return fail("Mật khẩu hiện tại không đúng.");

  const admin = createAdminClient();
  const { error: updateError } = await admin.auth.admin.updateUserById(viewer.id, {
    password: newPassword
  });
  if (updateError) return fail(updateError.message);

  return { status: "success", message: "Đã đổi mật khẩu." };
}

function readField(formData: FormData, name: string, max = 160) {
  return String(formData.get(name) ?? "").trim().slice(0, max);
}

/**
 * Cập nhật profile + hồ sơ customers gắn login.
 * Email / role không đổi ở đây (auth provider / admin).
 */
export async function updateProfileAction(
  _prev: AdminFormState,
  formData: FormData
): Promise<AdminFormState> {
  const viewer = await getViewer();
  if (!viewer || viewer.demo) {
    return fail("Sign in with a real account to edit your profile.");
  }
  if (!(await checkRateLimit(await callerKey("profile-update", viewer.id), RATE_LIMITS.mutation))) {
    return fail("Too many changes. Wait a minute and try again.");
  }

  const fullName = readField(formData, "fullName", 120) || null;
  const companyName = readField(formData, "companyName", 120) || null;
  const phoneRaw = readField(formData, "phone", 40);
  let phone: string | null = null;
  if (phoneRaw) {
    const normalized = normalizeUsPhone(phoneRaw);
    if (!normalized) {
      return fail("Enter a valid 10-digit U.S. phone number, or leave phone blank.");
    }
    phone = normalized;
  }

  const nameParts = fullName ? fullName.split(/\s+/) : [];
  const firstName = nameParts[0] || null;
  const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : null;

  const supabase = createAdminClient();
  const now = new Date().toISOString();

  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      full_name: fullName,
      phone,
      updated_at: now
    })
    .eq("id", viewer.id);

  if (profileError) return fail(profileError.message);

  // Đồng bộ customers (orders hiển thị tên + SĐT từ đây).
  const { data: customer } = await supabase
    .from("customers")
    .select("id")
    .eq("auth_user_id", viewer.id)
    .maybeSingle();

  if (customer?.id) {
    const { error: customerError } = await supabase
      .from("customers")
      .update({
        first_name: firstName,
        last_name: lastName,
        company_name: companyName,
        phone,
        email: viewer.email || null
        // customer_type / wholesale min — chỉ admin gán, không đổi từ profile.
      })
      .eq("id", customer.id);
    if (customerError) return fail(customerError.message);
  } else {
    // Tạo hồ sơ khách retail mặc định (wholesale chỉ admin gán).
    await supabase.from("customers").insert({
      auth_user_id: viewer.id,
      email: viewer.email || null,
      first_name: firstName,
      last_name: lastName,
      company_name: companyName,
      phone,
      customer_type: "retail",
      status: "active"
    });
  }

  revalidatePath("/account");
  revalidatePath("/account/profile");
  revalidatePath("/admin/orders");

  return { status: "success", message: "Profile saved." };
}

/** Xoá (làm trống) một trường: phone | company | name */
export async function clearProfileFieldAction(
  _prev: AdminFormState,
  formData: FormData
): Promise<AdminFormState> {
  const viewer = await getViewer();
  if (!viewer || viewer.demo) {
    return fail("Sign in with a real account to edit your profile.");
  }
  if (!(await checkRateLimit(await callerKey("profile-clear", viewer.id), RATE_LIMITS.mutation))) {
    return fail("Too many changes. Wait a minute and try again.");
  }

  const field = String(formData.get("field") ?? "").trim();
  if (!["phone", "company", "name"].includes(field)) {
    return fail("Unknown field.");
  }

  const supabase = createAdminClient();
  const now = new Date().toISOString();

  if (field === "name") {
    await supabase
      .from("profiles")
      .update({ full_name: null, updated_at: now })
      .eq("id", viewer.id);
    await supabase
      .from("customers")
      .update({ first_name: null, last_name: null })
      .eq("auth_user_id", viewer.id);
  } else if (field === "phone") {
    await supabase.from("profiles").update({ phone: null, updated_at: now }).eq("id", viewer.id);
    await supabase.from("customers").update({ phone: null }).eq("auth_user_id", viewer.id);
  } else if (field === "company") {
    await supabase
      .from("customers")
      .update({ company_name: null })
      .eq("auth_user_id", viewer.id);
  }

  revalidatePath("/account");
  revalidatePath("/account/profile");
  revalidatePath("/admin/orders");

  return {
    status: "success",
    message:
      field === "name"
        ? "Name cleared."
        : field === "phone"
          ? "Phone number removed."
          : "Company name removed."
  };
}

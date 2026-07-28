"use server";

import { revalidatePath } from "next/cache";
import { getViewer } from "@/lib/auth";
import { writeAuditLog } from "@/lib/data/audit-log";
import { callerKey, checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { countCustomerReferences } from "@/lib/data/customers";
import type { AdminFormState } from "@/lib/data/admin-form";

// CRUD khách hàng cho khu admin.
// Ghi bằng service role (bảng customers chỉ cấp vài cột cho `authenticated`),
// nên quyền phải được kiểm tra tường minh ở đây — không có RLS đỡ phía sau.

const CUSTOMER_TYPES = new Set(["retail", "wholesale", "guest"]);
const CUSTOMER_STATUSES = new Set(["active", "inactive", "blocked"]);

function fail(message: string): AdminFormState {
  return { status: "error", message };
}

async function requireStaff() {
  const viewer = await getViewer();
  // Seller cũng tra cứu / cập nhật khách sỉ cho giao dịch hằng ngày.
  return viewer?.canAccessAdmin ? viewer : null;
}

function readForm(formData: FormData) {
  const text = (name: string, max = 160) => String(formData.get(name) ?? "").trim().slice(0, max) || null;
  const customerType = String(formData.get("customerType") ?? "retail");
  const status = String(formData.get("status") ?? "active");
  const minKindRaw = String(formData.get("wholesaleMinKind") ?? "").trim();
  const minKind =
    minKindRaw === "quantity" || minKindRaw === "amount" ? minKindRaw : null;
  const minValueRaw = String(formData.get("wholesaleMinValue") ?? "").trim();
  const minValueParsed = minValueRaw ? Number.parseFloat(minValueRaw) : null;

  return {
    firstName: text("firstName"),
    lastName: text("lastName"),
    companyName: text("companyName"),
    email: text("email"),
    phone: text("phone", 40),
    notes: text("notes", 1000),
    customerType: CUSTOMER_TYPES.has(customerType) ? customerType : "retail",
    status: CUSTOMER_STATUSES.has(status) ? status : "active",
    wholesaleMinKind: minKind as "quantity" | "amount" | null,
    wholesaleMinValue:
      minValueParsed != null && Number.isFinite(minValueParsed) ? minValueParsed : null
  };
}

function validate(input: ReturnType<typeof readForm>) {
  if (!input.firstName && !input.lastName && !input.companyName) {
    return "Enter a name or a company name.";
  }
  if (input.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(input.email)) {
    return "Enter a valid email address.";
  }
  // Ràng buộc customers_wholesale_company_check trong DB cũng chặn, nhưng báo
  // sớm ở đây thì thông báo dễ hiểu hơn lỗi Postgres.
  if (input.customerType === "wholesale" && !input.companyName) {
    return "Wholesale customers need a company name.";
  }
  if (input.customerType === "wholesale") {
    if (!input.wholesaleMinKind) {
      return "Set wholesale minimum as quantity or order amount.";
    }
    if (input.wholesaleMinValue == null || input.wholesaleMinValue <= 0) {
      return "Wholesale minimum must be greater than zero.";
    }
  }
  return null;
}

function wholesaleFields(input: ReturnType<typeof readForm>) {
  if (input.customerType !== "wholesale") {
    return { wholesale_min_kind: null, wholesale_min_value: null };
  }
  return {
    wholesale_min_kind: input.wholesaleMinKind,
    wholesale_min_value: input.wholesaleMinValue
  };
}

function friendlyError(message: string) {
  if (message.includes("customers_email_lower_idx") || message.includes("duplicate key")) {
    return "Another customer already uses that email.";
  }
  if (message.includes("customers_wholesale_company_check")) {
    return "Wholesale customers need a company name.";
  }
  return message;
}

async function guard(scope: string) {
  const viewer = await requireStaff();
  if (!viewer) return { viewer: null, error: fail("Staff access is required.") };
  if (!(await checkRateLimit(await callerKey(scope, viewer.id), RATE_LIMITS.mutation))) {
    return { viewer: null, error: fail("Too many changes in a short time. Wait a minute and try again.") };
  }
  return { viewer, error: null };
}

function revalidate() {
  revalidatePath("/admin/customers");
  revalidatePath("/admin");
}

export async function createCustomerAction(
  _prev: AdminFormState,
  formData: FormData
): Promise<AdminFormState> {
  const { viewer, error: denied } = await guard("admin-customer");
  if (denied) return denied;

  const input = readForm(formData);
  const invalid = validate(input);
  if (invalid) return fail(invalid);

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("customers")
    .insert({
      first_name: input.firstName,
      last_name: input.lastName,
      company_name: input.companyName,
      email: input.email,
      phone: input.phone,
      notes: input.notes,
      customer_type: input.customerType,
      status: input.status,
      ...wholesaleFields(input)
    })
    .select("id")
    .single();

  if (error) return fail(friendlyError(error.message));

  await writeAuditLog({
    actorUserId: viewer!.id,
    action: "customer.create",
    entityType: "customer",
    entityId: data?.id,
    after: input,
    metadata: { actorRole: viewer!.role, actorEmail: viewer!.email }
  });

  revalidate();
  const label = input.companyName ?? [input.firstName, input.lastName].filter(Boolean).join(" ");
  return { status: "success", message: `Added ${label}.` };
}

export async function updateCustomerAction(
  _prev: AdminFormState,
  formData: FormData
): Promise<AdminFormState> {
  const { viewer, error: denied } = await guard("admin-customer");
  if (denied) return denied;

  const id = String(formData.get("id") ?? "").trim();
  if (!id) return fail("Missing customer id.");

  const input = readForm(formData);
  const invalid = validate(input);
  if (invalid) return fail(invalid);

  const supabase = createAdminClient();
  const { data: before } = await supabase
    .from("customers")
    .select("first_name, last_name, company_name, email, phone, notes, customer_type, status")
    .eq("id", id)
    .maybeSingle();

  const { error } = await supabase
    .from("customers")
    .update({
      first_name: input.firstName,
      last_name: input.lastName,
      company_name: input.companyName,
      email: input.email,
      phone: input.phone,
      notes: input.notes,
      customer_type: input.customerType,
      status: input.status,
      ...wholesaleFields(input)
    })
    .eq("id", id);

  if (error) return fail(friendlyError(error.message));

  await writeAuditLog({
    actorUserId: viewer!.id,
    action: "customer.update",
    entityType: "customer",
    entityId: id,
    before,
    after: input,
    metadata: { actorRole: viewer!.role, actorEmail: viewer!.email }
  });

  revalidate();
  const label = input.companyName ?? [input.firstName, input.lastName].filter(Boolean).join(" ");
  return { status: "success", message: `Saved ${label}.` };
}

export async function deleteCustomerAction(
  _prev: AdminFormState,
  formData: FormData
): Promise<AdminFormState> {
  const { viewer, error: denied } = await guard("admin-customer");
  if (denied) return denied;
  // Xoá dữ liệu khách là thao tác không hoàn tác được → giới hạn ở manager.
  if (!viewer?.isManager) return fail("Manager access is required to delete a customer.");

  const id = String(formData.get("id") ?? "").trim();
  if (!id) return fail("Missing customer id.");

  const supabase = createAdminClient();
  const { data: customer } = await supabase
    .from("customers")
    .select("id, company_name, first_name, last_name, auth_user_id")
    .eq("id", id)
    .maybeSingle();

  if (!customer) return fail("Customer not found.");

  // Hồ sơ gắn với tài khoản đăng nhập: xoá đi thì người dùng đó mất hồ sơ khách
  // (không đặt hàng / nộp đơn miễn thuế được nữa) mà tài khoản vẫn tồn tại.
  if (customer.auth_user_id) {
    return fail(
      "This customer is linked to a sign-in account. Set the status to inactive or blocked instead of deleting."
    );
  }

  const { error } = await supabase.from("customers").delete().eq("id", id);

  if (error) {
    // FK `on delete restrict` từ sales_orders/invoices.
    if (error.code === "23503") {
      const refs = await countCustomerReferences(id);
      return fail(
        `Cannot delete: this customer still has ${refs.orders} order(s) and ${refs.invoices} invoice(s). Set the status to inactive instead.`
      );
    }
    return fail(error.message);
  }

  await writeAuditLog({
    actorUserId: viewer.id,
    action: "customer.delete",
    entityType: "customer",
    entityId: id,
    before: customer,
    after: null,
    metadata: { actorRole: viewer.role, actorEmail: viewer.email }
  });

  revalidate();
  const label = customer.company_name ?? [customer.first_name, customer.last_name].filter(Boolean).join(" ");
  return { status: "success", message: `Deleted ${label || "customer"}.` };
}

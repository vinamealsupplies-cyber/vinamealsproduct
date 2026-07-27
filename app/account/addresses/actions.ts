"use server";

import { revalidatePath } from "next/cache";
import { getViewer } from "@/lib/auth";
import type { AddressFormState } from "@/lib/data/address-form";
import { getOwnCustomerId } from "@/lib/data/addresses";
import { normalizeUsPhone, US_STATE_CODES, US_ZIP_PATTERN } from "@/lib/data/us-states";
import { callerKey, checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

function fail(message: string): AddressFormState {
  return { status: "error", message };
}

function readField(formData: FormData, name: string, max = 160) {
  return String(formData.get(name) ?? "").trim().slice(0, max);
}

type ParsedAddress = {
  label: string | null;
  recipientName: string;
  companyName: string | null;
  phone: string;
  line1: string;
  line2: string | null;
  city: string;
  stateRegion: string;
  postalCode: string;
  isDefault: boolean;
};

function parseAddressFields(formData: FormData): ParsedAddress | AddressFormState {
  const label = readField(formData, "label", 60) || null;
  const recipientName = readField(formData, "recipientName", 120);
  const companyName = readField(formData, "companyName", 120) || null;
  const phoneRaw = readField(formData, "phone", 40);
  const line1 = readField(formData, "line1", 160);
  const line2 = readField(formData, "line2", 160) || null;
  const city = readField(formData, "city", 80);
  const stateRegion = readField(formData, "stateRegion", 2).toUpperCase();
  const postalCode = readField(formData, "postalCode", 10);
  const isDefault = formData.get("isDefault") === "on" || formData.get("isDefault") === "true";

  if (!recipientName) return fail("Recipient name is required.");
  const phone = normalizeUsPhone(phoneRaw);
  if (!phone) return fail("Enter a valid 10-digit U.S. phone number.");
  if (!line1) return fail("Street address is required.");
  if (!city) return fail("City is required.");
  if (!US_STATE_CODES.has(stateRegion)) return fail("Select a valid U.S. state.");
  if (!US_ZIP_PATTERN.test(postalCode)) return fail("Enter a valid ZIP code (12345 or 12345-6789).");

  return {
    label,
    recipientName,
    companyName,
    phone,
    line1,
    line2,
    city,
    stateRegion,
    postalCode,
    isDefault
  };
}

function revalidateAddressPaths() {
  revalidatePath("/account");
  revalidatePath("/account/addresses");
  revalidatePath("/cart");
}

/** Gỡ cờ default cũ cùng loại trước khi gán default mới (partial unique index). */
async function clearDefaultShipping(customerId: string, exceptId?: string) {
  const admin = createAdminClient();
  let query = admin
    .from("customer_addresses")
    .update({ is_default: false })
    .eq("customer_id", customerId)
    .eq("address_type", "shipping")
    .eq("is_default", true);
  if (exceptId) query = query.neq("id", exceptId);
  await query;
}

export async function createShippingAddress(
  _prev: AddressFormState,
  formData: FormData
): Promise<AddressFormState> {
  const viewer = await getViewer();
  if (!viewer) return fail("Sign in to save a shipping address.");
  if (viewer.demo) return fail("Connect Supabase to save addresses outside demo mode.");

  if (!(await checkRateLimit(await callerKey("address-create", viewer.id), RATE_LIMITS.mutation))) {
    return fail("Too many changes. Wait a moment and try again.");
  }

  const parsed = parseAddressFields(formData);
  if ("status" in parsed) return parsed;

  const customerId = await getOwnCustomerId(viewer.id);
  if (!customerId) return fail("No customer profile is linked to this account yet.");

  const admin = createAdminClient();

  // Địa chỉ đầu tiên luôn là default.
  const { count } = await admin
    .from("customer_addresses")
    .select("id", { count: "exact", head: true })
    .eq("customer_id", customerId)
    .eq("address_type", "shipping");
  const makeDefault = parsed.isDefault || (count ?? 0) === 0;

  if (makeDefault) await clearDefaultShipping(customerId);

  const { data, error } = await admin
    .from("customer_addresses")
    .insert({
      customer_id: customerId,
      address_type: "shipping",
      label: parsed.label,
      recipient_name: parsed.recipientName,
      company_name: parsed.companyName,
      phone: parsed.phone,
      line1: parsed.line1,
      line2: parsed.line2,
      city: parsed.city,
      state_region: parsed.stateRegion,
      postal_code: parsed.postalCode,
      country_code: "US",
      is_default: makeDefault
    })
    .select("id")
    .single();

  if (error) return fail(error.message);

  revalidateAddressPaths();
  return {
    status: "success",
    message: "Shipping address saved.",
    addressId: data.id
  };
}

export async function updateShippingAddress(
  _prev: AddressFormState,
  formData: FormData
): Promise<AddressFormState> {
  const viewer = await getViewer();
  if (!viewer) return fail("Sign in to update a shipping address.");
  if (viewer.demo) return fail("Connect Supabase to save addresses outside demo mode.");

  if (!(await checkRateLimit(await callerKey("address-update", viewer.id), RATE_LIMITS.mutation))) {
    return fail("Too many changes. Wait a moment and try again.");
  }

  const addressId = readField(formData, "addressId", 40);
  if (!addressId) return fail("Missing address.");

  const parsed = parseAddressFields(formData);
  if ("status" in parsed) return parsed;

  const customerId = await getOwnCustomerId(viewer.id);
  if (!customerId) return fail("No customer profile is linked to this account yet.");

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("customer_addresses")
    .select("id, is_default")
    .eq("id", addressId)
    .eq("customer_id", customerId)
    .eq("address_type", "shipping")
    .maybeSingle();

  if (!existing) return fail("Address not found.");

  const makeDefault = parsed.isDefault || existing.is_default;
  if (makeDefault) await clearDefaultShipping(customerId, addressId);

  const { error } = await admin
    .from("customer_addresses")
    .update({
      label: parsed.label,
      recipient_name: parsed.recipientName,
      company_name: parsed.companyName,
      phone: parsed.phone,
      line1: parsed.line1,
      line2: parsed.line2,
      city: parsed.city,
      state_region: parsed.stateRegion,
      postal_code: parsed.postalCode,
      country_code: "US",
      is_default: makeDefault
    })
    .eq("id", addressId)
    .eq("customer_id", customerId);

  if (error) return fail(error.message);

  revalidateAddressPaths();
  return { status: "success", message: "Shipping address updated.", addressId };
}

export async function deleteShippingAddress(formData: FormData): Promise<void> {
  const viewer = await getViewer();
  if (!viewer || viewer.demo) return;

  if (!(await checkRateLimit(await callerKey("address-delete", viewer.id), RATE_LIMITS.mutation))) {
    return;
  }

  const addressId = readField(formData, "addressId", 40);
  if (!addressId) return;

  const customerId = await getOwnCustomerId(viewer.id);
  if (!customerId) return;

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("customer_addresses")
    .select("id, is_default")
    .eq("id", addressId)
    .eq("customer_id", customerId)
    .eq("address_type", "shipping")
    .maybeSingle();
  if (!existing) return;

  await admin.from("customer_addresses").delete().eq("id", addressId).eq("customer_id", customerId);

  // Nếu xoá default, gán default cho địa chỉ còn lại (mới nhất).
  if (existing.is_default) {
    const { data: next } = await admin
      .from("customer_addresses")
      .select("id")
      .eq("customer_id", customerId)
      .eq("address_type", "shipping")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (next) {
      await admin.from("customer_addresses").update({ is_default: true }).eq("id", next.id);
    }
  }

  revalidateAddressPaths();
}

export async function setDefaultShippingAddress(formData: FormData): Promise<void> {
  const viewer = await getViewer();
  if (!viewer || viewer.demo) return;

  if (!(await checkRateLimit(await callerKey("address-default", viewer.id), RATE_LIMITS.mutation))) {
    return;
  }

  const addressId = readField(formData, "addressId", 40);
  if (!addressId) return;

  const customerId = await getOwnCustomerId(viewer.id);
  if (!customerId) return;

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("customer_addresses")
    .select("id")
    .eq("id", addressId)
    .eq("customer_id", customerId)
    .eq("address_type", "shipping")
    .maybeSingle();
  if (!existing) return;

  await clearDefaultShipping(customerId, addressId);
  await admin
    .from("customer_addresses")
    .update({ is_default: true })
    .eq("id", addressId)
    .eq("customer_id", customerId);

  revalidateAddressPaths();
}

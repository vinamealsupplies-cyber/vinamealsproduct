"use server";

import { revalidatePath } from "next/cache";
import { getViewer } from "@/lib/auth";
import type { AdminFormState } from "@/lib/data/admin-form";
import { saveStoreBusinessProfile } from "@/lib/data/store-settings";
import { callerKey, checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import type { StoreBusinessProfile } from "@/lib/store-profile";
import { normalizeStoreProfile } from "@/lib/store-profile";

function fail(message: string): AdminFormState {
  return { status: "error", message };
}

function read(formData: FormData, name: keyof StoreBusinessProfile, max = 500) {
  return String(formData.get(name) ?? "").trim().slice(0, max);
}

export async function saveBusinessInvoiceProfileAction(
  _prev: AdminFormState,
  formData: FormData
): Promise<AdminFormState> {
  const viewer = await getViewer();
  if (!viewer?.isManager) {
    return fail("Manager access is required to edit business information.");
  }
  if (!(await checkRateLimit(await callerKey("store-settings", viewer.id), RATE_LIMITS.mutation))) {
    return fail("Too many saves. Wait a moment and try again.");
  }

  const profile = normalizeStoreProfile({
    legalName: read(formData, "legalName", 160),
    displayName: read(formData, "displayName", 160),
    addressLine1: read(formData, "addressLine1", 160),
    addressLine2: read(formData, "addressLine2", 160),
    city: read(formData, "city", 80),
    state: read(formData, "state", 40),
    postalCode: read(formData, "postalCode", 20),
    country: read(formData, "country", 40) || "US",
    phone: read(formData, "phone", 40),
    email: read(formData, "email", 160),
    website: read(formData, "website", 200),
    logoPath: read(formData, "logoPath", 200) || "/logo-vinameals.png",
    payableTo: read(formData, "payableTo", 160),
    paymentTermsNote: read(formData, "paymentTermsNote", 1000),
    checkPayableTo: read(formData, "checkPayableTo", 160),
    checkMailingNote: read(formData, "checkMailingNote", 500),
    zelleName: read(formData, "zelleName", 120),
    zelleEmailOrPhone: read(formData, "zelleEmailOrPhone", 120),
    zelleInstructions: read(formData, "zelleInstructions", 500),
    bankName: read(formData, "bankName", 120),
    bankAccountName: read(formData, "bankAccountName", 160),
    bankRoutingNumber: read(formData, "bankRoutingNumber", 40),
    bankAccountNumber: read(formData, "bankAccountNumber", 40),
    bankAccountType: read(formData, "bankAccountType", 40) || "checking",
    bankInstructions: read(formData, "bankInstructions", 500)
  });

  if (profile.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(profile.email)) {
    return fail("Enter a valid support email.");
  }

  const result = await saveStoreBusinessProfile(profile, viewer.id);
  if (!result.ok) return fail(result.error);

  revalidatePath("/admin/settings");
  revalidatePath("/account");
  revalidatePath("/checkout");
  // Invoice pages are per-order; revalidate account tree
  revalidatePath("/account", "layout");

  return {
    status: "success",
    message: "Business information saved. It will appear on customer invoices."
  };
}

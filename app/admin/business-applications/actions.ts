"use server";

import { revalidatePath } from "next/cache";
import {
  buildDecisionEmail,
  sendBusinessApplicationEmail
} from "@/lib/business-application/notifications";
import { createBusinessDocumentDownloadUrl } from "@/lib/business-application/storage";
import type { BusinessApplicationFormState } from "@/lib/business-application/types";
import { getViewer } from "@/lib/auth";
import { writeApplicationAudit } from "@/lib/data/business-applications";
import { callerKey, checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

function siteOrigin() {
  return (
    process.env.NEXT_PUBLIC_SITE_ORIGIN?.replace(/\/$/, "") ||
    "https://vinamealsupplies.com"
  );
}

async function requireManager() {
  const viewer = await getViewer();
  return viewer?.isManager ? viewer : null;
}

async function requireStaff() {
  const viewer = await getViewer();
  return viewer?.isStaff || viewer?.isManager || viewer?.isAdmin ? viewer : null;
}

type DecisionTrack = "wholesale" | "tax_exemption";

export async function decideBusinessTrack(
  _prev: BusinessApplicationFormState,
  formData: FormData
): Promise<BusinessApplicationFormState> {
  const viewer = await requireManager();
  if (!viewer) return { status: "error", message: "Manager access is required." };

  if (!(await checkRateLimit(await callerKey("ba-decision", viewer.id), RATE_LIMITS.mutation))) {
    return { status: "error", message: "Too many decisions. Wait a minute." };
  }

  const applicationId = String(formData.get("applicationId") ?? "").trim();
  const track = String(formData.get("track") ?? "").trim() as DecisionTrack;
  const decision = String(formData.get("decision") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 1000);
  const internalNote = String(formData.get("internalNote") ?? "").trim().slice(0, 2000);
  const shareReason = formData.get("shareReason") === "on" || formData.get("shareReason") === "true";
  const verificationSource = String(formData.get("verificationSource") ?? "").trim().slice(0, 200);

  if (!applicationId) return { status: "error", message: "Missing application id." };
  if (track !== "wholesale" && track !== "tax_exemption") {
    return { status: "error", message: "Invalid review track." };
  }
  if (!["approved", "rejected", "under_review", "more_info_required", "suspended", "revoked"].includes(decision)) {
    return { status: "error", message: "Choose a valid decision." };
  }
  if (
    (decision === "rejected" || decision === "more_info_required") &&
    !reason
  ) {
    return { status: "error", message: "A reason is required for this decision." };
  }
  if (track === "wholesale" && decision === "more_info_required") {
    return { status: "error", message: "Use more information required on the tax track only, or reject wholesale with a reason." };
  }

  const admin = createAdminClient();
  const { data: app } = await admin
    .from("business_applications")
    .select(
      "id, customer_id, applicant_full_name, applicant_email, legal_business_name, application_number, wholesale_requested, tax_exemption_requested, wholesale_status, tax_exemption_status, permit_number, issuing_state, certificate_effective_date, certificate_expiration_date"
    )
    .eq("id", applicationId)
    .maybeSingle();

  if (!app) return { status: "error", message: "Application not found." };

  if (track === "wholesale" && !app.wholesale_requested) {
    return { status: "error", message: "Wholesale was not requested on this application." };
  }
  if (track === "tax_exemption" && !app.tax_exemption_requested) {
    return { status: "error", message: "Tax exemption was not requested on this application." };
  }

  const now = new Date().toISOString();
  const patch: Record<string, unknown> = {};
  let previousStatus: string;
  let newStatus: string = decision;

  if (track === "wholesale") {
    previousStatus = app.wholesale_status;
    if (decision === "approved") newStatus = "approved";
    else if (decision === "rejected") newStatus = "rejected";
    else if (decision === "under_review") newStatus = "under_review";
    else if (decision === "suspended") newStatus = "suspended";
    else return { status: "error", message: "Invalid wholesale decision." };

    patch.wholesale_status = newStatus;
    patch.wholesale_decided_by = viewer.id;
    patch.wholesale_decided_at = now;
    patch.wholesale_decision_reason = reason || null;
  } else {
    previousStatus = app.tax_exemption_status;
    if (decision === "approved") newStatus = "approved";
    else if (decision === "rejected") newStatus = "rejected";
    else if (decision === "under_review") newStatus = "under_review";
    else if (decision === "more_info_required") newStatus = "more_info_required";
    else if (decision === "suspended") newStatus = "suspended";
    else if (decision === "revoked") newStatus = "revoked";
    else return { status: "error", message: "Invalid tax decision." };

    patch.tax_exemption_status = newStatus;
    patch.tax_decided_by = viewer.id;
    patch.tax_decided_at = now;
    patch.tax_decision_reason = reason || null;
    if (verificationSource) {
      patch.tax_verification_source = verificationSource;
      patch.tax_verification_date = now.slice(0, 10);
    }
  }

  if (internalNote) {
    patch.internal_notes = internalNote;
  }
  if (shareReason && reason) {
    patch.customer_visible_message = reason;
  } else if (decision === "more_info_required" && reason) {
    patch.customer_visible_message = reason;
  }

  const { error: updateError } = await admin
    .from("business_applications")
    .update(patch)
    .eq("id", applicationId);
  if (updateError) return { status: "error", message: updateError.message };

  await admin.from("application_reviews").insert({
    application_id: applicationId,
    reviewer_id: viewer.id,
    review_type: track,
    previous_status: previousStatus,
    new_status: newStatus,
    decision,
    reason: reason || null,
    internal_note: internalNote || null,
    verification_source: verificationSource || null
  });

  // Mirror onto customers — independent tracks.
  if (track === "wholesale") {
    if (newStatus === "approved") {
      // Business account: offline discount orders (not SKU wholesale price list).
      await admin
        .from("customers")
        .update({
          customer_type: "wholesale",
          company_name: app.legal_business_name,
          wholesale_status: "approved",
          wholesale_approved_at: now,
          wholesale_approved_by: viewer.id,
          wholesale_application_id: applicationId,
          wholesale_min_kind: null,
          wholesale_min_value: null
        })
        .eq("id", app.customer_id);
    } else if (newStatus === "rejected") {
      await admin
        .from("customers")
        .update({
          wholesale_status: "rejected",
          wholesale_application_id: applicationId
        })
        .eq("id", app.customer_id);
    } else if (newStatus === "suspended") {
      await admin
        .from("customers")
        .update({
          customer_type: "retail",
          wholesale_status: "suspended"
        })
        .eq("id", app.customer_id);
    } else if (newStatus === "under_review") {
      await admin
        .from("customers")
        .update({ wholesale_status: "under_review" })
        .eq("id", app.customer_id);
    }
  } else {
    // tax_exemption → map to customers.tax_exempt_status enum
    // DB enum: not_requested | pending | approved | rejected | expired
    let customerTax: string = "pending";
    if (newStatus === "approved") customerTax = "approved";
    else if (newStatus === "rejected") customerTax = "rejected";
    else if (newStatus === "expired") customerTax = "expired";
    else if (newStatus === "suspended" || newStatus === "revoked") customerTax = "rejected";
    else customerTax = "pending";

    const taxPatch: Record<string, unknown> = {
      tax_exempt_status: customerTax,
      tax_exempt_reason: reason || null,
      tax_exempt_verified_by: viewer.id,
      tax_exempt_verified_at: now
    };
    if (newStatus === "approved") {
      taxPatch.tax_exempt_certificate_number = app.permit_number;
      taxPatch.tax_exempt_issuing_state = app.issuing_state;
      taxPatch.tax_exempt_effective_at = app.certificate_effective_date;
      taxPatch.tax_exempt_expires_at = app.certificate_expiration_date;
    }
    if (newStatus === "suspended" || newStatus === "revoked") {
      // Stop exemption at runtime without deleting history.
      taxPatch.tax_exempt_status = "rejected";
      taxPatch.tax_exempt_reason = `${newStatus}: ${reason || ""}`.trim();
    }
    await admin.from("customers").update(taxPatch).eq("id", app.customer_id);
  }

  await writeApplicationAudit({
    applicationId,
    actorId: viewer.id,
    actorType: "staff",
    action: `${track}_${decision}`,
    oldValue: { status: previousStatus },
    newValue: { status: newStatus, reason }
  });

  await admin.from("application_messages").insert({
    application_id: applicationId,
    sender_type: "staff",
    sender_id: viewer.id,
    subject: `${track === "wholesale" ? "Wholesale" : "Tax exemption"}: ${decision}`,
    message:
      shareReason || decision === "more_info_required"
        ? reason || `Status updated to ${decision}.`
        : `Your ${track === "wholesale" ? "wholesale" : "tax exemption"} status was updated to ${decision}.`
  });

  const email = buildDecisionEmail({
    applicantName: app.applicant_full_name,
    businessName: app.legal_business_name,
    applicationNumber: app.application_number,
    track,
    decision: newStatus,
    reason: shareReason || decision === "more_info_required" ? reason : null,
    statusUrl: `${siteOrigin()}/account/business-application/${applicationId}`
  });
  email.to = app.applicant_email;
  await sendBusinessApplicationEmail(email);

  revalidatePath("/admin/business-applications");
  revalidatePath(`/admin/business-applications/${applicationId}`);
  revalidatePath("/admin/tax-exemptions");
  revalidatePath("/account");
  revalidatePath("/account/business-application");
  revalidatePath(`/account/business-application/${applicationId}`);

  return {
    status: "success",
    message: `${track === "wholesale" ? "Wholesale" : "Tax exemption"} → ${newStatus}.`
  };
}

export async function assignBusinessReviewer(
  _prev: BusinessApplicationFormState,
  formData: FormData
): Promise<BusinessApplicationFormState> {
  const viewer = await requireManager();
  if (!viewer) return { status: "error", message: "Manager access is required." };

  const applicationId = String(formData.get("applicationId") ?? "").trim();
  const reviewerId = String(formData.get("reviewerId") ?? "").trim() || null;
  if (!applicationId) return { status: "error", message: "Missing application." };

  const admin = createAdminClient();
  const { error } = await admin
    .from("business_applications")
    .update({ assigned_reviewer_id: reviewerId })
    .eq("id", applicationId);
  if (error) return { status: "error", message: error.message };

  await writeApplicationAudit({
    applicationId,
    actorId: viewer.id,
    actorType: "staff",
    action: "assign_reviewer",
    newValue: { reviewerId }
  });

  revalidatePath(`/admin/business-applications/${applicationId}`);
  return { status: "success", message: "Reviewer updated." };
}

export async function addBusinessInternalNote(
  _prev: BusinessApplicationFormState,
  formData: FormData
): Promise<BusinessApplicationFormState> {
  const viewer = await requireStaff();
  if (!viewer) return { status: "error", message: "Staff access is required." };

  const applicationId = String(formData.get("applicationId") ?? "").trim();
  const note = String(formData.get("internalNote") ?? "").trim().slice(0, 4000);
  if (!applicationId || !note) return { status: "error", message: "Note is required." };

  const admin = createAdminClient();
  const { data: app } = await admin
    .from("business_applications")
    .select("internal_notes")
    .eq("id", applicationId)
    .maybeSingle();
  if (!app) return { status: "error", message: "Not found." };

  const stamped = `[${new Date().toISOString().slice(0, 16)}] ${viewer.fullName || viewer.email}: ${note}`;
  const merged = app.internal_notes ? `${app.internal_notes}\n${stamped}` : stamped;

  const { error } = await admin
    .from("business_applications")
    .update({ internal_notes: merged })
    .eq("id", applicationId);
  if (error) return { status: "error", message: error.message };

  await writeApplicationAudit({
    applicationId,
    actorId: viewer.id,
    actorType: "staff",
    action: "internal_note",
    newValue: { note: note.slice(0, 200) }
  });

  revalidatePath(`/admin/business-applications/${applicationId}`);
  return { status: "success", message: "Note saved." };
}

export async function getBusinessDocumentLink(documentId: string) {
  const viewer = await requireManager();
  if (!viewer) return { ok: false as const, message: "Manager access is required." };

  if (!(await checkRateLimit(await callerKey("ba-doc", viewer.id), RATE_LIMITS.upload))) {
    return { ok: false as const, message: "Too many download requests." };
  }

  const admin = createAdminClient();
  const { data: document } = await admin
    .from("application_documents")
    .select("storage_path, mime_type, original_filename, application_id")
    .eq("id", documentId)
    .maybeSingle();
  if (!document) return { ok: false as const, message: "Document not found." };

  try {
    const { url, expiresInSeconds } = await createBusinessDocumentDownloadUrl({
      key: document.storage_path,
      filename: document.original_filename,
      contentType: document.mime_type
    });
    await writeApplicationAudit({
      applicationId: document.application_id,
      actorId: viewer.id,
      actorType: "staff",
      action: "document_download",
      newValue: { documentId }
    });
    return { ok: true as const, url, expiresInSeconds };
  } catch (error) {
    return {
      ok: false as const,
      message: error instanceof Error ? error.message : "Link failed."
    };
  }
}

"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import {
  BUSINESS_DOC_ACCEPTED_LABEL,
  MAX_BUSINESS_DOCS,
  TAX_STATUS_LABELS,
  WHOLESALE_STATUS_LABELS
} from "@/lib/business-application/constants";
import {
  checkBusinessUpload,
  type CheckedBusinessFile
} from "@/lib/business-application/file-guard";
import {
  buildSubmissionEmail,
  sendBusinessApplicationEmail
} from "@/lib/business-application/notifications";
import { putBusinessDocument } from "@/lib/business-application/storage";
import {
  initialBusinessApplicationFormState,
  type BusinessApplicationFormState
} from "@/lib/business-application/types";
import { parseBusinessApplicationForm } from "@/lib/business-application/validate";
import { getViewer } from "@/lib/auth";
import { writeApplicationAudit } from "@/lib/data/business-applications";
import { isTaxDocumentStorageConfigured } from "@/lib/env";
import { callerKey, checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

function fail(message: string): BusinessApplicationFormState {
  return { status: "error", message };
}

function siteOrigin() {
  return (
    process.env.NEXT_PUBLIC_SITE_ORIGIN?.replace(/\/$/, "") ||
    "https://vinamealsupplies.com"
  );
}

export async function submitBusinessApplication(
  _prev: BusinessApplicationFormState,
  formData: FormData
): Promise<BusinessApplicationFormState> {
  const viewer = await getViewer();
  if (!viewer) return fail("Sign in to submit a business application.");

  if (!(await checkRateLimit(await callerKey("business-app", viewer.id), RATE_LIMITS.upload))) {
    return fail("Too many submissions. Wait a minute and try again.");
  }

  if (!isTaxDocumentStorageConfigured()) {
    return fail("Document storage is not configured yet. Contact support.");
  }

  const parsed = parseBusinessApplicationForm(formData);
  if ("error" in parsed) return fail(parsed.error);

  const uploads = formData
    .getAll("documents")
    .filter((item): item is File => item instanceof File && item.size > 0);

  if (!uploads.length) {
    return fail(`Please upload at least one supporting document. Accepted: ${BUSINESS_DOC_ACCEPTED_LABEL}.`);
  }
  if (uploads.length > MAX_BUSINESS_DOCS) {
    return fail(`Upload at most ${MAX_BUSINESS_DOCS} files.`);
  }

  const checked: CheckedBusinessFile[] = [];
  for (const upload of uploads) {
    const result = checkBusinessUpload({
      name: upload.name,
      size: upload.size,
      buffer: await upload.arrayBuffer()
    });
    if (!result.ok) return fail(result.message);
    checked.push(result.file);
  }

  // Align document types with file order
  const docTypes = checked.map((_, index) => {
    const meta = parsed.documentMeta.find((d) => d.index === index);
    return meta?.type || formData.get(`documentType_${index}`)?.toString() || "Other supporting document";
  });

  const admin = createAdminClient();
  const { data: customer } = await admin
    .from("customers")
    .select("id, company_name")
    .eq("auth_user_id", viewer.id)
    .maybeSingle();
  if (!customer) return fail("No customer profile is linked to this account yet.");

  const hdrs = await headers();
  const ip =
    hdrs.get("cf-connecting-ip") ||
    hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    null;
  const userAgent = hdrs.get("user-agent")?.slice(0, 500) || null;

  const wholesaleStatus = parsed.wholesaleRequested ? "pending_review" : "not_requested";
  const taxStatus = parsed.taxExemptionRequested ? "pending_review" : "not_requested";
  const signedAtIso = new Date(`${parsed.signedAt}T12:00:00.000Z`).toISOString();

  const { data: application, error: insertError } = await admin
    .from("business_applications")
    .insert({
      customer_id: customer.id,
      auth_user_id: viewer.id,
      applicant_full_name: parsed.applicantFullName,
      applicant_job_title: parsed.applicantJobTitle,
      applicant_email: parsed.applicantEmail,
      applicant_phone: parsed.applicantPhone,
      preferred_contact_method: parsed.preferredContactMethod,
      legal_business_name: parsed.legalBusinessName,
      dba_name: parsed.dbaName,
      entity_type: parsed.entityType,
      business_category: parsed.businessCategory,
      business_description: parsed.businessDescription,
      website_url: parsed.websiteUrl,
      social_media_url: parsed.socialMediaUrl,
      years_in_business: parsed.yearsInBusiness,
      estimated_monthly_volume: parsed.estimatedMonthlyVolume,
      business_street: parsed.businessStreet,
      business_address_line_2: parsed.businessAddressLine2,
      business_city: parsed.businessCity,
      business_state: parsed.businessState,
      business_zip: parsed.businessZip,
      business_country: parsed.businessCountry,
      mailing_same_as_business: parsed.mailingSameAsBusiness,
      mailing_address_json: parsed.mailingAddress,
      shipping_same_as_business: parsed.shippingSameAsBusiness,
      shipping_address_json: parsed.shippingAddress,
      wholesale_requested: parsed.wholesaleRequested,
      tax_exemption_requested: parsed.taxExemptionRequested,
      wholesale_status: wholesaleStatus,
      tax_exemption_status: taxStatus,
      products_interested_json: parsed.productsInterested,
      intended_use: parsed.intendedUse,
      sales_channels_json: parsed.salesChannels,
      expected_first_order_amount: parsed.expectedFirstOrderAmount,
      wholesale_notes: parsed.wholesaleNotes,
      exemption_type: parsed.exemptionType,
      issuing_state: parsed.issuingState,
      permit_number: parsed.permitNumber,
      certificate_effective_date: parsed.certificateEffectiveDate,
      certificate_expiration_date: parsed.certificateExpirationDate,
      certificate_business_name: parsed.certificateBusinessName,
      certificate_same_as_business: parsed.certificateSameAsBusiness,
      certificate_address_json: parsed.certificateAddress,
      resale_product_description: parsed.resaleProductDescription,
      no_permit_reason: parsed.noPermitReason,
      verification_reference: parsed.verificationReference,
      signer_name: parsed.signerName,
      signer_title: parsed.signerTitle,
      electronic_signature: parsed.electronicSignature,
      signed_at: signedAtIso,
      ip_address: ip,
      user_agent: userAgent
    })
    .select("id, application_number, submitted_at, wholesale_status, tax_exemption_status")
    .single();

  if (insertError) {
    if (insertError.code === "23505") {
      return fail(
        "You already have an application open for review. Open it from your account or wait for a decision."
      );
    }
    return fail(insertError.message);
  }

  try {
    for (let i = 0; i < checked.length; i++) {
      const file = checked[i];
      const stored = await putBusinessDocument(customer.id, file);
      const { error: docError } = await admin.from("application_documents").insert({
        application_id: application.id,
        document_type: docTypes[i] ?? "Other supporting document",
        original_filename: file.originalFilename,
        storage_path: stored.key,
        mime_type: stored.contentType,
        file_size: stored.bytes,
        uploaded_by: viewer.id
      });
      if (docError) throw new Error(docError.message);
    }

    // Mirror pending flags on customer (runtime sources of truth stay separate).
    const customerPatch: Record<string, unknown> = {
      company_name: parsed.legalBusinessName
    };
    if (parsed.wholesaleRequested) {
      customerPatch.wholesale_status = "pending_review";
      customerPatch.wholesale_application_id = application.id;
    }
    if (parsed.taxExemptionRequested) {
      customerPatch.tax_exempt_status = "pending";
    }
    await admin.from("customers").update(customerPatch).eq("id", customer.id);

    await writeApplicationAudit({
      applicationId: application.id,
      actorId: viewer.id,
      actorType: "customer",
      action: "application_submitted",
      newValue: {
        wholesale_status: wholesaleStatus,
        tax_exemption_status: taxStatus,
        application_number: application.application_number
      },
      ipAddress: ip
    });

    await admin.from("application_messages").insert({
      application_id: application.id,
      sender_type: "system",
      subject: "Application received",
      message:
        "Your application was received and is pending review. Wholesale and tax exemption are reviewed separately."
    });
  } catch (error) {
    await admin.from("business_applications").delete().eq("id", application.id);
    return fail(error instanceof Error ? error.message : "Documents could not be stored.");
  }

  const statusUrl = `${siteOrigin()}/account/business-application/${application.id}`;
  const email = buildSubmissionEmail({
    applicantName: parsed.applicantFullName,
    businessName: parsed.legalBusinessName,
    applicationNumber: application.application_number,
    submittedAt: application.submitted_at,
    wholesaleRequested: parsed.wholesaleRequested,
    taxRequested: parsed.taxExemptionRequested,
    wholesaleStatus: WHOLESALE_STATUS_LABELS[wholesaleStatus] ?? wholesaleStatus,
    taxStatus: TAX_STATUS_LABELS[taxStatus] ?? taxStatus,
    statusUrl,
    supportEmail: process.env.SUPPORT_EMAIL
  });
  email.to = parsed.applicantEmail;
  await sendBusinessApplicationEmail(email);

  revalidatePath("/account");
  revalidatePath("/account/business-application");
  revalidatePath("/account/tax-exemption");
  revalidatePath("/admin/business-applications");
  revalidatePath("/admin/tax-exemptions");

  return {
    status: "success",
    message: "Application submitted. Our team will review your documents.",
    applicationId: application.id,
    applicationNumber: application.application_number,
    wholesaleStatus: application.wholesale_status,
    taxExemptionStatus: application.tax_exemption_status,
    submittedAt: application.submitted_at
  };
}

/** Customer uploads extra docs when more information is required. */
export async function uploadAdditionalBusinessDocuments(
  _prev: BusinessApplicationFormState,
  formData: FormData
): Promise<BusinessApplicationFormState> {
  const viewer = await getViewer();
  if (!viewer) return fail("Sign in to upload documents.");

  if (!(await checkRateLimit(await callerKey("business-app-docs", viewer.id), RATE_LIMITS.upload))) {
    return fail("Too many uploads. Wait a minute and try again.");
  }

  const applicationId = String(formData.get("applicationId") ?? "").trim();
  if (!applicationId) return fail("Missing application.");

  const admin = createAdminClient();
  const { data: app } = await admin
    .from("business_applications")
    .select("id, customer_id, auth_user_id, tax_exemption_status, wholesale_status")
    .eq("id", applicationId)
    .eq("auth_user_id", viewer.id)
    .maybeSingle();

  if (!app) return fail("Application not found.");

  const open =
    app.tax_exemption_status === "more_info_required" ||
    app.tax_exemption_status === "pending_review" ||
    app.tax_exemption_status === "under_review" ||
    app.wholesale_status === "pending_review" ||
    app.wholesale_status === "under_review";
  if (!open) return fail("This application is not accepting new documents right now.");

  const uploads = formData
    .getAll("documents")
    .filter((item): item is File => item instanceof File && item.size > 0);
  if (!uploads.length) return fail("Choose at least one file to upload.");
  if (uploads.length > MAX_BUSINESS_DOCS) return fail(`Upload at most ${MAX_BUSINESS_DOCS} files.`);

  for (let i = 0; i < uploads.length; i++) {
    const upload = uploads[i];
    const result = checkBusinessUpload({
      name: upload.name,
      size: upload.size,
      buffer: await upload.arrayBuffer()
    });
    if (!result.ok) return fail(result.message);
    const docType =
      String(formData.get(`documentType_${i}`) ?? "").trim() || "Other supporting document";
    const stored = await putBusinessDocument(app.customer_id, result.file);
    const { error } = await admin.from("application_documents").insert({
      application_id: app.id,
      document_type: docType,
      original_filename: result.file.originalFilename,
      storage_path: stored.key,
      mime_type: stored.contentType,
      file_size: stored.bytes,
      uploaded_by: viewer.id
    });
    if (error) return fail(error.message);
  }

  if (app.tax_exemption_status === "more_info_required") {
    await admin
      .from("business_applications")
      .update({ tax_exemption_status: "pending_review" })
      .eq("id", app.id);
  }

  await writeApplicationAudit({
    applicationId: app.id,
    actorId: viewer.id,
    actorType: "customer",
    action: "additional_documents_uploaded",
    newValue: { count: uploads.length }
  });

  revalidatePath(`/account/business-application/${app.id}`);
  revalidatePath("/admin/business-applications");

  return {
    ...initialBusinessApplicationFormState,
    status: "success",
    message: "Documents uploaded. Our team will continue the review."
  };
}

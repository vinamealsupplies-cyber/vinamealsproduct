import "server-only";

import type {
  AddressJson,
  BusinessApplication,
  BusinessApplicationAudit,
  BusinessApplicationDocument,
  BusinessApplicationMessage,
  BusinessApplicationReview,
  TaxAppStatus,
  WholesaleAppStatus
} from "@/lib/business-application/types";
import { createAdminClient } from "@/lib/supabase/admin";

type DbDoc = {
  id: string;
  application_id: string;
  document_type: string;
  original_filename: string | null;
  storage_path: string;
  mime_type: string;
  file_size: number | string;
  uploaded_at: string;
  status: string;
  admin_note: string | null;
};

type DbApp = {
  id: string;
  application_number: string;
  customer_id: string;
  auth_user_id: string;
  applicant_full_name: string;
  applicant_job_title: string;
  applicant_email: string;
  applicant_phone: string;
  preferred_contact_method: string | null;
  legal_business_name: string;
  dba_name: string | null;
  entity_type: string;
  business_category: string;
  business_description: string;
  website_url: string | null;
  social_media_url: string | null;
  years_in_business: number | null;
  estimated_monthly_volume: string | null;
  business_street: string;
  business_address_line_2: string | null;
  business_city: string;
  business_state: string;
  business_zip: string;
  business_country: string;
  mailing_same_as_business: boolean;
  mailing_address_json: AddressJson | null;
  shipping_same_as_business: boolean;
  shipping_address_json: AddressJson | null;
  wholesale_requested: boolean;
  tax_exemption_requested: boolean;
  wholesale_status: WholesaleAppStatus;
  tax_exemption_status: TaxAppStatus;
  products_interested_json: string[] | null;
  intended_use: string | null;
  sales_channels_json: string[] | null;
  expected_first_order_amount: number | string | null;
  wholesale_notes: string | null;
  exemption_type: string | null;
  issuing_state: string | null;
  permit_number: string | null;
  certificate_effective_date: string | null;
  certificate_expiration_date: string | null;
  certificate_business_name: string | null;
  certificate_same_as_business: boolean | null;
  certificate_address_json: AddressJson | null;
  resale_product_description: string | null;
  no_permit_reason: string | null;
  verification_reference: string | null;
  signer_name: string;
  signer_title: string;
  electronic_signature: string;
  signed_at: string;
  submitted_at: string;
  ip_address: string | null;
  user_agent: string | null;
  assigned_reviewer_id: string | null;
  risk_flag: string | null;
  internal_notes: string | null;
  customer_visible_message: string | null;
  wholesale_decided_by: string | null;
  wholesale_decided_at: string | null;
  wholesale_decision_reason: string | null;
  tax_decided_by: string | null;
  tax_decided_at: string | null;
  tax_decision_reason: string | null;
  tax_verification_source: string | null;
  tax_verification_date: string | null;
  created_at: string;
  updated_at: string;
  application_documents?: DbDoc[] | null;
};

const APP_SELECT = `
  id, application_number, customer_id, auth_user_id,
  applicant_full_name, applicant_job_title, applicant_email, applicant_phone, preferred_contact_method,
  legal_business_name, dba_name, entity_type, business_category, business_description,
  website_url, social_media_url, years_in_business, estimated_monthly_volume,
  business_street, business_address_line_2, business_city, business_state, business_zip, business_country,
  mailing_same_as_business, mailing_address_json, shipping_same_as_business, shipping_address_json,
  wholesale_requested, tax_exemption_requested, wholesale_status, tax_exemption_status,
  products_interested_json, intended_use, sales_channels_json, expected_first_order_amount, wholesale_notes,
  exemption_type, issuing_state, permit_number, certificate_effective_date, certificate_expiration_date,
  certificate_business_name, certificate_same_as_business, certificate_address_json,
  resale_product_description, no_permit_reason, verification_reference,
  signer_name, signer_title, electronic_signature, signed_at, submitted_at, ip_address, user_agent,
  assigned_reviewer_id, risk_flag, internal_notes, customer_visible_message,
  wholesale_decided_by, wholesale_decided_at, wholesale_decision_reason,
  tax_decided_by, tax_decided_at, tax_decision_reason, tax_verification_source, tax_verification_date,
  created_at, updated_at,
  application_documents ( id, application_id, document_type, original_filename, storage_path, mime_type, file_size, uploaded_at, status, admin_note )
`;

function mapDoc(row: DbDoc): BusinessApplicationDocument {
  return {
    id: row.id,
    applicationId: row.application_id,
    documentType: row.document_type,
    originalFilename: row.original_filename,
    storagePath: row.storage_path,
    mimeType: row.mime_type,
    fileSize: typeof row.file_size === "string" ? Number.parseInt(row.file_size, 10) : row.file_size,
    uploadedAt: row.uploaded_at,
    status: row.status,
    adminNote: row.admin_note
  };
}

function mapApp(row: DbApp): BusinessApplication {
  return {
    id: row.id,
    applicationNumber: row.application_number,
    customerId: row.customer_id,
    authUserId: row.auth_user_id,
    applicantFullName: row.applicant_full_name,
    applicantJobTitle: row.applicant_job_title,
    applicantEmail: row.applicant_email,
    applicantPhone: row.applicant_phone,
    preferredContactMethod: row.preferred_contact_method,
    legalBusinessName: row.legal_business_name,
    dbaName: row.dba_name,
    entityType: row.entity_type,
    businessCategory: row.business_category,
    businessDescription: row.business_description,
    websiteUrl: row.website_url,
    socialMediaUrl: row.social_media_url,
    yearsInBusiness: row.years_in_business,
    estimatedMonthlyVolume: row.estimated_monthly_volume,
    businessStreet: row.business_street,
    businessAddressLine2: row.business_address_line_2,
    businessCity: row.business_city,
    businessState: row.business_state,
    businessZip: row.business_zip,
    businessCountry: row.business_country,
    mailingSameAsBusiness: row.mailing_same_as_business,
    mailingAddress: row.mailing_address_json,
    shippingSameAsBusiness: row.shipping_same_as_business,
    shippingAddress: row.shipping_address_json,
    wholesaleRequested: row.wholesale_requested,
    taxExemptionRequested: row.tax_exemption_requested,
    wholesaleStatus: row.wholesale_status,
    taxExemptionStatus: row.tax_exemption_status,
    productsInterested: row.products_interested_json ?? [],
    intendedUse: row.intended_use,
    salesChannels: row.sales_channels_json ?? [],
    expectedFirstOrderAmount:
      row.expected_first_order_amount == null
        ? null
        : typeof row.expected_first_order_amount === "string"
          ? Number.parseFloat(row.expected_first_order_amount)
          : row.expected_first_order_amount,
    wholesaleNotes: row.wholesale_notes,
    exemptionType: row.exemption_type,
    issuingState: row.issuing_state,
    permitNumber: row.permit_number,
    certificateEffectiveDate: row.certificate_effective_date,
    certificateExpirationDate: row.certificate_expiration_date,
    certificateBusinessName: row.certificate_business_name,
    certificateSameAsBusiness: row.certificate_same_as_business,
    certificateAddress: row.certificate_address_json,
    resaleProductDescription: row.resale_product_description,
    noPermitReason: row.no_permit_reason,
    verificationReference: row.verification_reference,
    signerName: row.signer_name,
    signerTitle: row.signer_title,
    electronicSignature: row.electronic_signature,
    signedAt: row.signed_at,
    submittedAt: row.submitted_at,
    ipAddress: row.ip_address,
    userAgent: row.user_agent,
    assignedReviewerId: row.assigned_reviewer_id,
    riskFlag: row.risk_flag,
    internalNotes: row.internal_notes,
    customerVisibleMessage: row.customer_visible_message,
    wholesaleDecidedBy: row.wholesale_decided_by,
    wholesaleDecidedAt: row.wholesale_decided_at,
    wholesaleDecisionReason: row.wholesale_decision_reason,
    taxDecidedBy: row.tax_decided_by,
    taxDecidedAt: row.tax_decided_at,
    taxDecisionReason: row.tax_decision_reason,
    taxVerificationSource: row.tax_verification_source,
    taxVerificationDate: row.tax_verification_date,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    documents: (row.application_documents ?? []).map(mapDoc)
  };
}

export async function getOwnCustomerForBusinessApp(authUserId: string) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("customers")
    .select(
      "id, first_name, last_name, company_name, email, phone, tax_exempt_status, customer_type, wholesale_status"
    )
    .eq("auth_user_id", authUserId)
    .maybeSingle();
  return data;
}

export async function listOwnBusinessApplications(
  authUserId: string
): Promise<BusinessApplication[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("business_applications")
    .select(APP_SELECT)
    .eq("auth_user_id", authUserId)
    .order("submitted_at", { ascending: false });
  if (error) return [];
  return ((data ?? []) as unknown as DbApp[]).map(mapApp);
}

export async function getOwnBusinessApplication(
  authUserId: string,
  id: string
): Promise<BusinessApplication | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("business_applications")
    .select(APP_SELECT)
    .eq("auth_user_id", authUserId)
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  return mapApp(data as unknown as DbApp);
}

export async function listBusinessApplicationsForStaff(filters?: {
  wholesaleStatus?: string;
  taxStatus?: string;
  q?: string;
}): Promise<BusinessApplication[]> {
  const admin = createAdminClient();
  let query = admin
    .from("business_applications")
    .select(APP_SELECT)
    .order("submitted_at", { ascending: false })
    .limit(200);

  if (filters?.wholesaleStatus && filters.wholesaleStatus !== "all") {
    query = query.eq("wholesale_status", filters.wholesaleStatus);
  }
  if (filters?.taxStatus && filters.taxStatus !== "all") {
    query = query.eq("tax_exemption_status", filters.taxStatus);
  }
  if (filters?.q?.trim()) {
    const q = filters.q.trim();
    query = query.or(
      `application_number.ilike.%${q}%,legal_business_name.ilike.%${q}%,dba_name.ilike.%${q}%,applicant_full_name.ilike.%${q}%,applicant_email.ilike.%${q}%,applicant_phone.ilike.%${q}%,permit_number.ilike.%${q}%`
    );
  }

  const { data, error } = await query;
  if (error) throw new Error(`Failed to load applications: ${error.message}`);
  return ((data ?? []) as unknown as DbApp[]).map(mapApp);
}

export async function getBusinessApplicationForStaff(
  id: string
): Promise<BusinessApplication | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("business_applications")
    .select(APP_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  const app = mapApp(data as unknown as DbApp);

  const [reviews, messages, audits] = await Promise.all([
    admin
      .from("application_reviews")
      .select(
        "id, application_id, reviewer_id, review_type, previous_status, new_status, decision, reason, internal_note, verification_source, created_at"
      )
      .eq("application_id", id)
      .order("created_at", { ascending: false }),
    admin
      .from("application_messages")
      .select("id, application_id, sender_type, sender_id, subject, message, sent_at, read_at")
      .eq("application_id", id)
      .order("sent_at", { ascending: false }),
    admin
      .from("application_audit_logs")
      .select(
        "id, application_id, actor_id, actor_type, action, old_value_json, new_value_json, ip_address, created_at"
      )
      .eq("application_id", id)
      .order("created_at", { ascending: false })
      .limit(100)
  ]);

  app.reviews = (reviews.data ?? []).map(
    (r): BusinessApplicationReview => ({
      id: r.id,
      applicationId: r.application_id,
      reviewerId: r.reviewer_id,
      reviewType: r.review_type,
      previousStatus: r.previous_status,
      newStatus: r.new_status,
      decision: r.decision,
      reason: r.reason,
      internalNote: r.internal_note,
      verificationSource: r.verification_source,
      createdAt: r.created_at
    })
  );
  app.messages = (messages.data ?? []).map(
    (m): BusinessApplicationMessage => ({
      id: m.id,
      applicationId: m.application_id,
      senderType: m.sender_type,
      senderId: m.sender_id,
      subject: m.subject,
      message: m.message,
      sentAt: m.sent_at,
      readAt: m.read_at
    })
  );
  app.auditLogs = (audits.data ?? []).map(
    (a): BusinessApplicationAudit => ({
      id: a.id,
      applicationId: a.application_id,
      actorId: a.actor_id,
      actorType: a.actor_type,
      action: a.action,
      oldValueJson: a.old_value_json,
      newValueJson: a.new_value_json,
      ipAddress: a.ip_address,
      createdAt: a.created_at
    })
  );

  return app;
}

export async function getPendingBusinessApplicationSummary() {
  const admin = createAdminClient();
  const { data, count } = await admin
    .from("business_applications")
    .select("id, legal_business_name, submitted_at", { count: "exact" })
    .or(
      "wholesale_status.eq.pending_review,wholesale_status.eq.under_review,tax_exemption_status.eq.pending_review,tax_exemption_status.eq.under_review,tax_exemption_status.eq.more_info_required"
    )
    .order("submitted_at", { ascending: false })
    .limit(1);

  const latest = data?.[0];
  return {
    pendingCount: count ?? 0,
    latestId: latest?.id ?? null,
    latestBusinessName: latest?.legal_business_name ?? null
  };
}

export async function writeApplicationAudit(input: {
  applicationId: string;
  actorId: string | null;
  actorType: "customer" | "staff" | "system";
  action: string;
  oldValue?: unknown;
  newValue?: unknown;
  ipAddress?: string | null;
}) {
  const admin = createAdminClient();
  await admin.from("application_audit_logs").insert({
    application_id: input.applicationId,
    actor_id: input.actorId,
    actor_type: input.actorType,
    action: input.action,
    old_value_json: input.oldValue ?? null,
    new_value_json: input.newValue ?? null,
    ip_address: input.ipAddress ?? null
  });
}

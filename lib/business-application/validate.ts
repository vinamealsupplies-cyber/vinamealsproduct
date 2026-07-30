import {
  BUSINESS_CATEGORIES,
  DOCUMENT_TYPES,
  ENTITY_TYPES,
  EXEMPTION_TYPES,
  INTENDED_USES,
  JOB_TITLES,
  MONTHLY_VOLUMES
} from "@/lib/business-application/constants";
import type { AddressJson, ApplicationTypeChoice } from "@/lib/business-application/types";
import { normalizeUsPhone, US_STATE_CODES, US_ZIP_PATTERN } from "@/lib/data/us-states";

export type ParsedBusinessApplication = {
  applicationType: ApplicationTypeChoice;
  wholesaleRequested: boolean;
  taxExemptionRequested: boolean;
  applicantFullName: string;
  applicantJobTitle: string;
  applicantEmail: string;
  applicantPhone: string;
  preferredContactMethod: string | null;
  legalBusinessName: string;
  dbaName: string | null;
  entityType: string;
  businessCategory: string;
  businessDescription: string;
  websiteUrl: string | null;
  socialMediaUrl: string | null;
  yearsInBusiness: number | null;
  estimatedMonthlyVolume: string | null;
  businessStreet: string;
  businessAddressLine2: string | null;
  businessCity: string;
  businessState: string;
  businessZip: string;
  businessCountry: string;
  mailingSameAsBusiness: boolean;
  mailingAddress: AddressJson | null;
  shippingSameAsBusiness: boolean;
  shippingAddress: AddressJson | null;
  productsInterested: string[];
  intendedUse: string | null;
  salesChannels: string[];
  expectedFirstOrderAmount: number | null;
  wholesaleNotes: string | null;
  exemptionType: string | null;
  issuingState: string | null;
  permitNumber: string | null;
  certificateEffectiveDate: string | null;
  certificateExpirationDate: string | null;
  certificateBusinessName: string | null;
  certificateSameAsBusiness: boolean;
  certificateAddress: AddressJson | null;
  resaleProductDescription: string | null;
  noPermitReason: string | null;
  verificationReference: string | null;
  signerName: string;
  signerTitle: string;
  electronicSignature: string;
  signedAt: string;
  certTrue: boolean;
  certAuthorized: boolean;
  certSeparate: boolean;
  certEligibleUse: boolean;
  certVerify: boolean;
  certResale: boolean;
  documentMeta: { type: string; index: number }[];
};

function field(formData: FormData, name: string, max = 500) {
  return String(formData.get(name) ?? "").trim().slice(0, max);
}

function bool(formData: FormData, name: string) {
  const v = formData.get(name);
  return v === "on" || v === "true" || v === "1";
}

function multi(formData: FormData, name: string) {
  return formData
    .getAll(name)
    .map((v) => String(v).trim())
    .filter(Boolean)
    .slice(0, 40);
}

function optionalUrl(raw: string): string | null | { error: string } {
  if (!raw) return null;
  let url = raw;
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return { error: "Please enter a valid URL." };
    }
    return parsed.toString().slice(0, 400);
  } catch {
    return { error: "Please enter a valid URL." };
  }
}

function parseAddress(
  formData: FormData,
  prefix: string,
  required: boolean
): AddressJson | null | { error: string } {
  const street = field(formData, `${prefix}Street`, 160);
  const line2 = field(formData, `${prefix}Line2`, 160) || null;
  const city = field(formData, `${prefix}City`, 80);
  const state = field(formData, `${prefix}State`, 2).toUpperCase();
  const zip = field(formData, `${prefix}Zip`, 10);
  const country = field(formData, `${prefix}Country`, 2).toUpperCase() || "US";

  if (!required && !street && !city && !zip) return null;
  if (!street) return { error: `${prefix} street address is required.` };
  if (!city) return { error: `${prefix} city is required.` };
  if (!US_STATE_CODES.has(state) && country === "US") {
    return { error: `${prefix} state is required.` };
  }
  if (country === "US" && !US_ZIP_PATTERN.test(zip)) {
    return { error: `Please enter a valid ZIP code for ${prefix.toLowerCase()} address.` };
  }
  return { street, line2, city, state, zip, country: country || "US" };
}

export function parseBusinessApplicationForm(
  formData: FormData
): ParsedBusinessApplication | { error: string } {
  const applicationTypeRaw = field(formData, "applicationType", 20) as ApplicationTypeChoice | "";
  let wholesaleRequested = false;
  let taxExemptionRequested = false;

  if (applicationTypeRaw === "wholesale") {
    wholesaleRequested = true;
  } else if (applicationTypeRaw === "tax") {
    taxExemptionRequested = true;
  } else if (applicationTypeRaw === "both") {
    wholesaleRequested = true;
    taxExemptionRequested = true;
  } else {
    // Fallback: independent checkboxes
    wholesaleRequested = bool(formData, "wholesaleRequested");
    taxExemptionRequested = bool(formData, "taxExemptionRequested");
  }

  if (!wholesaleRequested && !taxExemptionRequested) {
    return { error: "Select wholesale pricing, resale tax exemption, or both." };
  }

  const applicantFullName = field(formData, "applicantFullName", 120);
  if (!applicantFullName) return { error: "Full legal name is required." };

  let applicantJobTitle = field(formData, "applicantJobTitle", 80);
  if (applicantJobTitle === "Other") {
    applicantJobTitle = field(formData, "applicantJobTitleOther", 80) || "Other";
  }
  if (!applicantJobTitle) return { error: "Job title is required." };
  if (!(JOB_TITLES as readonly string[]).includes(applicantJobTitle) && applicantJobTitle.length < 2) {
    return { error: "Job title is required." };
  }

  const applicantEmail = field(formData, "applicantEmail", 160).toLowerCase();
  if (!applicantEmail) return { error: "Email address is required." };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(applicantEmail)) {
    return { error: "Please enter a valid email address." };
  }

  const phoneRaw = field(formData, "applicantPhone", 40);
  const applicantPhone = normalizeUsPhone(phoneRaw);
  if (!applicantPhone) return { error: "Please enter a valid phone number." };

  const preferredContactMethod = field(formData, "preferredContactMethod", 20) || null;

  const legalBusinessName = field(formData, "legalBusinessName", 160);
  if (!legalBusinessName) return { error: "Legal business name is required." };

  const dbaName = field(formData, "dbaName", 160) || null;
  const entityType = field(formData, "entityType", 80);
  if (!entityType || !(ENTITY_TYPES as readonly string[]).includes(entityType)) {
    return { error: "Business entity type is required." };
  }

  const businessCategory = field(formData, "businessCategory", 80);
  if (!businessCategory || !(BUSINESS_CATEGORIES as readonly string[]).includes(businessCategory)) {
    return { error: "Business category is required." };
  }

  const businessDescription = field(formData, "businessDescription", 2000);
  if (!businessDescription || businessDescription.length < 10) {
    return { error: "Business description is required (at least a short description)." };
  }

  const websiteUrlRaw = optionalUrl(field(formData, "websiteUrl", 400));
  if (websiteUrlRaw && typeof websiteUrlRaw === "object" && "error" in websiteUrlRaw) {
    return websiteUrlRaw;
  }
  const socialRaw = optionalUrl(field(formData, "socialMediaUrl", 400));
  if (socialRaw && typeof socialRaw === "object" && "error" in socialRaw) return socialRaw;

  const yearsRaw = field(formData, "yearsInBusiness", 10);
  let yearsInBusiness: number | null = null;
  if (yearsRaw) {
    const n = Number.parseInt(yearsRaw, 10);
    if (!Number.isFinite(n) || n < 0) return { error: "Years in business cannot be negative." };
    yearsInBusiness = n;
  }

  const estimatedMonthlyVolume = field(formData, "estimatedMonthlyVolume", 40) || null;
  if (
    estimatedMonthlyVolume &&
    !(MONTHLY_VOLUMES as readonly string[]).includes(estimatedMonthlyVolume)
  ) {
    return { error: "Select a valid monthly purchasing volume." };
  }

  const businessStreet = field(formData, "businessStreet", 160);
  const businessAddressLine2 = field(formData, "businessAddressLine2", 160) || null;
  const businessCity = field(formData, "businessCity", 80);
  const businessState = field(formData, "businessState", 2).toUpperCase();
  const businessZip = field(formData, "businessZip", 10);
  const businessCountry = field(formData, "businessCountry", 2).toUpperCase() || "US";

  if (!businessStreet) return { error: "Business address is required." };
  if (!businessCity) return { error: "City is required." };
  if (!US_STATE_CODES.has(businessState)) return { error: "Select a valid U.S. state." };
  if (!US_ZIP_PATTERN.test(businessZip)) {
    return { error: "Please enter a valid ZIP code (12345 or 12345-6789)." };
  }

  // Checkboxes: hidden input value="false" + checkbox value="true" → last wins in FormData.getAll;
  // we read explicit string fields set by the form controller.
  const mailingSame = field(formData, "mailingSameAsBusiness", 10) !== "false";
  const shippingSame = field(formData, "shippingSameAsBusiness", 10) !== "false";

  let mailingAddress: AddressJson | null = null;
  if (!mailingSame) {
    const parsed = parseAddress(formData, "mailing", true);
    if (parsed && "error" in parsed) return parsed;
    mailingAddress = parsed;
  }

  let shippingAddress: AddressJson | null = null;
  if (!shippingSame) {
    const parsed = parseAddress(formData, "shipping", true);
    if (parsed && "error" in parsed) return parsed;
    shippingAddress = parsed;
  }

  const productsInterested = multi(formData, "productsInterested");
  let intendedUse: string | null = field(formData, "intendedUse", 80) || null;
  const salesChannels = multi(formData, "salesChannels");
  const wholesaleNotes = field(formData, "wholesaleNotes", 2000) || null;

  let expectedFirstOrderAmount: number | null = null;
  const amountRaw = field(formData, "expectedFirstOrderAmount", 20);
  if (amountRaw) {
    const n = Number.parseFloat(amountRaw.replace(/[$,]/g, ""));
    if (!Number.isFinite(n) || n < 0) {
      return { error: "Expected first order amount must be a non-negative number." };
    }
    expectedFirstOrderAmount = Math.round(n * 100) / 100;
  }

  if (wholesaleRequested) {
    if (!productsInterested.length) {
      return { error: "Select at least one product category you plan to purchase." };
    }
    if (!intendedUse || !(INTENDED_USES as readonly string[]).includes(intendedUse)) {
      return { error: "Intended use is required for wholesale applications." };
    }
  } else {
    intendedUse = null;
  }

  let exemptionType: string | null = field(formData, "exemptionType", 80) || null;
  let issuingState: string | null = field(formData, "issuingState", 2).toUpperCase() || null;
  let permitNumber: string | null = field(formData, "permitNumber", 80) || null;
  let certificateEffectiveDate: string | null =
    field(formData, "certificateEffectiveDate", 20) || null;
  let certificateExpirationDate: string | null =
    field(formData, "certificateExpirationDate", 20) || null;
  let certificateBusinessName: string | null =
    field(formData, "certificateBusinessName", 160) || null;
  const certificateSameAsBusiness = bool(formData, "certificateSameAsBusiness");
  let certificateAddress: AddressJson | null = null;
  let resaleProductDescription: string | null =
    field(formData, "resaleProductDescription", 2000) || null;
  let noPermitReason: string | null = field(formData, "noPermitReason", 2000) || null;
  let verificationReference: string | null =
    field(formData, "verificationReference", 400) || null;

  if (taxExemptionRequested) {
    if (!exemptionType || !(EXEMPTION_TYPES as readonly string[]).includes(exemptionType)) {
      return { error: "Exemption type is required." };
    }
    if (!issuingState || !US_STATE_CODES.has(issuingState)) {
      return { error: "Issuing state is required." };
    }
    const needsPermit = !["Nonprofit exemption", "Government exemption", "Other"].includes(
      exemptionType
    );
    if (needsPermit && !permitNumber) {
      return { error: "Permit or certificate number is required." };
    }
    if (!needsPermit && !permitNumber && !noPermitReason) {
      return {
        error: "Explain why no seller’s permit number is required, or provide a certificate number."
      };
    }
    if (!certificateBusinessName) {
      return { error: "Name shown on certificate is required." };
    }
    if (certificateSameAsBusiness) {
      certificateAddress = {
        street: businessStreet,
        line2: businessAddressLine2,
        city: businessCity,
        state: businessState,
        zip: businessZip,
        country: businessCountry
      };
    } else {
      const parsed = parseAddress(formData, "certificate", true);
      if (parsed && "error" in parsed) return parsed;
      certificateAddress = parsed;
    }
    if (!resaleProductDescription) {
      return { error: "Please describe the products being purchased for resale." };
    }
    if (certificateEffectiveDate && !/^\d{4}-\d{2}-\d{2}$/.test(certificateEffectiveDate)) {
      return { error: "Certificate effective date is invalid." };
    }
    if (certificateExpirationDate && !/^\d{4}-\d{2}-\d{2}$/.test(certificateExpirationDate)) {
      return { error: "Certificate expiration date is invalid." };
    }
    if (
      certificateEffectiveDate &&
      certificateExpirationDate &&
      certificateExpirationDate < certificateEffectiveDate
    ) {
      return { error: "The expiration date cannot be earlier than the effective date." };
    }
  } else {
    exemptionType = null;
    issuingState = null;
    permitNumber = null;
    certificateEffectiveDate = null;
    certificateExpirationDate = null;
    certificateBusinessName = null;
    certificateAddress = null;
    resaleProductDescription = null;
    noPermitReason = null;
    verificationReference = null;
  }

  const certTrue = bool(formData, "certTrue");
  const certAuthorized = bool(formData, "certAuthorized");
  const certSeparate = bool(formData, "certSeparate");
  const certEligibleUse = bool(formData, "certEligibleUse");
  const certVerify = bool(formData, "certVerify");
  const certResale = bool(formData, "certResale");

  if (!certTrue || !certAuthorized || !certSeparate || !certEligibleUse || !certVerify) {
    return { error: "Please accept all required certifications." };
  }
  if (taxExemptionRequested && !certResale) {
    return {
      error: "Please certify that eligible products are intended for resale or another valid exemption."
    };
  }

  const signerName = field(formData, "signerName", 120);
  const signerTitle = field(formData, "signerTitle", 80);
  const electronicSignature = field(formData, "electronicSignature", 120);
  let signedAt = field(formData, "signedAt", 20);
  if (!signerName) return { error: "Authorized signer full name is required." };
  if (!signerTitle) return { error: "Authorized signer title is required." };
  if (!electronicSignature) return { error: "Electronic signature is required." };
  if (electronicSignature.toLowerCase() !== signerName.toLowerCase()) {
    return {
      error: "Electronic signature must match the authorized signer’s full name."
    };
  }
  if (!signedAt || !/^\d{4}-\d{2}-\d{2}$/.test(signedAt)) {
    signedAt = new Date().toISOString().slice(0, 10);
  }
  const today = new Date().toISOString().slice(0, 10);
  if (signedAt > today) return { error: "Date signed cannot be in the future." };

  // Document type metadata: documentType_0, documentType_1, ... aligned with files order
  const documentMeta: { type: string; index: number }[] = [];
  for (let i = 0; i < 5; i++) {
    const t = field(formData, `documentType_${i}`, 80);
    if (t) {
      if (!(DOCUMENT_TYPES as readonly string[]).includes(t)) {
        return { error: "Select a valid document type for each file." };
      }
      documentMeta.push({ type: t, index: i });
    }
  }

  const applicationType: ApplicationTypeChoice =
    wholesaleRequested && taxExemptionRequested
      ? "both"
      : wholesaleRequested
        ? "wholesale"
        : "tax";

  return {
    applicationType,
    wholesaleRequested,
    taxExemptionRequested,
    applicantFullName,
    applicantJobTitle,
    applicantEmail,
    applicantPhone,
    preferredContactMethod,
    legalBusinessName,
    dbaName,
    entityType,
    businessCategory,
    businessDescription,
    websiteUrl: websiteUrlRaw as string | null,
    socialMediaUrl: socialRaw as string | null,
    yearsInBusiness,
    estimatedMonthlyVolume,
    businessStreet,
    businessAddressLine2,
    businessCity,
    businessState,
    businessZip,
    businessCountry,
    mailingSameAsBusiness: mailingSame,
    mailingAddress,
    shippingSameAsBusiness: shippingSame,
    shippingAddress,
    productsInterested: wholesaleRequested ? productsInterested : [],
    intendedUse,
    salesChannels: wholesaleRequested ? salesChannels : [],
    expectedFirstOrderAmount: wholesaleRequested ? expectedFirstOrderAmount : null,
    wholesaleNotes: wholesaleRequested ? wholesaleNotes : null,
    exemptionType,
    issuingState,
    permitNumber,
    certificateEffectiveDate,
    certificateExpirationDate,
    certificateBusinessName,
    certificateSameAsBusiness: taxExemptionRequested ? certificateSameAsBusiness : false,
    certificateAddress,
    resaleProductDescription,
    noPermitReason,
    verificationReference,
    signerName,
    signerTitle,
    electronicSignature,
    signedAt,
    certTrue,
    certAuthorized,
    certSeparate,
    certEligibleUse,
    certVerify,
    certResale,
    documentMeta
  };
}

/** Mask permit for list views: ******1234 */
export function maskPermitNumber(permit: string | null | undefined) {
  if (!permit) return "—";
  const clean = permit.replace(/\s+/g, "");
  if (clean.length <= 4) return "****";
  return `${"*".repeat(Math.min(6, clean.length - 4))}${clean.slice(-4)}`;
}

import type {
  BUSINESS_CATEGORIES,
  DOCUMENT_TYPES,
  ENTITY_TYPES,
  EXEMPTION_TYPES,
  INTENDED_USES,
  JOB_TITLES,
  MONTHLY_VOLUMES,
  SALES_CHANNELS
} from "@/lib/business-application/constants";

export type WholesaleAppStatus =
  | "not_requested"
  | "pending_review"
  | "under_review"
  | "approved"
  | "rejected"
  | "suspended";

export type TaxAppStatus =
  | "not_requested"
  | "pending_review"
  | "under_review"
  | "more_info_required"
  | "approved"
  | "rejected"
  | "expired"
  | "suspended"
  | "revoked";

export type ApplicationTypeChoice = "wholesale" | "tax" | "both";

export type AddressJson = {
  street: string;
  line2?: string | null;
  city: string;
  state: string;
  zip: string;
  country: string;
};

export type BusinessApplicationDocument = {
  id: string;
  applicationId: string;
  documentType: string;
  originalFilename: string | null;
  storagePath: string;
  mimeType: string;
  fileSize: number;
  uploadedAt: string;
  status: string;
  adminNote: string | null;
};

export type BusinessApplicationReview = {
  id: string;
  applicationId: string;
  reviewerId: string | null;
  reviewType: string;
  previousStatus: string | null;
  newStatus: string | null;
  decision: string | null;
  reason: string | null;
  internalNote: string | null;
  verificationSource: string | null;
  createdAt: string;
};

export type BusinessApplicationMessage = {
  id: string;
  applicationId: string;
  senderType: "customer" | "staff" | "system";
  senderId: string | null;
  subject: string | null;
  message: string;
  sentAt: string;
  readAt: string | null;
};

export type BusinessApplicationAudit = {
  id: string;
  applicationId: string;
  actorId: string | null;
  actorType: string;
  action: string;
  oldValueJson: unknown;
  newValueJson: unknown;
  ipAddress: string | null;
  createdAt: string;
};

export type BusinessApplication = {
  id: string;
  applicationNumber: string;
  customerId: string;
  authUserId: string;
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
  wholesaleRequested: boolean;
  taxExemptionRequested: boolean;
  wholesaleStatus: WholesaleAppStatus;
  taxExemptionStatus: TaxAppStatus;
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
  certificateSameAsBusiness: boolean | null;
  certificateAddress: AddressJson | null;
  resaleProductDescription: string | null;
  noPermitReason: string | null;
  verificationReference: string | null;
  signerName: string;
  signerTitle: string;
  electronicSignature: string;
  signedAt: string;
  submittedAt: string;
  ipAddress: string | null;
  userAgent: string | null;
  assignedReviewerId: string | null;
  riskFlag: string | null;
  internalNotes: string | null;
  customerVisibleMessage: string | null;
  wholesaleDecidedBy: string | null;
  wholesaleDecidedAt: string | null;
  wholesaleDecisionReason: string | null;
  taxDecidedBy: string | null;
  taxDecidedAt: string | null;
  taxDecisionReason: string | null;
  taxVerificationSource: string | null;
  taxVerificationDate: string | null;
  createdAt: string;
  updatedAt: string;
  documents: BusinessApplicationDocument[];
  reviews?: BusinessApplicationReview[];
  messages?: BusinessApplicationMessage[];
  auditLogs?: BusinessApplicationAudit[];
};

export type BusinessApplicationFormState = {
  status: "idle" | "success" | "error";
  message: string;
  applicationId?: string;
  applicationNumber?: string;
  wholesaleStatus?: WholesaleAppStatus;
  taxExemptionStatus?: TaxAppStatus;
  submittedAt?: string;
};

export const initialBusinessApplicationFormState: BusinessApplicationFormState = {
  status: "idle",
  message: ""
};

export type JobTitle = (typeof JOB_TITLES)[number];
export type EntityType = (typeof ENTITY_TYPES)[number];
export type BusinessCategory = (typeof BUSINESS_CATEGORIES)[number];
export type MonthlyVolume = (typeof MONTHLY_VOLUMES)[number];
export type IntendedUse = (typeof INTENDED_USES)[number];
export type SalesChannel = (typeof SALES_CHANNELS)[number];
export type ExemptionType = (typeof EXEMPTION_TYPES)[number];
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

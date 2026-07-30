/** Shared constants for Wholesale & Resale Account Application. */

export const JOB_TITLES = [
  "Owner",
  "Co-owner",
  "President",
  "Manager",
  "Purchasing manager",
  "Authorized representative",
  "Other"
] as const;

export const ENTITY_TYPES = [
  "Sole proprietorship",
  "LLC",
  "Corporation",
  "Partnership",
  "Nonprofit organization",
  "Government agency",
  "Other"
] as const;

export const BUSINESS_CATEGORIES = [
  "Nail salon",
  "Beauty salon",
  "Spa",
  "Beauty supply store",
  "Jewelry store",
  "Online retailer",
  "Physical retail store",
  "Wholesaler",
  "Distributor",
  "Manufacturer",
  "Reseller",
  "Other"
] as const;

export const MONTHLY_VOLUMES = [
  "Under $500",
  "$500–$1,999",
  "$2,000–$4,999",
  "$5,000–$9,999",
  "$10,000 or more"
] as const;

export const INTENDED_USES = [
  "Resale in physical store",
  "Resale online",
  "Use in professional services",
  "Distribution",
  "Manufacturing",
  "Other"
] as const;

export const SALES_CHANNELS = [
  "Physical store",
  "Business website",
  "Amazon",
  "eBay",
  "Etsy",
  "Walmart Marketplace",
  "TikTok Shop",
  "Instagram",
  "Facebook",
  "Other"
] as const;

export const EXEMPTION_TYPES = [
  "Resale certificate",
  "Seller’s permit",
  "State tax exemption certificate",
  "Nonprofit exemption",
  "Government exemption",
  "Direct pay permit",
  "Other"
] as const;

export const DOCUMENT_TYPES = [
  "Seller’s permit",
  "Resale certificate",
  "State tax exemption certificate",
  "Business license",
  "Articles of organization",
  "Nonprofit exemption letter",
  "Government exemption letter",
  "Other supporting document"
] as const;

export const CONTACT_METHODS = ["Email", "Phone", "Either"] as const;

export const REJECTION_REASONS = [
  "Invalid permit number",
  "Certificate name does not match",
  "Certificate address does not match",
  "Expired document",
  "Incomplete document",
  "Unsupported exemption",
  "Unable to verify business",
  "Other"
] as const;

export const WHOLESALE_STATUS_LABELS: Record<string, string> = {
  not_requested: "Not requested",
  pending_review: "Pending review",
  under_review: "Under review",
  approved: "Business approved",
  rejected: "Rejected",
  suspended: "Suspended"
};

export const TAX_STATUS_LABELS: Record<string, string> = {
  not_requested: "Not requested",
  pending_review: "Pending review",
  under_review: "Under review",
  more_info_required: "More information required",
  approved: "Approved",
  rejected: "Rejected",
  expired: "Expired",
  suspended: "Suspended",
  revoked: "Revoked"
};

export const MAX_BUSINESS_DOCS = 5;
export const MAX_BUSINESS_DOC_BYTES = 10 * 1024 * 1024;
export const BUSINESS_DOC_ACCEPTED_LABEL =
  "PDF, JPEG, PNG, or WebP up to 10 MB each (max 5 files)";

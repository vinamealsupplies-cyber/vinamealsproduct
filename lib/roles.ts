/** Shared role / account types — safe for client + server (no server-only). */

export type AppRole = "customer" | "seller" | "staff" | "manager" | "admin";

export type AccountStatus = "active" | "disabled";

export type AdminAccount = {
  id: string;
  email: string | null;
  fullName: string | null;
  phone: string | null;
  role: AppRole;
  status: AccountStatus;
  createdAt: string;
  updatedAt: string;
};

export const APP_ROLES: { value: AppRole; label: string }[] = [
  { value: "customer", label: "Customer" },
  { value: "seller", label: "Seller" },
  { value: "staff", label: "Staff" },
  { value: "manager", label: "Manager" },
  { value: "admin", label: "Admin" }
];

export const ACCOUNT_STATUSES: { value: AccountStatus; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "disabled", label: "Disabled" }
];

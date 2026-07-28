import { AccountManager } from "@/components/account-manager";
import { AdminPageHeader } from "@/components/admin-page-header";
import { requireAdminPage } from "@/lib/auth";
import { getAccountsForAdmin } from "@/lib/data/accounts";

export const metadata = { title: "Accounts" };

export default async function AccountsPage() {
  const viewer = await requireAdminPage();
  const accounts = await getAccountsForAdmin();

  return (
    <>
      <AdminPageHeader
        eyebrow="Access"
        title="Accounts"
        description="All sign-in accounts from Supabase Auth. Set role (customer, seller, staff, manager, admin) and enable or disable access."
      />
      <AccountManager accounts={accounts} currentUserId={viewer.id} />
      <div className="legal-callout compact">
        <h2>Roles at a glance</h2>
        <p>
          <strong>Customer</strong> — storefront only. <strong>Seller</strong> — giao dịch hằng ngày
          (products add/edit, orders giao/huỷ, customers, invoices, payments, inventory) — mọi thao
          tác ghi Activity log. <strong>Staff</strong> — full admin except role management.{" "}
          <strong>Manager</strong> — staff plus destructive actions. <strong>Admin</strong> — full
          control including this page.
        </p>
      </div>
    </>
  );
}

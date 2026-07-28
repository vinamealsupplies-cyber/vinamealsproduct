import { Save } from "lucide-react";
import { AdminPageHeader } from "@/components/admin-page-header";
import { requireStaffPage } from "@/lib/auth";

export default async function SettingsPage() {
  await requireStaffPage();
  return (
    <>
      <AdminPageHeader eyebrow="Configuration" title="Store settings" description="Centralize storefront, inventory, invoice, media, and account controls." />
      <form className="admin-form">
        <section className="form-card"><div className="form-card-heading"><div><h2>Store identity</h2><p>Used in storefront metadata and customer documents.</p></div></div><div className="form-grid two-columns"><label>Store name<input defaultValue="Vinameals" /></label><label>Support email<input type="email" placeholder="support@example.com" /></label><label>Default currency<select defaultValue="USD"><option>USD</option></select></label><label>Default timezone<select defaultValue="America/Los_Angeles"><option>America/Los_Angeles</option></select></label></div></section>
        <section className="form-card"><div className="form-card-heading"><div><h2>Inventory defaults</h2><p>Control initial location and stock behavior.</p></div></div><div className="form-grid two-columns"><label>Default location code<input defaultValue="MAIN" /></label></div><div className="checkbox-row"><label><input type="checkbox" defaultChecked /> Prevent sale below available quantity</label><label><input type="checkbox" defaultChecked /> Show low-stock warnings</label></div></section>
        <section className="form-card"><div className="form-card-heading"><div><h2>Commerce modules</h2><p>Payment, shipping, and tax calculation remain disabled until configured.</p></div></div><div className="settings-switch-list"><label><span><strong>Checkout and payment</strong><small>Add a payment provider and webhook reconciliation.</small></span><input type="checkbox" disabled /></label><label><span><strong>Shipping rates</strong><small>Add zones, carriers, cold-chain rules, and fulfillment.</small></span><input type="checkbox" disabled /></label><label><span><strong>Automated sales tax</strong><small>Add a tax engine or reviewed jurisdiction rules.</small></span><input type="checkbox" disabled /></label></div></section>
        <div className="sticky-form-actions"><button className="button primary" type="button"><Save size={17} /> Save settings</button></div>
      </form>
    </>
  );
}

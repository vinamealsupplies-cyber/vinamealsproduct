import { CircleAlert, Plus, Upload } from "lucide-react";
import { AdminPageHeader } from "@/components/admin-page-header";
import { SearchableTable } from "@/components/searchable-table";
import { TaxCalculator } from "@/components/tax-calculator";
import { formatRate } from "@/lib/tax/calculate";
import {
  taxCityCount,
  taxJurisdictionCount,
  taxJurisdictions,
  taxStateCount
} from "@/lib/tax/jurisdictions.generated";

export const metadata = { title: "Sales tax" };

export default function AdminTaxPage() {
  const rows = taxJurisdictions.map((row, index) => ({
    id: `${row.state}-${row.city}-${index}`,
    state: row.state,
    city: row.city === "*" ? "— state default —" : row.city,
    general: formatRate(row.general),
    grocery: formatRate(row.grocery),
    difference: row.general === row.grocery ? "Same" : "Grocery relief",
    status: "Unverified"
  }));

  return (
    <>
      <AdminPageHeader
        eyebrow="Tax"
        title="Sales tax by city"
        description="Rates are matched to the delivery address: an exact city rate wins, otherwise the state default applies. Grocery items carry their own rate because most states exempt or reduce tax on food."
        action={
          <div className="button-row">
            <button className="button secondary" type="button">
              <Upload size={17} /> Import rates
            </button>
            <button className="button primary" type="button">
              <Plus size={17} /> Add jurisdiction
            </button>
          </div>
        }
      />

      <div className="setup-notice warning" role="note">
        <CircleAlert size={18} aria-hidden="true" />
        <div>
          <strong>All {taxJurisdictionCount} rates are unverified starting estimates.</strong>
          <span>
            United States rates change by quarter and by special district. Confirm every rate against the
            state revenue department, then mark it verified, before charging real customers. Nexus — which
            states you are actually required to collect in — is a decision for your accountant.
          </span>
        </div>
      </div>

      <div className="report-kpi-grid">
        <article>
          <span>Jurisdictions on file</span>
          <strong>{taxJurisdictionCount}</strong>
          <small>{taxStateCount} states and DC</small>
        </article>
        <article>
          <span>City-specific rates</span>
          <strong>{taxCityCount}</strong>
          <small>Everything else falls back to the state default</small>
        </article>
        <article>
          <span>Verified rates</span>
          <strong>0</strong>
          <small>Verify before enabling checkout</small>
        </article>
        <article>
          <span>Grocery relief</span>
          <strong>{taxJurisdictions.filter((row) => row.grocery < row.general).length}</strong>
          <small>Jurisdictions taxing food lower than general goods</small>
        </article>
      </div>

      <TaxCalculator />

      <SearchableTable
        columns={[
          { key: "state", label: "State" },
          { key: "city", label: "City" },
          { key: "general", label: "General rate", align: "right" },
          { key: "grocery", label: "Grocery rate", align: "right" },
          { key: "difference", label: "Food treatment" },
          { key: "status", label: "Status", kind: "status" }
        ]}
        rows={rows}
        searchPlaceholder="Search by state or city"
        defaultSortKey="state"
        emptyMessage="No jurisdiction matches that search."
      />

      <section className="ledger-explainer">
        <h2>How a rate is chosen</h2>
        <p>
          The database function <code>calculate_sales_tax</code> resolves the address in this order: an exact
          ZIP row, then a city row, then the state default. If no row exists for the state at all it returns
          <code> no_jurisdiction</code> instead of zero, so checkout can stop rather than silently
          undercharging. Rates are stored with an effective date, so a change can be scheduled without
          rewriting history on past invoices.
        </p>
      </section>
    </>
  );
}

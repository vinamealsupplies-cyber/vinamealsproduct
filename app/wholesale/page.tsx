import Link from "next/link";
import { ArrowRight, BadgeDollarSign, Building2, FileCheck2, ReceiptText } from "lucide-react";

export default function WholesalePage() {
  return (
    <div className="page-shell shell">
      <section className="content-hero wholesale-content-hero">
        <span className="kicker light">Business customers</span><h1>Wholesale tools for markets, cafés, and food businesses.</h1>
        <p>Keep business pricing, invoice history, balances, and approved exemption records connected to one customer account.</p>
        <Link className="button light" href="/login">Create an account <ArrowRight size={17} /></Link>
      </section>
      <section className="section info-card-grid">
        <article><Building2 size={25} /><h2>Business profile</h2><p>Company name, contact details, billing addresses, price level, credit terms, and notes.</p></article>
        <article><BadgeDollarSign size={25} /><h2>Wholesale pricing</h2><p>A separate price level that does not automatically grant sales-tax exemption.</p></article>
        <article><FileCheck2 size={25} /><h2>Exemption review</h2><p>Track certificate status, jurisdiction, dates, and approval by authorized staff.</p></article>
        <article><ReceiptText size={25} /><h2>Invoices and balances</h2><p>See invoiced, paid, partially paid, outstanding, and payment history.</p></article>
      </section>
      <section className="legal-callout"><h2>Important tax rule</h2><p>A business or wholesale customer is not automatically tax exempt. The store should apply tax treatment only after the required resale or exemption documentation is reviewed for the relevant jurisdiction.</p></section>
    </div>
  );
}

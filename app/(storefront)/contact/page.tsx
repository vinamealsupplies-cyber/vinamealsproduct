import type { Metadata } from "next";
import Link from "next/link";
import { Building2, Clock, Mail, MapPin } from "lucide-react";

export const metadata: Metadata = {
  title: "Contact",
  description: "Reach the Vinameals team about orders, store pickup, and wholesale accounts."
};

// ⚠️ Thông tin liên hệ công khai — cập nhật email/giờ mở cửa thật tại đây.
// Địa chỉ pickup khớp với cấu hình thuế trong components/fulfillment-picker.tsx.
const CONTACT = {
  email: "support@vinamealsupplies.com",
  city: "Garden Grove, CA",
  pickupNote: "Store pickup orders are handed off at our Garden Grove location — bring your order number and a photo ID.",
  hoursNote: "We reply to messages within one business day."
};

export default function ContactPage() {
  return (
    <div className="page-shell shell narrow-page">
      <header className="page-heading">
        <span className="kicker">Contact</span>
        <h1>How can we help?</h1>
        <p>Questions about an order, store pickup, or setting up a wholesale account — send us a note and we will get back to you.</p>
      </header>

      <div className="account-grid">
        <section className="account-card">
          <Mail />
          <h2>Email us</h2>
          <p>Order questions, product availability, and general support.</p>
          <a className="text-link" href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a>
        </section>
        <section className="account-card">
          <MapPin />
          <h2>Store pickup</h2>
          <p>{CONTACT.pickupNote}</p>
          <span className="status-pill status-active">{CONTACT.city}</span>
        </section>
        <section className="account-card">
          <Building2 />
          <h2>Business customers</h2>
          <p>Wholesale pricing, invoices, and tax-exemption review for markets, cafés, and food businesses.</p>
          <Link className="text-link" href="/wholesale">Learn about wholesale</Link>
        </section>
      </div>

      <div className="legal-callout compact">
        <h2><Clock size={17} aria-hidden="true" /> Response time</h2>
        <p>{CONTACT.hoursNote}</p>
      </div>
    </div>
  );
}

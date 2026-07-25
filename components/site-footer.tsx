import Image from "next/image";
import Link from "next/link";
import { Building2, FileText, Mail, Send, ShoppingBag, Sparkles, UserRound } from "lucide-react";
import type { LucideIcon } from "lucide-react";

// Mỗi cột footer: tiêu đề + danh sách link. Mỗi link có icon phía trước và
// nền pill riêng, căn giữa (theo yêu cầu hiển thị trên mobile — trông cũng
// gọn trên desktop).
const footerColumns: { heading: string; links: { href: string; label: string; icon: LucideIcon }[] }[] = [
  {
    heading: "Shop",
    links: [
      { href: "/products", label: "All products", icon: ShoppingBag },
      { href: "/products?sort=newest", label: "New arrivals", icon: Sparkles },
      { href: "/wholesale", label: "Wholesale", icon: Building2 }
    ]
  },
  {
    heading: "Help",
    links: [
      { href: "/account", label: "My account", icon: UserRound },
      { href: "/contact", label: "Contact", icon: Mail },
      { href: "/policies", label: "Store policies", icon: FileText }
    ]
  }
];

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="shell footer-grid">
        <div className="footer-intro">
          <div className="brand footer-brand">
            <Image
              className="brand-mark-img"
              src="/logo-mark.png"
              alt=""
              width={512}
              height={512}
              aria-hidden="true"
            />
            <span><strong>Vinameals</strong><small>REAL FOOD MAKE YOUR LIFE</small></span>
          </div>
          <p>Colorful pantry, frozen, snack, sauce, and beverage favorites for homes and businesses.</p>
        </div>

        {footerColumns.map((column) => (
          <nav className="footer-col" key={column.heading} aria-label={column.heading}>
            <h2>{column.heading}</h2>
            {column.links.map(({ href, label, icon: Icon }) => (
              <Link className="footer-link" href={href} key={href}>
                <Icon size={16} aria-hidden="true" />
                <span>{label}</span>
              </Link>
            ))}
          </nav>
        ))}

        <div className="footer-col">
          <h2>Stay in the loop</h2>
          <p>Product launches, seasonal ideas, and business account updates.</p>
          {/* Form đăng ký newsletter cũ không nối đi đâu (fake) — thay bằng
              đường dẫn thật tới trang liên hệ cho tới khi có backend email. */}
          <Link className="footer-link" href="/contact">
            <Send size={16} aria-hidden="true" />
            <span>Contact us to get updates</span>
          </Link>
        </div>
      </div>
      <div className="shell footer-bottom">
        <span>© 2026 Vinameals. All rights reserved.</span>
        <span>Prices shown in USD.</span>
      </div>
    </footer>
  );
}

import Image from "next/image";
import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="shell footer-grid">
        <div>
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
        <div>
          <h2>Shop</h2>
          <Link href="/products">All products</Link>
          <Link href="/products?sort=newest">New arrivals</Link>
          <Link href="/wholesale">Wholesale</Link>
        </div>
        <div>
          <h2>Help</h2>
          <Link href="/account">My account</Link>
          <Link href="/contact">Contact</Link>
          <Link href="/policies">Store policies</Link>
        </div>
        <div>
          <h2>Stay in the loop</h2>
          <p>Product launches, seasonal ideas, and business account updates.</p>
          <form className="newsletter-form">
            <input type="email" aria-label="Email address" placeholder="Email address" />
            <button type="submit">Join</button>
          </form>
        </div>
      </div>
      <div className="shell footer-bottom">
        <span>© 2026 Vinameals. Starter demonstration.</span>
        <span>Prices shown in USD.</span>
      </div>
    </footer>
  );
}

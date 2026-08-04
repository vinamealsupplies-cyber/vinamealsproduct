import "server-only";

import { getStoreBusinessProfile } from "@/lib/data/store-settings";
import { sendEmail } from "@/lib/email/send";
import { createAdminClient } from "@/lib/supabase/admin";

function siteOrigin() {
  return process.env.NEXT_PUBLIC_SITE_ORIGIN?.replace(/\/$/, "") || "https://vinamealsupplies.com";
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/** Email khách của một đơn: ưu tiên email đăng nhập (profiles), fallback customers.email. */
async function resolveCustomerEmail(customerId: string): Promise<string | null> {
  const supabase = createAdminClient();
  const { data: customer } = await supabase
    .from("customers")
    .select("email, auth_user_id")
    .eq("id", customerId)
    .maybeSingle();
  if (!customer) return null;
  let email = (customer.email as string | null)?.trim() || null;
  if (customer.auth_user_id) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("email")
      .eq("id", customer.auth_user_id)
      .maybeSingle();
    const loginEmail = (profile?.email as string | null)?.trim();
    if (loginEmail) email = loginEmail;
  }
  return email || null;
}

export type OrderNotifyKind = "shipped" | "pickup_ready";

/**
 * Báo khách khi đơn được ship (kèm mã tracking) hoặc sẵn sàng để pickup.
 * BEST-EFFORT: lỗi email không bao giờ làm hỏng thao tác của staff.
 */
export async function sendOrderStatusEmail(opts: {
  customerId: string | null | undefined;
  orderNumber: string | null | undefined;
  kind: OrderNotifyKind;
  carrierLabel?: string | null;
  trackingNumber?: string | null;
  trackingUrl?: string | null;
}): Promise<void> {
  try {
    if (!opts.customerId) return;
    const email = await resolveCustomerEmail(opts.customerId);
    if (!email) return;

    const store = await getStoreBusinessProfile().catch(() => null);
    const storeName = store?.displayName || store?.legalName || "Vinameals";
    const orderNo = opts.orderNumber || "";
    const orderUrl = orderNo
      ? `${siteOrigin()}/account/orders/${encodeURIComponent(orderNo)}`
      : `${siteOrigin()}/account/orders`;
    const storeAddress = store
      ? [store.addressLine1, store.city, store.state, store.postalCode].filter(Boolean).join(", ")
      : "";

    const text: string[] = [];
    const html: string[] = [];
    let subject: string;

    if (opts.kind === "shipped") {
      subject = `Đơn ${orderNo} đã được gửi đi`;
      text.push(`Đơn hàng ${orderNo} của bạn đã được gửi đi.`);
      html.push(`<p>Đơn hàng <strong>${orderNo}</strong> của bạn đã được gửi đi.</p>`);
      if (opts.trackingNumber) {
        const label = opts.carrierLabel ? `${opts.carrierLabel} · ` : "";
        text.push(`Mã vận đơn: ${label}${opts.trackingNumber}`);
        html.push(`<p>Mã vận đơn: <strong>${label}${opts.trackingNumber}</strong></p>`);
      }
      if (opts.trackingUrl) {
        text.push(`Tra cứu: ${opts.trackingUrl}`);
        html.push(`<p>Tra cứu: <a href="${opts.trackingUrl}">${opts.trackingUrl}</a></p>`);
      }
    } else {
      subject = `Đơn ${orderNo} đã sẵn sàng để lấy`;
      text.push(`Đơn hàng ${orderNo} của bạn đã sẵn sàng. Mời bạn đến cửa hàng lấy hàng.`);
      html.push(
        `<p>Đơn hàng <strong>${orderNo}</strong> của bạn đã sẵn sàng — mời bạn đến cửa hàng lấy hàng.</p>`
      );
      if (storeAddress) {
        text.push(`Địa chỉ: ${storeAddress}`);
        html.push(`<p>Địa chỉ: ${storeAddress}</p>`);
      }
      text.push(`Mang theo số đơn ${orderNo} và giấy tờ tuỳ thân.`);
      html.push(`<p>Mang theo số đơn <strong>${escapeHtml(orderNo)}</strong> và giấy tờ tuỳ thân.</p>`);
    }
    text.push(`Xem đơn hàng: ${orderUrl}`);
    html.push(`<p><a href="${orderUrl}">Xem đơn hàng ${escapeHtml(orderNo)}</a></p>`);
    text.push(`\n— ${storeName}`);

    await sendEmail({
      to: [email],
      subject,
      text: text.join("\n"),
      html: `<div style="font-family:system-ui,Arial,sans-serif;font-size:15px;color:#111">${html.join(
        ""
      )}<p style="color:#6b7280;font-size:13px">— ${storeName}</p></div>`
    });
  } catch (err) {
    console.error("[order notify] failed:", err);
  }
}

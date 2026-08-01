import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFImage,
  type RGB
} from "pdf-lib";

export interface InvoiceLine {
  description: string;
  sku: string | null;
  quantity: number;
  unitPrice: number;
  amount: number;
  note: string | null;
}
export interface InvoiceView {
  invoiceNumber: string;
  issueDate: string;
  orderNumber: string;
  status: string;
  fulfillmentMethod: string;
  paymentMethod: string | null;
  paymentStatus: string;
  billTo: {
    name: string;
    companyName: string | null;
    lines: string[];
    email: string | null;
    phone: string | null;
    customerNumber: string | null;
  };
  lines: InvoiceLine[];
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  shippingAmount: number;
  total: number;
  amountPaid: number;
  balanceDue: number;
}
export interface StoreProfile {
  legalName: string;
  displayName: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  postalCode: string;
  phone: string;
  email: string;
  website: string;
  checkPayableTo: string;
  zelleName: string;
  zelleEmailOrPhone: string;
  bankName: string;
  bankAccountName: string;
  bankRoutingNumber: string;
  bankAccountNumber: string;
  bankAccountType: string;
}

const METHOD_LABELS: Record<string, string> = {
  card: "Card",
  check: "Check",
  zelle: "Zelle",
  bank_transfer: "Bank transfer",
  test_checkout: "Card (test checkout)",
  cash: "Cash"
};

// pdf-lib font chuẩn chỉ encode WinAnsi (Latin1). Dấu tiếng Việt → hạ về ASCII.
function ascii(input: string | null | undefined): string {
  return (input ?? "")
    .replace(/[‒-―]/g, "-")
    .replace(/[‘’‚]/g, "'")
    .replace(/[“”„]/g, '"')
    .replace(/…/g, "...")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .replace(/[^\x00-\xff]/g, "?");
}

function money(n: number): string {
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n)
    .toFixed(2)
    .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${sign}$${abs}`;
}

const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN = 50;
const INK = rgb(0.11, 0.12, 0.13);
const MUTED = rgb(0.44, 0.47, 0.52);
const LINE = rgb(0.86, 0.88, 0.9);
const GREEN = rgb(0.043, 0.42, 0.3);
const GREEN_SOFT = rgb(0.9, 0.95, 0.93);
const RED = rgb(0.7, 0.2, 0.12);

const QTY_R = 392;
const UNIT_R = 476;
const AMT_R = PAGE_W - MARGIN;
const DESC_X = MARGIN;

export async function renderInvoicePdf(
  view: InvoiceView,
  store: StoreProfile,
  logoUrl?: string | null
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  // Logo (nếu tải được) — không có/logo lỗi thì bỏ qua, không vỡ PDF.
  let logo: PDFImage | null = null;
  if (logoUrl) {
    try {
      const res = await fetch(logoUrl);
      if (res.ok) {
        const bytes = new Uint8Array(await res.arrayBuffer());
        const ct = (res.headers.get("content-type") || "").toLowerCase();
        logo = ct.includes("png")
          ? await doc.embedPng(bytes)
          : await doc.embedJpg(bytes);
      }
    } catch {
      logo = null;
    }
  }

  const isReceipt = view.paymentStatus === "paid" || view.balanceDue <= 0;
  const title = isReceipt ? "RECEIPT" : "INVOICE";

  let page = doc.addPage([PAGE_W, PAGE_H]);

  const draw = (
    s: string,
    x: number,
    yy: number,
    opts?: { size?: number; font?: PDFFont; color?: RGB }
  ) =>
    page.drawText(ascii(s), {
      x,
      y: yy,
      size: opts?.size ?? 10,
      font: opts?.font ?? font,
      color: opts?.color ?? INK
    });

  const drawRight = (
    s: string,
    xRight: number,
    yy: number,
    opts?: { size?: number; font?: PDFFont; color?: RGB }
  ) => {
    const f = opts?.font ?? font;
    const size = opts?.size ?? 10;
    draw(s, xRight - f.widthOfTextAtSize(ascii(s), size), yy, opts);
  };

  const clip = (s: string, maxWidth: number, size: number) => {
    const clean = ascii(s);
    if (font.widthOfTextAtSize(clean, size) <= maxWidth) return clean;
    let out = clean;
    while (out.length > 1 && font.widthOfTextAtSize(out + "...", size) > maxWidth) {
      out = out.slice(0, -1);
    }
    return out + "...";
  };

  // Thanh accent trên đầu.
  page.drawRectangle({ x: 0, y: PAGE_H - 6, width: PAGE_W, height: 6, color: GREEN });

  // ---- Header: seller (trái) + INVOICE/meta (phải) ----
  let leftY = PAGE_H - MARGIN;
  if (logo) {
    const w = 150;
    const h = (logo.height / logo.width) * w;
    page.drawImage(logo, { x: MARGIN, y: leftY - h, width: w, height: h });
    leftY -= h + 12;
  } else {
    draw(store.displayName || store.legalName || "Vinameals", MARGIN, leftY - 16, {
      size: 20,
      font: bold
    });
    leftY -= 30;
  }

  draw(store.legalName || "Vinameals", MARGIN, leftY, { size: 11, font: bold });
  leftY -= 14;
  const sellerMeta = [
    store.addressLine1,
    store.addressLine2,
    [store.city, store.state, store.postalCode].filter(Boolean).join(", "),
    store.phone ? `Phone: ${store.phone}` : "",
    store.email,
    store.website ? store.website.replace(/^https?:\/\//, "") : ""
  ].filter((l) => l && l.trim());
  for (const l of sellerMeta) {
    draw(l, MARGIN, leftY, { size: 9, color: MUTED });
    leftY -= 12;
  }

  // Phải: tiêu đề + meta list.
  let rightY = PAGE_H - MARGIN - 6;
  drawRight(title, PAGE_W - MARGIN, rightY, { size: 26, font: bold, color: GREEN });
  rightY -= 26;

  const meta: [string, string][] = [
    ["DATE", view.issueDate],
    ["INVOICE #", view.invoiceNumber],
    ["ORDER #", view.orderNumber]
  ];
  if (view.billTo.customerNumber) meta.push(["CUSTOMER ID", view.billTo.customerNumber]);
  meta.push(["FULFILLMENT", view.fulfillmentMethod === "pickup" ? "Pickup" : "Shipping"]);
  for (const [label, value] of meta) {
    draw(label, 372, rightY, { size: 8, font: bold, color: MUTED });
    drawRight(value, PAGE_W - MARGIN, rightY, { size: 9 });
    rightY -= 13;
  }
  rightY -= 4;
  // Badge trạng thái thanh toán.
  const badge = isReceipt ? "PAID IN FULL" : `BALANCE DUE ${money(view.balanceDue)}`;
  const badgeW = bold.widthOfTextAtSize(ascii(badge), 10) + 16;
  page.drawRectangle({
    x: PAGE_W - MARGIN - badgeW,
    y: rightY - 4,
    width: badgeW,
    height: 18,
    color: isReceipt ? GREEN_SOFT : rgb(0.98, 0.92, 0.9)
  });
  drawRight(badge, PAGE_W - MARGIN - 8, rightY, {
    size: 10,
    font: bold,
    color: isReceipt ? GREEN : RED
  });

  let y = Math.min(leftY, rightY) - 16;
  page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_W - MARGIN, y }, thickness: 1, color: LINE });
  y -= 20;

  // ---- Bill to ----
  draw("BILL TO", MARGIN, y, { size: 8, font: bold, color: MUTED });
  y -= 15;
  const billLines = [
    view.billTo.companyName || view.billTo.name,
    view.billTo.companyName ? view.billTo.name : "",
    ...view.billTo.lines,
    view.billTo.email,
    view.billTo.phone
  ].filter((l): l is string => Boolean(l && l.trim()));
  for (const l of billLines) {
    draw(l, MARGIN, y, { size: 10 });
    y -= 13;
  }
  y -= 12;

  // ---- Bảng line items ----
  const tableHeader = () => {
    page.drawRectangle({
      x: MARGIN,
      y: y - 6,
      width: PAGE_W - 2 * MARGIN,
      height: 20,
      color: GREEN_SOFT
    });
    draw("DESCRIPTION", DESC_X + 8, y, { size: 8, font: bold, color: GREEN });
    drawRight("QTY", QTY_R, y, { size: 8, font: bold, color: GREEN });
    drawRight("UNIT", UNIT_R, y, { size: 8, font: bold, color: GREEN });
    drawRight("AMOUNT", AMT_R, y, { size: 8, font: bold, color: GREEN });
    y -= 24;
  };
  tableHeader();

  let stripe = false;
  for (const li of view.lines) {
    if (y < 150) {
      page = doc.addPage([PAGE_W, PAGE_H]);
      y = PAGE_H - MARGIN;
      tableHeader();
    }
    if (stripe) {
      page.drawRectangle({
        x: MARGIN,
        y: y - 5,
        width: PAGE_W - 2 * MARGIN,
        height: 18,
        color: rgb(0.975, 0.98, 0.985)
      });
    }
    stripe = !stripe;
    const label = li.sku ? `${li.description} (${li.sku})` : li.description;
    draw(clip(label, QTY_R - DESC_X - 40, 10), DESC_X + 8, y, { size: 10 });
    drawRight(String(li.quantity), QTY_R, y, { size: 10 });
    drawRight(money(li.unitPrice), UNIT_R, y, { size: 10 });
    drawRight(money(li.amount), AMT_R, y, { size: 10 });
    if (li.note && li.note.trim()) {
      y -= 12;
      draw(clip(`Note: ${li.note}`, AMT_R - DESC_X - 8, 8), DESC_X + 8, y, { size: 8, color: MUTED });
    }
    y -= 17;
  }

  y -= 4;
  page.drawLine({ start: { x: 340, y: y + 6 }, end: { x: PAGE_W - MARGIN, y: y + 6 }, thickness: 1, color: LINE });
  y -= 6;

  // ---- Tổng ----
  const totalRow = (label: string, value: string, opts?: { bold?: boolean; color?: RGB }) => {
    const f = opts?.bold ? bold : font;
    drawRight(label, UNIT_R, y, { size: opts?.bold ? 11 : 10, font: f, color: opts?.color ?? MUTED });
    drawRight(value, AMT_R, y, { size: opts?.bold ? 11 : 10, font: f, color: opts?.color ?? INK });
    y -= 15;
  };
  totalRow("Subtotal", money(view.subtotal));
  if (view.discountAmount > 0) totalRow("Discount", `-${money(view.discountAmount)}`);
  if (view.taxAmount > 0) totalRow("Tax", money(view.taxAmount));
  if (view.shippingAmount > 0) totalRow("Shipping", money(view.shippingAmount));
  totalRow("Total", money(view.total), { bold: true });
  if (view.amountPaid > 0) totalRow("Amount paid", `-${money(view.amountPaid)}`);
  totalRow(
    isReceipt ? "Paid" : "Balance due",
    isReceipt ? money(view.amountPaid || view.total) : money(view.balanceDue),
    { bold: true, color: isReceipt ? GREEN : RED }
  );
  y -= 14;

  // ---- Chi tiết thanh toán: phương thức + số tài khoản ----
  const method = view.paymentMethod;
  const methodLabel = method ? METHOD_LABELS[method] ?? method : null;
  const showBank =
    (method === "bank_transfer" || (!method && !isReceipt)) &&
    (store.bankName || store.bankAccountNumber || store.bankRoutingNumber);
  const showZelle =
    (method === "zelle" || (!method && !isReceipt)) &&
    (store.zelleEmailOrPhone || store.zelleName);
  const showCheck =
    (method === "check" || (!method && !isReceipt)) && store.checkPayableTo;

  if (methodLabel || showBank || showZelle || showCheck) {
    if (y < 130) {
      page = doc.addPage([PAGE_W, PAGE_H]);
      y = PAGE_H - MARGIN;
    }
    draw("PAYMENT", MARGIN, y, { size: 8, font: bold, color: MUTED });
    y -= 15;
    if (methodLabel) {
      draw(isReceipt ? "Paid via" : "Payment method", MARGIN, y, { size: 9, color: MUTED });
      draw(methodLabel, MARGIN + 92, y, { size: 10, font: bold });
      y -= 15;
    }
    const payLine = (label: string, value: string) => {
      draw(label, MARGIN, y, { size: 9, color: MUTED });
      draw(value, MARGIN + 92, y, { size: 10 });
      y -= 14;
    };
    if (showCheck) payLine("Check to", store.checkPayableTo);
    if (showZelle) {
      payLine("Zelle", `${store.zelleEmailOrPhone}${store.zelleName ? ` (${store.zelleName})` : ""}`);
    }
    if (showBank) {
      if (store.bankName) payLine("Bank", store.bankName);
      if (store.bankAccountName) payLine("Account name", store.bankAccountName);
      if (store.bankRoutingNumber) payLine("Routing #", store.bankRoutingNumber);
      if (store.bankAccountNumber) {
        payLine(
          "Account #",
          `${store.bankAccountNumber}${store.bankAccountType ? ` (${store.bankAccountType})` : ""}`
        );
      }
    }
    if (!isReceipt && (showBank || showZelle || showCheck)) {
      y -= 2;
      draw(`Reference: invoice ${view.invoiceNumber} / order ${view.orderNumber}`, MARGIN, y, {
        size: 8,
        color: MUTED
      });
    }
  }

  // ---- Footer ----
  draw(
    isReceipt ? "Thank you for your payment." : "Thank you for your business.",
    MARGIN,
    MARGIN,
    { size: 9, color: MUTED }
  );
  drawRight(`Questions? ${store.email || "support@vinamealsupplies.com"}`, PAGE_W - MARGIN, MARGIN, {
    size: 9,
    color: MUTED
  });

  return doc.save();
}

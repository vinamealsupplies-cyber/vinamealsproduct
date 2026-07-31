import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type RGB
} from "pdf-lib";

// Type cục bộ (subset các field cần) — worker này độc lập với app.
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
  paymentStatus: string;
  billTo: {
    name: string;
    companyName: string | null;
    lines: string[];
    email: string | null;
    phone: string | null;
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
  checkPayableTo: string;
  zelleName: string;
  zelleEmailOrPhone: string;
  bankName: string;
  bankAccountName: string;
}

// pdf-lib font chuẩn chỉ encode WinAnsi (Latin1). Tên/địa chỉ khách có dấu tiếng
// Việt → hạ về ASCII để drawText không vỡ (invoice khách vốn tiếng Anh).
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
const INK = rgb(0.1, 0.1, 0.11);
const MUTED = rgb(0.42, 0.45, 0.5);
const LINE = rgb(0.85, 0.87, 0.9);
const GREEN = rgb(0.04, 0.42, 0.3);
const RED = rgb(0.7, 0.2, 0.1);

const QTY_R = 400;
const UNIT_R = 480;
const AMT_R = PAGE_W - MARGIN - 4;
const DESC_X = MARGIN + 4;

export async function renderInvoicePdf(
  view: InvoiceView,
  store: StoreProfile
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const isReceipt = view.paymentStatus === "paid" || view.balanceDue <= 0;
  const title = isReceipt ? "RECEIPT" : "INVOICE";

  let page = doc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;

  const draw = (
    s: string,
    x: number,
    yy: number,
    opts?: { size?: number; font?: PDFFont; color?: RGB }
  ) => {
    page.drawText(ascii(s), {
      x,
      y: yy,
      size: opts?.size ?? 10,
      font: opts?.font ?? font,
      color: opts?.color ?? INK
    });
  };

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

  const storeName = store.displayName || store.legalName || "Vinameals";
  draw(storeName, MARGIN, y - 4, { size: 18, font: bold });
  drawRight(title, PAGE_W - MARGIN, y - 2, { size: 22, font: bold, color: GREEN });

  let leftY = y - 22;
  const storeMeta = [
    store.addressLine1,
    store.addressLine2,
    [store.city, store.state, store.postalCode].filter(Boolean).join(", "),
    store.phone,
    store.email
  ].filter((l) => l && l.trim());
  for (const l of storeMeta) {
    draw(l, MARGIN, leftY, { size: 9, color: MUTED });
    leftY -= 12;
  }

  let rightY = y - 24;
  drawRight(`No. ${view.invoiceNumber}`, PAGE_W - MARGIN, rightY, { size: 11, font: bold });
  rightY -= 14;
  drawRight(`Issued ${view.issueDate}`, PAGE_W - MARGIN, rightY, { size: 9, color: MUTED });
  rightY -= 13;
  drawRight(`Order ${view.orderNumber}`, PAGE_W - MARGIN, rightY, { size: 9, color: MUTED });
  rightY -= 16;
  drawRight(
    isReceipt ? "PAID IN FULL" : `BALANCE DUE ${money(view.balanceDue)}`,
    PAGE_W - MARGIN,
    rightY,
    { size: 12, font: bold, color: isReceipt ? GREEN : RED }
  );

  y = Math.min(leftY, rightY) - 12;
  page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_W - MARGIN, y }, thickness: 1, color: LINE });
  y -= 20;

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
  y -= 10;

  const tableHeader = () => {
    page.drawRectangle({
      x: MARGIN,
      y: y - 5,
      width: PAGE_W - 2 * MARGIN,
      height: 18,
      color: rgb(0.95, 0.97, 0.96)
    });
    draw("Description", DESC_X, y, { size: 9, font: bold, color: MUTED });
    drawRight("Qty", QTY_R, y, { size: 9, font: bold, color: MUTED });
    drawRight("Unit", UNIT_R, y, { size: 9, font: bold, color: MUTED });
    drawRight("Amount", AMT_R, y, { size: 9, font: bold, color: MUTED });
    y -= 22;
  };
  tableHeader();

  for (const li of view.lines) {
    if (y < 120) {
      page = doc.addPage([PAGE_W, PAGE_H]);
      y = PAGE_H - MARGIN;
      tableHeader();
    }
    const label = li.sku ? `${li.description} (${li.sku})` : li.description;
    draw(clip(label, QTY_R - DESC_X - 30, 10), DESC_X, y, { size: 10 });
    drawRight(String(li.quantity), QTY_R, y, { size: 10 });
    drawRight(money(li.unitPrice), UNIT_R, y, { size: 10 });
    drawRight(money(li.amount), AMT_R, y, { size: 10 });
    if (li.note && li.note.trim()) {
      y -= 12;
      draw(clip(`Note: ${li.note}`, AMT_R - DESC_X, 8), DESC_X, y, { size: 8, color: MUTED });
    }
    y -= 16;
  }

  page.drawLine({ start: { x: 330, y: y + 4 }, end: { x: PAGE_W - MARGIN, y: y + 4 }, thickness: 1, color: LINE });
  y -= 8;

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
  y -= 10;

  if (!isReceipt) {
    const pay: string[] = [];
    if (store.checkPayableTo) pay.push(`Check payable to: ${store.checkPayableTo}`);
    if (store.zelleEmailOrPhone)
      pay.push(`Zelle: ${store.zelleEmailOrPhone}${store.zelleName ? ` (${store.zelleName})` : ""}`);
    if (store.bankName)
      pay.push(`Bank transfer: ${store.bankName}${store.bankAccountName ? ` — ${store.bankAccountName}` : ""}`);
    if (pay.length) {
      if (y < 90) {
        page = doc.addPage([PAGE_W, PAGE_H]);
        y = PAGE_H - MARGIN;
      }
      draw("HOW TO PAY", MARGIN, y, { size: 8, font: bold, color: MUTED });
      y -= 14;
      for (const l of pay) {
        draw(clip(l, PAGE_W - 2 * MARGIN, 9), MARGIN, y, { size: 9, color: INK });
        y -= 12;
      }
      draw(`Reference: invoice ${view.invoiceNumber} / order ${view.orderNumber}`, MARGIN, y - 2, {
        size: 8,
        color: MUTED
      });
    }
  }

  draw(isReceipt ? "Thank you for your payment." : "Thank you for your business.", MARGIN, MARGIN, {
    size: 9,
    color: MUTED
  });
  drawRight(`Questions? ${store.email || "support@vinamealsupplies.com"}`, PAGE_W - MARGIN, MARGIN, {
    size: 9,
    color: MUTED
  });

  return doc.save();
}

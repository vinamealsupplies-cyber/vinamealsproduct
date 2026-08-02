import "server-only";

import ExcelJS from "exceljs";
import type { MonthlyPerformance } from "@/lib/data/reporting";
import type { SalesTaxOrderRow, SalesTaxReport } from "@/lib/data/sales-tax-report";

export type ReportExportRow = MonthlyPerformance & {
  grossProfit: number;
  operatingProfit: number;
};

export async function buildPerformanceWorkbook(input: {
  periodLabel: string;
  rows: ReportExportRow[];
}): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Vinameals";
  workbook.created = new Date();

  const summary = workbook.addWorksheet("Summary");
  summary.columns = [
    { header: "Metric", key: "metric", width: 28 },
    { header: "Amount (USD)", key: "amount", width: 18 }
  ];

  const totals = input.rows.reduce(
    (sum, row) => ({
      netSales: sum.netSales + row.netSales,
      shippingRevenue: sum.shippingRevenue + row.shippingRevenue,
      taxCollected: sum.taxCollected + row.taxCollected,
      amountInvoiced: sum.amountInvoiced + row.amountInvoiced,
      received: sum.received + row.received,
      balanceDue: sum.balanceDue + row.balanceDue,
      cogs: sum.cogs + row.cogs,
      expenses: sum.expenses + row.expenses,
      grossProfit: sum.grossProfit + row.grossProfit,
      operatingProfit: sum.operatingProfit + row.operatingProfit
    }),
    {
      netSales: 0,
      shippingRevenue: 0,
      taxCollected: 0,
      amountInvoiced: 0,
      received: 0,
      balanceDue: 0,
      cogs: 0,
      expenses: 0,
      grossProfit: 0,
      operatingProfit: 0
    }
  );

  summary.addRow({ metric: "Period", amount: input.periodLabel });
  summary.addRow({ metric: "Months included", amount: input.rows.length });
  summary.addRow({});
  summary.addRow({ metric: "Net sales", amount: totals.netSales });
  summary.addRow({ metric: "Shipping revenue", amount: totals.shippingRevenue });
  summary.addRow({ metric: "Tax collected", amount: totals.taxCollected });
  summary.addRow({ metric: "Amount invoiced", amount: totals.amountInvoiced });
  summary.addRow({ metric: "Amount received", amount: totals.received });
  summary.addRow({ metric: "Balance due (selected months)", amount: totals.balanceDue });
  summary.addRow({ metric: "Cost of goods (COGS)", amount: totals.cogs });
  summary.addRow({ metric: "Gross profit", amount: totals.grossProfit });
  summary.addRow({ metric: "Operating expenses", amount: totals.expenses });
  summary.addRow({ metric: "Operating profit", amount: totals.operatingProfit });

  summary.getRow(1).font = { bold: true };
  for (let r = 4; r <= 13; r++) {
    summary.getCell(`B${r}`).numFmt = '$#,##0.00';
  }

  const monthly = workbook.addWorksheet("Monthly detail");
  monthly.columns = [
    { header: "Month", key: "month", width: 14 },
    { header: "Month start", key: "monthStart", width: 14 },
    { header: "Net sales", key: "netSales", width: 14 },
    { header: "Shipping", key: "shippingRevenue", width: 12 },
    { header: "Tax", key: "taxCollected", width: 12 },
    { header: "Invoiced", key: "amountInvoiced", width: 14 },
    { header: "Received", key: "received", width: 14 },
    { header: "Balance due", key: "balanceDue", width: 14 },
    { header: "COGS", key: "cogs", width: 12 },
    { header: "Gross profit", key: "grossProfit", width: 14 },
    { header: "Expenses", key: "expenses", width: 12 },
    { header: "Operating profit", key: "operatingProfit", width: 16 }
  ];
  monthly.getRow(1).font = { bold: true };

  for (const row of input.rows) {
    monthly.addRow({
      month: row.month,
      monthStart: row.monthStart,
      netSales: row.netSales,
      shippingRevenue: row.shippingRevenue,
      taxCollected: row.taxCollected,
      amountInvoiced: row.amountInvoiced,
      received: row.received,
      balanceDue: row.balanceDue,
      cogs: row.cogs,
      grossProfit: row.grossProfit,
      expenses: row.expenses,
      operatingProfit: row.operatingProfit
    });
  }

  const moneyCols = ["C", "D", "E", "F", "G", "H", "I", "J", "K", "L"];
  monthly.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    for (const col of moneyCols) {
      row.getCell(col).numFmt = '$#,##0.00';
    }
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

// ---- California Sales Tax (CDTFA) export ------------------------------------

const SALES_TAX_HEADERS = [
  "Order #",
  "Order date",
  "Payment status",
  "Refund",
  "Fulfillment",
  "Country",
  "State",
  "County",
  "City",
  "ZIP",
  "Ship-to address",
  "Gross sales",
  "Taxable subtotal",
  "Shipping",
  "Shipping taxable",
  "Exempt amount",
  "Total taxable",
  "Net taxable sales",
  "Tax rate %",
  "State tax",
  "District tax",
  "Sales tax collected",
  "Jurisdiction",
  "Jurisdiction code"
];

// 1-based column indexes that hold currency amounts (for number formatting).
const SALES_TAX_MONEY_COLS = [4, 12, 13, 14, 15, 16, 17, 18, 20, 21, 22];

function salesTaxRow(o: SalesTaxOrderRow): (string | number)[] {
  return [
    o.orderNumber,
    o.orderDate ?? "",
    o.paymentStatus.replace(/_/g, " "),
    o.refundAmount,
    o.fulfillmentMethod ?? "",
    o.country ?? "",
    o.state ?? "",
    o.county ?? "",
    o.city ?? "",
    o.zip ?? "",
    o.shippingAddress ?? "",
    o.grossSales,
    o.taxableSubtotal,
    o.shipping,
    o.shippingTaxable,
    o.exemptAmount,
    o.totalTaxable,
    o.netTaxableSales,
    Number((o.taxRate * 100).toFixed(4)),
    o.stateTax,
    o.districtTax,
    o.taxCollected,
    o.jurisdictionLabel ?? "",
    o.jurisdictionCode ?? ""
  ];
}

function csvEscape(value: unknown): string {
  const s = String(value ?? "");
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Per-order CSV with all fields needed for CDTFA filing. */
export function buildSalesTaxCsv(report: SalesTaxReport): string {
  const lines = [SALES_TAX_HEADERS.map(csvEscape).join(",")];
  for (const order of report.orders) {
    lines.push(salesTaxRow(order).map(csvEscape).join(","));
  }
  return lines.join("\r\n");
}

/** Two-sheet workbook: per-order detail + by-jurisdiction summary. */
export async function buildSalesTaxWorkbook(report: SalesTaxReport): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Vinameals";
  workbook.created = new Date();

  const orders = workbook.addWorksheet("Orders");
  orders.addRow(SALES_TAX_HEADERS);
  orders.getRow(1).font = { bold: true };
  for (const order of report.orders) orders.addRow(salesTaxRow(order));
  orders.columns.forEach((col, index) => {
    col.width = index === 10 ? 34 : 14;
  });
  orders.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    for (const col of SALES_TAX_MONEY_COLS) row.getCell(col).numFmt = '$#,##0.00';
  });

  const summary = workbook.addWorksheet("By jurisdiction");
  summary.addRow([
    "State",
    "County",
    "City",
    "ZIP",
    "Tax rate %",
    "Orders",
    "Gross sales",
    "Taxable sales",
    "Exempt sales",
    "Shipping",
    "State tax",
    "District tax",
    "Tax collected"
  ]);
  summary.getRow(1).font = { bold: true };
  for (const group of report.groups) {
    summary.addRow([
      group.state,
      group.county,
      group.city,
      group.zip,
      Number((group.taxRate * 100).toFixed(4)),
      group.orderCount,
      group.grossSales,
      group.taxableSales,
      group.exemptSales,
      group.shipping,
      group.stateTax,
      group.districtTax,
      group.taxCollected
    ]);
  }
  summary.columns.forEach((col) => {
    col.width = 14;
  });
  summary.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    for (const col of [7, 8, 9, 10, 11, 12, 13]) row.getCell(col).numFmt = '$#,##0.00';
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

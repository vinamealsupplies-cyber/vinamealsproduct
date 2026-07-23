export const dashboardMetrics = [
  { label: "Net sales", value: "$84,230", detail: "+12.4% vs. previous period" },
  { label: "Amount received", value: "$79,540", detail: "$4,690 currently outstanding" },
  { label: "Gross profit", value: "$31,880", detail: "37.8% gross margin" },
  { label: "Inventory value", value: "$26,410", detail: "8 low-stock SKUs" }
];

export const inventoryRows = [
  { product: "Tropical Mango Slices", variant: "8 oz bag", sku: "MANGO-8OZ", category: "Snacks", location: "MAIN", onHand: 42, reserved: 4, reorder: 10, cost: 3.4 },
  { product: "Garden Veggie Dumplings", variant: "20 count", sku: "DUMP-VEG-20", category: "Frozen", location: "MAIN", onHand: 18, reserved: 7, reorder: 8, cost: 5.2 },
  { product: "Golden Chili Crisp", variant: "6 oz jar", sku: "CHILI-6OZ", category: "Sauces", location: "MAIN", onHand: 27, reserved: 2, reorder: 8, cost: 3.85 },
  { product: "Sesame Rice Crackers", variant: "5 oz bag", sku: "RICE-SES-5", category: "Snacks", location: "MAIN", onHand: 9, reserved: 1, reorder: 10, cost: 2.1 },
  { product: "Pure Coconut Water", variant: "16.9 fl oz", sku: "COCO-169", category: "Beverages", location: "MAIN", onHand: 64, reserved: 12, reorder: 15, cost: 1.35 }
];

export const customerRows = [
  { number: "CUS-0001024", name: "Ava Johnson", company: "—", type: "Retail", email: "ava@example.com", exempt: "Not requested", sales: 428.3, balance: 0 },
  { number: "CUS-0001025", name: "Noah Kim", company: "Sunrise Market LLC", type: "Wholesale", email: "orders@sunrisemarket.example", exempt: "Approved", sales: 12480, balance: 920 },
  { number: "CUS-0001026", name: "Mia Garcia", company: "Harbor Cafe", type: "Wholesale", email: "mia@harborcafe.example", exempt: "Pending", sales: 7280.5, balance: 0 },
  { number: "CUS-0001027", name: "Walk-in Customer", company: "—", type: "Guest", email: "—", exempt: "Not requested", sales: 182.75, balance: 0 }
];

export const invoiceRows = [
  { number: "INV-2026-0001182", customer: "Sunrise Market LLC", issueDate: "2026-07-18", total: 1840, paid: 920, status: "Partially paid" },
  { number: "INV-2026-0001181", customer: "Harbor Cafe", issueDate: "2026-07-17", total: 1284.5, paid: 1284.5, status: "Paid" },
  { number: "INV-2026-0001180", customer: "Ava Johnson", issueDate: "2026-07-16", total: 68.24, paid: 68.24, status: "Paid" },
  { number: "INV-2026-0001179", customer: "Walk-in Customer", issueDate: "2026-07-15", total: 42.6, paid: 42.6, status: "Paid" }
];

export const expenseRows = [
  { date: "2026-07-18", category: "Delivery and shipping", vendor: "Local Freight Co.", description: "Wholesale delivery route", amount: 186.5 },
  { date: "2026-07-15", category: "Inventory supplies", vendor: "PackRight", description: "Insulated liners and labels", amount: 342.18 },
  { date: "2026-07-11", category: "Marketing", vendor: "Neighborhood Guide", description: "Summer food issue placement", amount: 275 }
];

export const monthlyPerformance = [
  { month: "February", netSales: 52140, shippingRevenue: 1600, taxCollected: 2780, amountInvoiced: 56520, received: 50380, balanceDue: 3820, cogs: 31820, expenses: 6120 },
  { month: "March", netSales: 58840, shippingRevenue: 1780, taxCollected: 3150, amountInvoiced: 63770, received: 57200, balanceDue: 4200, cogs: 35120, expenses: 6380 },
  { month: "April", netSales: 63120, shippingRevenue: 1940, taxCollected: 3390, amountInvoiced: 68450, received: 61510, balanceDue: 4560, cogs: 37450, expenses: 6910 },
  { month: "May", netSales: 69860, shippingRevenue: 2100, taxCollected: 3740, amountInvoiced: 75700, received: 68240, balanceDue: 4720, cogs: 40940, expenses: 7240 },
  { month: "June", netSales: 74820, shippingRevenue: 2280, taxCollected: 4020, amountInvoiced: 81120, received: 72100, balanceDue: 5120, cogs: 43280, expenses: 7550 },
  { month: "July", netSales: 84230, shippingRevenue: 2540, taxCollected: 4530, amountInvoiced: 91300, received: 79540, balanceDue: 4690, cogs: 52350, expenses: 8180 }
];

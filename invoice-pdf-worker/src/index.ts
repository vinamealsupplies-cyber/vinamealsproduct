import { renderInvoicePdf, type InvoiceView, type StoreProfile } from "./render";

export interface Env {
  /** Bí mật chia sẻ với app — chặn người lạ gọi endpoint render PDF. */
  INVOICE_PDF_SECRET: string;
}

// Worker render PDF invoice, tách riêng để pdf-lib KHÔNG nằm trong worker chính
// (worker OpenNext gói Free bị cap 3 MiB). App gọi POST /render với bearer secret.
export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    if (req.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }
    const auth = req.headers.get("authorization") ?? "";
    if (!env.INVOICE_PDF_SECRET || auth !== `Bearer ${env.INVOICE_PDF_SECRET}`) {
      return new Response("Unauthorized", { status: 401 });
    }

    let body: { view?: InvoiceView; store?: StoreProfile };
    try {
      body = (await req.json()) as typeof body;
    } catch {
      return new Response("Bad JSON", { status: 400 });
    }
    if (!body?.view || !body?.store) {
      return new Response("Missing view/store", { status: 400 });
    }

    try {
      const pdf = await renderInvoicePdf(body.view, body.store);
      return new Response(pdf, {
        headers: {
          "content-type": "application/pdf",
          "cache-control": "no-store"
        }
      });
    } catch (err) {
      console.error("render failed", err);
      return new Response("Render failed", { status: 500 });
    }
  }
};

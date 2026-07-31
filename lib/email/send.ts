import "server-only";

// Gửi thư qua Resend HTTP API.
//
// Dùng API thay vì SMTP vì code chạy trên Cloudflare Workers — Workers không mở
// được kết nối TCP thô tới cổng 587. (Supabase Auth vẫn dùng SMTP vì nó chạy
// trên hạ tầng Supabase, không phải Workers.)
//
// Khoá: RESEND_API_KEY, lùi về SMTP_PASSWORD cho tiện lúc dev vì .env.local đã
// có sẵn khoá đó cho Supabase. Trên production phải set secret cho Worker:
//   npx wrangler secret put RESEND_API_KEY

export const SUPPORT_FROM = "Vinameals <support@vinamealsupplies.com>";

function apiKey() {
  return process.env.RESEND_API_KEY || process.env.SMTP_PASSWORD || "";
}

export function isEmailSendingConfigured() {
  return apiKey().length > 0;
}

export type SendEmailInput = {
  to: string[];
  subject: string;
  text: string;
  html: string;
  /** Header RFC để thư gộp đúng luồng hội thoại bên phía khách. */
  inReplyTo?: string | null;
  references?: string[] | null;
  replyTo?: string;
  /** File đính kèm — `content` là base64 (Resend yêu cầu). */
  attachments?: { filename: string; content: string }[];
};

export type SendEmailResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const key = apiKey();
  if (!key) return { ok: false, error: "Email sending is not configured (missing RESEND_API_KEY)." };

  const headers: Record<string, string> = {};
  if (input.inReplyTo) headers["In-Reply-To"] = input.inReplyTo;
  if (input.references?.length) headers["References"] = input.references.join(" ");

  let response: Response;
  try {
    response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: SUPPORT_FROM,
        to: input.to,
        subject: input.subject,
        text: input.text,
        html: input.html,
        reply_to: input.replyTo ?? "support@vinamealsupplies.com",
        ...(input.attachments?.length ? { attachments: input.attachments } : {}),
        ...(Object.keys(headers).length ? { headers } : {})
      })
    });
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Network error" };
  }

  const payload = (await response.json().catch(() => null)) as
    | { id?: string; message?: string; name?: string }
    | null;

  if (!response.ok || !payload?.id) {
    // Không lộ khoá/nội dung thô ra UI — chỉ thông điệp của Resend.
    return { ok: false, error: payload?.message || `Resend trả về HTTP ${response.status}` };
  }
  return { ok: true, id: payload.id };
}

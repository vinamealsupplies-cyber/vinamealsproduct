import PostalMime from "postal-mime";

export interface Env {
  /** URL project Supabase (công khai). */
  SUPABASE_URL: string;
  /** Service role key — SECRET, chỉ để gọi RPC ingest. */
  SUPABASE_SERVICE_ROLE_KEY: string;
}

/**
 * Cloudflare Email Worker: nhận thư gửi tới support@vinamealsupplies.com, parse
 * MIME rồi đẩy vào hộp thư hỗ trợ qua RPC `ingest_inbound_email` (service role).
 *
 * Nguyên tắc: KHÔNG bao giờ reject/bounce thư khách. Lỗi thì log rồi bỏ qua —
 * mất một thư còn hơn dội ngược "gửi thất bại" về khách.
 */
export default {
  async email(message: ForwardableEmailMessage, env: Env): Promise<void> {
    let parsed: Awaited<ReturnType<typeof PostalMime.parse>>;
    try {
      const raw = await new Response(message.raw).arrayBuffer();
      parsed = await PostalMime.parse(raw);
    } catch (err) {
      console.error("MIME parse failed", err);
      return;
    }

    const fromAddress = parsed.from?.address || message.from;
    if (!fromAddress) {
      console.error("no from address; dropping");
      return;
    }

    const references =
      typeof parsed.references === "string"
        ? parsed.references.split(/\s+/).filter(Boolean)
        : null;

    const payload = {
      p_from_address: fromAddress,
      p_from_name: parsed.from?.name || null,
      p_to_addresses: [message.to],
      p_subject: parsed.subject || "",
      p_text_body: parsed.text || null,
      p_html_body: parsed.html || null,
      p_rfc_message_id: parsed.messageId || null,
      p_in_reply_to: parsed.inReplyTo || null,
      p_references: references
    };

    try {
      const res = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/ingest_inbound_email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: env.SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`
        },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        console.error("ingest_inbound_email failed", res.status, await res.text());
      }
    } catch (err) {
      console.error("ingest fetch error", err);
    }
  }
};

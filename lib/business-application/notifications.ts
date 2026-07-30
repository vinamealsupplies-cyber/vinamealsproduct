import "server-only";

/**
 * Transactional email for business applications.
 * Uses Resend when RESEND_API_KEY + EMAIL_FROM are set; otherwise no-ops
 * (status is still visible in Account). Never attaches permit files.
 */

export type BusinessAppEmailPayload = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

export async function sendBusinessApplicationEmail(
  payload: BusinessAppEmailPayload
): Promise<{ sent: boolean; reason?: string }> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim() || process.env.RESEND_FROM?.trim();

  if (!apiKey || !from) {
    if (process.env.NODE_ENV !== "production") {
      console.info("[business-application email skipped]", payload.subject, "→", payload.to);
    }
    return { sent: false, reason: "Email provider not configured (RESEND_API_KEY / EMAIL_FROM)." };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from,
        to: [payload.to],
        subject: payload.subject,
        text: payload.text,
        html: payload.html ?? `<pre style="font-family:sans-serif">${escapeHtml(payload.text)}</pre>`
      })
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error("[business-application email]", res.status, body);
      return { sent: false, reason: `Email API ${res.status}` };
    }
    return { sent: true };
  } catch (err) {
    console.error("[business-application email]", err);
    return { sent: false, reason: err instanceof Error ? err.message : "Email failed" };
  }
}

function escapeHtml(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function buildSubmissionEmail(input: {
  applicantName: string;
  businessName: string;
  applicationNumber: string;
  submittedAt: string;
  wholesaleRequested: boolean;
  taxRequested: boolean;
  wholesaleStatus: string;
  taxStatus: string;
  statusUrl: string;
  supportEmail?: string;
}): BusinessAppEmailPayload {
  const typeLabel =
    input.wholesaleRequested && input.taxRequested
      ? "Wholesale pricing and resale tax exemption"
      : input.wholesaleRequested
        ? "Wholesale pricing"
        : "Resale tax exemption";

  const text = [
    `Hello ${input.applicantName},`,
    ``,
    `We received your business application.`,
    ``,
    `Application number: ${input.applicationNumber}`,
    `Business: ${input.businessName}`,
    `Submitted: ${input.submittedAt}`,
    `Application type: ${typeLabel}`,
    `Wholesale status: ${input.wholesaleStatus}`,
    `Tax exemption status: ${input.taxStatus}`,
    ``,
    `Our team typically reviews applications within 2–5 business days.`,
    `You can check status any time: ${input.statusUrl}`,
    ``,
    `We will email you when a decision is made or if we need more information.`,
    input.supportEmail ? `Questions? Contact ${input.supportEmail}` : "",
    ``,
    `— Vinameals`
  ]
    .filter(Boolean)
    .join("\n");

  return {
    to: "", // filled by caller
    subject: "We received your business application",
    text
  };
}

export function buildDecisionEmail(input: {
  applicantName: string;
  businessName: string;
  applicationNumber: string;
  track: "wholesale" | "tax_exemption";
  decision: string;
  reason?: string | null;
  statusUrl: string;
}): BusinessAppEmailPayload {
  const trackLabel = input.track === "wholesale" ? "Wholesale pricing" : "Tax exemption";
  const text = [
    `Hello ${input.applicantName},`,
    ``,
    `An update on application ${input.applicationNumber} (${input.businessName}):`,
    ``,
    `${trackLabel}: ${input.decision}`,
    input.reason ? `Note: ${input.reason}` : "",
    ``,
    `View details: ${input.statusUrl}`,
    ``,
    `— Vinameals`
  ]
    .filter(Boolean)
    .join("\n");

  return {
    to: "",
    subject: `${trackLabel} update — ${input.applicationNumber}`,
    text
  };
}

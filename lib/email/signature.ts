import "server-only";

// Dựng thân thư gửi đi = nội dung + chữ ký cá nhân + dòng xác nhận người gửi.
//
// HAI PHẦN KHÁC NHAU, đừng nhầm:
//
//   1. Chữ ký cá nhân (profiles.email_signature) — nhân viên TỰ soạn và sửa
//      được: chức danh, số điện thoại, lời chào cuối thư.
//
//   2. Dòng "Sent by <họ tên>" — server chèn, lấy từ phiên đăng nhập
//      (getViewer()). KHÔNG có tham số nào cho phép truyền tên vào, nên không
//      form nào giả mạo được. Đây là thứ trả lời câu hỏi "thư này ai gửi".
//
// Vì lý do (2), hàm này chỉ nhận `Viewer` — không nhận chuỗi tên rời.

import type { Viewer } from "@/lib/auth";

/** Tên hiển thị của nhân viên; lùi về email nếu profile chưa có họ tên. */
export function senderDisplayName(viewer: Viewer) {
  const name = viewer.fullName?.trim();
  if (name) return name;
  return viewer.email.split("@")[0] || "Vinameals staff";
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function paragraphs(text: string) {
  return text
    .trim()
    .split(/\n{2,}/)
    .map((block) => `<p style="margin:0 0 12px">${escapeHtml(block).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

export type OutboundBody = {
  text: string;
  html: string;
  /** Tên đã dùng cho dòng xác nhận — ghi vào email_messages.sent_by_name. */
  sentByName: string;
};

/**
 * Ghép thân thư hoàn chỉnh.
 *
 * @param body        nội dung nhân viên gõ (plain text)
 * @param viewer      phiên đăng nhập ở server — nguồn duy nhất của tên người gửi
 * @param signature   chữ ký cá nhân đã lưu (profiles.email_signature), có thể null
 * @param htmlBody    nội dung HTML dựng sẵn (vd. bảng invoice); nếu có thì dùng
 *                    thay cho `body` ở bản HTML, `body` vẫn dùng cho bản text
 */
export function buildOutboundBody(input: {
  body: string;
  viewer: Viewer;
  signature?: string | null;
  htmlBody?: string | null;
}): OutboundBody {
  const sentByName = senderDisplayName(input.viewer);
  const signature = input.signature?.trim() || "";

  const textParts = [input.body.trim()];
  if (signature) textParts.push(signature);
  // Dòng xác nhận luôn ở cuối cùng, luôn có mặt.
  textParts.push(`Sent by ${sentByName} — Vinameals`);

  const htmlParts = [input.htmlBody?.trim() || paragraphs(input.body)];
  if (signature) {
    htmlParts.push(
      `<p style="margin:16px 0 0;color:#444">${escapeHtml(signature).replace(/\n/g, "<br>")}</p>`
    );
  }
  htmlParts.push(
    `<p style="margin:16px 0 0;padding-top:12px;border-top:1px solid #e3e8e4;color:#6b7280;font-size:12px">` +
      `Sent by ${escapeHtml(sentByName)} — Vinameals</p>`
  );

  return {
    text: textParts.join("\n\n"),
    html: `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:14px;line-height:1.6;color:#111">${htmlParts.join(
      ""
    )}</div>`,
    sentByName
  };
}

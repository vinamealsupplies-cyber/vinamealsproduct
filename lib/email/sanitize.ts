// Làm sạch HTML của thư ĐẾN trước khi hiển thị trong admin.
//
// Thư đến là dữ liệu do người lạ gửi — bất kỳ ai biết địa chỉ support@ đều gửi
// được. Render thẳng HTML đó là lỗ hổng XSS ngay giữa khu admin, nơi người dùng
// đang có phiên đăng nhập quyền cao.
//
// Chiến lược PHÒNG THỦ HAI LỚP:
//   1. Hàm này bóc bỏ script/style/iframe/handler on*/javascript: URL.
//   2. Kết quả vẫn được render trong <iframe sandbox> KHÔNG có allow-scripts
//      (xem components/email-body-frame.tsx). Kể cả lớp 1 sót thì lớp 2 vẫn
//      chặn thực thi.
// Cố ý không dùng allowlist thẻ đầy đủ kiểu DOMPurify: thêm một dependency nặng
// chỉ để làm lớp thứ nhất là không đáng, khi lớp thứ hai mới là lớp quyết định.

const BLOCK_ELEMENTS = ["script", "style", "iframe", "object", "embed", "link", "meta", "base", "form"];

export function sanitizeEmailHtml(raw: string | null | undefined): string {
  if (!raw) return "";

  let html = raw;

  // Bỏ toàn bộ cặp thẻ nguy hiểm kèm nội dung bên trong.
  for (const tag of BLOCK_ELEMENTS) {
    html = html.replace(new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?</${tag}\\s*>`, "gi"), "");
    // Thẻ tự đóng / không có thẻ đóng (vd <link>, <meta>, <base>).
    html = html.replace(new RegExp(`<${tag}\\b[^>]*/?>`, "gi"), "");
  }

  // Handler inline: onclick=, onerror=, onload=… ở cả 3 kiểu trích dẫn.
  html = html.replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, "");
  html = html.replace(/\son[a-z]+\s*=\s*'[^']*'/gi, "");
  html = html.replace(/\son[a-z]+\s*=\s*[^\s>]+/gi, "");

  // URL thực thi được trong href/src/action.
  html = html.replace(
    /\s(href|src|action)\s*=\s*("|')?\s*(javascript|data|vbscript):[^"'>\s]*("|')?/gi,
    ' $1="#"'
  );

  // srcdoc nhồi HTML lồng nhau.
  html = html.replace(/\ssrcdoc\s*=\s*"[^"]*"/gi, "");
  html = html.replace(/\ssrcdoc\s*=\s*'[^']*'/gi, "");

  return html.trim();
}

/**
 * Thân thư dạng text -> HTML an toàn để hiển thị.
 * Dùng khi thư chỉ có text/plain, hoặc khi muốn xem bản text cho chắc.
 */
export function textToSafeHtml(raw: string | null | undefined): string {
  if (!raw) return "";
  const escaped = raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
  return `<pre style="white-space:pre-wrap;word-break:break-word;margin:0;font:inherit">${escaped}</pre>`;
}

/** Đoạn xem trước trong danh sách thread — luôn là text thuần, không HTML. */
export function buildPreview(text: string | null, html: string | null, max = 140) {
  const source = text?.trim() || stripTags(html ?? "");
  const flat = source.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max)}…` : flat;
}

function stripTags(html: string) {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

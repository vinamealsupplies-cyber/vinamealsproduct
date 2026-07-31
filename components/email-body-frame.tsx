"use client";

import { useMemo } from "react";

/**
 * Hiển thị thân thư trong iframe SANDBOX.
 *
 * Đây là lớp phòng thủ THỨ HAI (lớp thứ nhất là sanitizeEmailHtml ở server).
 * Thuộc tính `sandbox` để rỗng nghĩa là bật toàn bộ hạn chế: không script,
 * không form, không popup, không cùng origin. Kể cả sanitize sót một handler
 * thì trong iframe này nó cũng không chạy được, và không đọc được cookie hay
 * DOM của khu admin.
 *
 * KHÔNG được thêm `allow-scripts` hay `allow-same-origin` vào đây — chỉ cần một
 * trong hai là mất tác dụng bảo vệ; có cả hai thì iframe tự tháo được sandbox.
 */
export function EmailBodyFrame({ html, title }: { html: string; title: string }) {
  const srcDoc = useMemo(
    () =>
      `<!doctype html><html><head><meta charset="utf-8">` +
      `<meta name="viewport" content="width=device-width,initial-scale=1">` +
      `<base target="_blank">` +
      `<style>
         body{margin:0;padding:4px 2px;font:14px/1.6 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#111;word-break:break-word}
         img{max-width:100%;height:auto}
         table{max-width:100%}
         a{color:#0b6b3a}
         blockquote{margin:8px 0;padding-left:12px;border-left:3px solid #dfe6e0;color:#555}
       </style></head><body>${html}</body></html>`,
    [html]
  );

  return (
    <iframe
      className="email-body-frame"
      title={title}
      sandbox=""
      srcDoc={srcDoc}
      // Ảnh từ domain lạ bị CSP của trang chặn — đó là chủ ý, nó cũng chặn luôn
      // pixel theo dõi của người gửi.
      referrerPolicy="no-referrer"
    />
  );
}

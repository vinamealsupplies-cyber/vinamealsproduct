import type { NextConfig } from "next";

// Nguồn ngoài mà trang thực sự cần: Supabase (auth/data) và media Cloudflare.
const supabaseOrigin = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const r2Origin = (() => {
  try {
    return process.env.R2_PUBLIC_BASE_URL ? new URL(process.env.R2_PUBLIC_BASE_URL).origin : "";
  } catch {
    return "";
  }
})();
const isDev = process.env.NODE_ENV !== "production";

// CSP: Next.js chèn script/style nội tuyến khi hydrate nên phải cho phép
// 'unsafe-inline' (muốn bỏ hẳn thì cần hạ tầng nonce, làm sau). Dev cần thêm
// 'unsafe-eval' cho HMR của Turbopack và websocket cho fast refresh.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: https://*.r2.dev https://*.cloudflarestream.com${r2Origin ? ` ${r2Origin}` : ""}`,
  "media-src 'self' blob: https://*.cloudflarestream.com",
  "font-src 'self' data:",
  `connect-src 'self'${supabaseOrigin ? ` ${supabaseOrigin} ${supabaseOrigin.replace(/^https:/, "wss:")}` : ""} https://*.r2.cloudflarestorage.com https://*.cloudflarestream.com${isDev ? " ws: http://localhost:*" : ""}`,
  "frame-ancestors 'none'",
  "frame-src 'self' https://*.cloudflarestream.com",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  ...(isDev ? [] : ["upgrade-insecure-requests"])
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  // Khu admin không được phép nhúng trong iframe (chống clickjacking).
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  // Trình duyệt bỏ qua HSTS trên http nên để dev cũng không sao.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }
];

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.r2.dev" },
      { protocol: "https", hostname: "media.example.com" },
      { protocol: "https", hostname: "**.cloudflarestream.com" }
    ]
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  }
};

export default nextConfig;

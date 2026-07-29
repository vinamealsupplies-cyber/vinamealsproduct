import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  // .open-next/** và .wrangler/** là output do adapter Cloudflare và wrangler
  // sinh ra — không lint code sinh tự động.
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    ".open-next/**",
    ".wrangler/**",
    // image/ chỉ chứa asset (logo) + tài liệu tham khảo tải về (trang HTML lưu
    // kèm _files/*.js) — không phải source, không lint.
    "image/**",
    "next-env.d.ts"
  ])
]);

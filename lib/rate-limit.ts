import "server-only";

import { headers } from "next/headers";

// Rate limiting cho các đường nhạy cảm (đăng nhập, đăng ký, mutation admin,
// cấp URL upload R2). SECURITY.md liệt kê đây là kiểm soát bắt buộc trước
// production nhưng trước đây chưa có gì.
//
// Hai tầng:
//  1. Rate Limiting binding của Cloudflare Workers (khai báo trong
//     wrangler.jsonc) — đếm phân tán ở biên, đúng nghĩa trên production.
//  2. Bộ đếm trong bộ nhớ tiến trình — dùng khi chạy `next dev` hoặc khi
//     binding chưa sẵn sàng. Trên Workers mỗi isolate có bộ nhớ riêng nên
//     tầng này chỉ là lưới an toàn, không thay thế tầng 1.

export type RateLimitRule = {
  /** Tên binding trong wrangler.jsonc. */
  binding: "RL_AUTH" | "RL_MUTATION" | "RL_UPLOAD";
  /** Số lượt tối đa trong `windowSeconds` (dùng cho tầng bộ nhớ). */
  limit: number;
  windowSeconds: number;
};

export const RATE_LIMITS = {
  auth: { binding: "RL_AUTH", limit: 8, windowSeconds: 60 },
  mutation: { binding: "RL_MUTATION", limit: 30, windowSeconds: 60 },
  upload: { binding: "RL_UPLOAD", limit: 20, windowSeconds: 60 }
} as const satisfies Record<string, RateLimitRule>;

type CloudflareRateLimiter = { limit: (options: { key: string }) => Promise<{ success: boolean }> };

const memoryHits = new Map<string, number[]>();

function checkMemory(key: string, rule: RateLimitRule) {
  const now = Date.now();
  const windowStart = now - rule.windowSeconds * 1000;
  const hits = (memoryHits.get(key) ?? []).filter((time) => time > windowStart);
  hits.push(now);
  memoryHits.set(key, hits);

  // Dọn rác định kỳ để Map không phình vô hạn.
  if (memoryHits.size > 5000) {
    for (const [existingKey, times] of memoryHits) {
      if (!times.some((time) => time > windowStart)) memoryHits.delete(existingKey);
    }
  }

  return hits.length <= rule.limit;
}

async function checkCloudflare(key: string, rule: RateLimitRule) {
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const context = await getCloudflareContext({ async: true });
    const limiter = (context?.env as Record<string, unknown> | undefined)?.[rule.binding] as
      | CloudflareRateLimiter
      | undefined;
    if (!limiter?.limit) return null; // Không có binding → để tầng bộ nhớ quyết định.
    const { success } = await limiter.limit({ key });
    return success;
  } catch {
    return null; // Ngoài Workers (next dev) hoặc binding lỗi.
  }
}

/** Định danh người gọi: ưu tiên IP thật do Cloudflare gắn. */
export async function callerKey(scope: string, extra?: string) {
  const h = await headers();
  const ip =
    h.get("cf-connecting-ip") ??
    h.get("x-real-ip") ??
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown";
  return extra ? `${scope}:${ip}:${extra}` : `${scope}:${ip}`;
}

/** true = còn hạn mức, false = vượt hạn mức (chặn). */
export async function checkRateLimit(key: string, rule: RateLimitRule) {
  const edge = await checkCloudflare(key, rule);
  const memory = checkMemory(key, rule);
  return edge === null ? memory : edge && memory;
}

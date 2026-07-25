"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/env";
import { callerKey, checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";

// Origin dùng để dựng link xác nhận trong email đăng ký.
//
// BẢO MẬT: host lấy từ header của request (x-forwarded-host/host) là dữ liệu
// do client gửi lên. Nếu tin tuyệt đối, kẻ tấn công có thể đăng ký hộ email
// nạn nhân kèm `X-Forwarded-Host: evil.test`; email xác nhận (gửi từ Supabase
// thật) sẽ chứa link trỏ về domain của hắn, nạn nhân bấm vào là lộ token_hash
// → chiếm tài khoản. Vì vậy chỉ chấp nhận host nằm trong allowlist, còn lại
// rơi về origin cấu hình sẵn.
const ALLOWED_HOSTS = new Set([
  "vinamealsupplies.com",
  "www.vinamealsupplies.com",
  "vinamealsproduct.vinameals.workers.dev"
]);

function isAllowedHost(host: string) {
  const bare = host.toLowerCase().split(":")[0];
  if (ALLOWED_HOSTS.has(host.toLowerCase()) || ALLOWED_HOSTS.has(bare)) return true;
  // Dev: localhost / 127.0.0.1 ở cổng bất kỳ, chỉ khi không phải production.
  return process.env.NODE_ENV !== "production" && (bare === "localhost" || bare === "127.0.0.1");
}

function fallbackOrigin() {
  return process.env.NEXT_PUBLIC_SITE_ORIGIN ?? "https://vinamealsupplies.com";
}

async function requestOrigin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (host && isAllowedHost(host)) {
    const bare = host.toLowerCase().split(":")[0];
    const isLocal = bare === "localhost" || bare === "127.0.0.1";
    const proto = isLocal ? (h.get("x-forwarded-proto") ?? "http") : "https";
    return `${proto}://${host}`;
  }
  return fallbackOrigin();
}

function destination(formData: FormData) {
  const next = String(formData.get("next") ?? "/account");
  return next.startsWith("/") && !next.startsWith("//") ? next : "/account";
}

function loginUrl(message: string, next: string) {
  const params = new URLSearchParams({ message, next });
  return `/login?${params.toString()}`;
}

const TOO_MANY_ATTEMPTS = "Too many attempts. Wait a minute and try again.";

export async function signIn(formData: FormData) {
  const next = destination(formData);
  if (!isSupabaseConfigured()) redirect(loginUrl("Connect Supabase before signing in. For the admin UI preview, set APP_DEMO_MODE=true locally.", next));
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  // Chặn dò mật khẩu / credential stuffing: giới hạn theo IP và theo email
  // (một IP đổi email liên tục, hoặc nhiều IP cùng đánh một tài khoản).
  const [ipOk, emailOk] = await Promise.all([
    checkRateLimit(await callerKey("signin"), RATE_LIMITS.auth),
    checkRateLimit(`signin:email:${email.toLowerCase()}`, RATE_LIMITS.auth)
  ]);
  if (!ipOk || !emailOk) redirect(loginUrl(TOO_MANY_ATTEMPTS, next));

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) redirect(loginUrl(error.message, next));
  redirect(next);
}

export async function signUp(formData: FormData) {
  const next = destination(formData);
  if (!isSupabaseConfigured()) redirect(loginUrl("Connect Supabase before creating an account.", next));
  const fullName = String(formData.get("fullName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  // Chặn spam đăng ký / bơm email xác nhận tới địa chỉ người khác.
  if (!(await checkRateLimit(await callerKey("signup"), RATE_LIMITS.auth))) {
    redirect(loginUrl(TOO_MANY_ATTEMPTS, next));
  }

  const supabase = await createClient();
  const origin = await requestOrigin();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
      emailRedirectTo: `${origin}/auth/confirm?next=${encodeURIComponent(next)}`
    }
  });
  if (error) redirect(loginUrl(error.message, next));
  redirect(loginUrl("Check your email to confirm your account.", next));
}

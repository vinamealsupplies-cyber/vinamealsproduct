import "server-only";

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured } from "@/lib/env";

/**
 * Supabase client gắn cookie vào một NextResponse cụ thể.
 * Dùng trong Route Handlers (OAuth start + callback): cookie PKCE/session
 * phải nằm trên response redirect, không chỉ cookies() của Next.
 */
export function createRouteHandlerClient(
  request: NextRequest,
  response: NextResponse
) {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured.");
  }

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        }
      }
    }
  );
}

export function safeNextPath(value: string | null | undefined, fallback = "/account") {
  if (!value) return fallback;
  return value.startsWith("/") && !value.startsWith("//") ? value : fallback;
}

export function requestPublicOrigin(request: NextRequest) {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "";
  const bare = host.toLowerCase().split(":")[0];
  const allowed = new Set([
    "vinamealsupplies.com",
    "www.vinamealsupplies.com",
    "vinamealsproduct.vinameals.workers.dev",
    "localhost",
    "127.0.0.1"
  ]);
  if (allowed.has(bare) || allowed.has(host.toLowerCase())) {
    const isLocal = bare === "localhost" || bare === "127.0.0.1";
    const proto = isLocal
      ? (request.headers.get("x-forwarded-proto") ?? "http")
      : "https";
    return `${proto}://${host}`;
  }
  return process.env.NEXT_PUBLIC_SITE_ORIGIN ?? "https://vinamealsupplies.com";
}

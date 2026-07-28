import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured } from "@/lib/env";
import { requestPublicOrigin, safeNextPath } from "@/lib/supabase/route";

type OAuthProvider = "google" | "apple";

type CookieToSet = {
  name: string;
  value: string;
  options?: Parameters<NextResponse["cookies"]["set"]>[2];
};

/**
 * Bắt đầu OAuth (Google/Apple).
 * GET /auth/oauth?provider=google&next=/account
 *
 * Route Handler ghi cookie PKCE vào response redirect (Server Action dễ mất
 * cookie trên Workers/OpenNext).
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const provider = searchParams.get("provider") as OAuthProvider | null;
  const next = safeNextPath(searchParams.get("next"));
  const origin = requestPublicOrigin(request);

  if (provider !== "google" && provider !== "apple") {
    return NextResponse.redirect(
      `${origin}/login?message=${encodeURIComponent("Unknown sign-in provider.")}&next=${encodeURIComponent(next)}`
    );
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.redirect(
      `${origin}/login?message=${encodeURIComponent("Supabase is not configured.")}&next=${encodeURIComponent(next)}`
    );
  }

  const redirectTo = `${origin}/auth/callback?next=${encodeURIComponent(next)}`;
  const cookieJar: CookieToSet[] = [];

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieJar.push({ name, value, options });
          });
        }
      }
    }
  );

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo,
      scopes: provider === "apple" ? "name email" : undefined,
      queryParams: provider === "google" ? { prompt: "select_account" } : undefined
    }
  });

  if (error) {
    const message = /provider is not enabled|Unsupported provider/i.test(error.message)
      ? `${provider === "google" ? "Google" : "Apple"} sign-in is not enabled yet. In Supabase Dashboard → Authentication → Providers, enable ${provider === "google" ? "Google" : "Apple"} and add Client ID + Client Secret.`
      : error.message;
    return NextResponse.redirect(
      `${origin}/login?message=${encodeURIComponent(message)}&next=${encodeURIComponent(next)}`
    );
  }

  if (!data.url) {
    return NextResponse.redirect(
      `${origin}/login?message=${encodeURIComponent(
        `${provider === "google" ? "Google" : "Apple"} sign-in is not available. Check that the provider is enabled in Supabase.`
      )}&next=${encodeURIComponent(next)}`
    );
  }

  const response = NextResponse.redirect(data.url);
  for (const cookie of cookieJar) {
    response.cookies.set(cookie.name, cookie.value, cookie.options);
  }
  return response;
}

import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { isSupabaseConfigured } from "@/lib/env";
import { requestPublicOrigin, safeNextPath } from "@/lib/supabase/route";

/**
 * OAuth callback (Google / Apple).
 * Supabase redirect về đây với ?code=… → exchangeCodeForSession (PKCE).
 * Session cookies PHẢI gắn vào response redirect (không tạo redirect mới sau).
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const origin = requestPublicOrigin(request);
  const code = url.searchParams.get("code");
  const oauthError =
    url.searchParams.get("error_description") ?? url.searchParams.get("error");
  const next = safeNextPath(url.searchParams.get("next"));

  if (oauthError) {
    return NextResponse.redirect(
      `${origin}/login?message=${encodeURIComponent(oauthError)}&next=${encodeURIComponent(next)}`
    );
  }

  if (!code) {
    return NextResponse.redirect(
      `${origin}/login?message=${encodeURIComponent("Missing sign-in code. Try again.")}&next=${encodeURIComponent(next)}`
    );
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.redirect(
      `${origin}/login?message=${encodeURIComponent("Supabase is not configured.")}&next=${encodeURIComponent(next)}`
    );
  }

  // Response cuối cùng: redirect về app + cookie session.
  const response = NextResponse.redirect(`${origin}${next}`);
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
            response.cookies.set(name, value, options);
          });
        }
      }
    }
  );

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(
      `${origin}/login?message=${encodeURIComponent(error.message)}&next=${encodeURIComponent(next)}`
    );
  }

  return response;
}

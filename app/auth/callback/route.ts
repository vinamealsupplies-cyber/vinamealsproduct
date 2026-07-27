import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";

/**
 * OAuth callback (Google / Apple).
 * Supabase redirect về đây với ?code=… → exchangeCodeForSession (PKCE cookies).
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const oauthError = searchParams.get("error_description") ?? searchParams.get("error");
  const requestedNext = searchParams.get("next") ?? "/account";
  const next =
    requestedNext.startsWith("/") && !requestedNext.startsWith("//") ? requestedNext : "/account";

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

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(
      `${origin}/login?message=${encodeURIComponent(error.message)}&next=${encodeURIComponent(next)}`
    );
  }

  return NextResponse.redirect(`${origin}${next}`);
}

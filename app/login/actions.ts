"use server";

import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

function destination(formData: FormData) {
  const next = String(formData.get("next") ?? "/account");
  return next.startsWith("/") && !next.startsWith("//") ? next : "/account";
}

function loginUrl(message: string, next: string) {
  const params = new URLSearchParams({ message, next });
  return `/login?${params.toString()}`;
}

export async function signIn(formData: FormData) {
  const next = destination(formData);
  if (!isSupabaseConfigured()) redirect(loginUrl("Connect Supabase before signing in. For the admin UI preview, set APP_DEMO_MODE=true locally.", next));
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
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
  const supabase = await createClient();
  const origin = process.env.NEXT_PUBLIC_SITE_ORIGIN ?? "http://localhost:3000";
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

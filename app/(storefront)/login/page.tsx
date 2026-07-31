import type { Metadata } from "next";
import { KeyRound, ShieldCheck, UserPlus } from "lucide-react";
import { OAuthButtons } from "@/components/oauth-buttons";
import { signIn, signUp } from "./actions";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams
}: {
  searchParams: Promise<{ message?: string; next?: string }>;
}) {
  const params = await searchParams;
  const next = params.next ?? "/account";
  return (
    <div className="page-shell shell auth-page">
      <div className="auth-intro">
        <span className="kicker">
          <ShieldCheck size={16} /> One account, two experiences
        </span>
        <h1>Welcome to Vinameals.</h1>
        <p>
          Customers see account history and business details. Authorized staff also see the Admin link in the top
          navigation.
        </p>
      </div>
      <div className="auth-forms">
        {params.message ? (
          <div className="auth-message" role="status">
            {params.message}
          </div>
        ) : null}

        <section className="auth-card auth-card-wide">
          <div className="auth-card-icon">
            <KeyRound />
          </div>
          <h2>Continue with a provider</h2>
          <p>Use Google to sign in or create an account in one step.</p>
          <OAuthButtons next={next} />
        </section>

        <section className="auth-card">
          <div className="auth-card-icon">
            <KeyRound />
          </div>
          <h2>Sign in with email</h2>
          <p>Use your customer or staff account.</p>
          <form action={signIn}>
            <input type="hidden" name="next" value={next} />
            <label>
              Email address
              <input required type="email" name="email" autoComplete="email" />
            </label>
            <label>
              Password
              <input required type="password" name="password" autoComplete="current-password" />
            </label>
            <button className="button primary full" type="submit">
              Sign in
            </button>
          </form>
        </section>

        <section className="auth-card secondary-auth-card">
          <div className="auth-card-icon">
            <UserPlus />
          </div>
          <h2>Create an account</h2>
          <p>Or start with email as a retail customer. Business status can be reviewed separately.</p>
          <form action={signUp}>
            <input type="hidden" name="next" value={next} />
            <label>
              Full name
              <input required name="fullName" autoComplete="name" />
            </label>
            <label>
              Email address
              <input required type="email" name="email" autoComplete="email" />
            </label>
            <label>
              Password
              <input required type="password" name="password" minLength={8} autoComplete="new-password" />
            </label>
            <button className="button secondary full" type="submit">
              Create account
            </button>
          </form>
          <OAuthButtons next={next} />
        </section>
      </div>
    </div>
  );
}

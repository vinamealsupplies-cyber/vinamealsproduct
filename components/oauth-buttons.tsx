import { signInWithApple, signInWithGoogle } from "@/app/login/actions";

/** Nút đăng nhập Google / Apple — dùng chung Sign in và Create account. */
export function OAuthButtons({ next }: { next: string }) {
  return (
    <div className="oauth-block">
      <p className="oauth-divider">
        <span>Or continue with</span>
      </p>
      <div className="oauth-buttons">
        <form action={signInWithGoogle}>
          <input type="hidden" name="next" value={next} />
          <button className="button oauth-button oauth-google" type="submit">
            <GoogleIcon />
            Google
          </button>
        </form>
        <form action={signInWithApple}>
          <input type="hidden" name="next" value={next} />
          <button className="button oauth-button oauth-apple" type="submit">
            <AppleIcon />
            Apple
          </button>
        </form>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 3l5.7-5.7C34.2 6.1 29.4 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.5-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 16 19 12 24 12c3.1 0 5.8 1.1 8 3l5.7-5.7C34.2 6.1 29.4 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 10-2 13.5-5.2l-6.2-5.2C29.3 35.3 26.8 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-1.1 3.1-3.6 5.5-6.5 6.6l.1.1 6.2 5.2C36.9 41.1 44 36 44 24c0-1.3-.1-2.5-.4-3.5z"
      />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M16.4 12.7c0-2.1 1.7-3.1 1.8-3.2-1-1.4-2.5-1.6-3-1.7-1.3-.1-2.5.8-3.1.8s-1.6-.7-2.7-.7c-1.4 0-2.7.8-3.4 2.1-1.5 2.5-.4 6.3 1 8.4.7 1 1.5 2.2 2.6 2.1 1 0 1.4-.7 2.7-.7s1.6.7 2.7.7 1.8-1 2.5-2c.8-1.1 1.1-2.2 1.1-2.3-.1 0-2.1-.8-2.2-3.3zM14.5 5.6c.6-.7 1-1.7.9-2.6-.8 0-1.9.6-2.5 1.2-.5.6-1 1.6-.9 2.5 1 .1 1.9-.5 2.5-1.1z" />
    </svg>
  );
}

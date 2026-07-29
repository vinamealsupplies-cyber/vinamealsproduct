"use client";

import { useEffect } from "react";
import {
  isSiteOverloadedError,
  SITE_OVERLOADED_MESSAGE,
  toUserFacingError
} from "@/lib/user-facing-error";

/** Root-level error UI (must include html/body). */
export default function GlobalError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const overloaded = isSiteOverloadedError(error);
  const message = overloaded
    ? SITE_OVERLOADED_MESSAGE
    : toUserFacingError(error, "Something went wrong. Please try again.");

  useEffect(() => {
    console.error("[global-error]", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          padding: 24,
          fontFamily: "system-ui, sans-serif",
          background: "#f7f3eb",
          color: "#1a2e24"
        }}
      >
        <main
          style={{
            width: "min(440px, 100%)",
            padding: "28px 26px",
            borderRadius: 20,
            border: "1px solid #d8e3dc",
            background: "#fff",
            textAlign: "center"
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              margin: "0 auto 14px",
              borderRadius: 999,
              background: "#fdecea",
              color: "#c62828",
              display: "grid",
              placeItems: "center",
              fontWeight: 800,
              fontSize: 22
            }}
            aria-hidden="true"
          >
            !
          </div>
          <h1 style={{ margin: "0 0 10px", fontSize: "1.4rem" }}>
            {overloaded ? "Website overloaded" : "Something went wrong"}
          </h1>
          <p style={{ margin: "0 0 18px", color: "#5c6b63", lineHeight: 1.5 }}>{message}</p>
          <button
            type="button"
            onClick={reset}
            style={{
              minHeight: 44,
              padding: "0 18px",
              border: 0,
              borderRadius: 12,
              background: "#2f6b4f",
              color: "#fff",
              fontWeight: 700,
              cursor: "pointer"
            }}
          >
            Try again
          </button>
          <p style={{ marginTop: 14 }}>
            {/* global-error thay CẢ root layout — router context có thể đã hỏng,
                nên điều hướng bằng <a> (full reload) thay vì next/link. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a href="/" style={{ color: "#2f6b4f", fontWeight: 700 }}>
              Back to home
            </a>
          </p>
        </main>
      </body>
    </html>
  );
}

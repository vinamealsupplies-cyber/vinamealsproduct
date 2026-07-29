"use client";

import { useEffect } from "react";
import Link from "next/link";
import {
  isSiteOverloadedError,
  SITE_OVERLOADED_MESSAGE,
  toUserFacingError
} from "@/lib/user-facing-error";

export default function AppError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const overloaded = isSiteOverloadedError(error);
  const message = overloaded
    ? SITE_OVERLOADED_MESSAGE
    : toUserFacingError(error, "Something went wrong while loading this page.");

  useEffect(() => {
    // Keep technical detail in console for debugging only.
    console.error("[app/error]", error);
  }, [error]);

  return (
    <div className="page-shell shell narrow-page">
      <div className="empty-state large overload-state">
        <div className="overload-badge" aria-hidden="true">
          !
        </div>
        <h1>{overloaded ? "Website overloaded" : "Something went wrong"}</h1>
        <p>{message}</p>
        <div className="checkout-actions-row">
          <button className="button primary" type="button" onClick={reset}>
            Try again
          </button>
          <Link className="button secondary" href="/">
            Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}

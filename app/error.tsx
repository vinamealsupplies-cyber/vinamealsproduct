"use client";

import { useEffect } from "react";
import Link from "next/link";
import {
  isSiteOverloadedError,
  isStaleDeployError,
  SITE_OVERLOADED_MESSAGE,
  STALE_DEPLOY_MESSAGE,
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
  const stale = !overloaded && isStaleDeployError(error);
  const message = overloaded
    ? SITE_OVERLOADED_MESSAGE
    : stale
      ? STALE_DEPLOY_MESSAGE
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
        <h1>
          {overloaded ? "Website overloaded" : stale ? "Page out of date" : "Something went wrong"}
        </h1>
        <p>{message}</p>
        <div className="checkout-actions-row">
          {stale ? (
            <button
              className="button primary"
              type="button"
              onClick={() => window.location.reload()}
            >
              Refresh page
            </button>
          ) : (
            <button className="button primary" type="button" onClick={reset}>
              Try again
            </button>
          )}
          <Link className="button secondary" href="/">
            Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { BellRing, X } from "lucide-react";

// Admin toast: open business applications (and legacy tax apps) pending review.

const POLL_MS = 20000;
const SEEN_KEY = "vinameals-tax-exemption-seen";

type Summary = {
  pendingCount: number;
  latestId: string | null;
  latestBusinessName: string | null;
  href?: string;
};

export function TaxExemptionAlert() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [dismissedId, setDismissedId] = useState<string | null>(null);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    function readSeen() {
      try {
        return window.localStorage.getItem(SEEN_KEY);
      } catch {
        return null;
      }
    }

    async function poll() {
      try {
        const response = await fetch("/api/admin/tax-exemptions/pending", { cache: "no-store" });
        if (!response.ok) return;
        const body = (await response.json()) as { data?: Summary };
        if (!cancelled && body.data) {
          setDismissedId(readSeen());
          setSummary(body.data);
        }
      } catch {
        // ignore transient network errors
      }
    }

    void poll();
    timer.current = window.setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      if (timer.current) window.clearInterval(timer.current);
    };
  }, []);

  if (!summary || !summary.pendingCount || !summary.latestId) return null;
  if (summary.latestId === dismissedId) return null;

  function dismiss() {
    const id = summary?.latestId ?? null;
    setDismissedId(id);
    try {
      if (id) window.localStorage.setItem(SEEN_KEY, id);
    } catch {
      // ignore
    }
  }

  const href =
    summary.href ||
    (summary.latestId
      ? `/admin/business-applications/${summary.latestId}`
      : "/admin/business-applications");

  return (
    <div className="admin-toast" role="status" aria-live="polite">
      <BellRing size={19} aria-hidden="true" />
      <div>
        <strong>
          {summary.pendingCount} business application
          {summary.pendingCount === 1 ? "" : "s"} waiting
        </strong>
        {summary.latestBusinessName ? <span>Newest: {summary.latestBusinessName}</span> : null}
        <Link href={href} onClick={dismiss}>
          Review now
        </Link>
      </div>
      <button type="button" aria-label="Dismiss notification" onClick={dismiss}>
        <X size={16} />
      </button>
    </div>
  );
}

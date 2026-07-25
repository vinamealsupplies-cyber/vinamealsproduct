"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { BellRing, X } from "lucide-react";

// Popup báo có đơn miễn thuế mới trong khu admin.
//
// Hỏi định kỳ thay vì mở kênh realtime: chỉ cần một endpoint đã kiểm tra quyền
// staff, không phải phát khoá Supabase ra trình duyệt. Id đơn mới nhất đã xem
// lưu ở localStorage nên popup không hiện lại sau khi đã đóng.

const POLL_MS = 20000;
const SEEN_KEY = "vinameals-tax-exemption-seen";

type Summary = { pendingCount: number; latestId: string | null; latestBusinessName: string | null };

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
        // Trình duyệt chặn localStorage → popup vẫn chạy, chỉ hiện lại mỗi lần.
        return null;
      }
    }

    // setState nằm trong callback bất đồng bộ (không phải thân effect) nên
    // không gây cascading render — đúng với rule react-hooks/set-state-in-effect.
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
        // Mất mạng tạm thời thì bỏ qua, lần hỏi sau sẽ tự khớp lại.
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
      // Không lưu được thì thôi.
    }
  }

  return (
    <div className="admin-toast" role="status" aria-live="polite">
      <BellRing size={19} aria-hidden="true" />
      <div>
        <strong>
          {summary.pendingCount} tax exemption application{summary.pendingCount === 1 ? "" : "s"} waiting
        </strong>
        {summary.latestBusinessName ? <span>Newest: {summary.latestBusinessName}</span> : null}
        <Link href="/admin/tax-exemptions" onClick={dismiss}>
          Review now
        </Link>
      </div>
      <button type="button" aria-label="Dismiss notification" onClick={dismiss}>
        <X size={16} />
      </button>
    </div>
  );
}

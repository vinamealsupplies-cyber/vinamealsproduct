// Shared (server + client) — KHÔNG gắn "use client".
// Trang reports server import hàm này; picker client import type + resolve.

export type ReportPeriod = {
  preset: string;
  from: string; // YYYY-MM
  to: string; // YYYY-MM
  label: string;
};

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** Tháng hiện tại theo UTC (khớp view month_start). */
function utcMonthParts(date = new Date()) {
  return { y: date.getUTCFullYear(), m: date.getUTCMonth() + 1 };
}

export function monthValue(y: number, m: number) {
  return `${y}-${pad(m)}`;
}

export function shiftMonth(y: number, m: number, delta: number) {
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1 };
}

export function resolveReportPeriod(
  preset: string | null | undefined,
  fromParam: string | null | undefined,
  toParam: string | null | undefined
): ReportPeriod {
  const now = utcMonthParts();
  const key = (preset || "last-12").toLowerCase();

  const formatLabel = (from: string, to: string) => {
    const [fy, fm] = from.split("-").map(Number);
    const [ty, tm] = to.split("-").map(Number);
    const fromDate = new Date(Date.UTC(fy, fm - 1, 1));
    const toDate = new Date(Date.UTC(ty, tm - 1, 1));
    const fmt = new Intl.DateTimeFormat("en-US", {
      month: "short",
      year: "numeric",
      timeZone: "UTC"
    });
    if (from === to) return fmt.format(fromDate);
    return `${fmt.format(fromDate)} - ${fmt.format(toDate)}`;
  };

  let from = "";
  let to = monthValue(now.y, now.m);
  let resolvedPreset = key;

  switch (key) {
    case "this-month": {
      from = to;
      break;
    }
    case "last-3": {
      const s = shiftMonth(now.y, now.m, -2);
      from = monthValue(s.y, s.m);
      break;
    }
    case "last-6": {
      const s = shiftMonth(now.y, now.m, -5);
      from = monthValue(s.y, s.m);
      break;
    }
    case "ytd": {
      from = monthValue(now.y, 1);
      break;
    }
    case "custom": {
      resolvedPreset = "custom";
      const customFrom =
        fromParam && /^\d{4}-\d{2}/.test(fromParam) ? fromParam.slice(0, 7) : null;
      const customTo = toParam && /^\d{4}-\d{2}/.test(toParam) ? toParam.slice(0, 7) : null;
      const fallback = shiftMonth(now.y, now.m, -11);
      from = customFrom ?? monthValue(fallback.y, fallback.m);
      to = customTo ?? to;
      if (from > to) {
        const swap = from;
        from = to;
        to = swap;
      }
      break;
    }
    case "last-12":
    default: {
      resolvedPreset = "last-12";
      const s = shiftMonth(now.y, now.m, -11);
      from = monthValue(s.y, s.m);
      break;
    }
  }

  return {
    preset: resolvedPreset,
    from,
    to,
    label: formatLabel(from, to)
  };
}

export const REPORT_PERIOD_PRESETS: { id: string; label: string }[] = [
  { id: "this-month", label: "This month" },
  { id: "last-3", label: "Last 3 months" },
  { id: "last-6", label: "Last 6 months" },
  { id: "last-12", label: "Last 12 months" },
  { id: "ytd", label: "Year to date" },
  { id: "custom", label: "Custom" }
];

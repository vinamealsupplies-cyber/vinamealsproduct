"use client";

import { useRouter } from "next/navigation";
import { CalendarRange } from "lucide-react";

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

function monthValue(y: number, m: number) {
  return `${y}-${pad(m)}`;
}

function shiftMonth(y: number, m: number, delta: number) {
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
    const fmt = new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
    if (from === to) return fmt.format(fromDate);
    return `${fmt.format(fromDate)} – ${fmt.format(toDate)}`;
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
      // type=month values YYYY-MM
      const customFrom = fromParam && /^\d{4}-\d{2}/.test(fromParam) ? fromParam.slice(0, 7) : null;
      const customTo = toParam && /^\d{4}-\d{2}/.test(toParam) ? toParam.slice(0, 7) : null;
      from = customFrom ?? monthValue(shiftMonth(now.y, now.m, -11).y, shiftMonth(now.y, now.m, -11).m);
      to = customTo ?? to;
      if (from > to) [from, to] = [to, from];
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

const PRESETS: { id: string; label: string }[] = [
  { id: "this-month", label: "This month" },
  { id: "last-3", label: "Last 3 months" },
  { id: "last-6", label: "Last 6 months" },
  { id: "last-12", label: "Last 12 months" },
  { id: "ytd", label: "Year to date" },
  { id: "custom", label: "Custom" }
];

export function ReportPeriodPicker({ period }: { period: ReportPeriod }) {
  const router = useRouter();

  function applyPreset(preset: string) {
    if (preset === "custom") {
      const params = new URLSearchParams({
        preset: "custom",
        from: period.from,
        to: period.to
      });
      router.push(`/admin/reports?${params.toString()}`);
      return;
    }
    router.push(`/admin/reports?preset=${preset}`);
  }

  return (
    <div className="report-period-bar">
      <div className="report-period-label">
        <CalendarRange size={16} aria-hidden="true" />
        <strong>{period.label}</strong>
      </div>

      <div className="status-filter-tabs report-period-tabs" role="tablist" aria-label="Report period">
        {PRESETS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={period.preset === item.id}
            className={period.preset === item.id ? "active" : undefined}
            onClick={() => applyPreset(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {period.preset === "custom" ? (
        <form className="report-period-custom" method="get" action="/admin/reports">
          <input type="hidden" name="preset" value="custom" />
          <label>
            From
            <input type="month" name="from" defaultValue={period.from} required />
          </label>
          <label>
            To
            <input type="month" name="to" defaultValue={period.to} required />
          </label>
          <button className="button secondary" type="submit">
            Apply
          </button>
        </form>
      ) : null}
    </div>
  );
}

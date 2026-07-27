"use client";

import { useRouter } from "next/navigation";
import { CalendarRange } from "lucide-react";
import {
  REPORT_PERIOD_PRESETS,
  type ReportPeriod
} from "@/lib/data/report-period";

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
    router.push(`/admin/reports?preset=${encodeURIComponent(preset)}`);
  }

  return (
    <div className="report-period-bar">
      <div className="report-period-label">
        <CalendarRange size={16} aria-hidden="true" />
        <strong>{period.label}</strong>
      </div>

      <div className="status-filter-tabs report-period-tabs" role="tablist" aria-label="Report period">
        {REPORT_PERIOD_PRESETS.map((item) => (
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

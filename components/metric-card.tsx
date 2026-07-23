import { ArrowUpRight } from "lucide-react";

export function MetricCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <article className="metric-card">
      <div className="metric-label"><span>{label}</span><ArrowUpRight size={17} aria-hidden="true" /></div>
      <strong>{value}</strong>
      <p>{detail}</p>
    </article>
  );
}

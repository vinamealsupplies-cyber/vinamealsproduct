import { usd } from "@/lib/format";

type Point = { month: string; netSales: number; received: number; cogs: number; expenses: number };

export function PerformanceChart({ data }: { data: Point[] }) {
  const max = Math.max(...data.map((point) => point.netSales), 1);
  return (
    <div className="performance-chart" role="img" aria-label="Monthly net sales and amount received bar chart">
      <div className="chart-legend"><span><i className="legend-sales" />Net sales</span><span><i className="legend-received" />Amount received</span></div>
      <div className="chart-columns">
        {data.map((point) => (
          <div className="chart-column" key={point.month}>
            <div className="chart-bars">
              <div className="chart-bar sales" style={{ height: `${Math.max(8, point.netSales / max * 100)}%` }} title={`Net sales ${usd.format(point.netSales)}`} />
              <div className="chart-bar received" style={{ height: `${Math.max(8, point.received / max * 100)}%` }} title={`Received ${usd.format(point.received)}`} />
            </div>
            <strong title={point.month}>{point.month}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

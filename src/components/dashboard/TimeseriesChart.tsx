import { memo } from "react";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import type { ChartPoint } from "@/utils/stats";

export type TimeseriesChartProps = {
  data: ChartPoint[];
  color: string;
  label: string;
};

const formatTimestamp = (value: number) => {
  const date = new Date(value);
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
};

export const TimeseriesChart = memo(function TimeseriesChart({ data, color, label }: TimeseriesChartProps) {
  return (
    <div className="flex h-full flex-col gap-3 rounded-2xl border border-slate-200/60 bg-white/80 p-4 shadow-sm backdrop-blur">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-600">{label}</h3>
      </div>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} syncId="uptime-timeline" margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis
              dataKey="timestamp"
              type="number"
              domain={["auto", "auto"]}
              tickFormatter={(value) => new Date(value).toLocaleTimeString()}
              stroke="#94a3b8"
              tick={{ fontSize: 12 }}
            />
            <YAxis stroke="#94a3b8" tick={{ fontSize: 12 }} width={70} />
            <Tooltip
              contentStyle={{ backgroundColor: "rgba(15, 23, 42, 0.9)", borderRadius: 12, border: "none" }}
              labelFormatter={formatTimestamp}
              formatter={(_, __, item) => {
                const log = item?.payload?.log;
                if (!log) return ["", ""];
                return [
                  `${label}: ${item.value} ms` +
                    `\nStatus: ${log.http_status ?? "—"}` +
                    `\nTraffic: ${log.traffic_light}` +
                    `\nLatency: ${log.latency_ms ?? "—"}` +
                    `\nPing: ${log.ping_ms ?? "—"}` +
                    `\nSSL days: ${log.ssl_days_left ?? "—"}` +
                    `\nRedirects: ${log.redirects ?? "—"}` +
                    `\nDNS OK: ${log.dns_resolved ? "yes" : "no"}`,
                  "",
                ];
              }}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
});

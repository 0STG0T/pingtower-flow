import type { ChartPoint } from "@/utils/stats";
import { TimeseriesChart } from "./TimeseriesChart";

export type LatencyChartProps = {
  data: ChartPoint[];
};

export function LatencyChart({ data }: LatencyChartProps) {
  return <TimeseriesChart data={data} color="#0f172a" label="Latency" />;
}

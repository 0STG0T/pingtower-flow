import type { ChartPoint } from "@/utils/stats";
import { TimeseriesChart } from "./TimeseriesChart";

export type PingChartProps = {
  data: ChartPoint[];
};

export function PingChart({ data }: PingChartProps) {
  return <TimeseriesChart data={data} color="#2563eb" label="Ping" />;
}

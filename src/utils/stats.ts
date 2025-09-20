export type TrafficLight = "green" | "orange" | "red";

export type LogRecord = {
  timestamp: string;
  traffic_light: TrafficLight;
  http_status: number | null;
  latency_ms: number | null;
  ping_ms: number | null;
  ssl_days_left: number | null;
  dns_resolved: number | boolean | null;
  redirects: number | null;
  url?: string | null;
};

const asNumber = (value: number | null | undefined) =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

export function calcAvgLatency(logs: LogRecord[]): number | null {
  const values = logs
    .map((log) => asNumber(log.latency_ms))
    .filter((value): value is number => value !== null);

  if (values.length === 0) return null;

  const sum = values.reduce((acc, value) => acc + value, 0);
  return Math.round(sum / values.length);
}

export function calcAvgPing(logs: LogRecord[]): number | null {
  const values = logs
    .map((log) => asNumber(log.ping_ms))
    .filter((value): value is number => value !== null);

  if (values.length === 0) return null;

  const sum = values.reduce((acc, value) => acc + value, 0);
  return Math.round(sum / values.length);
}

export function calcUptime(logs: LogRecord[]): number | null {
  if (logs.length === 0) return null;

  const successful = logs.filter((log) => {
    if (log.http_status === null || log.http_status === undefined) return false;
    return log.http_status < 400;
  }).length;

  return Math.round((successful / logs.length) * 100);
}

export function minSslDays(logs: LogRecord[]): number | null {
  const values = logs
    .map((log) => asNumber(log.ssl_days_left))
    .filter((value): value is number => value !== null);

  if (values.length === 0) return null;

  return Math.min(...values);
}

export type TrafficLightAggregate = {
  green: number;
  orange: number;
  red: number;
};

export function aggregateTrafficLight(logs: LogRecord[]): TrafficLightAggregate {
  return logs.reduce<TrafficLightAggregate>(
    (acc, log) => {
      acc[log.traffic_light] += 1;
      return acc;
    },
    { green: 0, orange: 0, red: 0 },
  );
}

export function countIncidents(logs: LogRecord[]): number {
  return logs.filter((log) => log.traffic_light === "orange" || log.traffic_light === "red").length;
}

export function getSparklineSeries(
  logs: LogRecord[],
  field: "latency_ms" | "ping_ms",
): { timestamp: number; value: number }[] {
  return logs
    .map((log) => {
      const value = asNumber(log[field]);
      if (value === null) return null;
      return {
        timestamp: new Date(log.timestamp).getTime(),
        value,
      };
    })
    .filter((value): value is { timestamp: number; value: number } => value !== null);
}

export type ChartPoint = {
  timestamp: number;
  value: number;
  log: LogRecord;
};

export function buildTimeseries(
  logs: LogRecord[],
  field: "latency_ms" | "ping_ms",
  maxPoints = 3000,
): ChartPoint[] {
  const points: ChartPoint[] = [];

  const safeLogs = logs.filter((log) => asNumber(log[field]) !== null);
  if (safeLogs.length === 0) return points;

  const bucketSize = Math.max(1, Math.ceil(safeLogs.length / maxPoints));

  for (let i = 0; i < safeLogs.length; i += bucketSize) {
    const bucket = safeLogs.slice(i, i + bucketSize);
    const avgValue =
      bucket.reduce((sum, log) => sum + (asNumber(log[field]) ?? 0), 0) /
      bucket.length;
    const referenceLog = bucket[bucket.length - 1];
    points.push({
      timestamp: new Date(referenceLog.timestamp).getTime(),
      value: Number(avgValue.toFixed(2)),
      log: referenceLog,
    });
  }

  return points;
}

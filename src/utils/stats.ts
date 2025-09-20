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

export type TrafficLightAggregate = {
  green: number;
  orange: number;
  red: number;
};

export type AggregatedBucket = {
  timestamp: string;
  count: number;
  latency_avg: number | null;
  ping_avg: number | null;
  ssl_days_left_avg: number | null;
  dns_success_rate: number | null;
  traffic_light: TrafficLightAggregate;
};

export type AggregatedSummary = {
  latency_avg: number | null;
  ping_avg: number | null;
  ssl_days_left_avg: number | null;
  dns_success_rate: number | null;
  traffic_light: TrafficLightAggregate;
};

export type AggregatedDashboardResponse = {
  summary: AggregatedSummary;
  buckets: AggregatedBucket[];
};

const asNumber = (value: number | null | undefined) =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const toFixedNumber = (value: number, digits = 2) => Number(value.toFixed(digits));

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


export function calcDnsSuccessRate(logs: LogRecord[]): number | null {
  if (logs.length === 0) return null;

  const success = logs.filter((log) => {
    if (log.dns_resolved === null || log.dns_resolved === undefined) return false;
    if (typeof log.dns_resolved === "boolean") return log.dns_resolved;
    return Number(log.dns_resolved) === 1;
  }).length;

  return toFixedNumber((success / logs.length) * 100, 1);
}


export function aggregateTrafficLight(logs: LogRecord[]): TrafficLightAggregate {
  return logs.reduce<TrafficLightAggregate>(
    (acc, log) => {
      acc[log.traffic_light] += 1;
      return acc;
    },
    { green: 0, orange: 0, red: 0 },
  );
}


export function mergeTrafficLightAggregates(buckets: AggregatedBucket[]): TrafficLightAggregate {
  return buckets.reduce<TrafficLightAggregate>(
    (acc, bucket) => {
      acc.green += bucket.traffic_light.green;
      acc.orange += bucket.traffic_light.orange;
      acc.red += bucket.traffic_light.red;
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

export type ChartPoint<TMeta = unknown> = {
  timestamp: number;
  value: number;
  meta?: TMeta;

};

export function buildTimeseries(
  logs: LogRecord[],
  field: "latency_ms" | "ping_ms",
  maxPoints = 3000,
): ChartPoint<LogRecord>[] {
  const points: ChartPoint<LogRecord>[] = [];


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
      value: toFixedNumber(avgValue),
      meta: referenceLog,

    });
  }

  return points;
}

type AggregatedField = keyof Pick<
  AggregatedBucket,
  "latency_avg" | "ping_avg" | "ssl_days_left_avg" | "dns_success_rate"
>;

export function buildAggregatedTimeseries(
  buckets: AggregatedBucket[],
  field: AggregatedField,
): ChartPoint<AggregatedBucket>[] {
  return buckets
    .map((bucket) => {
      const rawValue = bucket[field];
      if (typeof rawValue !== "number" || !Number.isFinite(rawValue)) return null;
      return {
        timestamp: new Date(bucket.timestamp).getTime(),
        value: toFixedNumber(rawValue),
        meta: bucket,
      } satisfies ChartPoint<AggregatedBucket>;
    })
    .filter((value): value is ChartPoint<AggregatedBucket> => value !== null);
}

export type TrafficLightTimeseriesPoint = {
  timestamp: number;
  green: number;
  orange: number;
  red: number;
  total: number;
};

export function buildTrafficLightTimeseries(buckets: AggregatedBucket[]): TrafficLightTimeseriesPoint[] {
  return buckets.map((bucket) => {
    const green = bucket.traffic_light.green ?? 0;
    const orange = bucket.traffic_light.orange ?? 0;
    const red = bucket.traffic_light.red ?? 0;
    const total = green + orange + red;
    return {
      timestamp: new Date(bucket.timestamp).getTime(),
      green,
      orange,
      red,
      total,
    } satisfies TrafficLightTimeseriesPoint;
  });
}

export function summarizeAggregatedBuckets(
  buckets: AggregatedBucket[],
): AggregatedSummary {
  if (buckets.length === 0) {
    return {
      latency_avg: null,
      ping_avg: null,
      ssl_days_left_avg: null,
      dns_success_rate: null,
      traffic_light: { green: 0, orange: 0, red: 0 },
    } satisfies AggregatedSummary;
  }

  const totals = buckets.reduce(
    (acc, bucket) => {
      const count = bucket.count || 0;
      acc.count += count;
      acc.latency += (bucket.latency_avg ?? 0) * count;
      acc.ping += (bucket.ping_avg ?? 0) * count;
      acc.ssl += (bucket.ssl_days_left_avg ?? 0) * count;
      acc.dns += (bucket.dns_success_rate ?? 0) * count;
      acc.traffic.green += bucket.traffic_light.green;
      acc.traffic.orange += bucket.traffic_light.orange;
      acc.traffic.red += bucket.traffic_light.red;
      return acc;
    },
    {
      count: 0,
      latency: 0,
      ping: 0,
      ssl: 0,
      dns: 0,
      traffic: { green: 0, orange: 0, red: 0 },
    },
  );

  const safeCount = Math.max(1, totals.count);

  return {
    latency_avg: totals.count === 0 ? null : toFixedNumber(totals.latency / safeCount),
    ping_avg: totals.count === 0 ? null : toFixedNumber(totals.ping / safeCount),
    ssl_days_left_avg: totals.count === 0 ? null : toFixedNumber(totals.ssl / safeCount),
    dns_success_rate: totals.count === 0 ? null : toFixedNumber(totals.dns / safeCount),
    traffic_light: totals.traffic,
  } satisfies AggregatedSummary;
}

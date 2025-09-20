import { useCallback, useEffect, useMemo, useState } from "react";
import axios, { CanceledError } from "axios";
import {
  aggregateTrafficLight,
  buildAggregatedTimeseries,
  buildTrafficLightTimeseries,
  calcDnsSuccessRate,
  calcUptime,
  countIncidents,
  getSparklineSeries,
  mergeTrafficLightAggregates,
  minSslDays,
  summarizeAggregatedBuckets,
  type AggregatedBucket,
  type AggregatedDashboardResponse,
  type ChartPoint,
  type LogRecord,
  type TrafficLight,
} from "@/utils/stats";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { TrafficLightPie } from "@/components/dashboard/TrafficLightPie";
import { LatencyChart } from "@/components/dashboard/LatencyChart";
import { PingChart } from "@/components/dashboard/PingChart";
import { TimeseriesChart } from "@/components/dashboard/TimeseriesChart";
import { TrafficLightTimeline } from "@/components/dashboard/TrafficLightTimeline";
import {

  LogsTable,
  type LogsTableFilters,
} from "@/components/dashboard/LogsTable";
import { LogDetailsDrawer } from "@/components/dashboard/LogDetailsDrawer";

import { IncidentBanner } from "@/components/dashboard/IncidentBanner";
import { RefreshCw } from "lucide-react";


const API_URL = "http://localhost:8000";

const TIME_RANGES = [
  { value: "1s", label: "1 сек", durationMs: 1_000, groupBy: "1s" },
  { value: "1m", label: "1 мин", durationMs: 60_000, groupBy: "1m" },
  { value: "10m", label: "10 мин", durationMs: 600_000, groupBy: "10m" },
  { value: "60m", label: "60 мин", durationMs: 3_600_000, groupBy: "60m" },
  { value: "1d", label: "1 день", durationMs: 86_400_000, groupBy: "1d" },
  { value: "1w", label: "1 неделя", durationMs: 604_800_000, groupBy: "1w" },
] as const;

const DEFAULT_LIMIT = 500;
const TRAFFIC_OPTIONS: TrafficLight[] = ["green", "orange", "red"];

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const isAggregatedBucket = (value: unknown): value is AggregatedBucket => {
  return !!value && typeof value === "object" && "count" in value && "traffic_light" in value;
};

const aggregatedTooltip = (label: string, unit = "", digits = 0) => (meta: unknown, value: number) => {
  const bucket = isAggregatedBucket(meta) ? meta : null;
  const formatted = `${value.toFixed(digits)}${unit ? ` ${unit}` : ""}`;
  const checks = bucket ? `\nПроверок: ${bucket.count}` : "";
  return `${label}: ${formatted}${checks}`;
};

const buildTrend = (series: ChartPoint[], limit = 120) => {
  return series.slice(-limit).map((point) => ({ timestamp: point.timestamp, value: point.value }));
};



type Site = {
  name: string;
  url: string;

};

const getInitials = (site: Site) => {
  if (site.name) {
    return site.name
      .split(" ")
      .filter(Boolean)
      .map((part) => part[0]?.toUpperCase())
      .slice(0, 2)
      .join("") || "?";
  }
  try {
    const { hostname } = new URL(site.url);
    return hostname
      .split(".")
      .filter(Boolean)
      .map((part) => part[0]?.toUpperCase())
      .slice(0, 2)
      .join("") || "?";
  } catch {
    return "?";
  }
};

const getHostname = (site: Site) => {
  try {
    return new URL(site.url).hostname;
  } catch {
    return site.url;
  }

};

const formatMs = (value: number | null) => (value === null ? "—" : `${Math.round(value)} мс`);
const formatPercent = (value: number | null, digits = 1) =>
  value === null ? "—" : `${value.toFixed(digits)}%`;
const formatDays = (value: number | null, digits = 1) =>
  value === null ? "—" : `${value.toFixed(digits)} дн.`;


export default function DashboardPage() {
  const [sites, setSites] = useState<Site[]>([]);
  const [selectedSiteUrl, setSelectedSiteUrl] = useState<string>("");

  const [timeRange, setTimeRange] = useState<(typeof TIME_RANGES)[number]["value"]>("1m");
  const [logs, setLogs] = useState<LogRecord[]>([]);
  const [overview, setOverview] = useState<AggregatedDashboardResponse | null>(null);
  const [siteAggregate, setSiteAggregate] = useState<AggregatedDashboardResponse | null>(null);
  const [isOverviewLoading, setIsOverviewLoading] = useState(false);
  const [isSiteLoading, setIsSiteLoading] = useState(false);
  const [overviewError, setOverviewError] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  const [autoRefreshInterval, setAutoRefreshInterval] = useState(1);
  const [trafficFilter, setTrafficFilter] = useState<Set<TrafficLight>>(new Set(TRAFFIC_OPTIONS));
  const [httpStatusRange, setHttpStatusRange] = useState({ min: 100, max: 599 });
  const [searchTerm, setSearchTerm] = useState("");
  const [limit, setLimit] = useState(DEFAULT_LIMIT);
  const [selectedLog, setSelectedLog] = useState<LogRecord | null>(null);

  const timeRangeConfig = useMemo(
    () => TIME_RANGES.find((option) => option.value === timeRange) ?? TIME_RANGES[1],
    [timeRange],
  );

  useEffect(() => {
    let isMounted = true;

    const loadSites = async () => {
      try {
        const response = await axios.get<Site[]>(`${API_URL}/sites`);
        if (!isMounted) return;
        setSites(response.data);
        if (response.data.length > 0) {

        }
      } catch (err) {
        console.error("Failed to load sites", err);
        if (isMounted) {
          setOverviewError("Не удалось загрузить список сайтов");
        }
      }
    };

    loadSites();
    return () => {
      isMounted = false;
    };
  }, []);

  const fetchOverviewData = useCallback(
    async (signal?: AbortSignal) => {
      setIsOverviewLoading(true);
      const since = new Date(Date.now() - timeRangeConfig.durationMs).toISOString();
      try {
        const response = await axios.get<AggregatedDashboardResponse>(`${API_URL}/logs/aggregated`, {
          params: {
            since,
            group_by: timeRangeConfig.groupBy,
          },
          signal,
        });
        if (signal?.aborted) return;
        setOverview(response.data);
        setOverviewError(null);
      } catch (err) {
        if (err instanceof CanceledError || signal?.aborted) {
          return;
        }
        console.error("Failed to load overview", err);
        setOverviewError("Не удалось загрузить общую статистику");
      } finally {
        if (!signal?.aborted) {
          setIsOverviewLoading(false);
        }
      }
    },
    [timeRangeConfig.durationMs, timeRangeConfig.groupBy],
  );

  const fetchSiteData = useCallback(
    async (signal?: AbortSignal) => {
      if (!selectedSiteUrl) {
        setLogs([]);
        setSiteAggregate(null);
        return;
      }

      setIsSiteLoading(true);
      const since = new Date(Date.now() - timeRangeConfig.durationMs).toISOString();

      try {
        const [aggregateResponse, logsResponse] = await Promise.all([
          axios.get<AggregatedDashboardResponse>(`${API_URL}/logs/aggregated`, {
            params: {
              since,
              group_by: timeRangeConfig.groupBy,
              url: selectedSiteUrl,
            },
            signal,
          }),
          axios.get<LogRecord[]>(`${API_URL}/logs`, {
            params: {
              url: selectedSiteUrl,
              limit,
              since,
            },
            signal,
          }),
        ]);

        if (signal?.aborted) return;

        setSiteAggregate(aggregateResponse.data);
        const payload = Array.isArray(logsResponse.data) ? logsResponse.data : [];
        setLogs(payload);
        setError(null);
        setLastUpdated(new Date());
      } catch (err) {
        if (err instanceof CanceledError || signal?.aborted) {
          return;
        }
        console.error("Failed to load site dashboard", err);
        setError("Не удалось загрузить данные сайта");
      } finally {
        if (!signal?.aborted) {
          setIsSiteLoading(false);
        }
      }
    },
    [limit, selectedSiteUrl, timeRangeConfig.durationMs, timeRangeConfig.groupBy],
  );

  useEffect(() => {
    const controller = new AbortController();
    fetchOverviewData(controller.signal);
    return () => controller.abort();
  }, [fetchOverviewData]);

  useEffect(() => {
    const controller = new AbortController();
    fetchSiteData(controller.signal);
    return () => controller.abort();
  }, [fetchSiteData]);

  useEffect(() => {
    if (!autoRefreshEnabled) return;
    const intervalId = window.setInterval(() => {
      fetchOverviewData();
      fetchSiteData();
    }, clamp(autoRefreshInterval, 1, 60) * 1000);
    return () => window.clearInterval(intervalId);
  }, [autoRefreshEnabled, autoRefreshInterval, fetchOverviewData, fetchSiteData]);

  const handleManualRefresh = useCallback(() => {
    fetchOverviewData();
    fetchSiteData();
  }, [fetchOverviewData, fetchSiteData]);

  const sortedLogs = useMemo(
    () => [...logs].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()),
    [logs],
  );

  const filters: LogsTableFilters = useMemo(
    () => ({
      traffic: trafficFilter,
      statusRange: httpStatusRange,
      search: searchTerm,
      limit,
    }),
    [trafficFilter, httpStatusRange, searchTerm, limit],
  );

  const filteredLogs = useMemo(() => {
    return sortedLogs.filter((log) => {
      const trafficAllowed = filters.traffic.size === 0 || filters.traffic.has(log.traffic_light as TrafficLight);
      if (!trafficAllowed) return false;

      const status = log.http_status;
      const statusAllowed =
        status === null || (status >= filters.statusRange.min && status <= filters.statusRange.max);
      if (!statusAllowed) return false;

      if (filters.search.trim().length > 0) {
        const value = log.url ?? "";
        if (!value.toLowerCase().includes(filters.search.toLowerCase())) {
          return false;
        }
      }

      return true;
    });
  }, [filters, sortedLogs]);

  const selectedSite = useMemo(
    () => sites.find((site) => site.url === selectedSiteUrl) ?? null,
    [sites, selectedSiteUrl],
  );

  const overviewBuckets = useMemo(() => overview?.buckets ?? [], [overview]);
  const overviewSummary = overview?.summary ?? summarizeAggregatedBuckets(overviewBuckets);
  const overviewTraffic = overview?.summary?.traffic_light ?? mergeTrafficLightAggregates(overviewBuckets);

  const overviewLatencySeries = useMemo(
    () => buildAggregatedTimeseries(overviewBuckets, "latency_avg"),
    [overviewBuckets],
  );
  const overviewPingSeries = useMemo(
    () => buildAggregatedTimeseries(overviewBuckets, "ping_avg"),
    [overviewBuckets],
  );
  const overviewDnsSeries = useMemo(
    () => buildAggregatedTimeseries(overviewBuckets, "dns_success_rate"),
    [overviewBuckets],
  );
  const overviewSslSeries = useMemo(
    () => buildAggregatedTimeseries(overviewBuckets, "ssl_days_left_avg"),
    [overviewBuckets],
  );
  const overviewTrafficSeries = useMemo(
    () => buildTrafficLightTimeseries(overviewBuckets),
    [overviewBuckets],
  );

  const overviewLatencyTrend = useMemo(() => buildTrend(overviewLatencySeries), [overviewLatencySeries]);
  const overviewPingTrend = useMemo(() => buildTrend(overviewPingSeries), [overviewPingSeries]);
  const overviewDnsTrend = useMemo(() => buildTrend(overviewDnsSeries), [overviewDnsSeries]);
  const overviewSslTrend = useMemo(() => buildTrend(overviewSslSeries), [overviewSslSeries]);

  const siteBuckets = useMemo(() => siteAggregate?.buckets ?? [], [siteAggregate]);
  const siteSummary = siteAggregate?.summary ?? summarizeAggregatedBuckets(siteBuckets);
  const siteTrafficRaw = siteAggregate?.summary?.traffic_light ?? mergeTrafficLightAggregates(siteBuckets);
  const siteTrafficFallback = useMemo(() => aggregateTrafficLight(sortedLogs), [sortedLogs]);
  const siteTraffic = useMemo(() => {
    const total = siteTrafficRaw.green + siteTrafficRaw.orange + siteTrafficRaw.red;
    if (total === 0 && sortedLogs.length > 0) {
      return siteTrafficFallback;
    }
    return siteTrafficRaw;
  }, [siteTrafficFallback, siteTrafficRaw, sortedLogs.length]);

  const siteLatencySeries = useMemo(
    () => buildAggregatedTimeseries(siteBuckets, "latency_avg"),
    [siteBuckets],
  );
  const sitePingSeries = useMemo(
    () => buildAggregatedTimeseries(siteBuckets, "ping_avg"),
    [siteBuckets],
  );
  const siteDnsSeries = useMemo(
    () => buildAggregatedTimeseries(siteBuckets, "dns_success_rate"),
    [siteBuckets],
  );
  const siteSslSeries = useMemo(
    () => buildAggregatedTimeseries(siteBuckets, "ssl_days_left_avg"),
    [siteBuckets],
  );

  const siteLatencyTrend = useMemo(() => buildTrend(siteLatencySeries), [siteLatencySeries]);
  const sitePingTrend = useMemo(() => buildTrend(sitePingSeries), [sitePingSeries]);
  const siteDnsTrend = useMemo(() => buildTrend(siteDnsSeries), [siteDnsSeries]);
  const siteSslTrend = useMemo(() => buildTrend(siteSslSeries), [siteSslSeries]);

  const siteLatencyAvg = siteSummary.latency_avg;
  const sitePingAvg = siteSummary.ping_avg;
  const siteDnsSuccess = siteSummary.dns_success_rate ?? calcDnsSuccessRate(sortedLogs);
  const siteSslAvg = siteSummary.ssl_days_left_avg;
  const siteChecks = sortedLogs.length;
  const uptime = useMemo(() => calcUptime(sortedLogs), [sortedLogs]);
  const sslDaysLeftMin = useMemo(() => minSslDays(sortedLogs), [sortedLogs]);
  const incidentsCount = useMemo(() => countIncidents(filteredLogs), [filteredLogs]);

  const latencyDrawerTrend = useMemo(() => {
    if (!selectedLog) return [];
    const index = sortedLogs.findIndex((log) => log.timestamp === selectedLog.timestamp);
    const slice = index === -1 ? sortedLogs.slice(-10) : sortedLogs.slice(Math.max(0, index - 9), index + 1);
    return getSparklineSeries(slice, "latency_ms");
  }, [selectedLog, sortedLogs]);

  const pingDrawerTrend = useMemo(() => {
    if (!selectedLog) return [];
    const index = sortedLogs.findIndex((log) => log.timestamp === selectedLog.timestamp);
    const slice = index === -1 ? sortedLogs.slice(-10) : sortedLogs.slice(Math.max(0, index - 9), index + 1);
    return getSparklineSeries(slice, "ping_ms");
  }, [selectedLog, sortedLogs]);

  const latestLog = filteredLogs[filteredLogs.length - 1] ?? sortedLogs[sortedLogs.length - 1] ?? null;
  const activeTrafficLight = latestLog?.traffic_light ?? "green";


  const statusBadgeClass = useMemo(() => {
    switch (activeTrafficLight) {
      case "red":
        return "bg-rose-100 text-rose-700 border border-rose-200";
      case "orange":
        return "bg-amber-100 text-amber-700 border border-amber-200";
      default:
        return "bg-emerald-100 text-emerald-700 border border-emerald-200";
    }
  }, [activeTrafficLight]);
  const handleToggleTraffic = useCallback((traffic: TrafficLight) => {
    setTrafficFilter((prev) => {
      const next = new Set(prev);
      if (next.has(traffic)) {
        next.delete(traffic);
        if (next.size === 0) {
          return new Set(TRAFFIC_OPTIONS);
        }
      } else {
        next.add(traffic);
      }
      return next;
    });
  }, []);

  const handleStatusRangeChange = useCallback((range: { min: number; max: number }) => {
    setHttpStatusRange({
      min: clamp(range.min, 100, 599),
      max: clamp(range.max, 100, 599),
    });
  }, []);

  const overviewSiteCount = sites.length;
  const sslAccent =
    sslDaysLeftMin === null ? "default" : sslDaysLeftMin <= 0 ? "danger" : sslDaysLeftMin < 7 ? "warning" : "default";


  return (
    <div className="flex h-full flex-1 flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-[1600px] flex-col gap-10 px-6 pb-14 pt-6">
          <section className="space-y-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h1 className="text-2xl font-semibold text-slate-900">Общая статистика</h1>
                <p className="text-sm text-slate-500">Все сайты за выбранный период.</p>
              </div>
              {overviewError ? <span className="text-sm text-rose-600">{overviewError}</span> : null}
            </div>
            <div className="grid gap-4 xl:grid-cols-6">
              <div className="grid gap-4 sm:grid-cols-2 xl:col-span-4 xl:grid-cols-4">
                <MetricCard title="Сайтов" value={overviewSiteCount} description="Активные ресурсы" compact />
                <MetricCard
                  title="Средняя латентность"
                  value={formatMs(overviewSummary.latency_avg)}
                  trend={overviewLatencyTrend}
                />
                <MetricCard
                  title="Средний пинг"
                  value={formatMs(overviewSummary.ping_avg)}
                  trend={overviewPingTrend}
                />
                <MetricCard
                  title="% успешных DNS"
                  value={formatPercent(overviewSummary.dns_success_rate)}
                  trend={overviewDnsTrend}
                  trendFormatter={(value) => `${value.toFixed(1)}%`}
                />
                <MetricCard
                  title="Средний срок SSL"
                  value={formatDays(overviewSummary.ssl_days_left_avg)}
                  trend={overviewSslTrend}
                  trendFormatter={(value) => `${value.toFixed(1)} дн.`}
                />
              </div>
              <div className="xl:col-span-2">
                <TrafficLightPie data={overviewTraffic} title="Светофор (все сайты)" />
              </div>
            </div>
            <div className="grid gap-4 xl:grid-cols-2">
              <LatencyChart
                data={overviewLatencySeries}
                label="Латентность (все сайты)"
                tooltipFormatter={aggregatedTooltip("Латентность", "мс")}
              />
              <PingChart
                data={overviewPingSeries}
                label="Пинг (все сайты)"
                tooltipFormatter={aggregatedTooltip("Пинг", "мс")}
              />
            </div>
            <TrafficLightTimeline data={overviewTrafficSeries} title="Распределение статусов (все сайты)" />
          </section>

          <div className="sticky top-16 z-30 -mx-6 border-y border-slate-200/80 bg-slate-50/90 px-6 py-4 backdrop-blur">
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center justify-between gap-4">

                <div className="flex-1 overflow-x-auto">
                  <div className="flex w-max gap-2">
                    {sites.map((site) => {
                      const isActive = site.url === selectedSiteUrl;
                      return (
                        <button
                          key={site.url}
                          type="button"
                          onClick={() => setSelectedSiteUrl(site.url)}
                          className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 ${
                            isActive
                              ? "border-slate-900 bg-slate-900 text-white"
                              : "border-slate-200 bg-white text-slate-600"
                          }`}
                        >
                          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900/10 text-sm font-semibold">
                            {getInitials(site)}
                          </span>
                          <div className="flex flex-col">
                            <span className="text-sm font-semibold leading-5">{getHostname(site)}</span>

                            <span className="text-xs text-slate-400">{site.url}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {TIME_RANGES.map((range) => {
                    const isActive = range.value === timeRange;
                    return (
                      <button
                        key={range.value}
                        type="button"
                        onClick={() => setTimeRange(range.value)}
                        className={`h-9 rounded-full border px-4 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 ${
                          isActive ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-600"
                        }`}
                      >
                        {range.label}

                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                <label className="flex items-center gap-2 text-sm text-slate-600">
                  <input
                    type="checkbox"
                    checked={autoRefreshEnabled}
                    onChange={(event) => setAutoRefreshEnabled(event.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-400"
                  />
                  Автообновление
                </label>
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <span>Интервал</span>
                  <input
                    type="number"
                    min={1}
                    max={60}
                    value={autoRefreshInterval}
                    onChange={(event) => setAutoRefreshInterval(clamp(Number(event.target.value) || 1, 1, 60))}
                    className="h-8 w-16 rounded-md border border-slate-200 bg-white px-2 text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                  />
                  <span>сек.</span>
                </div>
                <button
                  type="button"
                  onClick={handleManualRefresh}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                >
                  <RefreshCw className={`h-4 w-4 ${isSiteLoading || isOverviewLoading ? "animate-spin" : ""}`} />
                  Обновить
                </button>
                {lastUpdated ? (
                  <span className="text-sm text-slate-500">Обновлено {lastUpdated.toLocaleTimeString()}</span>
                ) : null}
                {isSiteLoading || isOverviewLoading ? (
                  <span className="text-sm text-slate-400">Обновляем данные…</span>
                ) : null}

              </div>
            </div>
          </div>

          <section className="space-y-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">Дашборд сайта</h2>
                <p className="text-sm text-slate-500">{selectedSite ? selectedSite.url : "Выберите ресурс"}</p>
              </div>
              {selectedSite ? (
                <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${statusBadgeClass}`}>
                  <span className="h-2 w-2 rounded-full bg-current" />
                  {activeTrafficLight}
                </span>
              ) : null}
            </div>
            {error ? (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">{error}</div>
            ) : null}
            <div className="grid gap-4 xl:grid-cols-5">
              <div className="grid gap-4 sm:grid-cols-2 xl:col-span-4 xl:grid-cols-4">
                <MetricCard
                  title="Средняя латентность"
                  value={formatMs(siteLatencyAvg)}
                  trend={siteLatencyTrend}
                />
                <MetricCard
                  title="Средний пинг"
                  value={formatMs(sitePingAvg)}
                  trend={sitePingTrend}
                />
                <MetricCard
                  title="Доступность"
                  value={uptime === null ? "—" : `${uptime}%`}
                />
                <MetricCard
                  title="% успешных DNS"
                  value={formatPercent(siteDnsSuccess)}
                  trend={siteDnsTrend}
                  trendFormatter={(value) => `${value.toFixed(1)}%`}
                />
                <MetricCard
                  title="Средний срок SSL"
                  value={formatDays(siteSslAvg)}
                  trend={siteSslTrend}
                  trendFormatter={(value) => `${value.toFixed(1)} дн.`}
                  accent={sslAccent}
                />
              </div>
              <MetricCard
                title="Проверок"
                value={siteChecks}
                description="Количество записей в выборке"
                compact
              />
            </div>
            <IncidentBanner incidentCount={incidentsCount} windowSize={filteredLogs.length || siteChecks} />
            <div className="grid gap-4 xl:grid-cols-2">
              <LatencyChart
                data={siteLatencySeries}
                label="Латентность сайта"
                tooltipFormatter={aggregatedTooltip("Латентность", "мс")}
              />
              <PingChart
                data={sitePingSeries}
                label="Пинг сайта"
                tooltipFormatter={aggregatedTooltip("Пинг", "мс")}
              />
            </div>
            <div className="grid gap-4 xl:grid-cols-4">
              <div className="xl:col-span-2">
                <TimeseriesChart
                  data={siteSslSeries}
                  color="#0ea5e9"
                  label="SSL, дни"
                  valueFormatter={(value) => `${value.toFixed(1)} дн.`}
                  tooltipFormatter={aggregatedTooltip("SSL", "дн.", 1)}
                />
              </div>
              <TimeseriesChart
                data={siteDnsSeries}
                color="#22c55e"
                label="DNS, %"
                valueFormatter={(value) => `${value.toFixed(1)}%`}
                tooltipFormatter={aggregatedTooltip("DNS", "%", 1)}
              />
              <TrafficLightPie data={siteTraffic} title="Светофор сайта" />
            </div>
            <LogsTable
              logs={filteredLogs}
              onRowClick={setSelectedLog}
              filters={filters}
              onToggleTraffic={handleToggleTraffic}
              onStatusChange={handleStatusRangeChange}
              onSearchChange={setSearchTerm}
              onLimitChange={setLimit}
            />
          </section>
        </div>
      </div>

      <LogDetailsDrawer
        log={selectedLog}
        open={Boolean(selectedLog)}
        onClose={() => setSelectedLog(null)}
        latencyTrend={latencyDrawerTrend}
        pingTrend={pingDrawerTrend}
      />
    </div>
  );
}



import { useCallback, useEffect, useMemo, useState } from "react";
import axios, { CanceledError } from "axios";
import {
  aggregateTrafficLight,
  buildTimeseries,
  calcAvgLatency,
  calcAvgPing,
  calcUptime,
  countIncidents,
  getSparklineSeries,
  minSslDays,
  type LogRecord,
  type TrafficLight,
} from "@/utils/stats";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { IncidentBanner } from "@/components/dashboard/IncidentBanner";
import { LatencyChart } from "@/components/dashboard/LatencyChart";
import { PingChart } from "@/components/dashboard/PingChart";
import { TrafficLightPie } from "@/components/dashboard/TrafficLightPie";
import {

  LogsTable,
  type LogsTableFilters,
} from "@/components/dashboard/LogsTable";
import { LogDetailsDrawer } from "@/components/dashboard/LogDetailsDrawer";
import { RefreshCw, Zap } from "lucide-react";

const API_URL = "http://localhost:8000";

const TIME_RANGES = [
  { value: "5m", label: "5m", durationMs: 5 * 60 * 1000 },
  { value: "15m", label: "15m", durationMs: 15 * 60 * 1000 },
  { value: "1h", label: "1h", durationMs: 60 * 60 * 1000 },
  { value: "6h", label: "6h", durationMs: 6 * 60 * 60 * 1000 },
  { value: "24h", label: "24h", durationMs: 24 * 60 * 60 * 1000 },
  { value: "7d", label: "7d", durationMs: 7 * 24 * 60 * 60 * 1000 },
] as const;

const DEFAULT_LIMIT = 500;

const TRAFFIC_OPTIONS: TrafficLight[] = ["green", "orange", "red"];


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

export default function DashboardPage() {
  const [sites, setSites] = useState<Site[]>([]);
  const [selectedSiteUrl, setSelectedSiteUrl] = useState<string>("");
  const [timeRange, setTimeRange] = useState<(typeof TIME_RANGES)[number]["value"]>("15m");
  const [logs, setLogs] = useState<LogRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
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
          setSelectedSiteUrl(response.data[0].url);
        }
      } catch (err) {
        console.error("Failed to load sites", err);
        if (isMounted) {
          setError("Не удалось загрузить список сайтов");
        }
      }
    };

    loadSites();

    return () => {
      isMounted = false;
    };
  }, []);

  const fetchLogs = useCallback(
    async (signal?: AbortSignal) => {
      if (!selectedSiteUrl) return;
      setIsLoading(true);
      const since = new Date(Date.now() - timeRangeConfig.durationMs).toISOString();

      try {
        const response = await axios.get<LogRecord[]>(`${API_URL}/logs`, {
          params: {
            url: selectedSiteUrl,
            limit,
            since,
          },
          signal,
        });

        if (signal?.aborted) return;

        const payload = Array.isArray(response.data) ? response.data : [];
        setLogs(payload);
        setError(null);
        setLastUpdated(new Date());
      } catch (err) {
        if (err instanceof CanceledError) {
          return;
        }
        console.error("Failed to load logs", err);
        if (!signal?.aborted) {
          setError("Не удалось загрузить логи");
        }
      } finally {
        if (!signal?.aborted) {
          setIsLoading(false);
        }
      }
    },
    [limit, selectedSiteUrl, timeRangeConfig.durationMs],
  );

  useEffect(() => {
    const controller = new AbortController();
    fetchLogs(controller.signal);
    return () => controller.abort();
  }, [fetchLogs]);

  useEffect(() => {
    if (!autoRefreshEnabled) return;
    const intervalId = setInterval(() => {
      fetchLogs();
    }, Math.max(1, Math.min(autoRefreshInterval, 60)) * 1000);

    return () => {
      clearInterval(intervalId);
    };
  }, [autoRefreshEnabled, autoRefreshInterval, fetchLogs]);

  const sortedLogs = useMemo(() => {
    return [...logs].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }, [logs]);

  const distribution = useMemo(() => aggregateTrafficLight(sortedLogs), [sortedLogs]);

  const averageLatency = useMemo(() => calcAvgLatency(sortedLogs), [sortedLogs]);
  const averagePing = useMemo(() => calcAvgPing(sortedLogs), [sortedLogs]);
  const uptime = useMemo(() => calcUptime(sortedLogs), [sortedLogs]);
  const sslDaysLeft = useMemo(() => minSslDays(sortedLogs), [sortedLogs]);
  const incidentsCount = useMemo(() => countIncidents(sortedLogs), [sortedLogs]);

  const latencySparkline = useMemo(() => getSparklineSeries(sortedLogs.slice(-120), "latency_ms"), [sortedLogs]);
  const pingSparkline = useMemo(() => getSparklineSeries(sortedLogs.slice(-120), "ping_ms"), [sortedLogs]);

  const latencySeries = useMemo(() => buildTimeseries(sortedLogs, "latency_ms"), [sortedLogs]);
  const pingSeries = useMemo(() => buildTimeseries(sortedLogs, "ping_ms"), [sortedLogs]);

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
      const trafficAllowed =
        filters.traffic.size === 0 || filters.traffic.has(log.traffic_light as TrafficLight);
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

  const latestLog = filteredLogs[filteredLogs.length - 1] ?? sortedLogs[sortedLogs.length - 1] ?? null;
  const activeTrafficLight = latestLog?.traffic_light ?? "green";

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
      min: Math.max(100, Math.min(range.min, range.max)),
      max: Math.max(range.min, Math.min(range.max, 599)),
    });
  }, []);

  const handleManualRefresh = useCallback(() => {
    fetchLogs();
  }, [fetchLogs]);

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

  const selectedSite = useMemo(
    () => sites.find((site) => site.url === selectedSiteUrl) ?? null,
    [sites, selectedSiteUrl],
  );

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

  const sslAccent = sslDaysLeft === null ? "default" : sslDaysLeft <= 0 ? "danger" : sslDaysLeft < 7 ? "warning" : "default";

  return (
    <div className="flex h-full flex-1 flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-8 px-6 pb-10 pt-6">
          <header className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-semibold text-slate-900">Дашборд</h1>
                <p className="text-sm text-slate-500">
                  {selectedSite ? selectedSite.url : "Выберите ресурс"}
                </p>
              </div>
              <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${statusBadgeClass}`}>
                <span className="h-2 w-2 rounded-full bg-current" />
                {activeTrafficLight}
              </span>
            </div>
          </header>

          <div className="sticky top-16 z-20 -mx-6 border-y border-slate-200/80 bg-white/95 px-6 py-4 backdrop-blur">
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1 overflow-x-auto">
                  <div className="flex w-max gap-2">
                    {sites.map((site) => {
                      const isActive = site.url === selectedSiteUrl;
                      return (
                        <button
                          key={site.url}
                          type="button"
                          onClick={() => setSelectedSiteUrl(site.url)}
                          className={`flex min-w-[220px] items-center gap-3 rounded-xl border px-4 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 ${
                            isActive
                              ? "border-slate-900 bg-slate-900 text-white"
                              : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                          }`}
                        >
                          <span
                            className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold ${
                              isActive ? "bg-white/15" : "bg-slate-100 text-slate-700"
                            }`}
                          >
                            {getInitials(site)}
                          </span>
                          <div className="flex flex-col">
                            <span className="text-sm font-semibold leading-tight">
                              {site.name || getHostname(site)}
                            </span>
                            <span className="text-xs text-slate-400">{site.url}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  {lastUpdated ? `Обновлено ${lastUpdated.toLocaleTimeString()}` : "—"}
                  {error && <span className="text-rose-500">{error}</span>}
                </div>
              </div>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-wrap items-center gap-2">
                  {TIME_RANGES.map((option) => {
                    const isActive = option.value === timeRange;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setTimeRange(option.value)}
                        className={`h-9 rounded-full border px-4 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 ${
                          isActive
                            ? "border-slate-900 bg-slate-900 text-white"
                            : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                        }`}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-600">
                    <input
                      type="checkbox"
                      checked={autoRefreshEnabled}
                      onChange={(event) => setAutoRefreshEnabled(event.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-400"
                    />
                    Автообновление
                  </label>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span>Интервал (сек)</span>
                    <input
                      type="number"
                      min={1}
                      max={60}
                      step={1}
                      value={autoRefreshInterval}
                      onChange={(event) =>
                        setAutoRefreshInterval(Math.min(60, Math.max(1, Number(event.target.value) || 1)))
                      }
                      className="h-8 w-16 rounded-md border border-slate-200 px-2 text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleManualRefresh}
                    disabled={isLoading}
                    className="inline-flex items-center gap-2 rounded-full border border-slate-900 bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-200 disabled:text-slate-500"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Обновить сейчас
                  </button>
                </div>
              </div>
            </div>
          </div>

          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">Ключевые показатели</h2>
              {incidentsCount > 0 && (
                <span className="inline-flex items-center gap-2 rounded-full border border-amber-300/60 bg-amber-50/80 px-3 py-1 text-xs font-medium text-amber-700">
                  <Zap className="h-4 w-4" /> Есть предупреждения
                </span>
              )}
            </div>
            <div className="grid gap-4 lg:grid-cols-5">
              <MetricCard
                title="Средняя латентность"
                value={averageLatency !== null ? `${averageLatency} ms` : "—"}
                description="за выбранный период"
                trend={latencySparkline}
              />
              <MetricCard
                title="Средний пинг"
                value={averagePing !== null ? `${averagePing} ms` : "—"}
                description="за выбранный период"
                trend={pingSparkline}
              />
              <MetricCard
                title="Доступность"
                value={uptime !== null ? `${uptime}%` : "—"}
                description="доля успешных ответов"
              />
              <MetricCard
                title="SSL сертификат"
                value={sslDaysLeft !== null ? `${sslDaysLeft} дн.` : "—"}
                description="минимум по выборке"
                accent={sslAccent}
              />
              <MetricCard
                title="Проверок"
                value={sortedLogs.length}
                description="в выборке"
                compact
              />
            </div>
          </section>

          <IncidentBanner
            incidentCount={incidentsCount}
            windowSize={sortedLogs.length}
            onClick={() => {
              if (incidentsCount > 0 && filteredLogs.length > 0) {
                const lastIncident = [...filteredLogs].reverse().find((log) => log.traffic_light !== "green");
                if (lastIncident) {
                  setSelectedLog(lastIncident);
                }
              }
            }}
          />

          <section className="grid gap-4 lg:grid-cols-[2fr_2fr_1fr]">
            <div className="grid gap-4 lg:grid-cols-2 lg:grid-rows-1">
              <LatencyChart data={latencySeries} />
              <PingChart data={pingSeries} />
            </div>
            <TrafficLightPie data={distribution} />
          </section>

          <LogsTable
            logs={filteredLogs}
            onRowClick={(log) => setSelectedLog(log)}
            filters={filters}
            onToggleTraffic={handleToggleTraffic}
            onStatusChange={handleStatusRangeChange}
            onSearchChange={setSearchTerm}
            onLimitChange={(value) => setLimit(value)}
          />
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

import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";

import { formatRelativeTime } from "@/utils/date";

const API_URL = "http://localhost:8000"; // ⚡️ API сервис из docker-compose

type Site = {
  url: string;
  name: string;
};

type Log = {
  timestamp: string;
  traffic_light: string;
  http_status: number | null;
  latency_ms: number | null;
  ping_ms: number | null;
  ssl_days_left: number | null;
  dns_resolved: number;
  redirects: number | null;
  errors_last: number | null;
};

const COLORS: Record<string, string> = {
  green: "#22c55e",
  orange: "#f97316",
  red: "#ef4444",
};

const STATUS_CONFIG: Record<
  string,
  {
    label: string;
    badge: string;
    dot: string;
  }
> = {
  green: {
    label: "Все системы в норме",
    badge: "border-emerald-200/60 bg-emerald-50/70 text-emerald-700",
    dot: "bg-emerald-400",
  },
  orange: {
    label: "Есть предупреждения",
    badge: "border-amber-200/70 bg-amber-50/70 text-amber-700",
    dot: "bg-amber-400",
  },
  red: {
    label: "Требует внимания",
    badge: "border-rose-200/70 bg-rose-50/75 text-rose-700",
    dot: "bg-rose-400",
  },
};

export default function DashboardPage() {
  const [sites, setSites] = useState<Site[]>([]);
  const [selectedSite, setSelectedSite] = useState<string>("");
  const [logs, setLogs] = useState<Log[]>([]);

  // Загружаем список сайтов
  useEffect(() => {
    axios.get(`${API_URL}/sites`).then((res) => {
      setSites(res.data); // ✅ бекенд возвращает массив
      if (res.data.length > 0) {
        setSelectedSite(res.data[0].url);
      }
    });
  }, []);

  // 🔄 Автообновление логов каждую секунду
  useEffect(() => {
    if (!selectedSite) return;

    const fetchLogs = async (siteUrl: string) => {
      try {
        const res = await axios.get(`${API_URL}/logs`, {
          params: { url: siteUrl, limit: 100 },
        });
        setLogs(res.data);
      } catch (err) {
        console.error("Ошибка загрузки логов:", err);
      }
    };

    fetchLogs(selectedSite); // ✅ первый запрос сразу
    const interval = setInterval(() => fetchLogs(selectedSite), 1000);

    return () => clearInterval(interval);
  }, [selectedSite]);


  const metrics = useMemo(() => {
    if (logs.length === 0) {
      return {
        latestLog: null,
        averageLatency: null,
        latencySamples: 0,
        averagePing: null,
        pingSamples: 0,
        uptimePercent: null,
        successChecks: 0,
        totalChecks: 0,
        sslDaysLeft: null,
        incidents: 0,
      };
    }

    const latestLog = logs[0] ?? null;

    const latencyValues = logs
      .map((log) => log.latency_ms)
      .filter((value): value is number => value !== null);
    const averageLatency =
      latencyValues.length > 0
        ? Math.round(
            latencyValues.reduce((acc, value) => acc + value, 0) /
              latencyValues.length,
          )
        : null;

    const pingValues = logs
      .map((log) => log.ping_ms)
      .filter((value): value is number => value !== null);
    const averagePing =
      pingValues.length > 0
        ? Math.round(
            pingValues.reduce((acc, value) => acc + value, 0) / pingValues.length,
          )
        : null;

    const totalChecks = logs.length;
    const successChecks = logs.filter(
      (log) => typeof log.http_status === "number" && log.http_status < 400,
    ).length;
    const uptimePercent =
      totalChecks > 0 ? Math.round((successChecks / totalChecks) * 100) : null;

    const sslValues = logs
      .map((log) => log.ssl_days_left)
      .filter((value): value is number => value !== null);
    const sslDaysLeft =
      sslValues.length > 0 ? Math.min(...sslValues) : null;

    const incidents = logs.filter((log) => log.traffic_light !== "green").length;

    return {
      latestLog,
      averageLatency,
      latencySamples: latencyValues.length,
      averagePing,
      pingSamples: pingValues.length,
      uptimePercent,
      successChecks,
      totalChecks,
      sslDaysLeft,
      incidents,
    };
  }, [logs]);

  const activeStatusKey = metrics.latestLog?.traffic_light ?? "green";
  const status = STATUS_CONFIG[activeStatusKey] ?? STATUS_CONFIG.green;

  const handleTabChange = (value: string) => {
    setSelectedSite(value);
  };

  const hasLogs = logs.length > 0;

  return (
    <div className="relative flex-1 overflow-y-auto">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-white via-white/80 to-transparent" />

      <div className="relative z-10 space-y-8 px-6 pb-10 pt-8">
        <div className="flex flex-col gap-3">
          <span className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-400">
            Мониторинг
          </span>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
              Центр дашбордов
            </h1>
            <div className="flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/80 px-3 py-1 text-xs font-medium text-slate-500 shadow-inner backdrop-blur">
              <span className="h-2 w-2 rounded-full bg-sky-400" />
              Автообновление каждые 1 c
            </div>
          </div>
        </div>

        <Tabs value={selectedSite} onValueChange={handleTabChange} className="w-full space-y-6">
          <TabsList className="flex flex-wrap gap-2 rounded-2xl border border-slate-200/80 bg-white/80 p-1 shadow-inner backdrop-blur">
            {sites.map((site) => (
              <TabsTrigger
                key={site.url}
                value={site.url}
                className="group relative flex items-center gap-3 rounded-2xl px-4 py-2 text-sm font-semibold text-slate-500 transition focus-visible:ring-sky-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-sky-500 data-[state=active]:to-indigo-500 data-[state=active]:text-white data-[state=active]:shadow-lg"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-sm font-semibold text-slate-500 transition group-data-[state=active]:bg-white/20 group-data-[state=active]:text-white">
                  {site.name.slice(0, 2).toUpperCase()}
                </span>
                <span className="flex flex-col text-left">
                  <span>{site.name}</span>
                  <span className="text-[11px] font-normal text-slate-400 transition group-data-[state=active]:text-white/80">
                    {site.url}
                  </span>
                </span>
              </TabsTrigger>
            ))}
          </TabsList>

          {sites.map((site) => (
            <TabsContent key={site.url} value={site.url} className="space-y-6">
              <Card className="relative overflow-hidden border border-slate-200/80 bg-white/80 shadow-lg backdrop-blur">
                <div className="pointer-events-none absolute -right-32 -top-32 h-64 w-64 rounded-full bg-gradient-to-br from-sky-500/10 via-indigo-500/10 to-purple-500/10" />
                <CardHeader className="relative flex flex-col gap-6 pb-4 md:flex-row md:items-center md:justify-between">
                  <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Активный ресурс
                    </p>
                    <CardTitle className="text-2xl font-semibold text-slate-900">
                      {site.name}
                    </CardTitle>
                    <p className="text-sm text-slate-500">{site.url}</p>
                  </div>

                  <div
                    className={`flex items-center gap-3 rounded-2xl border px-4 py-2 text-sm font-semibold shadow-sm backdrop-blur ${status.badge}`}
                  >
                    <span className={`h-2.5 w-2.5 rounded-full ${status.dot}`} />
                    <div className="flex flex-col text-left text-xs md:text-sm">
                      <span>{status.label}</span>
                      {metrics.latestLog && (
                        <span className="text-[11px] font-normal opacity-70">
                          Обновлено {" "}
                          {formatRelativeTime(
                            new Date(metrics.latestLog.timestamp).getTime(),
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="relative space-y-6">
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-4 shadow-sm">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Средняя латентность
                      </p>
                      <p className="mt-2 text-2xl font-semibold text-slate-900">
                        {metrics.averageLatency !== null
                          ? `${metrics.averageLatency.toLocaleString("ru-RU")} мс`
                          : "—"}
                      </p>
                      <p className="text-xs text-slate-400">
                        {metrics.latencySamples > 0
                          ? `${metrics.latencySamples} измерений`
                          : "Нет данных"}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-4 shadow-sm">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Средний пинг
                      </p>
                      <p className="mt-2 text-2xl font-semibold text-slate-900">
                        {metrics.averagePing !== null
                          ? `${metrics.averagePing.toLocaleString("ru-RU")} мс`
                          : "—"}
                      </p>
                      <p className="text-xs text-slate-400">
                        {metrics.pingSamples > 0
                          ? `${metrics.pingSamples} измерений`
                          : "Нет данных"}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-4 shadow-sm">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Доступность
                      </p>
                      <p className="mt-2 text-2xl font-semibold text-slate-900">
                        {metrics.uptimePercent !== null
                          ? `${metrics.uptimePercent}%`
                          : "—"}
                      </p>
                      <p className="text-xs text-slate-400">
                        {metrics.totalChecks > 0
                          ? `${metrics.successChecks}/${metrics.totalChecks} успешных`
                          : "Нет данных"}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-4 shadow-sm">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                        SSL сертификат
                      </p>
                      <p className="mt-2 text-2xl font-semibold text-slate-900">
                        {metrics.sslDaysLeft !== null
                          ? `${metrics.sslDaysLeft} дней`
                          : "—"}
                      </p>
                      <p className="text-xs text-slate-400">
                        Минимальный остаток по выборке
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[2fr_1fr]">
                    <div className="rounded-2xl border border-rose-200/70 bg-rose-50/70 p-5 text-rose-700 shadow-sm">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold uppercase tracking-wide">
                          Инциденты
                        </p>
                        <span className="rounded-full bg-white/60 px-2 py-0.5 text-[11px] font-semibold text-rose-600">
                          Последние 100 событий
                        </span>
                      </div>
                      <p className="mt-3 text-3xl font-semibold">
                        {metrics.incidents.toLocaleString("ru-RU")}
                      </p>
                      <p className="text-xs text-rose-600/80">
                        Количество записей со статусом ⚠️ или 🔴
                      </p>
                    </div>

                    <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-5 shadow-sm">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Проверок в выборке
                      </p>
                      <p className="mt-3 text-3xl font-semibold text-slate-900">
                        {metrics.totalChecks.toLocaleString("ru-RU")}
                      </p>
                      <p className="text-xs text-slate-400">
                        Используется для визуализаций ниже
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="grid gap-6 xl:grid-cols-2">
                <Card className="border border-slate-200/80 bg-white/80 shadow-sm backdrop-blur">
                  <CardHeader>
                    <CardTitle className="text-lg font-semibold text-slate-800">
                      HTTP Latency (мс)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex h-[320px] items-center justify-center">
                    {hasLogs ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={logs}>
                          <XAxis dataKey="timestamp" hide />
                          <YAxis />
                          <Tooltip />
                          <Legend />
                          <Line
                            type="monotone"
                            dataKey="latency_ms"
                            stroke="#2563eb"
                            name="Latency"
                            dot={false}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      <p className="text-sm text-slate-400">Нет данных</p>
                    )}
                  </CardContent>
                </Card>

                <Card className="border border-slate-200/80 bg-white/80 shadow-sm backdrop-blur">
                  <CardHeader>
                    <CardTitle className="text-lg font-semibold text-slate-800">
                      Ping (мс)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex h-[320px] items-center justify-center">
                    {hasLogs ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={logs}>
                          <XAxis dataKey="timestamp" hide />
                          <YAxis />
                          <Tooltip />
                          <Legend />
                          <Line
                            type="monotone"
                            dataKey="ping_ms"
                            stroke="#0ea5e9"
                            name="Ping"
                            dot={false}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      <p className="text-sm text-slate-400">Нет данных</p>
                    )}
                  </CardContent>
                </Card>
              </div>

              <Card className="border border-slate-200/80 bg-white/80 shadow-sm backdrop-blur">
                <CardHeader>
                  <CardTitle className="text-lg font-semibold text-slate-800">
                    Распределение статусов светофора
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex h-[340px] items-center justify-center">
                  {hasLogs ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={Object.entries(
                            logs.reduce((acc, log) => {
                              acc[log.traffic_light] =
                                (acc[log.traffic_light] || 0) + 1;
                              return acc;
                            }, {} as Record<string, number>),
                          ).map(([key, value]) => ({ name: key, value }))}
                          dataKey="value"
                          nameKey="name"
                          outerRadius={110}
                          label
                        >
                          {Object.keys(COLORS).map((key) => (
                            <Cell key={key} fill={COLORS[key]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-sm text-slate-400">Нет данных</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </div>
  );
}

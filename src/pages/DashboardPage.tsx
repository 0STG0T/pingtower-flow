import { useEffect, useState } from "react";
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


  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">📊 Dashboard</h1>

      <Tabs
        value={selectedSite}
        onValueChange={(val) => setSelectedSite(val)}
        className="w-full"
      >
        <TabsList className="flex flex-wrap gap-2">
          {sites.map((s) => (
            <TabsTrigger key={s.url} value={s.url}>
              {s.name}
            </TabsTrigger>
          ))}
        </TabsList>

        {sites.map((s) => (
          <TabsContent key={s.url} value={s.url} className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>
                  {s.name} ({s.url})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {logs.length > 0 ? (
                  <div className="flex items-center gap-4">
                    <span
                      className={`text-lg font-bold`}
                      style={{
                        color: COLORS[logs[0].traffic_light] || "#000",
                      }}
                    >
                      ● {logs[0].traffic_light.toUpperCase()}
                    </span>
                    <span>Последний HTTP: {logs[0].http_status}</span>
                    <span>SSL: {logs[0].ssl_days_left ?? "—"} дней</span>
                  </div>
                ) : (
                  <p>Нет данных</p>
                )}
              </CardContent>
            </Card>

            {/* Latency график */}
            <Card>
              <CardHeader>
                <CardTitle>HTTP Latency (ms)</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={logs}>
                    <XAxis dataKey="timestamp" hide />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="latency_ms"
                      stroke="#3b82f6"
                      name="Latency"
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Ping график */}
            <Card>
              <CardHeader>
                <CardTitle>Ping (ms)</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={logs}>
                    <XAxis dataKey="timestamp" hide />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="ping_ms"
                      stroke="#10b981"
                      name="Ping"
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Диаграмма распределения светофора */}
            <Card>
              <CardHeader>
                <CardTitle>Traffic Light Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={Object.entries(
                        logs.reduce((acc, l) => {
                          acc[l.traffic_light] =
                            (acc[l.traffic_light] || 0) + 1;
                          return acc;
                        }, {} as Record<string, number>)
                      ).map(([key, value]) => ({ name: key, value }))}
                      dataKey="value"
                      nameKey="name"
                      outerRadius={100}
                      label
                    >
                      {Object.keys(COLORS).map((key) => (
                        <Cell key={key} fill={COLORS[key]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

// src/lib/api.ts
export type SiteRecord = {
  id: number;
  url: string;
  name: string;
  ping_interval: number;
  com?: Record<string, unknown> | null;
};

export async function fetchSites() {
  const res = await fetch("http://localhost:8000/sites");
  if (!res.ok) throw new Error("Ошибка при загрузке сайтов");
  return res.json() as Promise<SiteRecord[]>;
}

export async function createSite(url: string, name: string, ping_interval = 30) {
  const res = await fetch("http://localhost:8000/sites", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url, name, ping_interval }),
  });
  if (!res.ok) throw new Error("Ошибка при создании сайта");
  return res.json() as Promise<SiteRecord>;
}

export async function updateSite(id: number, data: { url: string; name: string; ping_interval: number }) {
  const res = await fetch(`http://localhost:8000/sites/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Ошибка при обновлении сайта");
  return res.json() as Promise<SiteRecord>;
}

export async function deleteSite(id: number) {
  const res = await fetch(`http://localhost:8000/sites/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Ошибка при удалении сайта");
  return true;
}

export async function patchSiteParams(id: number, params: { com?: Record<string, unknown> | null }) {
  const res = await fetch(`http://localhost:8000/sites/${id}/params`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error("Ошибка при обновлении параметров сайта");
  return res.json() as Promise<SiteRecord>;
}

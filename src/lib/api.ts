export async function createSite(url: string, name: string) {
  const res = await fetch("http://localhost:8000/sites", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url, name }),
  });

  if (!res.ok) {
    throw new Error("Ошибка при создании сайта");
  }

  return res.json() as Promise<{ id: number; url: string; name: string }>;
}

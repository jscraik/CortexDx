export async function httpAdapter<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const res = await fetch(input, init);
  const contentType = res.headers.get("content-type") || "";
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
  if (contentType.includes("application/json")) return (await res.json()) as T;
  return (await res.text()) as T;
}

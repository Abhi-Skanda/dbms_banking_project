// Tiny fetch wrapper: throws Error(message) using the API's { error } body.
export async function api<T>(url: string, opts?: { method?: string; body?: unknown }): Promise<T> {
  const res = await fetch(url, {
    method: opts?.method ?? 'GET',
    headers: opts?.body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: opts?.body !== undefined ? JSON.stringify(opts.body) : undefined,
    cache: 'no-store',
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error ?? `Request failed (${res.status})`);
  return data as T;
}

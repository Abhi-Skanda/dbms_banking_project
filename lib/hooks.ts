'use client';
import { useCallback, useEffect, useState } from 'react';
import { api } from './client';

/** GET a URL; pass null to skip. Call reload() after a change. */
export function useApi<T>(url: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    setLoading(true);
    api<T>(url)
      .then((d) => { if (!cancelled) { setData(d); setError(null); } })
      .catch((e: Error) => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [url, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { data, error, loading, reload };
}

export type NoticeState = { type: 'ok' | 'err'; text: string } | null;

/** Runs a mutation, tracks busy state and produces a success/error notice. */
export function useAction() {
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<NoticeState>(null);

  const run = useCallback(async <T,>(fn: () => Promise<T>, okText: string | ((r: T) => string)): Promise<T | null> => {
    setBusy(true);
    setNotice(null);
    try {
      const r = await fn();
      setNotice({ type: 'ok', text: typeof okText === 'function' ? okText(r) : okText });
      return r;
    } catch (e) {
      setNotice({ type: 'err', text: (e as Error).message });
      return null;
    } finally {
      setBusy(false);
    }
  }, []);

  return { run, busy, notice, setNotice };
}

export function useDebounced<T>(value: T, ms = 300): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

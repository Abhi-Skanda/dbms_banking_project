export const inr = (v: string | number | null | undefined) =>
  v == null || v === '' ? '—' : new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(v));

export const dateTime = (v: string) =>
  new Date(v).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });

// Plain 'YYYY-MM-DD' strings (DATE columns) -> readable date
export const date = (v: string | null | undefined) => {
  if (!v) return '—';
  const d = new Date(v.length === 10 ? `${v}T00:00:00` : v);
  return d.toLocaleDateString('en-IN', { dateStyle: 'medium' });
};

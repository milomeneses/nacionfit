/** Public base URL where the API is reachable from the internet (for the iOS app). */
export const PUBLIC_API_BASE =
  import.meta.env.VITE_API_PUBLIC_URL ?? 'https://api.tu-dominio.com';

export function webhookUrl(token: string): string {
  return `${PUBLIC_API_BASE}/api/health/webhook/${token}`;
}

/** Minutes → "7h 12m". */
export function fmtSleep(min: number | null | undefined): string {
  if (min == null) return '—';
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return `${h}h ${m.toString().padStart(2, '0')}m`;
}

/** ISO timestamp → "25/05/2026 07:10" (Argentine), or a fallback. */
export function fmtDateTimeEs(iso: string | null): string {
  if (!iso) return 'Sin sincronizar aún';
  return new Date(iso).toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

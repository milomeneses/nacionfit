// Parses Health Auto Export (iOS) payloads into per-day health metrics.
//
// The app's "REST API" automation posts JSON. We accept several shapes for
// robustness:
//   - { data: { metrics: [ { name, units, data: [...] } ] } }   (real app)
//   - { metrics: [...] } | { data: [...] } | [ ... ]             (spec form)
//
// Each metric has a `name` and a `data` array of samples. Daily metrics
// (steps, energy) carry { date, qty, source }; sleep samples carry stage
// fields (deep/rem/core/awake/asleep) plus sleepStart/sleepEnd.

export interface DayMetrics {
  sleepMinutes?: number;
  deepSleepMinutes?: number;
  remSleepMinutes?: number;
  awakeMinutes?: number;
  hrvMs?: number;
  restingHr?: number;
  steps?: number;
  activeCalories?: number;
  source?: string;
}

type Json = Record<string, unknown>;

function isObject(v: unknown): v is Json {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function num(v: unknown): number | undefined {
  if (typeof v === 'number') return Number.isFinite(v) ? v : undefined;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number.parseFloat(v);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

/**
 * Sleep stage / duration values arrive in hours in some HAE versions and in
 * minutes in others. Values <= 24 are treated as hours, otherwise as minutes.
 */
function toMinutes(v: number | undefined): number | undefined {
  if (v === undefined || v < 0) return undefined;
  return v <= 24 ? Math.round(v * 60) : Math.round(v);
}

/** Extract the local calendar day and a sortable timestamp from a HAE date. */
export function parseHaeDate(input: unknown): { day: string; ts: number } | null {
  if (typeof input !== 'string') return null;
  const m = input.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const day = `${m[1]}-${m[2]}-${m[3]}`;
  // Normalise "2024-01-01 07:30:00 -0800" -> ISO so Date.parse can sort it.
  const iso = input.replace(' ', 'T').replace(/\s*([+-]\d{2})(\d{2})$/, '$1:$2');
  const parsed = Date.parse(iso);
  return { day, ts: Number.isNaN(parsed) ? Date.parse(day) : parsed };
}

function normalizeName(name: unknown): string {
  return typeof name === 'string'
    ? name.toLowerCase().replace(/[\s_]+/g, ' ').trim()
    : '';
}

function lowerKeys(obj: Json): Json {
  const out: Json = {};
  for (const k of Object.keys(obj)) out[k.toLowerCase()] = obj[k];
  return out;
}

function getMetrics(body: unknown): Json[] {
  if (Array.isArray(body)) return body.filter(isObject);
  if (isObject(body)) {
    const data = body.data;
    if (isObject(data) && Array.isArray(data.metrics)) return data.metrics.filter(isObject);
    if (Array.isArray(body.metrics)) return body.metrics.filter(isObject);
    if (Array.isArray(data)) return data.filter(isObject);
  }
  return [];
}

export function parseHealthExport(body: unknown): Map<string, DayMetrics> {
  const days = new Map<string, DayMetrics>();
  const hrvTs = new Map<string, number>();
  const hrTs = new Map<string, number>();

  const get = (day: string): DayMetrics => {
    let d = days.get(day);
    if (!d) {
      d = {};
      days.set(day, d);
    }
    return d;
  };

  for (const metric of getMetrics(body)) {
    const name = normalizeName(metric.name);
    const samples = Array.isArray(metric.data) ? metric.data.filter(isObject) : [];

    for (const raw of samples) {
      const p = lowerKeys(raw);
      const source = typeof p.source === 'string' ? p.source.slice(0, 40) : undefined;

      if (name === 'sleep analysis') {
        const when = parseHaeDate(p.sleepend ?? p.date);
        if (!when) continue;
        const d = get(when.day);
        const deep = toMinutes(num(p.deep));
        const rem = toMinutes(num(p.rem));
        const awake = toMinutes(num(p.awake));
        const core = toMinutes(num(p.core));
        const asleep = toMinutes(num(p.asleep));
        const total =
          asleep ??
          ([core, deep, rem].some((x) => x !== undefined)
            ? (core ?? 0) + (deep ?? 0) + (rem ?? 0)
            : toMinutes(num(p.qty)));
        if (total !== undefined) d.sleepMinutes = (d.sleepMinutes ?? 0) + total;
        if (deep !== undefined) d.deepSleepMinutes = (d.deepSleepMinutes ?? 0) + deep;
        if (rem !== undefined) d.remSleepMinutes = (d.remSleepMinutes ?? 0) + rem;
        if (awake !== undefined) d.awakeMinutes = (d.awakeMinutes ?? 0) + awake;
        if (source) d.source = source;
        continue;
      }

      const when = parseHaeDate(p.date);
      const qty = num(p.qty);
      if (!when || qty === undefined) continue;
      const d = get(when.day);
      if (source) d.source = source;

      switch (name) {
        case 'heart rate variability':
        case 'heart rate variability sdnn': {
          if (when.ts >= (hrvTs.get(when.day) ?? -Infinity)) {
            hrvTs.set(when.day, when.ts);
            d.hrvMs = Math.round(qty * 100) / 100;
          }
          break;
        }
        case 'resting heart rate': {
          if (when.ts >= (hrTs.get(when.day) ?? -Infinity)) {
            hrTs.set(when.day, when.ts);
            d.restingHr = Math.round(qty);
          }
          break;
        }
        case 'step count':
          d.steps = (d.steps ?? 0) + Math.round(qty);
          break;
        case 'active energy':
        case 'active energy burned':
          d.activeCalories = (d.activeCalories ?? 0) + Math.round(qty);
          break;
        default:
          break;
      }
    }
  }

  return days;
}

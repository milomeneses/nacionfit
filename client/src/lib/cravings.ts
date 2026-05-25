import type { CravingAction, CravingTrigger } from '@mi-cocina/shared';

export const TRIGGER_OPTIONS: { value: CravingTrigger; label: string }[] = [
  { value: 'estres', label: 'Estrés' },
  { value: 'cansancio', label: 'Cansancio' },
  { value: 'aburrimiento', label: 'Aburrimiento' },
  { value: 'hambre', label: 'Hambre real' },
  { value: 'vista', label: 'Lo vi / olí' },
  { value: 'social', label: 'Social' },
  { value: 'emocion', label: 'Emoción' },
  { value: 'otro', label: 'Otro' },
];

export const ACTION_OPTIONS: { value: CravingAction; label: string }[] = [
  { value: 'cedi', label: 'Cedí' },
  { value: 'cedi_planeado', label: 'Cedí (planeado)' },
  { value: 'porcion_chica', label: 'Porción chica' },
  { value: 'redirigi', label: 'Me redirigí' },
  { value: 'espere', label: 'Esperé y pasó' },
  { value: 'agua_prot', label: 'Agua / proteína' },
];

export const TRIGGER_LABELS = Object.fromEntries(
  TRIGGER_OPTIONS.map((o) => [o.value, o.label]),
) as Record<CravingTrigger, string>;

export const ACTION_LABELS = Object.fromEntries(
  ACTION_OPTIONS.map((o) => [o.value, o.label]),
) as Record<CravingAction, string>;

export const PROTOCOL_STEPS = [
  'Pará y respirá: hacé tres respiraciones lentas antes de decidir.',
  'Nombrá el antojo: ¿qué querés y qué tan fuerte es, del 1 al 10?',
  'Tomá agua o algo con proteína y esperá unos minutos.',
  'Buscá el disparador real: ¿estrés, cansancio, aburrimiento o hambre?',
  'Decidí con intención: si todavía lo querés, elegí una porción chica y disfrutala sin culpa.',
];

export function fmtTimeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60_000);
  if (min < 1) return 'recién';
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  if (d === 1) return 'ayer';
  if (d < 7) return `hace ${d} días`;
  const w = Math.floor(d / 7);
  if (w < 5) return `hace ${w} sem`;
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' });
}

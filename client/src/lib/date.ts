export function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function todayStr(): string {
  return toDateStr(new Date());
}

export function daysAgoStr(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return toDateStr(d);
}

/** "Domingo 25 de mayo" in Argentine Spanish. */
export function formatLongEs(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00`);
  const s = d
    .toLocaleDateString('es-AR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    })
    .replace(',', '');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Consecutive saved days ending at today. If today isn't saved yet the streak
 * is measured from yesterday, so an unsaved "today" never breaks the run.
 */
export function computeStreak(savedDates: Set<string>, today: string): number {
  const cur = new Date(`${today}T12:00:00`);
  if (!savedDates.has(toDateStr(cur))) {
    cur.setDate(cur.getDate() - 1);
  }
  let streak = 0;
  while (savedDates.has(toDateStr(cur))) {
    streak += 1;
    cur.setDate(cur.getDate() - 1);
  }
  return streak;
}

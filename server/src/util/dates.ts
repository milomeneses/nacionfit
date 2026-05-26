import { eq } from 'drizzle-orm';
import type { WeekDay } from '@nacionfit/shared';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';

const WEEKDAYS: WeekDay[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

export async function userTimezone(userId: number): Promise<string> {
  const [u] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return u?.timezone ?? 'UTC';
}

export function dateInTz(d: Date, tz: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

export function todayInTz(tz: string): string {
  return dateInTz(new Date(), tz);
}

export function weekdayKey(dateStr: string): WeekDay {
  const [y, m, d] = dateStr.split('-').map(Number);
  return WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

export function addDays(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}

export function mondayOf(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() - ((dt.getUTCDay() + 6) % 7));
  return dt.toISOString().slice(0, 10);
}

export function weekDates(monday: string): { day: WeekDay; date: string }[] {
  const order: WeekDay[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
  return order.map((day, i) => ({ day, date: addDays(monday, i) }));
}

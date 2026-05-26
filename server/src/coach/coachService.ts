import { and, asc, desc, eq, gte, sql } from 'drizzle-orm';
import type { CravingTrigger, ProjectIntensity } from '@nacionfit/shared';
import { db } from '../db/index.js';
import {
  aiConversations,
  aiMessages,
  cravings,
  dailyLogs,
  habitsLogs,
  healthData,
  hydrationLogs,
  supplementLogs,
  supplements,
  trainingBlocks,
  users,
  workouts,
} from '../db/schema.js';
import { complete, streamChat, type ChatMessage } from './groq.js';
import { addDays, mondayOf } from '../util/dates.js';
import { parseSlot, parseStructure } from '../training/recommend.js';

const FOCUS_LABELS: Record<string, string> = {
  hypertrophy: 'hipertrofia',
  strength: 'fuerza',
  cut: 'definición',
  recomp: 'recomposición',
  maintenance: 'mantenimiento',
};

const TRIGGER_LABELS: Record<CravingTrigger, string> = {
  estres: 'estrés',
  cansancio: 'cansancio',
  aburrimiento: 'aburrimiento',
  hambre: 'hambre real',
  vista: 'verla u olerla',
  social: 'situación social',
  emocion: 'una emoción',
  otro: 'otro',
};

const INTENSITY_SCORE: Record<ProjectIntensity, number> = {
  low: 1,
  medium: 2,
  high: 3,
  crisis: 4,
};

function dateAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
}

function topOf<T extends string>(values: T[]): { value: T; count: number } | null {
  const counts = new Map<T, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best: { value: T; count: number } | null = null;
  for (const [value, count] of counts) if (!best || count > best.count) best = { value, count };
  return best;
}

export async function buildSystemPrompt(userId: number): Promise<string> {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  const name = user?.name?.split(' ')[0] ?? 'la persona';
  const since28 = dateAgo(28);

  // Habits hit rate (4 weeks)
  const [{ done, total }] = await db
    .select({
      done: sql<number>`sum(case when ${habitsLogs.completed} then 1 else 0 end)`,
      total: sql<number>`count(*)`,
    })
    .from(habitsLogs)
    .where(and(eq(habitsLogs.userId, userId), gte(habitsLogs.date, since28)));
  const hitRate = Number(total) > 0 ? Math.round((Number(done) / Number(total)) * 100) : null;

  // Avg sleep (4 weeks)
  const [{ avgSleepMin }] = await db
    .select({ avgSleepMin: sql<number>`avg(${healthData.sleepMinutes})` })
    .from(healthData)
    .where(and(eq(healthData.userId, userId), gte(healthData.date, since28)));
  const avgSleep = avgSleepMin != null ? Math.round((Number(avgSleepMin) / 60) * 10) / 10 : null;

  // Avg project stress (4 weeks)
  const stressRows = await db
    .select({ intensity: dailyLogs.projectIntensity })
    .from(dailyLogs)
    .where(and(eq(dailyLogs.userId, userId), gte(dailyLogs.date, since28)));
  const stressScores = stressRows
    .map((r) => (r.intensity ? INTENSITY_SCORE[r.intensity] : null))
    .filter((x): x is number => x != null);
  const avgStress =
    stressScores.length > 0
      ? stressScores.reduce((a, b) => a + b, 0) / stressScores.length
      : null;
  const stressLabel =
    avgStress == null
      ? 'sin datos'
      : avgStress < 1.7
        ? 'bajo'
        : avgStress < 2.5
          ? 'medio'
          : avgStress < 3.3
            ? 'alto'
            : 'crisis';

  // Weight trend (4 weeks)
  const weightRows = await db
    .select({ date: dailyLogs.date, weight: dailyLogs.weightKg })
    .from(dailyLogs)
    .where(and(eq(dailyLogs.userId, userId), gte(dailyLogs.date, since28)))
    .orderBy(asc(dailyLogs.date));
  const weights = weightRows
    .map((r) => (r.weight != null ? Number(r.weight) : null))
    .filter((x): x is number => x != null);
  let weightTrend = 'sin datos de peso';
  if (weights.length >= 2) {
    const delta = Math.round((weights[weights.length - 1] - weights[0]) * 10) / 10;
    if (delta <= -0.3) weightTrend = `viene bajando, ${Math.abs(delta)}kg en el último mes`;
    else if (delta >= 0.3) weightTrend = `subió ${delta}kg en el último mes`;
    else weightTrend = 'se mantuvo estable este mes';
  }

  // Cravings (last 20)
  const recentCravings = await db
    .select({ trigger: cravings.trigger, food: cravings.food, action: cravings.action })
    .from(cravings)
    .where(eq(cravings.userId, userId))
    .orderBy(desc(cravings.timestamp))
    .limit(20);
  const topTrigger = topOf(recentCravings.map((c) => c.trigger));
  const topFood = topOf(recentCravings.map((c) => c.food));
  const managedPct =
    recentCravings.length > 0
      ? Math.round(
          (recentCravings.filter((c) => c.action !== 'cedi').length / recentCravings.length) *
            100,
        )
      : null;

  // Variance (last two weeks of habit completion, weekday vs weekend)
  const varianceDesc = await describeVariance(userId);

  const lines: string[] = [];
  lines.push(`- Hábitos: completa el ${hitRate ?? '—'}% de sus hábitos diarios.`);
  lines.push(`- Sueño promedio: ${avgSleep != null ? `${avgSleep}h` : 'sin datos'} por noche.`);
  lines.push(`- Estrés del proyecto: nivel promedio ${stressLabel}.`);
  lines.push(`- Peso: ${weightTrend}.`);
  if (recentCravings.length > 0) {
    lines.push(
      `- Antojos (últimos ${recentCravings.length}): disparador más común "${
        topTrigger ? TRIGGER_LABELS[topTrigger.value] : '—'
      }", comida más frecuente "${topFood?.value ?? '—'}", manejó el ${managedPct}% sin ceder.`,
    );
  } else {
    lines.push('- Antojos: todavía no registró ninguno.');
  }
  lines.push(`- Consistencia (varianza semana vs fin de semana): ${varianceDesc}.`);

  for (const l of await describeTraining(userId, user?.timezone ?? 'UTC')) lines.push(l);

  return `Sos el coach personal de ${name} dentro de la app NacionFit. Hablás en español rioplatense (vos, tenés, querés), cálido pero directo.

Tu enfoque es la Entrevista Motivacional:
- Hacés preguntas abiertas, reflejás lo que ${name} dice, afirmás sus fortalezas y respetás su autonomía: las decisiones son siempre suyas.
- NUNCA usás las palabras "deberías", "tenés que" ni "no es saludable", y nunca moralizás ni juzgás. En vez de eso ofrecés observaciones, preguntas curiosas y opciones.
- Cuando ${name} cuenta un antojo, un atracón o una "caída": primero empatía y validación sin juicio, después curiosidad por el contexto, y recién ahí —si viene al caso— UNA sola sugerencia chiquita y concreta. Nunca arranques por la solución.
- Mensajes cortos: 1 a 3 oraciones por defecto. Solo te extendés si ${name} te pide una explicación.
- Escribís en español argentino, pero dejás los términos técnicos en su idioma original (HRV, deep sleep, etc.).
- Usás *cursiva* (con asteriscos) muy de vez en cuando, como máximo para resaltar UN concepto clave por mensaje.
- No inventás datos: si no sabés algo de ${name}, preguntás.

Tenés acceso a los datos reales de ${name} y los podés citar con naturalidad cuando sumen (no los enumeres de golpe):

DATOS DE ${name} (últimas 4 semanas salvo que se indique):
${lines.join('\n')}

Respondé siempre como el coach, en primera persona, sin encabezados ni listas salvo que ayuden de verdad.`;
}

async function describeTraining(userId: number, tz: string): Promise<string[]> {
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  const monday = mondayOf(today);
  const out: string[] = [];

  const [block] = await db
    .select()
    .from(trainingBlocks)
    .where(eq(trainingBlocks.userId, userId))
    .orderBy(desc(trainingBlocks.startDate))
    .limit(1);
  if (!block) return ['- Entrenamiento: todavía no configuró un plan.'];

  out.push(
    `- Plan activo: "${block.name}", foco ${FOCUS_LABELS[block.focus] ?? block.focus}.`,
  );

  // This week's workout completion
  const structure = parseStructure(block.weeklyStructure);
  const plannedDays = Object.values(structure).filter((s) => {
    const t = parseSlot(s).type;
    return t === 'crossfit' || t === 'strength' || t === 'cardio';
  }).length;
  const weekWorkouts = await db
    .select({ type: workouts.type, rpe: workouts.rpe, completedAt: workouts.completedAt, date: workouts.date })
    .from(workouts)
    .where(and(eq(workouts.userId, userId), gte(workouts.date, monday)));
  const completed = weekWorkouts.filter(
    (w) => w.completedAt != null && (w.type === 'crossfit' || w.type === 'strength' || w.type === 'cardio'),
  ).length;
  out.push(`- Esta semana entrenó ${completed} de ${plannedDays} sesiones previstas.`);

  // Yesterday's RPE
  const yesterday = addDays(today, -1);
  const [yWorkout] = await db
    .select({ rpe: workouts.rpe, type: workouts.type })
    .from(workouts)
    .where(and(eq(workouts.userId, userId), eq(workouts.date, yesterday)))
    .orderBy(desc(workouts.id))
    .limit(1);
  if (yWorkout?.rpe != null) out.push(`- RPE de ayer: ${yWorkout.rpe}/10.`);

  // Supplement adherence this week
  const [{ active }] = await db
    .select({ active: sql<number>`count(*)` })
    .from(supplements)
    .where(and(eq(supplements.userId, userId), eq(supplements.active, true)));
  const takenLogs = await db
    .select({ id: supplementLogs.id })
    .from(supplementLogs)
    .where(
      and(eq(supplementLogs.userId, userId), gte(supplementLogs.date, monday), eq(supplementLogs.taken, true)),
    );
  const daysElapsed = Math.max(1, Math.round((Date.parse(today) - Date.parse(monday)) / 86_400_000) + 1);
  const expected = Number(active) * daysElapsed;
  if (expected > 0) {
    out.push(`- Adherencia a suplementos esta semana: ~${Math.round((takenLogs.length / expected) * 100)}%.`);
  }

  // Hydration last 7 days
  const hydra = await db
    .select({ target: hydrationLogs.targetMl, consumed: hydrationLogs.consumedMl })
    .from(hydrationLogs)
    .where(and(eq(hydrationLogs.userId, userId), gte(hydrationLogs.date, addDays(today, -7))));
  const hydraPcts = hydra
    .filter((h) => h.target != null && h.target > 0)
    .map((h) => h.consumed / (h.target as number));
  if (hydraPcts.length > 0) {
    const avg = Math.round((hydraPcts.reduce((a, b) => a + b, 0) / hydraPcts.length) * 100);
    out.push(`- Hidratación: viene cumpliendo ~${avg}% de su objetivo diario.`);
  }

  // Recovery last 7 days
  const recovery = await db
    .select({ sleep: healthData.sleepMinutes, hrv: healthData.hrvMs })
    .from(healthData)
    .where(and(eq(healthData.userId, userId), gte(healthData.date, addDays(today, -7))));
  const sleeps = recovery.map((r) => r.sleep).filter((x): x is number => x != null);
  const hrvs = recovery.map((r) => (r.hrv != null ? Number(r.hrv) : null)).filter((x): x is number => x != null);
  if (sleeps.length || hrvs.length) {
    const parts: string[] = [];
    if (sleeps.length) parts.push(`sueño ~${(sleeps.reduce((a, b) => a + b, 0) / sleeps.length / 60).toFixed(1)}h`);
    if (hrvs.length) parts.push(`HRV ~${Math.round(hrvs.reduce((a, b) => a + b, 0) / hrvs.length)}ms`);
    out.push(`- Recuperación (últimos 7 días): ${parts.join(', ')}.`);
  }

  return out;
}

async function describeVariance(userId: number): Promise<string> {
  const since = dateAgo(21);
  const rows = await db
    .select({ date: habitsLogs.date, completed: habitsLogs.completed })
    .from(habitsLogs)
    .where(and(eq(habitsLogs.userId, userId), gte(habitsLogs.date, since)));
  if (rows.length === 0) return 'sin datos suficientes';

  const done = new Map<string, number>();
  const seen = new Set<string>();
  for (const r of rows) {
    seen.add(r.date);
    if (r.completed) done.set(r.date, (done.get(r.date) ?? 0) + 1);
  }
  const wd: number[] = [];
  const we: number[] = [];
  for (const date of seen) {
    const [y, m, d] = date.split('-').map(Number);
    const dow = (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
    const rate = (done.get(date) ?? 0) / 6;
    (dow <= 4 ? wd : we).push(rate);
  }
  if (wd.length === 0 || we.length === 0) return 'sin datos suficientes';
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const v = Math.round(Math.abs(mean(wd) - mean(we)) * 100) / 100;
  return `${v} (meta 0.15)${v <= 0.15 ? ', muy pareja' : v < 0.25 ? ', razonable' : ', el fin de semana se dispersa'}`;
}

/** Streams the assistant reply; persists both the user and assistant messages. */
export async function* chat(
  userId: number,
  conversationId: number,
  userMessage: string,
): AsyncGenerator<string> {
  await db.insert(aiMessages).values({ conversationId, role: 'user', content: userMessage });
  await db
    .update(aiConversations)
    .set({ lastMessageAt: new Date() })
    .where(eq(aiConversations.id, conversationId));

  const system = await buildSystemPrompt(userId);
  const history = await db
    .select()
    .from(aiMessages)
    .where(eq(aiMessages.conversationId, conversationId))
    .orderBy(asc(aiMessages.id));

  const messages: ChatMessage[] = [
    { role: 'system', content: system },
    ...history
      .filter((m) => m.role !== 'system')
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
  ];

  let acc = '';
  let tokens: number | null = null;
  for await (const chunk of streamChat(messages)) {
    if (chunk.delta) {
      acc += chunk.delta;
      yield chunk.delta;
    }
    if (chunk.totalTokens) tokens = chunk.totalTokens;
  }

  await db.insert(aiMessages).values({
    conversationId,
    role: 'assistant',
    content: acc,
    tokensUsed: tokens,
  });
  await db
    .update(aiConversations)
    .set({ lastMessageAt: new Date() })
    .where(eq(aiConversations.id, conversationId));

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(aiMessages)
    .where(eq(aiMessages.conversationId, conversationId));
  if (Number(count) >= 10) {
    try {
      await summarize(conversationId);
    } catch {
      // a failed summary must not break the chat
    }
  }
}

/** Generates a 2-sentence memory summary stored on the conversation. */
export async function summarize(conversationId: number): Promise<void> {
  const msgs = await db
    .select()
    .from(aiMessages)
    .where(eq(aiMessages.conversationId, conversationId))
    .orderBy(asc(aiMessages.id));
  if (msgs.length < 2) return;

  const transcript = msgs
    .filter((m) => m.role !== 'system')
    .map((m) => `${m.role === 'user' ? 'Usuario' : 'Coach'}: ${m.content}`)
    .join('\n')
    .slice(0, 6000);

  const summary = await complete(
    [
      {
        role: 'system',
        content:
          'Resumí esta conversación entre un usuario y su coach en exactamente 2 oraciones, en español rioplatense, enfocándote en qué trabajó el usuario y cualquier acuerdo o insight. Sin encabezados ni listas.',
      },
      { role: 'user', content: transcript },
    ],
    160,
  );

  await db
    .update(aiConversations)
    .set({ summary: summary.trim() })
    .where(eq(aiConversations.id, conversationId));
}

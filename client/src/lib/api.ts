import type {
  AdminMetrics,
  AdminUpdateUserInput,
  AdminUserDetail,
  AdminUserSummary,
  AuditLogEntry,
  AuthResponse,
  Craving,
  CravingAction,
  CravingContext,
  CravingTrigger,
  CoachConversation,
  CoachMessage,
  CravingsHeatmap,
  Meals,
  ProjectIntensity,
  CravingStats,
  CreateCravingRequest,
  SleepVsCravings,
  StressCravings,
  TopTriggersResult,
  VarianceTrend,
  DailyLog,
  DailyLogInput,
  HabitLog,
  HabitToggleRequest,
  HealthData,
  LoginRequest,
  PushSubscriptionInput,
  RegisterRequest,
  User,
  WebhookTokenInfo,
  WeeklyReview,
  WeeklyReviewSummary,
  CreateWorkoutInput,
  DrinkSource,
  HydrationToday,
  MobilityRoutine,
  ProposedWorkout,
  Supplement,
  SupplementDoseToday,
  TrainingPlanResponse,
  TrainingWeekRecap,
  Workout,
} from '@nacionfit/shared';

const ACCESS_KEY = 'mc.accessToken';
const REFRESH_KEY = 'mc.refreshToken';

export const tokenStore = {
  get access() {
    return localStorage.getItem(ACCESS_KEY);
  },
  get refresh() {
    return localStorage.getItem(REFRESH_KEY);
  },
  set(tokens: { accessToken: string; refreshToken: string }) {
    localStorage.setItem(ACCESS_KEY, tokens.accessToken);
    localStorage.setItem(REFRESH_KEY, tokens.refreshToken);
  },
  clear() {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};

async function parseError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: string };
    return body.error ?? `Request failed (${res.status})`;
  } catch {
    return `Request failed (${res.status})`;
  }
}

export async function register(body: RegisterRequest): Promise<AuthResponse> {
  const res = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await parseError(res));
  const data = (await res.json()) as AuthResponse;
  tokenStore.set(data);
  return data;
}

export async function login(body: LoginRequest): Promise<AuthResponse> {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await parseError(res));
  const data = (await res.json()) as AuthResponse;
  tokenStore.set(data);
  return data;
}

async function authFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${tokenStore.access ?? ''}`,
    ...(init.headers as Record<string, string> | undefined),
  };
  if (init.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
  return fetch(path, { ...init, headers });
}

export async function fetchMe(): Promise<User> {
  const res = await authFetch('/api/auth/me');
  if (!res.ok) throw new Error(await parseError(res));
  return (await res.json()) as User;
}

export async function getDay(date: string): Promise<DailyLog | null> {
  const res = await authFetch(`/api/days/${date}`);
  if (!res.ok) throw new Error(await parseError(res));
  return (await res.json()) as DailyLog | null;
}

export async function putDay(date: string, input: DailyLogInput): Promise<DailyLog> {
  const res = await authFetch(`/api/days/${date}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return (await res.json()) as DailyLog;
}

export async function getDays(from: string, to: string): Promise<DailyLog[]> {
  const res = await authFetch(`/api/days?from=${from}&to=${to}`);
  if (!res.ok) throw new Error(await parseError(res));
  return (await res.json()) as DailyLog[];
}

export async function toggleHabit(body: HabitToggleRequest): Promise<HabitLog> {
  const res = await authFetch('/api/habits/toggle', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return (await res.json()) as HabitLog;
}

export async function getHealthMe(): Promise<HealthData[]> {
  const res = await authFetch('/api/health/me');
  if (!res.ok) throw new Error(await parseError(res));
  return (await res.json()) as HealthData[];
}

export async function getHealthToken(): Promise<WebhookTokenInfo> {
  const res = await authFetch('/api/health/token');
  if (!res.ok) throw new Error(await parseError(res));
  return (await res.json()) as WebhookTokenInfo;
}

export async function regenerateHealthToken(): Promise<WebhookTokenInfo> {
  const res = await authFetch('/api/health/token', { method: 'POST' });
  if (!res.ok) throw new Error(await parseError(res));
  return (await res.json()) as WebhookTokenInfo;
}

export async function getCravingContext(): Promise<CravingContext> {
  const res = await authFetch('/api/cravings/context');
  if (!res.ok) throw new Error(await parseError(res));
  return (await res.json()) as CravingContext;
}

export async function createCraving(body: CreateCravingRequest): Promise<Craving> {
  const res = await authFetch('/api/cravings', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return (await res.json()) as Craving;
}

export async function getCravings(limit = 20): Promise<Craving[]> {
  const res = await authFetch(`/api/cravings?limit=${limit}`);
  if (!res.ok) throw new Error(await parseError(res));
  return (await res.json()) as Craving[];
}

export async function getCravingStats(): Promise<CravingStats> {
  const res = await authFetch('/api/cravings/stats');
  if (!res.ok) throw new Error(await parseError(res));
  return (await res.json()) as CravingStats;
}

export async function getCravingsHeatmap(weeks = 6): Promise<CravingsHeatmap> {
  const res = await authFetch(`/api/patterns/cravings-heatmap?weeks=${weeks}`);
  if (!res.ok) throw new Error(await parseError(res));
  return (await res.json()) as CravingsHeatmap;
}

export async function getSleepVsCravings(weeks = 8): Promise<SleepVsCravings> {
  const res = await authFetch(`/api/patterns/sleep-vs-cravings?weeks=${weeks}`);
  if (!res.ok) throw new Error(await parseError(res));
  return (await res.json()) as SleepVsCravings;
}

export async function getVariance(weeks = 6): Promise<VarianceTrend> {
  const res = await authFetch(`/api/patterns/variance?weeks=${weeks}`);
  if (!res.ok) throw new Error(await parseError(res));
  return (await res.json()) as VarianceTrend;
}

export async function getTopTriggers(weeks = 8): Promise<TopTriggersResult> {
  const res = await authFetch(`/api/patterns/top-triggers?weeks=${weeks}`);
  if (!res.ok) throw new Error(await parseError(res));
  return (await res.json()) as TopTriggersResult;
}

export async function getStressCravings(weeks = 6): Promise<StressCravings> {
  const res = await authFetch(`/api/patterns/stress-cravings?weeks=${weeks}`);
  if (!res.ok) throw new Error(await parseError(res));
  return (await res.json()) as StressCravings;
}

export async function listConversations(): Promise<CoachConversation[]> {
  const res = await authFetch('/api/coach/conversations');
  if (!res.ok) throw new Error(await parseError(res));
  return (await res.json()) as CoachConversation[];
}

export async function createConversation(): Promise<CoachConversation> {
  const res = await authFetch('/api/coach/conversations', { method: 'POST' });
  if (!res.ok) throw new Error(await parseError(res));
  return (await res.json()) as CoachConversation;
}

export async function getCoachMessages(id: number): Promise<CoachMessage[]> {
  const res = await authFetch(`/api/coach/conversations/${id}/messages`);
  if (!res.ok) throw new Error(await parseError(res));
  return (await res.json()) as CoachMessage[];
}

export async function transcribeVoice(blob: Blob): Promise<string> {
  const res = await authFetch('/api/coach/voice', {
    method: 'POST',
    body: blob,
    headers: { 'Content-Type': blob.type || 'audio/webm' },
  });
  if (!res.ok) throw new Error(await parseError(res));
  return ((await res.json()) as { text: string }).text;
}

export async function getReviews(): Promise<WeeklyReviewSummary[]> {
  const res = await authFetch('/api/reviews');
  if (!res.ok) throw new Error(await parseError(res));
  return (await res.json()) as WeeklyReviewSummary[];
}

export async function getReview(weekStart: string): Promise<WeeklyReview> {
  const res = await authFetch(`/api/reviews/${weekStart}`);
  if (!res.ok) throw new Error(await parseError(res));
  return (await res.json()) as WeeklyReview;
}

export async function markReviewRead(weekStart: string): Promise<void> {
  await authFetch(`/api/reviews/${weekStart}/mark-read`, { method: 'POST' });
}

export async function generateReview(): Promise<WeeklyReview> {
  const res = await authFetch('/api/reviews/generate', { method: 'POST' });
  if (!res.ok) throw new Error(await parseError(res));
  return (await res.json()) as WeeklyReview;
}

export async function getVapidPublicKey(): Promise<string> {
  const res = await fetch('/api/push/vapid-public-key');
  if (!res.ok) throw new Error(await parseError(res));
  return ((await res.json()) as { publicKey: string }).publicKey;
}

export async function subscribePush(sub: PushSubscriptionInput): Promise<void> {
  const res = await authFetch('/api/push/subscribe', {
    method: 'POST',
    body: JSON.stringify(sub),
  });
  if (!res.ok) throw new Error(await parseError(res));
}

/** POSTs a message and streams the assistant reply, calling onDelta per token. */
export async function streamCoachMessage(
  id: number,
  content: string,
  onDelta: (delta: string) => void,
): Promise<void> {
  const res = await authFetch(`/api/coach/conversations/${id}/messages`, {
    method: 'POST',
    body: JSON.stringify({ content }),
  });
  if (!res.ok || !res.body) throw new Error(await parseError(res));

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buffer.indexOf('\n\n')) >= 0) {
      const chunk = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      const line = chunk.split('\n').find((l) => l.startsWith('data:'));
      if (!line) continue;
      const data = line.slice(5).trim();
      if (!data) continue;
      let evt: { delta?: string; error?: string };
      try {
        evt = JSON.parse(data);
      } catch {
        continue;
      }
      if (evt.error) throw new Error(evt.error);
      if (evt.delta) onDelta(evt.delta);
    }
  }
}

// ----- Admin -----

export interface AdminDay {
  id: number;
  date: string;
  meals: Meals | null;
  waterCount: number | null;
  sleepHours: number | null;
  mood: number | null;
  crossfit: boolean | null;
  energy: number | null;
  stress: number | null;
  projectIntensity: ProjectIntensity | null;
  weightKg: number | null;
  savedAt: string | null;
}

export interface AdminCravingRow {
  id: number;
  timestamp: string;
  food: string;
  intensity: number;
  trigger: CravingTrigger;
  action: CravingAction;
  note: string | null;
}

export interface AdminHealthRow {
  id: number;
  date: string;
  sleepMinutes: number | null;
  deepSleepMinutes: number | null;
  remSleepMinutes: number | null;
  hrvMs: number | null;
  restingHr: number | null;
  steps: number | null;
}

export async function getAdminUsers(): Promise<AdminUserSummary[]> {
  const res = await authFetch('/api/admin/users');
  if (!res.ok) throw new Error(await parseError(res));
  return (await res.json()) as AdminUserSummary[];
}

export async function getAdminUser(id: number): Promise<AdminUserDetail> {
  const res = await authFetch(`/api/admin/users/${id}`);
  if (!res.ok) throw new Error(await parseError(res));
  return (await res.json()) as AdminUserDetail;
}

export async function getAdminUserDays(id: number): Promise<AdminDay[]> {
  const res = await authFetch(`/api/admin/users/${id}/days`);
  if (!res.ok) throw new Error(await parseError(res));
  return (await res.json()) as AdminDay[];
}

export async function getAdminUserCravings(id: number): Promise<AdminCravingRow[]> {
  const res = await authFetch(`/api/admin/users/${id}/cravings`);
  if (!res.ok) throw new Error(await parseError(res));
  return (await res.json()) as AdminCravingRow[];
}

export async function getAdminUserHealth(id: number): Promise<AdminHealthRow[]> {
  const res = await authFetch(`/api/admin/users/${id}/health`);
  if (!res.ok) throw new Error(await parseError(res));
  return (await res.json()) as AdminHealthRow[];
}

export async function patchAdminUser(id: number, body: AdminUpdateUserInput): Promise<User> {
  const res = await authFetch(`/api/admin/users/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return (await res.json()) as User;
}

export async function deleteAdminUser(id: number, confirm: string): Promise<void> {
  const res = await authFetch(`/api/admin/users/${id}`, {
    method: 'DELETE',
    body: JSON.stringify({ confirm }),
  });
  if (!res.ok) throw new Error(await parseError(res));
}

export async function patchAdminDay(id: number, body: Partial<AdminDay>): Promise<AdminDay> {
  const res = await authFetch(`/api/admin/days/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return (await res.json()) as AdminDay;
}

export async function deleteAdminDay(id: number): Promise<void> {
  const res = await authFetch(`/api/admin/days/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(await parseError(res));
}

export async function deleteAdminCraving(id: number): Promise<void> {
  const res = await authFetch(`/api/admin/cravings/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(await parseError(res));
}

export async function getAdminMetrics(): Promise<AdminMetrics> {
  const res = await authFetch('/api/admin/metrics');
  if (!res.ok) throw new Error(await parseError(res));
  return (await res.json()) as AdminMetrics;
}

export async function getAdminAudit(): Promise<AuditLogEntry[]> {
  const res = await authFetch('/api/admin/audit');
  if (!res.ok) throw new Error(await parseError(res));
  return (await res.json()) as AuditLogEntry[];
}

// ----- Training / Supplements / Hydration / Mobility -----

export async function getTrainingPlan(): Promise<TrainingPlanResponse> {
  const res = await authFetch('/api/training/plan');
  if (!res.ok) throw new Error(await parseError(res));
  return (await res.json()) as TrainingPlanResponse;
}

export async function getTrainingToday(): Promise<ProposedWorkout> {
  const res = await authFetch('/api/training/today');
  if (!res.ok) throw new Error(await parseError(res));
  return (await res.json()) as ProposedWorkout;
}

export async function getTrainingRecap(): Promise<TrainingWeekRecap> {
  const res = await authFetch('/api/training/recap');
  if (!res.ok) throw new Error(await parseError(res));
  return (await res.json()) as TrainingWeekRecap;
}

export async function logWorkout(input: CreateWorkoutInput): Promise<Workout> {
  const res = await authFetch('/api/workouts', { method: 'POST', body: JSON.stringify(input) });
  if (!res.ok) throw new Error(await parseError(res));
  return (await res.json()) as Workout;
}

export async function getSupplementsToday(): Promise<SupplementDoseToday[]> {
  const res = await authFetch('/api/supplements/today');
  if (!res.ok) throw new Error(await parseError(res));
  return (await res.json()) as SupplementDoseToday[];
}

export async function getSupplements(): Promise<Supplement[]> {
  const res = await authFetch('/api/supplements');
  if (!res.ok) throw new Error(await parseError(res));
  return (await res.json()) as Supplement[];
}

export async function logSupplement(supplementId: number, taken: boolean): Promise<void> {
  const res = await authFetch('/api/supplements/log', {
    method: 'POST',
    body: JSON.stringify({ supplementId, taken }),
  });
  if (!res.ok) throw new Error(await parseError(res));
}

export async function getHydrationToday(): Promise<HydrationToday> {
  const res = await authFetch('/api/hydration/today');
  if (!res.ok) throw new Error(await parseError(res));
  return (await res.json()) as HydrationToday;
}

export async function logHydration(amountMl: number, source: DrinkSource): Promise<HydrationToday> {
  const res = await authFetch('/api/hydration/log', {
    method: 'POST',
    body: JSON.stringify({ amountMl, source }),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return (await res.json()) as HydrationToday;
}

export async function getMobilityRoutines(): Promise<MobilityRoutine[]> {
  const res = await authFetch('/api/mobility/routines');
  if (!res.ok) throw new Error(await parseError(res));
  return (await res.json()) as MobilityRoutine[];
}

export async function logMobility(routineId: number): Promise<void> {
  const res = await authFetch('/api/mobility/log', {
    method: 'POST',
    body: JSON.stringify({ routineId }),
  });
  if (!res.ok) throw new Error(await parseError(res));
}

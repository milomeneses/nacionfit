// Shared types between the NacionFit client and server.

/** A user as exposed to clients — never includes the password hash. */
export interface User {
  id: number;
  email: string;
  name: string;
  heightCm: number | null;
  targetWeightKg: number | null;
  targetDate: string | null; // ISO date (YYYY-MM-DD)
  timezone: string;
  createdAt: string; // ISO timestamp
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
  heightCm?: number | null;
  targetWeightKg?: number | null;
  targetDate?: string | null;
  timezone?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RefreshRequest {
  refreshToken: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

/** Response returned by /register and /login. */
export interface AuthResponse extends AuthTokens {
  user: User;
}

export interface ErrorResponse {
  error: string;
}

// ----- Daily logging -----

export type ProjectIntensity = 'low' | 'medium' | 'high' | 'crisis';

/** Canonical habit identifiers. The contract shared by client and server. */
export type HabitId =
  | 'meditacion'
  | 'lectura'
  | 'estiramiento'
  | 'sin_azucar'
  | 'suplementos'
  | 'pasos';

export interface Meals {
  desayuno: string;
  almuerzo: string;
  cena: string;
  snacks: string;
}

/** A single day's log, merged with that day's habit completion map. */
export interface DailyLog {
  date: string; // YYYY-MM-DD
  meals: Meals | null;
  waterCount: number | null;
  sleepHours: number | null;
  mood: number | null;
  crossfit: boolean | null;
  energy: number | null;
  stress: number | null;
  projectIntensity: ProjectIntensity | null;
  weightKg: number | null;
  savedAt: string | null; // ISO timestamp, null if the day was never saved
  habits: Record<HabitId, boolean>;
}

/** Upsert body for PUT /api/days/:date. All fields optional (partial save). */
export interface DailyLogInput {
  meals?: Meals | null;
  waterCount?: number | null;
  sleepHours?: number | null;
  mood?: number | null;
  crossfit?: boolean | null;
  energy?: number | null;
  stress?: number | null;
  projectIntensity?: ProjectIntensity | null;
  weightKg?: number | null;
}

export interface HabitToggleRequest {
  date: string;
  habitId: HabitId;
  completed: boolean;
}

export interface HabitLog {
  date: string;
  habitId: HabitId;
  completed: boolean;
}

// ----- Apple Health integration -----

export interface HealthData {
  date: string; // YYYY-MM-DD (the wake day)
  sleepMinutes: number | null;
  deepSleepMinutes: number | null;
  remSleepMinutes: number | null;
  awakeMinutes: number | null;
  hrvMs: number | null;
  restingHr: number | null;
  steps: number | null;
  activeCalories: number | null;
  source: string | null;
  syncedAt: string | null; // ISO timestamp
}

export interface WebhookTokenInfo {
  token: string;
  lastSyncAt: string | null;
}

// ----- Cravings -----

export type CravingTrigger =
  | 'estres'
  | 'cansancio'
  | 'aburrimiento'
  | 'hambre'
  | 'vista'
  | 'social'
  | 'emocion'
  | 'otro';

export type CravingAction =
  | 'cedi'
  | 'cedi_planeado'
  | 'porcion_chica'
  | 'redirigi'
  | 'espere'
  | 'agua_prot';

/** Vulnerability snapshot computed server-side when a craving is logged. */
export interface CravingContext {
  hoursSinceLastMeal: number | null;
  sleepHoursLastNight: number | null;
  hrvYesterday: number | null;
  projectIntensityToday: ProjectIntensity | null;
  cravingsCountThisWeek: number;
  consecutiveHighStressDays: number;
}

export interface Craving {
  id: number;
  timestamp: string; // ISO
  food: string;
  intensity: number; // 1-10
  trigger: CravingTrigger;
  action: CravingAction;
  note: string | null;
  context: CravingContext | null;
}

export interface CreateCravingRequest {
  food: string;
  intensity: number;
  trigger: CravingTrigger;
  action: CravingAction;
  note?: string | null;
  timestamp?: string; // optional ISO; defaults to server now
}

export interface CravingStats {
  total: number;
  countLast7d: number;
  managedPct: number; // 0-100, share of actions != 'cedi'
  topTrigger: { trigger: CravingTrigger; count: number } | null;
  topFood: { food: string; count: number } | null;
}

// ----- Patterns (aggregations) -----

export interface CravingsHeatmap {
  weeks: number;
  dayLabels: string[]; // 7, Mon-first
  blockLabels: string[]; // 5 time blocks
  grid: number[][]; // [7 days][5 blocks] counts
  total: number;
  peak: { dayIndex: number; blockIndex: number; count: number } | null;
}

export interface SleepCravingsBucket {
  label: string; // "<5h", "5-6", ...
  count: number;
  avgIntensity: number | null;
}

export interface SleepVsCravings {
  weeks: number;
  buckets: SleepCravingsBucket[]; // 6
}

export interface VarianceWeek {
  weekStart: string; // YYYY-MM-DD (Monday)
  weekdayAvg: number | null; // 0-1 habit completion Mon-Fri
  weekendAvg: number | null; // 0-1 Sat-Sun
  variance: number | null; // abs diff
}

export interface VarianceTrend {
  weeks: number;
  goal: number; // 0.15
  series: VarianceWeek[];
}

export interface TopTriggersResult {
  weeks: number;
  triggers: { trigger: CravingTrigger; count: number }[];
}

export interface StressCravingsGroup {
  days: number;
  cravings: number;
  avgPerDay: number;
}

export interface StressCravings {
  weeks: number;
  high: StressCravingsGroup; // project_intensity high|crisis
  low: StressCravingsGroup; // low|medium
}

// ----- AI Coach -----

export type CoachRole = 'user' | 'assistant' | 'system';

export interface CoachMessage {
  id: number;
  role: CoachRole;
  content: string;
  createdAt: string;
}

export interface CoachConversation {
  id: number;
  startedAt: string;
  lastMessageAt: string;
  summary: string | null;
}

export interface VoiceTranscription {
  text: string;
}

// ----- Weekly review -----

export interface ReviewInsight {
  title: string;
  body: string;
}

export interface ReviewExperiment {
  title: string;
  body: string;
  success_criteria: string;
}

export interface WeeklyReviewData {
  kgChange: number | null;
  habitCompletion: { habitId: HabitId; rate: number }[];
  avgSleepHours: number | null;
  avgHrv: number | null;
  cravingsByTrigger: { trigger: CravingTrigger; count: number }[];
  cravingsTotal: number;
  variance: number | null;
  highStressDays: number;
  previousWeeks: {
    weekStart: string;
    kgChange: number | null;
    avgSleepHours: number | null;
    cravingsTotal: number;
    habitRate: number | null;
  }[];
}

export interface WeeklyReview {
  weekStart: string; // YYYY-MM-DD (Monday)
  weekEnd: string; // YYYY-MM-DD (Sunday)
  narrative: string;
  insights: ReviewInsight[];
  experiment: ReviewExperiment;
  data: WeeklyReviewData;
  generatedAt: string;
  readAt: string | null;
}

export interface WeeklyReviewSummary {
  weekStart: string;
  weekEnd: string;
  narrative: string;
  generatedAt: string;
  readAt: string | null;
}

export interface PushSubscriptionInput {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

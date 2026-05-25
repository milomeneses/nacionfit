import cron from 'node-cron';
import { gte } from 'drizzle-orm';
import { db } from '../db/index.js';
import { dailyLogs } from '../db/schema.js';
import { isGeminiConfigured } from './gemini.js';
import { generateReview, lastCompletedWeek, todayInTz, userTimezone } from './reviewService.js';
import { sendToUser } from './pushService.js';

/** Generates reviews for all recently-active users and pushes a notification. */
export async function runWeeklyReviews(): Promise<void> {
  const since = new Date(Date.now() - 14 * 86_400_000).toISOString().slice(0, 10);
  const active = await db
    .selectDistinct({ userId: dailyLogs.userId })
    .from(dailyLogs)
    .where(gte(dailyLogs.date, since));

  for (const { userId } of active) {
    try {
      const tz = await userTimezone(userId);
      const { weekStart } = lastCompletedWeek(todayInTz(tz));
      const review = await generateReview(userId, weekStart);
      await sendToUser(userId, {
        title: 'Tu review de la semana',
        body: review.narrative.slice(0, 140),
        url: `/reviews/${weekStart}`,
      });
    } catch (err) {
      console.error(`Weekly review failed for user ${userId}:`, err);
    }
  }
}

export function startWeeklyReviewCron(): void {
  if (!isGeminiConfigured()) {
    console.log('Weekly review cron disabled (no GEMINI_API_KEY).');
    return;
  }
  // Sundays at 19:00 server time; each user's week is computed in their timezone.
  cron.schedule('0 19 * * 0', () => {
    runWeeklyReviews().catch((err) => console.error('Weekly review cron error:', err));
  });
  console.log('Weekly review cron scheduled (Sun 19:00).');
}

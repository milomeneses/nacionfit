import webpush from 'web-push';
import { eq } from 'drizzle-orm';
import { env } from '../env.js';
import { db } from '../db/index.js';
import { pushSubscriptions } from '../db/schema.js';

let configured = false;

export function isPushConfigured(): boolean {
  if (!env.vapid.publicKey || !env.vapid.privateKey) return false;
  if (!configured) {
    webpush.setVapidDetails(env.vapid.subject, env.vapid.publicKey, env.vapid.privateKey);
    configured = true;
  }
  return true;
}

export interface PushPayload {
  title: string;
  body: string;
  url: string;
}

/** Sends a push to every subscription of a user; prunes dead subscriptions. */
export async function sendToUser(userId: number, payload: PushPayload): Promise<number> {
  if (!isPushConfigured()) return 0;
  const subs = await db
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, userId));

  let sent = 0;
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload),
      );
      sent += 1;
    } catch (err) {
      const statusCode = (err as { statusCode?: number }).statusCode;
      if (statusCode === 404 || statusCode === 410) {
        await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, sub.id));
      }
    }
  }
  return sent;
}

import { Router, type Response } from 'express';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { env } from '../env.js';
import { db } from '../db/index.js';
import { pushSubscriptions } from '../db/schema.js';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

const subSchema = z.object({
  endpoint: z.string().url().max(512),
  keys: z.object({ p256dh: z.string().max(255), auth: z.string().max(255) }),
});

// GET /api/push/vapid-public-key — the public key the browser needs to subscribe
router.get('/vapid-public-key', (_req, res: Response) => {
  res.json({ publicKey: env.vapid.publicKey });
});

// POST /api/push/subscribe — store (or refresh) a push subscription
router.post('/subscribe', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const parsed = subSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Suscripción inválida' });
    return;
  }
  const { endpoint, keys } = parsed.data;
  await db
    .insert(pushSubscriptions)
    .values({ userId: req.user!.sub, endpoint, p256dh: keys.p256dh, auth: keys.auth })
    .onDuplicateKeyUpdate({
      set: { userId: req.user!.sub, p256dh: keys.p256dh, auth: keys.auth },
    });
  res.status(201).json({ ok: true });
});

// POST /api/push/unsubscribe — remove a subscription by endpoint
router.post('/unsubscribe', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const endpoint = typeof req.body?.endpoint === 'string' ? req.body.endpoint : null;
  if (endpoint) {
    await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint));
  }
  res.json({ ok: true });
});

export default router;

import { Router, type Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import type {
  AuthResponse,
  User as PublicUser,
} from '@mi-cocina/shared';
import { db } from '../db/index.js';
import { users, type UserRow } from '../db/schema.js';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from './jwt.js';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
  heightCm: z.number().int().positive().nullish(),
  targetWeightKg: z.number().int().positive().nullish(),
  targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
  timezone: z.string().min(1).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

function toPublicUser(row: UserRow): PublicUser {
  const createdAt =
    row.createdAt instanceof Date
      ? row.createdAt.toISOString()
      : String(row.createdAt);

  return {
    id: row.id,
    email: row.email,
    name: row.name,
    heightCm: row.heightCm ?? null,
    targetWeightKg: row.targetWeightKg ?? null,
    targetDate: row.targetDate ?? null,
    timezone: row.timezone,
    createdAt,
  };
}

function issueTokens(row: UserRow): AuthResponse {
  const payload = { sub: row.id, email: row.email };
  return {
    accessToken: signAccessToken(payload),
    refreshToken: signRefreshToken(payload),
    user: toPublicUser(row),
  };
}

async function findById(id: number): Promise<UserRow | undefined> {
  const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return rows[0];
}

router.post('/register', async (req, res: Response) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' });
    return;
  }
  const data = parsed.data;

  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, data.email))
    .limit(1);
  if (existing.length > 0) {
    res.status(409).json({ error: 'An account with that email already exists' });
    return;
  }

  const passwordHash = await bcrypt.hash(data.password, 10);
  await db.insert(users).values({
    email: data.email,
    passwordHash,
    name: data.name,
    heightCm: data.heightCm ?? null,
    targetWeightKg: data.targetWeightKg ?? null,
    targetDate: data.targetDate ?? null,
    timezone: data.timezone ?? 'UTC',
  });

  const created = (
    await db.select().from(users).where(eq(users.email, data.email)).limit(1)
  )[0];
  if (!created) {
    res.status(500).json({ error: 'Failed to create user' });
    return;
  }

  res.status(201).json(issueTokens(created));
});

router.post('/login', async (req, res: Response) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input' });
    return;
  }
  const { email, password } = parsed.data;

  const row = (
    await db.select().from(users).where(eq(users.email, email)).limit(1)
  )[0];
  if (!row) {
    res.status(401).json({ error: 'Invalid email or password' });
    return;
  }

  const ok = await bcrypt.compare(password, row.passwordHash);
  if (!ok) {
    res.status(401).json({ error: 'Invalid email or password' });
    return;
  }

  res.json(issueTokens(row));
});

router.post('/refresh', async (req, res: Response) => {
  const parsed = refreshSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input' });
    return;
  }

  let payload;
  try {
    payload = verifyRefreshToken(parsed.data.refreshToken);
  } catch {
    res.status(401).json({ error: 'Invalid or expired refresh token' });
    return;
  }

  const row = await findById(payload.sub);
  if (!row) {
    res.status(401).json({ error: 'User no longer exists' });
    return;
  }

  res.json(issueTokens(row));
});

router.get('/me', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const row = await findById(req.user!.sub);
  if (!row) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  res.json(toPublicUser(row));
});

export default router;

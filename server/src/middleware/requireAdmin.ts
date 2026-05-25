import type { Response, NextFunction } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import type { AuthenticatedRequest } from './auth.js';

/**
 * Must run AFTER requireAuth. Looks up the authenticated user's role (the JWT
 * doesn't carry it) and rejects non-admins with 403.
 */
export async function requireAdmin(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const userId = req.user?.sub;
  if (!userId) {
    res.status(401).json({ error: 'No autenticado' });
    return;
  }
  const [row] = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!row || row.role !== 'admin') {
    res.status(403).json({ error: 'Acceso restringido a administradores' });
    return;
  }
  next();
}

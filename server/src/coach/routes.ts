import express, { Router, type Response } from 'express';
import { z } from 'zod';
import { and, asc, desc, eq } from 'drizzle-orm';
import type { CoachConversation, CoachMessage } from '@nacionfit/shared';
import { db } from '../db/index.js';
import { aiConversations, aiMessages } from '../db/schema.js';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth.js';
import { chat } from './coachService.js';
import { GroqNotConfiguredError, isGroqConfigured, transcribe } from './groq.js';

const router = Router();

async function ownConversation(userId: number, id: number) {
  const [row] = await db
    .select()
    .from(aiConversations)
    .where(and(eq(aiConversations.id, id), eq(aiConversations.userId, userId)))
    .limit(1);
  return row;
}

// POST /api/coach/conversations — start a new conversation
router.post('/conversations', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  await db.insert(aiConversations).values({ userId: req.user!.sub });
  const [row] = await db
    .select()
    .from(aiConversations)
    .where(eq(aiConversations.userId, req.user!.sub))
    .orderBy(desc(aiConversations.id))
    .limit(1);
  const result: CoachConversation = {
    id: row!.id,
    startedAt: row!.startedAt.toISOString(),
    lastMessageAt: row!.lastMessageAt.toISOString(),
    summary: row!.summary,
  };
  res.status(201).json(result);
});

// GET /api/coach/conversations — list with summaries
router.get('/conversations', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const rows = await db
    .select()
    .from(aiConversations)
    .where(eq(aiConversations.userId, req.user!.sub))
    .orderBy(desc(aiConversations.lastMessageAt));
  const result: CoachConversation[] = rows.map((r) => ({
    id: r.id,
    startedAt: r.startedAt.toISOString(),
    lastMessageAt: r.lastMessageAt.toISOString(),
    summary: r.summary,
  }));
  res.json(result);
});

// GET /api/coach/conversations/:id/messages — all messages
router.get(
  '/conversations/:id/messages',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    const id = Number(req.params.id);
    if (!(await ownConversation(req.user!.sub, id))) {
      res.status(404).json({ error: 'Conversation not found' });
      return;
    }
    const rows = await db
      .select()
      .from(aiMessages)
      .where(eq(aiMessages.conversationId, id))
      .orderBy(asc(aiMessages.id));
    const result: CoachMessage[] = rows
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        createdAt: m.createdAt.toISOString(),
      }));
    res.json(result);
  },
);

const sendSchema = z.object({ content: z.string().trim().min(1).max(4000) });

// POST /api/coach/conversations/:id/messages — SSE stream of the assistant reply
router.post(
  '/conversations/:id/messages',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    const id = Number(req.params.id);
    if (!(await ownConversation(req.user!.sub, id))) {
      res.status(404).json({ error: 'Conversation not found' });
      return;
    }
    const parsed = sendSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Mensaje inválido' });
      return;
    }
    if (!isGroqConfigured()) {
      res.status(503).json({ error: 'El coach no está configurado (falta GROQ_API_KEY).' });
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    try {
      for await (const delta of chat(req.user!.sub, id, parsed.data.content)) {
        res.write(`data: ${JSON.stringify({ delta })}\n\n`);
      }
      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    } catch (err) {
      const message =
        err instanceof GroqNotConfiguredError
          ? 'El coach no está configurado.'
          : 'El coach no está disponible en este momento.';
      res.write(`data: ${JSON.stringify({ error: message })}\n\n`);
    } finally {
      res.end();
    }
  },
);

// POST /api/coach/voice — transcribe an audio blob with Whisper
router.post(
  '/voice',
  requireAuth,
  express.raw({ type: () => true, limit: '25mb' }),
  async (req: AuthenticatedRequest, res: Response) => {
    if (!isGroqConfigured()) {
      res.status(503).json({ error: 'La transcripción no está configurada (falta GROQ_API_KEY).' });
      return;
    }
    const audio = req.body as Buffer;
    if (!Buffer.isBuffer(audio) || audio.length === 0) {
      res.status(400).json({ error: 'Audio vacío' });
      return;
    }
    const mime = req.headers['content-type'] ?? 'audio/webm';
    const ext = mime.includes('mp4') || mime.includes('m4a') ? 'm4a' : mime.includes('wav') ? 'wav' : 'webm';
    try {
      const text = await transcribe(audio, `audio.${ext}`, mime);
      res.json({ text });
    } catch {
      res.status(502).json({ error: 'No se pudo transcribir el audio.' });
    }
  },
);

export default router;

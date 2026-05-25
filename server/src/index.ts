import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import { env } from './env.js';
import authRoutes from './auth/routes.js';
import daysRoutes from './days/routes.js';
import habitsRoutes from './habits/routes.js';
import healthRoutes from './health/routes.js';
import cravingsRoutes from './cravings/routes.js';
import patternsRoutes from './patterns/routes.js';
import coachRoutes from './coach/routes.js';
import reviewRoutes from './review/routes.js';
import pushRoutes from './review/pushRoutes.js';
import adminRoutes from './admin/routes.js';
import { startWeeklyReviewCron } from './review/cron.js';

const app = express();

app.use(cors());
app.use(express.json({ limit: '5mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/auth', authRoutes);
app.use('/api/days', daysRoutes);
app.use('/api/habits', habitsRoutes);
app.use('/api/health', healthRoutes);
app.use('/api/cravings', cravingsRoutes);
app.use('/api/patterns', patternsRoutes);
app.use('/api/coach', coachRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/push', pushRoutes);
app.use('/api/admin', adminRoutes);

// In production, serve the built client and let React Router handle routing.
// Must come AFTER all /api routes so the catch-all doesn't shadow them.
if (process.env.NODE_ENV === 'production') {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const clientDist = path.resolve(__dirname, '../../client/dist');

  app.use(express.static(clientDist));

  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

app.listen(env.port, () => {
  console.log(`Server listening on http://localhost:${env.port}`);
  startWeeklyReviewCron();
});

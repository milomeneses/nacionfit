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

app.listen(env.port, () => {
  console.log(`Server listening on http://localhost:${env.port}`);
});

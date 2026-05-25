import express from 'express';
import cors from 'cors';
import { env } from './env.js';
import authRoutes from './auth/routes.js';

const app = express();

app.use(cors());
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/auth', authRoutes);

app.listen(env.port, () => {
  console.log(`Server listening on http://localhost:${env.port}`);
});

import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import { env } from '../env.js';
import * as schema from './schema.js';

export const pool = mysql.createPool({
  host: env.db.host,
  port: env.db.port,
  user: env.db.user,
  password: env.db.password,
  database: env.db.database,
  connectionLimit: 10,
  // Interpret all DATETIME/TIMESTAMP values as UTC for deterministic round-trips.
  timezone: 'Z',
});

export const db = drizzle(pool, { schema, mode: 'default' });

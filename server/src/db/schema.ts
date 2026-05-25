import {
  mysqlTable,
  int,
  varchar,
  date,
  timestamp,
} from 'drizzle-orm/mysql-core';

export const users = mysqlTable('users', {
  id: int('id').autoincrement().primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  heightCm: int('height_cm'),
  targetWeightKg: int('target_weight_kg'),
  targetDate: date('target_date', { mode: 'string' }),
  timezone: varchar('timezone', { length: 64 }).notNull().default('UTC'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export type UserRow = typeof users.$inferSelect;
export type NewUserRow = typeof users.$inferInsert;

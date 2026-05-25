# Mi Cocina

A TypeScript monorepo with a React client, an Express API, and a shared types
package. Includes JWT authentication backed by MySQL (via Drizzle ORM) and a
warm, editorial design system.

## Workspaces

```
.
├── client/   React 18 + Vite + TypeScript + Tailwind CSS
├── server/   Node 20 + Express + TypeScript + Drizzle ORM (MySQL)
└── shared/   TypeScript types shared between client and server
```

The repo uses npm workspaces. Install once from the root and all three
workspaces are linked together.

## Prerequisites

- Node.js 20+
- A MySQL database (local, or hosted — e.g. Hostinger MySQL)

## Setup

```bash
# 1. Install all workspace dependencies
npm install

# 2. Configure the server environment
cp .env.example server/.env
# then edit server/.env with your database credentials and JWT secrets
```

`server/.env` values:

| Variable             | Description                                  |
| -------------------- | -------------------------------------------- |
| `DB_HOST`            | MySQL host (Hostinger gives you this)        |
| `DB_PORT`            | MySQL port (usually `3306`)                  |
| `DB_USER`            | MySQL user                                   |
| `DB_PASSWORD`        | MySQL password                               |
| `DB_NAME`            | Database name                                |
| `JWT_ACCESS_SECRET`  | Secret for signing 7-day access tokens       |
| `JWT_REFRESH_SECRET` | Secret for signing 30-day refresh tokens     |
| `PORT`               | Server port (defaults to `3001`)             |

> Connecting to Hostinger MySQL: use the host, database, and user shown in
> hPanel → Databases. Make sure your IP is allowed under "Remote MySQL", then
> drop those values into `server/.env`.

## Database migrations

The schema lives in `server/src/db/schema.ts`. Migration SQL is generated into
`server/src/db/migrations/`.

```bash
# Generate migration SQL after editing the schema
npm run db:generate

# Apply migrations to the database in server/.env
npm run db:migrate
```

Migrations so far create:

- `users` — `id, email, password_hash, name, height_cm, target_weight_kg,
  target_date, timezone, created_at`.
- `daily_logs` — one row per user per day: `meals` (JSON), `water_count`,
  `sleep_hours`, `mood`, `crossfit`, `energy`, `stress`, `project_intensity`
  (enum), `weight_kg`, `saved_at`, with `UNIQUE(user_id, date)`.
- `habits_logs` — `habit_id` (enum) + `completed` per user/day, with
  `UNIQUE(user_id, date, habit_id)`.
- `health_data` — Apple Health metrics per user/day: sleep (total/deep/rem/awake
  minutes), `hrv_ms`, `resting_hr`, `steps`, `active_calories`, `source`,
  `synced_at`, with `UNIQUE(user_id, date)`.
- `user_webhook_tokens` — per-user secret `token` (UNIQUE) + `last_sync_at`.

## Running locally

```bash
npm run dev
```

This starts both apps in parallel:

- Client (Vite): http://localhost:5173
- Server (Express): http://localhost:3001

The Vite dev server proxies any request beginning with `/api` to the server on
port 3001, so the client calls `/api/...` directly with no CORS friction.

Run them individually if you prefer:

```bash
npm run dev:client
npm run dev:server
```

## Auth API

All endpoints are mounted under `/api/auth`.

| Method | Path                 | Body                                  | Returns                          |
| ------ | -------------------- | ------------------------------------- | -------------------------------- |
| POST   | `/api/auth/register` | `{ email, password, name, ... }`      | `{ accessToken, refreshToken, user }` |
| POST   | `/api/auth/login`    | `{ email, password }`                 | `{ accessToken, refreshToken, user }` |
| POST   | `/api/auth/refresh`  | `{ refreshToken }`                    | `{ accessToken, refreshToken, user }` |
| GET    | `/api/auth/me`       | — (`Authorization: Bearer <token>`)   | `user`                           |

- Passwords are hashed with bcrypt.
- Access tokens expire in **7 days**, refresh tokens in **30 days**.

## Daily logging API

All endpoints require `Authorization: Bearer <token>` and act on the logged-in
user only. Dates are `YYYY-MM-DD`.

| Method | Path                       | Body / Query                                  | Returns                         |
| ------ | -------------------------- | --------------------------------------------- | ------------------------------- |
| GET    | `/api/days/:date`          | —                                             | the day (with `habits`) or `null` |
| PUT    | `/api/days/:date`          | partial `DailyLog` (Zod-validated)            | the upserted day                |
| GET    | `/api/days?from=&to=`      | `from`, `to` dates                            | array of saved days in range    |
| POST   | `/api/habits/toggle`       | `{ date, habitId, completed }`                | the toggled habit               |

- `daily_logs` is keyed `UNIQUE(user_id, date)`; `PUT` upserts and stamps
  `saved_at`. `habits_logs` is keyed `UNIQUE(user_id, date, habit_id)`.
- A day's response merges its `daily_logs` row with a `habits` map of all six
  habit ids → completed.

## Apple Health API (Health Auto Export)

Integrates with the iOS app **Health Auto Export — JSON+CSV** (paid, for
automations) via a per-user webhook.

| Method | Path                            | Auth            | Purpose                              |
| ------ | ------------------------------- | --------------- | ------------------------------------ |
| POST   | `/api/health/webhook/:token`    | URL token       | Ingest a Health Auto Export payload  |
| GET    | `/api/health/me`                | Bearer          | Last 7 days of the user's metrics    |
| GET    | `/api/health/token`             | Bearer          | Current webhook token (created lazily) |
| POST   | `/api/health/token`             | Bearer          | Regenerate the token (old URL dies)  |

The webhook accepts the app's JSON — either `{ data: { metrics: [...] } }` or a
bare array of `{ name, data: [{ date, qty, source }] }`. Metric names are matched
case/spacing-insensitively:

- `Sleep Analysis` → sleep minutes (+ deep / rem / awake stages). Sleep that
  crosses midnight is assigned to the **wake day** (`sleepEnd`'s date). Stage/
  duration values ≤ 24 are treated as hours and converted to minutes.
- `Heart Rate Variability` → `hrv_ms` (most recent sample of the day).
- `Resting Heart Rate` → `resting_hr` (most recent of the day).
- `Step Count` → `steps` (summed). `Active Energy` → `active_calories` (summed).

Each day is upserted by `(user_id, date)`, **merging** only the fields present in
the payload (a partial sync never wipes existing metrics).

## Front end

- `/login` and `/register` — auth screens.
- `/app` — the **"Hoy"** screen: today's daily log. A persistent tab bar
  (Hoy / Coach / Patrones / Plan / Sueño) and top bar (with an **Ajustes** link)
  wrap every `/app` view. Hoy shows the Argentine-Spanish date, a streak counter,
  an **Apple Watch** card (today's sleep / HRV / steps, or a prompt to connect),
  then comidas, agua, estrés, ánimo, CrossFit (+energy), peso and hábitos cards.
- `/app/sueno` — **Sueño & Recuperación**: last night's sleep-stage breakdown,
  a 7-day sleep bar chart, and HRV / resting-HR trend lines (SVG, no chart lib).
- `/app/settings` — **Ajustes**: the webhook URL with a copy button, last-sync
  time, Health Auto Export setup steps, and a regenerate-token action.
- Edits **auto-save 1s after the last change** (debounced); habits toggle
  immediately. A subtle "Guardado" indicator fades in on save.
- **Streak**: consecutive days back from today with `saved_at` set. An unsaved
  *today* does not break the streak (it's measured from yesterday in that case).

The displayed webhook URL uses `VITE_API_PUBLIC_URL` (the public origin of your
API; defaults to `https://api.tu-dominio.com`). Set it for the client build, e.g.
`VITE_API_PUBLIC_URL=https://api.midominio.com npm run build --workspace client`.

Tokens are stored in `localStorage`; on load the app calls `/api/auth/me` to
restore the session.

## Design system

Design tokens are defined as CSS variables in `client/src/index.css` and mapped
to Tailwind theme colors in `client/tailwind.config.js`:

| Token          | Value     | Tailwind class examples            |
| -------------- | --------- | ---------------------------------- |
| `--bg`         | `#F4EFE3` | `bg-bg`                            |
| `--surface`    | `#FBF7EC` | `bg-surface`                       |
| `--ink`        | `#1E2A1E` | `text-ink`                         |
| `--green`      | `#2D4A33` | `text-green`, `bg-green`           |
| `--terra`      | `#B45A36` | `text-terra`                       |
| `--sun`        | `#C9962B` | `text-sun`                         |
| `--green-pale` | `#D8E2D4` | `ring-green-pale`                  |
| `--terra-pale` | `#F2DECA` | `bg-terra-pale`                    |
| `--line`       | `#DDD3BC` | `border-line`                      |

Fonts: **Fraunces** (display, `font-display`) and **DM Sans** (body,
`font-body`), loaded from Google Fonts in `client/index.html`.

## Production build

```bash
npm run build
```

Builds `shared`, then `server` (to `server/dist`), then `client` (to
`client/dist`). Serve the client `dist/` statically and run the server with
`npm run start --workspace server`.
```

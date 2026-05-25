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

The initial migration creates the `users` table:
`id, email, password_hash, name, height_cm, target_weight_kg, target_date,
timezone, created_at`.

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

## Front end

- `/login` and `/register` — auth screens.
- `/app` — the authenticated dashboard (shows your email; empty otherwise).
  Unauthenticated visits redirect to `/login`.

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

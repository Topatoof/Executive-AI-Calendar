# Exec AI — Personal Execution OS

A private, single-user AI productivity app that turns messy brain dumps into structured tasks, optimized schedules, accountability feedback, and Apple Calendar exports (`.ics`).

## Features

- **Brain Dump** — text input with AI task extraction (OpenAI or mock fallback)
- **Planner** — deterministic daily/weekly scheduling with focus windows
- **Boss Mode** — accountability alerts based on overdue work and missed blocks
- **Calendar Export** — download `.ics` for Apple Calendar
- **Analytics** — completion rate, focus time, burnout risk, category breakdown
- **Settings** — work hours, focus windows, coaching style

## Stack

- Next.js 15 (App Router) + TypeScript
- Tailwind CSS 4 + shadcn-style components
- **SQLite** + Prisma by default (no Docker required)
- OpenAI API (optional — mock extraction works without a key)
- Framer Motion, cmdk command palette

## Setup

### 1. Node.js

Use Node 20+ (or 22). If `npm` is missing, install Node from [nodejs.org](https://nodejs.org/) or Homebrew.

### 2. Install dependencies

```bash
cd ~/dev/exec-ai
npm install
```

### 3. Configure environment

```bash
cp .env.example .env
```

Default local database (SQLite):

```env
DATABASE_URL="file:./prisma/dev.db"
OPENAI_API_KEY=""   # optional — leave empty for mock extraction
```

To use **PostgreSQL** instead: change `provider` in `prisma/schema.prisma` to `postgresql`, set a `postgresql://...` `DATABASE_URL`, run `docker compose up -d` if you use the included compose file, then `npm run db:push`.

### 4. Database

```bash
npm run db:push
npm run db:seed
```

Seeding runs `node prisma/seed.cjs` (no `tsx` required).

### 5. Run

```bash
npm run dev
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000) (the dev script binds to `127.0.0.1` to avoid some macOS / sandbox `networkInterfaces` issues).

If you see **EMFILE: too many open files** from Watchpack, raise the limit or use polling:

```bash
ulimit -n 10240
# or
export WATCHPACK_POLLING=true
npm run dev
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server (`127.0.0.1:3000`) |
| `npm run build` | Production build |
| `npm run start` | Production server |
| `npm run db:push` | Push Prisma schema |
| `npm run db:seed` | Seed demo tasks |
| `npm run test` | Run Vitest tests |

## Apple Calendar

1. Generate a schedule in **Planner**
2. Go to **Calendar** → **Export .ics**
3. Open the file in Calendar.app (or drag into Calendar)

Re-export after regenerating your schedule.

## Personal use

This app is designed for a single owner profile. No multi-user auth is required for local development. For remote hosting, set `APP_PASSWORD` and add middleware if needed.

## Project structure

```
src/
  app/           # Pages and API routes
  components/    # UI components
  lib/
    ai/          # Extraction and accountability
    scheduler/   # Deterministic scheduling engine
    calendar/    # ICS export
prisma/          # Schema, seed.cjs, dev.db (SQLite, gitignored)
```

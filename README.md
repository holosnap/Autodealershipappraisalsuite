# Trade-In Appraisal Suite

Internal trade-in appraisal app: mobile-first for salespeople, desktop-friendly for used car managers.

**Stack:** Next.js (App Router) · TypeScript · Tailwind · Postgres · Drizzle · Better Auth

## Getting started

```bash
cp .env.example .env.local        # fill in DATABASE_URL and BETTER_AUTH_SECRET (32+ chars)
npm install
npm run db:migrate
SEED_ADMIN_EMAIL=you@dealer.com SEED_ADMIN_PASSWORD='at-least-10-chars' npm run db:seed
npm run dev
```

Sign-up is disabled; accounts are created by an admin (seed script for the first one).

## Scripts

`dev` · `build` · `lint` · `typecheck` · `test` · `db:generate` (after editing `src/db/schema.ts`) · `db:migrate` · `db:seed`

## Layout

- `src/app` – routes (`(auth)` login, `(app)` authenticated shell, `api/`)
- `src/db` – Drizzle schema, migrations, seed
- `src/lib` – auth, RBAC (`rbac.ts`), session helpers (`session.ts`)
- Every server action/query must call `requireCan(...)` from `src/lib/session.ts`; never rely on hidden UI.
- `valuation_snapshots` is append-only: insert, never update.

## Roadmap

1. ✅ Scaffold, auth and roles, schema and migrations, CI
2. Appraisal wizard (VIN decode, details, condition notes, photo upload to S3/R2)
3. Manager queue and review (valuation snapshots, offer, approve/return)
4. PWA, notifications, CSV export

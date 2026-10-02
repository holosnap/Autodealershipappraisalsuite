# Trade-In Appraisal Suite

Internal trade-in appraisal app: mobile-first for salespeople on the lot, desktop-friendly for used car managers.

**Stack:** Next.js 16 (App Router) · TypeScript · Tailwind 4 · Postgres · Drizzle ORM · Better Auth

## Roles

| Role | Can do |
|---|---|
| `salesperson` | Create appraisals; view **only their own** |
| `manager` | View **all** appraisals; set the final offer; **approve** or **reject** a submitted appraisal |

Authorization lives in `src/lib/rbac.ts` and is enforced in the service layer
(`src/features/appraisals/service.ts`), not just in the UI. A salesperson requesting someone else's appraisal gets a 404.

## Setup

Requires Node 20+ and a Postgres 14+ database.

```bash
npm install
cp .env.example .env.local     # set DATABASE_URL and BETTER_AUTH_SECRET (openssl rand -base64 32)
npm run db:migrate             # apply migrations
npm run db:seed                # demo users + sample appraisals (dev only)
npm run dev                    # http://localhost:3000
```

Quick local Postgres: `docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=appraisals postgres:16`
(then `DATABASE_URL=postgres://postgres:postgres@localhost:5432/appraisals`).

### Demo accounts (from `db:seed`, password `password1234`)

| Email | Role |
|---|---|
| `manager@example.com` | manager |
| `sam@example.com` | salesperson (has a submitted and an approved appraisal) |
| `sue@example.com` | salesperson (has a submitted and a rejected appraisal) |

The seed refuses to run when `NODE_ENV=production`. Re-running it resets the demo users and their data.

### Real accounts

Public sign-up is disabled. Create accounts from the command line:

```bash
npm run user:create -- jane@dealer.com "Jane Doe" manager 'a-long-password'
```

Running it again for the same email updates name, role and password.

## Scripts

| Script | Purpose |
|---|---|
| `dev` / `build` / `start` | Next.js |
| `lint` / `typecheck` | ESLint / `tsc` |
| `test` | Vitest. DB integration tests run when `DATABASE_URL` points at a migrated database, otherwise they are skipped |
| `db:generate` | Generate a migration after editing `src/db/schema.ts` |
| `db:migrate` | Apply migrations |
| `db:seed` | Demo data |
| `user:create` | Create/update a real user |

## Data model (`src/db/schema.ts`)

`users` (+ auth `sessions`, `accounts`, `verifications`) · `vehicles` (unique VIN) · `appraisals`
(`draft → submitted → approved | rejected`, with `offer_cents`, decision fields) · `appraisal_photos`
· `condition_notes` · `valuation_snapshots` (append-only) · `appraisal_events` (audit trail).
Money is stored as integer cents. The photo table and valuation snapshots are in the schema but their UI is not built yet.

## Layout

```
src/app/            routes: (auth)/login, (app)/appraisals[/new|/[id]], api/auth, api/health
src/features/       appraisals/{schema,service,actions}.ts: validation, business rules, server actions
src/db/             schema, migrations, seed
src/lib/            auth, rbac, session helpers
scripts/            create-user
tests/              rbac unit tests, service integration tests
```

## Deployment

Designed for Vercel + a managed Postgres (e.g. Neon). Set `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`
(the public URL), and run `npm run db:migrate` against the production DB on each release.

## Not built yet

Photo upload (S3/R2), VIN decoding, manager-entered valuation snapshots in the UI, notifications, PWA install.

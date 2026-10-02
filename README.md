# Trade-In Appraisal Suite

Internal trade-in appraisal app: mobile-first for salespeople on the lot, desktop-friendly for used car managers.

**Stack:** Next.js 16 (App Router) · TypeScript · Tailwind 4 · Postgres · Drizzle ORM · Better Auth

## Roles

| Role | Can do |
|---|---|
| `salesperson` | Create appraisals; view **only their own** |
| `manager` | View **all** appraisals; set the final offer; **approve** or **reject** a submitted appraisal |

Drafts are private to their author (managers see everyone's *submitted* work plus their own drafts).
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

## Intake flow (mobile-first)

New appraisal → four steps, each **autosaved as a draft** (`status = draft`), so nothing is lost if the phone locks:

1. **Vehicle**: type the VIN or **scan the barcode** with the camera (door-jamb Code 39 / Data Matrix / QR). Year/make/model are
   looked up from NHTSA vPIC and stay editable (if the lookup fails you just type them). Plus odometer. "Continue" creates the draft.
2. **Customer**: name, phone/email, what they're buying (+ stock #), and whether they still owe on the trade.
3. **Condition checklist**: exterior, interior, mechanical, tires (excellent/good/fair/poor + notes), warning lights, smoke odor,
   accident history, number of keys, aftermarket mods.
4. **Photos** with guided prompts: front, rear, both sides, interior, odometer (required), VIN plate (optional), and up to 12 damage
   close-ups. Photos are **resized to ≤1600px and re-encoded as JPEG in the browser** before upload.

"Submit" is enabled once everything required is filled in and the list of what's missing is always shown. After submitting, the
appraisal is read-only for the salesperson and goes to the managers' queue. In-progress drafts show up in the list as
**Continue · step N of 4** and reopen on the step you left.

**How draft saving works** (`src/features/appraisals/intake/use-draft-saver.ts`)

- Every change is debounced (~0.7 s) and saved to the server; saves are serialized so an old request can't overwrite a new one.
- Anything not yet saved is also mirrored to `localStorage`. If the phone locks, the tab is killed or there's no signal, the next time the draft opens the
  unsaved edits are restored and re-sent. Network failures retry automatically; the header shows *Saved / Saving… / Offline. Will retry*.
- The page also flushes immediately when it's hidden (`visibilitychange`/`pagehide`) and when the connection comes back.
- Photos upload one at a time per tile with a **Retry** button; the compressed image is kept in memory for the retry.
  (An upload that is cut off mid-flight, e.g. the phone locks during it, has to be retried: photo bytes aren't queued across sessions.)

### Photo storage

- **Production:** S3 or Cloudflare R2. The browser PUTs straight to the bucket using a short-lived presigned URL, and the server only stores the
  key. Set `S3_BUCKET`, `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` (and `S3_REGION`, `auto` for R2), and add a **CORS rule** to
  the bucket allowing `PUT` (with the `Content-Type` header) from your app's origin. The bucket must stay private: photos are only reachable through
  `/api/photos/:id`, which checks the viewer's permission and redirects to a 5-minute signed URL.
- **Local dev:** leave `S3_BUCKET` empty and photos are written to `./.uploads` (git-ignored) through the app itself. In production the app
  refuses to use local storage, because serverless disks are ephemeral.

The VIN-barcode fallback decoder (for iOS Safari / Firefox, which lack the native `BarcodeDetector`) is bundled and served from your own origin;
no third-party CDN is used. The camera needs HTTPS (localhost is exempt).

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
(`draft → submitted → approved | rejected`; customer + purchase context; `condition` JSON checklist; `wizard_step`; `offer_cents` + decision fields)
· `appraisal_photos` (slot, storage key, dimensions) · `condition_notes` · `valuation_snapshots` (append-only) · `appraisal_events` (audit trail).
Money is stored as integer cents. Valuation snapshots are in the schema but have no UI yet.

## Layout

```
src/app/            routes: (auth)/login, (app)/appraisals[/new|/[id]], api/auth, api/health
src/features/       appraisals/{schema,condition,photo-slots,readiness,service,actions}.ts: validation, rules, server actions
                    appraisals/intake/: wizard, step components, autosave hook, VIN scanner
src/db/             schema, migrations, seed
src/lib/            auth, rbac, session helpers
scripts/            create-user
tests/              rbac + intake logic unit tests, DB integration tests (intake, photos, submit, review)
```

## Deployment

Designed for Vercel + a managed Postgres (e.g. Neon). Set `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`
(the public URL), the `S3_*` variables above, and run `npm run db:migrate` against the production DB on each release.

## Not built yet

Manager-entered valuation snapshots in the UI, notifications, PWA install, a queue for photo uploads that survive the phone locking mid-upload.

# AUREVANE — Infrastructure & Environment Setup

**Ticket:** F0.2 — Infrastructure + Persistence Baseline  
**Authority:** `docs/GAME_MASTER_PLAN.md`, `docs/AI_DEVELOPMENT_QUALITY_MANDATE.md`, `docs/TECH_ARCHITECTURE.md`

This document describes the safe development/deployment workflow for Supabase, authentication, migrations, and environment variables. It does not define gameplay data.

## 1. Environment Model

AUREVANE has three deliberately separate environments:

| Environment | Purpose | Database |
| --- | --- | --- |
| Local | Developer work and disposable test data | Local Supabase via Docker |
| Staging | Cloud previews and integration testing | Dedicated staging Supabase project |
| Production | Real player data | Dedicated production Supabase project |

Never point local development or Vercel Preview deployments at the production database.

The application verifies its environment identity at runtime. `AUREVANE_ENV` and `NEXT_PUBLIC_AUREVANE_ENV` must match exactly.

## 2. Keys and Trust Boundaries

Browser-safe variables:

- `NEXT_PUBLIC_AUREVANE_ENV`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Server-only variables:

- `AUREVANE_ENV`
- `AUREVANE_ACCOUNT_SERVICES_READY`
- `SUPABASE_SECRET_KEY`

`SUPABASE_SECRET_KEY` must never be renamed with a `NEXT_PUBLIC_` prefix, logged, committed, returned by an API, or imported into Client Components.

`AUREVANE_ACCOUNT_SERVICES_READY` is a server-side production release gate, not a substitute for database verification. Production account entry remains unavailable until a dedicated Production Supabase project is configured, repository migrations are applied, profile provisioning/RLS are verified, and this flag is explicitly set to `true` for Production.

Normal authenticated application requests use the publishable key plus the player's verified session and remain subject to RLS. The elevated secret key is reserved for explicit privileged server operations and bypasses RLS, so code must opt into the admin client deliberately.

## 3. Local Development

Prerequisites:

1. Node.js 24.x.
2. pnpm 11.17.0 via Corepack.
3. Docker Desktop (or another Docker-compatible runtime) running.

From the repository root:

```powershell
pnpm install
pnpm db:start
```

The local stack uses the committed `supabase/config.toml`, applies all migrations in `supabase/migrations/`, and then applies `supabase/seed.sql`.

To prove the database can be reconstructed from version control:

```powershell
pnpm db:reset
```

To stop it:

```powershell
pnpm db:stop
```

Create `apps/web/.env.local` by copying `apps/web/.env.example`. Obtain the local API URL and local anon/service-role keys from:

```powershell
pnpm exec supabase status
```

Never commit `.env.local`.

## 4. Hosted Staging and Production

AUREVANE uses separate hosted Supabase projects for staging and production:

- AUREVANE Staging
- AUREVANE Production

For each provisioned project, record its project URL, publishable key, and server secret key in the appropriate deployment secret store. Do not place them in repository files.

The Vercel project must use **`apps/web` as its Root Directory**. Next.js is detected from `apps/web/package.json`; do not work around an incorrect project root with a repository-root `vercel.json` or duplicated application package manifest.

### Vercel Preview

Configure Preview environment variables with **staging** values:

```text
NEXT_PUBLIC_AUREVANE_ENV=staging
AUREVANE_ENV=staging
NEXT_PUBLIC_SUPABASE_URL=<staging project URL>
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<staging publishable key>
SUPABASE_SECRET_KEY=<staging server secret key>
```

### Vercel Production

Configure Production environment variables with **production** values only after a dedicated production Supabase project has been intentionally provisioned:

```text
NEXT_PUBLIC_AUREVANE_ENV=production
AUREVANE_ENV=production
NEXT_PUBLIC_SUPABASE_URL=<production project URL>
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<production publishable key>
SUPABASE_SECRET_KEY=<production server secret key>
AUREVANE_ACCOUNT_SERVICES_READY=false
```

Keep `AUREVANE_ACCOUNT_SERVICES_READY=false` while provisioning. Set it to `true` only after all repository migrations required by the current account flow are applied and the complete authenticated account/profile verification below succeeds.

Do not reuse the staging Supabase project for Production. If the dedicated production project has not been provisioned yet, Production database/auth configuration remains intentionally unconfigured rather than falling back to staging.

A Preview deployment that uses staging credentials is not a substitute for a Production build. AUREVANE's server readiness boundary treats a request to the Vercel production hostname as Production and refuses account entry if the bundled public environment still identifies itself as staging. This prevents a promoted staging-configured Preview from silently becoming the live account backend.

### Production account/profile readiness gate

Before setting `AUREVANE_ACCOUNT_SERVICES_READY=true`, verify against the intended Production environment:

1. The Production environment identity is `production` on both public and server boundaries.
2. All committed migrations through the current release are applied with matching Git migration identity.
3. `player_profiles`, its automatic provisioning trigger, and RLS policies are present when P1.1 or later depends on them.
4. A fresh Production account/sign-in reaches `/game` and creates exactly one private player profile.
5. `/game` renders **No character bound**, refresh succeeds, sign-out succeeds, and signing in again returns to the same account state.
6. Cross-account profile reads and direct browser profile mutations remain denied.
7. Production runtime logs are checked during the authenticated verification window.
8. Only after those checks pass, enable `AUREVANE_ACCOUNT_SERVICES_READY=true` and redeploy Production.

If the gate is false or Production is unconfigured, the public shell remains available but account controls stay unavailable. If a verified session encounters an unexpected profile persistence outage after entry was enabled, `/game` renders an authored recovery state with safe Retry and Sign out actions instead of substituting another environment or exposing a generic server-error page.

## 5. Migration Workflow

All application database schema changes require a version-controlled migration under:

```text
supabase/migrations/
```

The migration filename timestamp is part of the migration identity. Hosted migration history must preserve the same version recorded in Git.

Normal workflow:

1. Create/edit a migration locally.
2. Run `pnpm db:reset` to reconstruct the database from zero.
3. Run the repository quality gates.
4. Review generated SQL for security and data-loss risk.
5. Merge only after CI is green.
6. Link the intended hosted project through the Supabase CLI.
7. Apply repository-backed hosted migrations with `supabase db push` from the committed migration files.
8. Verify the hosted migration version and name match the committed filename/history.
9. Verify staging before any production migration.

Do not make untracked production schema changes in the Supabase Dashboard.

Do not use a generic DDL/migration execution tool for a migration that already exists in `supabase/migrations/` when that tool records its own generated timestamp. That can make remote migration history disagree with Git even when the SQL is identical. If hosted history ever differs from the committed version, reconcile the migration metadata before the next push rather than accepting permanent drift.

## 6. RLS Baseline

The `public` schema is browser-exposed application territory. Any migration that creates a `public` table must enable Row Level Security in the same migration. Automated tests reject public tables without RLS and reject migrations that disable RLS or broadly grant all privileges to browser-facing roles.

F0.2 deliberately creates no public game tables.

`app_private` is reserved for server-only database objects. Browser roles receive no schema access.

## 7. Authentication Boundary

The web application uses cookie-based Supabase SSR authentication:

- browser client for browser-only auth/realtime needs;
- server client for Server Components, Route Handlers, and Server Actions;
- request Proxy refreshes auth cookies;
- server authorization code verifies identity with `auth.getClaims()` rather than trusting a client-provided user/session object;
- OAuth/PKCE callback route exchanges the server-issued auth code;
- sign-out is performed server-side.

The diagnostic endpoint:

```text
GET /api/foundation/auth-status
```

returns only whether the current request has verified authentication claims. It does not expose tokens or credentials.

## 8. Production Safety Rules

- Never run destructive reset commands against production.
- Never use production player data as local seed data.
- Never expose `SUPABASE_SECRET_KEY` to the browser.
- Never point Preview at production or Production at staging as a convenience fallback.
- Never enable `AUREVANE_ACCOUNT_SERVICES_READY` before the current Production account dependency chain has been verified end to end.
- Never treat a Vercel `READY` deployment or HTTP 200 on `/` as proof that authenticated routes are operational.
- Never treat RLS as a substitute for server-side authorization on authoritative game actions.
- Never trust values submitted by the browser merely because the user is authenticated.
- Review migrations before applying them to hosted environments.
- Preserve Git migration identity when applying migrations to hosted databases.
- Keep `main` deployable; staging verification precedes production schema changes.

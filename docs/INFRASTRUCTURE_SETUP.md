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
- `SUPABASE_SECRET_KEY`

`SUPABASE_SECRET_KEY` must never be renamed with a `NEXT_PUBLIC_` prefix, logged, committed, returned by an API, or imported into Client Components.

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

Create **two different Supabase projects**:

- AUREVANE Staging
- AUREVANE Production

For each project, record its project URL, publishable key, and server secret key in the appropriate deployment secret store. Do not place them in repository files.

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

Configure Production environment variables with **production** values:

```text
NEXT_PUBLIC_AUREVANE_ENV=production
AUREVANE_ENV=production
NEXT_PUBLIC_SUPABASE_URL=<production project URL>
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<production publishable key>
SUPABASE_SECRET_KEY=<production server secret key>
```

Do not reuse the same Supabase project for Preview and Production.

## 5. Migration Workflow

All application database schema changes require a version-controlled migration under:

```text
supabase/migrations/
```

Normal workflow:

1. Create/edit a migration locally.
2. Run `pnpm db:reset` to reconstruct the database from zero.
3. Run the repository quality gates.
4. Review generated SQL for security and data-loss risk.
5. Merge only after CI is green.
6. Apply migrations to staging and verify there before production.

Do not make untracked production schema changes in the Supabase Dashboard.

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

The polished player authentication UI belongs to Phase 1 and is intentionally not implemented in F0.2.

## 8. Production Safety Rules

- Never run destructive reset commands against production.
- Never use production player data as local seed data.
- Never expose `SUPABASE_SECRET_KEY` to the browser.
- Never treat RLS as a substitute for server-side authorization on authoritative game actions.
- Never trust values submitted by the browser merely because the user is authenticated.
- Review migrations before applying them to hosted environments.
- Keep `main` deployable; staging verification precedes production schema changes.

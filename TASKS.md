# AUREVANE — Active Task Ledger

This file tracks the current implementation boundary. The Master Game Plan defines the final product; the Roadmap defines sequence; this file defines the active work.

## Current status

**Stage:** Phase 0 — Engineering Foundation

Authoritative documents established:

- `docs/GAME_MASTER_PLAN.md`
- `docs/ART_BIBLE.md`
- `docs/AUDIO_BIBLE.md`
- `docs/MEDIA_PIPELINE.md`
- `docs/TECH_ARCHITECTURE.md`
- `docs/ROADMAP.md`
- `AGENTS.md`

Legacy prototype code has intentionally not been imported.

## Completed

### SPRINT-0-PLAN — Break Phase 0 into implementation tickets

Phase 0 is defined in `docs/PHASE_0_TICKETS.md` as four independently verifiable tickets aligned to Master Plan Sprints 0–3.

### F0.1 — Repository + Runnable Web Foundation

Completed with:

- pnpm/Turborepo monorepo foundation;
- pinned dependency policy and committed lockfile;
- Next.js/React/TypeScript `apps/web` application;
- first responsive AUREVANE development screen;
- Prettier, ESLint, strict TypeScript, Vitest, and production-build gates;
- GitHub CI with frozen dependency installs and clean-working-tree verification;
- local-development and Vercel monorepo documentation.

**Verification:** formatting, lint, typecheck, tests, production build, and clean-source CI gate all pass.

### F0.2 — Infrastructure + Persistence Baseline

Completed with:

- explicit local/staging/production environment identity and validation;
- pinned Supabase client, SSR, and CLI dependencies;
- browser, server, and elevated server-only Supabase client boundaries;
- SSR cookie/session refresh, verified-claims auth boundary, callback, and server-side sign-out routes;
- version-controlled Supabase configuration, migration, and seed workflow;
- server-only `app_private` schema baseline with browser-role access revoked;
- migration security policy that rejects disabled RLS, broad browser grants, and public/unqualified application tables without same-migration RLS;
- CI that reconstructs the database from migrations, verifies schema privileges, and performs real local signup/sign-in through Supabase Auth;
- documented Vercel monorepo root and environment separation conventions;
- staging foundation migration applied and migration-history version reconciled with the committed migration filename.

**Verification:** final F0.2 quality gates, production build, migration rebuild, private-schema privilege checks, and local authentication checks pass. No gameplay schema or future-system implementation was introduced.

## ACTIVE

### F0.3 — Server Architecture Skeleton

**Purpose:** establish the durable server-authoritative command, service, persistence, idempotency, realtime, worker, error, and logging boundaries required by later game systems.

**Allowed scope:** `packages/game-core`, database adapter/service conventions, validation additions, transactional/idempotent command foundation, `packages/realtime`, `apps/worker`, structured errors/logging, and one non-game authoritative probe through the existing web server boundary.

**Explicitly out of scope:** character/gameplay schemas, combat, progression implementation, world systems, Master Panel features, final UI/design system, and media/audio runtime.

**Acceptance criteria:** the authority probe authenticates and validates before service execution; persistence is atomic and duplicate-safe; unauthorized requests are rejected; realtime remains notification-only; the worker builds and boots; structured errors are consistent; all existing quality/database gates remain green.

Tracking: GitHub issue #12.

## Next after F0.3

F0.4 — Design System + Media/Audio Core.

## Rule

Only one implementation ticket is ACTIVE at a time. Future systems may influence interfaces and boundaries, but they are not implemented early.

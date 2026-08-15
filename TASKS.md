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

### F0.3 — Server Architecture Skeleton

Completed with:

- pure `packages/game-core` actor/command and stable server-error primitives with no React/browser dependencies;
- reusable transactional-command and durable idempotency contracts;
- server-only `app_private.idempotency_records` persistence plus an atomic PostgreSQL authority-probe transaction;
- strict shared request/persistence validation for the non-game authority probe;
- thin authenticated Next.js route, server service, persistence adapter, and safe HTTP-error translation boundaries;
- realtime invalidation interfaces that carry identifiers for authoritative refetch rather than owning game state;
- runnable `apps/worker` lifecycle with structured startup/shutdown/crash logging and deterministic CI boot mode;
- documented server command, transaction, idempotency, realtime, logging, error, and worker conventions;
- CI coverage for browser-role denial, conflicting idempotency keys, first execution versus replay, real Supabase authentication, and a real authenticated Next.js authority-probe request end to end;
- no new external runtime framework/dependency and no gameplay schema or future gameplay feature implementation.

**Verification:** final F0.3 formatting, lint, all workspace typechecks/tests, production build, worker boot, database rebuild, private-schema checks, transactional idempotency checks, local authentication, and authenticated web-route replay checks pass.

## ACTIVE

### F0.4 — Design System + Media/Audio Core

**Purpose:** reach the Phase 0 presentation gate with a polished responsive AUREVANE shell and first-class image/audio architecture.

**Allowed scope:** `packages/ui`, `packages/audio`, `apps/web` presentation, stable media registries, accessibility baseline, persistent local audio settings, central browser-gesture-gated Audio Director, initial art/audio request records, and responsive browser smoke verification.

**Explicitly out of scope:** character/gameplay schemas, combat, progression, world systems, actual Expeditions/PvP/guild features, complete player manual UI, Master Panel implementation, and unreviewed production media.

**Acceptance criteria:** the empty shell is polished and responsive; keyboard/focus behavior is deliberate; requested/missing media fails gracefully; audio does not autoplay; Master/Music/SFX/Ambience/UI controls persist; mute preserves levels; the Audio Director is the single playback authority; registries are validated; desktop/mobile browser smoke checks and all existing CI gates pass.

Tracking: GitHub issue #14.

## Next after F0.4

Phase 1 — Character Foundation. Do not begin it until F0.4 reaches its completed checkpoint.

## Rule

Only one implementation ticket is ACTIVE at a time. Future systems may influence interfaces and boundaries, but they are not implemented early.

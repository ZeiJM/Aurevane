# AUREVANE — Active Task Ledger

This file tracks the current implementation boundary. The Master Game Plan defines the final product; the Roadmap defines sequence; this file defines the active work.

## Current status

**Stage:** Phase 1 — Character Foundation planned; implementation not started

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

### F0.4 — Design System + Media/Audio Core

Completed with:

- real `packages/ui` workspace with centralized semantic typography, color, spacing, focus, surface, motion, and reusable game-UI primitives;
- polished responsive AUREVANE application shell with deliberate desktop/mobile layouts, keyboard focus, skip navigation, and reduced-motion handling;
- stable image/media registry plus reusable image component that renders traceable requested-media fallbacks instead of broken or random placeholder assets;
- traceable `ART-UI-001`, `AUDIO-MUS-001`, `AUDIO-AMB-001`, and `AUDIO-UI-001` production request records;
- real `packages/audio` workspace with versioned settings, validated asset registry, and a central Web Audio `AudioDirector` that initializes only after explicit player interaction;
- independent Master, Music, SFX, Ambience, and UI channels, mute that preserves channel levels, and versioned pre-login local persistence;
- dev-only Playwright browser verification covering desktop/mobile layout, horizontal-overflow protection, keyboard reachability, media fallback, gesture-gated audio initialization, and persisted mute/volume behavior;
- dedicated browser-smoke CI plus the existing F0.1–F0.3 quality, worker, database, authentication, and idempotency regression gates;
- successful Git-linked Vercel preview of the canonical F0.4 branch;
- no gameplay schema, combat, progression, world, economy, Master Panel, or other future gameplay system implemented early.

**Verification:** F0.4 passed its implementation-branch quality/database gates and real Chromium acceptance, then the squash-merged `main` checkpoint passed the same CI, database/security regressions, and responsive browser-smoke verification.

**Concurrency audit:** a separately created competing F0.4 implementation was inspected and rejected as incomplete/conflicting. Canonical PR #18 was merged; the competing branch was force-aligned to the approved `main` checkpoint and its audit-marker PR #17 was closed without merge. No divergent duplicate F0.4 implementation remains.

### P1-PLAN — Break Character Foundation into implementation tickets

Phase 1 is defined in `docs/PHASE_1_TICKETS.md` as six independently verifiable tickets:

- P1.1 Account Entry + Player Profile Boundary;
- P1.2 Character Domain Rules + Creation Contract;
- P1.3 Authoritative Character Creation + Persistence Experience;
- P1.4 Character Profile + Derived Stat Framework;
- P1.5 Level 1–100 XP Progression + Telemetry Foundation;
- P1.6 Wayfarer's Practice: Balanced Practice Foundation.

The first major player milestone is P1.3: an authenticated player can create and permanently persist a valid character. Phase 1 explicitly preserves later Discipline, combat, world, inventory/equipment, Horizon, Rekindling, premium-slot and Master Panel scope for their roadmap phases rather than implementing them early.

## ACTIVE

No Phase 1 implementation ticket is active.

Phase 0 production-verification issue #20 remains open. Vercel Production is currently one commit behind `main`: the missing commit is the already-merged public-shell environment hotfix. The first Phase 1 implementation must not merge until the current Phase 0 production shell is successfully redeployed and verified.

## Next

P1.1 — Account Entry + Player Profile Boundary, after issue #20 is closed.

## Rule

Only one implementation ticket is ACTIVE at a time. Future systems may influence interfaces and boundaries, but they are not implemented early.

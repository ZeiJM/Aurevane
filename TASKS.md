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

## ACTIVE

### F0.2 — Infrastructure + Persistence Baseline

**Purpose:** Establish safe local/staging/production persistence and authentication infrastructure.

**Allowed scope:** Supabase project conventions, environment validation, migration workflow, PostgreSQL baseline, authentication integration, initial RLS/security baseline, server-only credential handling, and deployment environment documentation.

**Explicitly out of scope:** character/gameplay schemas, combat, world systems, final design system, media/audio runtime, and later game features.

**Acceptance criteria:**

- local, preview/staging, and production environments are explicitly separated;
- migrations are reproducible and version-controlled;
- authentication can be integrated without trusting the browser for privileged state;
- exposed data has a deliberate RLS model;
- service credentials remain server-only;
- automated environment/security checks pass;
- existing F0.1 quality gates remain green.

## Next after F0.2

F0.3 — Server Architecture Skeleton.

## Rule

Only one implementation ticket is ACTIVE at a time. Future systems may influence interfaces and boundaries, but they are not implemented early.

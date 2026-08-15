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

## ACTIVE

### F0.1 — Repository + Runnable Web Foundation

**Purpose:** Establish the monorepo and first deployable AUREVANE web application.

**Allowed scope:** workspace/tooling, `apps/web` scaffold, dependency policy, formatting, lint, typecheck, tests, production build, CI, Vercel/developer setup documentation.

**Explicitly out of scope:** Supabase/database/auth, gameplay mechanics, final design system, media runtime, audio engine, character systems, combat systems.

**Acceptance criteria:**

- monorepo structure matches the Master Plan;
- first AUREVANE page renders;
- formatting/lint/typecheck/tests/build all pass;
- GitHub CI enforces the quality gate;
- Vercel can deploy the web application after its Root Directory is set to `apps/web`;
- developer setup is documented.

## Next after F0.1

F0.2 — Infrastructure + Persistence Baseline.

## Rule

Only one implementation ticket is ACTIVE at a time. Future systems may influence interfaces and boundaries, but they are not implemented early.

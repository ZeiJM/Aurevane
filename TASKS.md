# AUREVANE — Active Task Ledger

This file tracks the current implementation boundary. The Master Game Plan defines the final product; the Roadmap defines sequence; this file defines the active work.

## Current status

**Stage:** Foundation preparation

Authoritative documents established:

- `docs/GAME_MASTER_PLAN.md`
- `docs/ART_BIBLE.md`
- `docs/AUDIO_BIBLE.md`
- `docs/MEDIA_PIPELINE.md`
- `docs/TECH_ARCHITECTURE.md`
- `docs/ROADMAP.md`
- `AGENTS.md`

Legacy prototype code has intentionally not been imported.

## Next task

### SPRINT-0-PLAN — Break Phase 0 into implementation tickets

**Purpose**

Translate Phase 0/Foundation into small, verifiable coding tickets before application code is created.

**Scope**

Plan only. No feature implementation yet.

**Required ticket coverage**

- fresh Next.js/TypeScript scaffold;
- dependency/version policy;
- formatting, linting, typecheck, tests, production build;
- GitHub CI;
- Vercel-safe environment setup;
- database/migration foundation;
- authentication baseline;
- authorization/security baseline;
- design-system tokens/primitives;
- responsive application shell;
- media registry foundation;
- central audio-runtime foundation;
- structured errors/logging;
- developer setup documentation.

**Acceptance criteria**

- tickets are independently implementable;
- each ticket includes exact scope, affected modules, approach, tests, acceptance criteria, manual verification, and dependencies;
- tickets do not prematurely implement later game systems;
- architecture anticipates the full Master Plan.

## Rule

Only one implementation ticket becomes ACTIVE at a time. When it is complete and verified, mark it DONE and select the next ticket.

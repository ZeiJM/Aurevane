# AUREVANE — Phase 0 Implementation Tickets

**Authority:** `docs/GAME_MASTER_PLAN.md` remains primary. These tickets translate its Phase 0 / Sprints 0–3 into independently verifiable work.

## F0.1 — Repository + Runnable Web Foundation

**Purpose:** Establish the monorepo and first deployable AUREVANE web application.

**Scope:** pnpm workspace; Turborepo; `apps/web` Next.js/React/TypeScript application; dependency policy; formatting; ESLint; TypeScript checks; Vitest smoke test; production build command; GitHub CI; Vercel deployment notes; developer setup.

**Affected modules:** repository root, `.github/workflows`, `apps/web`, foundation docs.

**Approach:** Use a minimal App Router application. Do not implement authentication, database, gameplay, media runtime, or final design system yet.

**Automated tests:** format check, lint, typecheck, Vitest, Next.js production build.

**Acceptance criteria:** all quality gates pass; web app renders a branded foundation screen; monorepo structure matches the Master Plan; `main` can remain deployable after merge.

**Manual verification:** open the Vercel preview/production URL and confirm the foundation page renders on desktop and mobile width.

**Dependencies:** authoritative project documents only.

## F0.2 — Infrastructure + Persistence Baseline

**Purpose:** Establish safe local/staging/production data infrastructure.

**Scope:** Supabase project conventions; local configuration; environment schema; migration workflow; PostgreSQL baseline; authentication integration; RLS baseline; server-only credential handling; Vercel environment documentation.

**Affected modules:** `packages/db`, `packages/validation`, `apps/web` auth boundary, Supabase/migration configuration.

**Approach:** Keep authoritative mutations server-side. Exposed tables receive deliberate RLS. No character/game tables beyond what infrastructure/auth requires.

**Automated tests:** environment validation, migration checks, auth boundary tests, RLS/security tests where supported locally.

**Acceptance criteria:** local/staging/production are explicitly separated; migrations are reproducible; a test account can authenticate safely; service credentials never enter browser code.

**Manual verification:** sign in/out in a non-production environment and confirm unauthorized data access is rejected.

**Dependencies:** F0.1.

## F0.3 — Server Architecture Skeleton

**Purpose:** Create the durable server-authoritative boundaries required by later game systems.

**Scope:** `packages/game-core`; database adapter/service conventions; validation package; transactional service pattern; idempotency abstraction; realtime adapter interface; worker application skeleton; structured errors/logging conventions; initial tRPC/API boundary without game features.

**Affected modules:** `packages/game-core`, `packages/db`, `packages/validation`, `packages/realtime`, `apps/worker`, `apps/web` server entry points.

**Approach:** Pure domain code has no React/browser dependencies. API boundaries authenticate and validate before service calls. Realtime transports events but does not become authority.

**Automated tests:** pure-domain unit tests, validation tests, service/idempotency tests, boundary authorization smoke tests.

**Acceptance criteria:** a trivial server-authoritative command can pass through validation/service/persistence boundaries without client-trusted state; worker boots; structured errors are consistent.

**Manual verification:** exercise the non-game health/example command and confirm expected server logs without secrets.

**Dependencies:** F0.2.

## F0.4 — Design System + Media/Audio Core

**Purpose:** Reach the Master Plan's Phase 0 gate: a beautiful empty AUREVANE shell with first-class media architecture.

**Scope:** typography/color/spacing tokens; reusable UI primitives; responsive application shell; accessibility baseline; media registry; image asset component conventions; central Audio Director; master/music/SFX/ambience volume channels; mute/settings persistence; initial art/audio request integration.

**Affected modules:** `packages/ui`, `packages/audio`, `apps/web`, `content/art-requests`, `content/audio-requests`.

**Approach:** Follow the Art Bible and Audio Bible. Visual/audio providers remain behind stable registries/services. Do not implement gameplay systems.

**Automated tests:** UI primitive tests where useful, audio state/reducer tests, registry validation, responsive browser smoke tests.

**Acceptance criteria:** polished responsive empty game shell; audio initializes only after valid browser interaction; mute/volume settings persist; missing assets fail gracefully; media requests are traceable.

**Manual verification:** inspect desktop/mobile shell, keyboard navigation, volume/mute behavior, and a Vercel preview.

**Dependencies:** F0.3.

## Phase 0 Gate

Phase 0 is complete only when the project has a clean build, automated checks, deployable preview, documented local setup, production-style infrastructure, and the polished empty shell/audio foundation required by the Master Plan.

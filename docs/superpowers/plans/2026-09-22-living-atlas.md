# Living Atlas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Implement the approved interactive globe and square-grid travel page with exploration, auto-path, encounters and View 360.

**Architecture:** Feature-owned world definitions and deterministic travel rules feed an authenticated service backed by private Postgres state and transactional RPCs. React renders projected public state over original map artwork; a small WebGL renderer handles globe and panorama cameras without adding a game-engine dependency.

**Tech Stack:** Existing Next.js/React/TypeScript, Supabase/Postgres, Vitest, WebGL, CSS, original generated WebP art.

**Spec:** `docs/superpowers/specs/2026-09-22-living-atlas.md`

Implementation/acceptance details and scoped deviations: `docs/LIVING_ATLAS_DELIVERY.md`.

## Global Constraints

- All valuable/persistent game state is server-authoritative.
- Hidden, undiscovered or ineligible world/map data is absent from unauthorized payloads rather than merely hidden by presentation.
- No combat balance changes, Phase 4 rewrites, remote migrations or deployments.
- Square 13 by 9 cells; eastings bottom; portrait markers at cell centres.
- Existing character rail, with no location information. No Sector Overview.
- View 360 changes camera only and provides no encounter immunity.

## Review Focus

- Simultaneous move/attack and stale tab commands must yield one authoritative result.
- A new character or disconnected client must not receive hidden geography or advance a route in a catch-up burst.
- Auto-path disabled for one event must not disable independent quest travel.
- Rotated globe selection and portrait projection must use the same coordinates as the rendered sphere.
- Mobile, keyboard, reduced motion and WebGL failure must retain usable travel controls.

### Task 1: Travel and discovery domain

**Files:** `apps/web/src/world/{types,catalog,travel,projection,globe-math}.ts` and focused `.test.ts` companions; `apps/web/src/server/world/world-content.ts` for unrevealed content.

**Interfaces:** `WorldPosition { sectorId, x, y }`, `WorldState { version, position, route, nextStepAt, discoveries }`, `WorldView` containing only allowed map/player/objective projections. `findWorldRoute(from,to,knownSectors)` returns legal timed steps; `advanceWorldRoute(state,now)` advances at most one due step; `projectWorldView` omits hidden content; `projectGlobePoint`/`unprojectGlobePoint` share sphere geometry.

- [x] Write failing behavior tests for a path around the river, a blocked destination, a cross-region road, unknown frontier rejection, event policy isolation and one-step-only advancement.
- [x] Run `pnpm --filter @aurevane/web exec vitest run src/world` and verify missing-feature failure.
- [x] Implement bounded Dijkstra routing over authored walkable cells plus explicit timed road edges. Reject unpublished/unknown destinations and cap route length. Derive grid centres as `(x + 0.5) / 13` and `(y + 0.5) / 9`.
- [x] Verify domain tests as part of the coherent candidate commit.

### Task 2: Persistent authority and encounters

**Files:** `apps/web/src/server/world/{world-service,world-repository,world-handler,world-battle}.ts`, focused tests, `apps/web/src/app/api/world/route.ts`, generated Supabase migration and SQL integration tests.

**Interfaces:** Authenticated GET loads `WorldView`; POST accepts a discriminated intent (`walk`, `autopath`, `stop`, `tick`, `cross`, `attack`) with expected version. Repository compare-and-swap validates session locks and command replay. Attack accepts a target character ID, never a client-supplied position or battle snapshot.

- [x] Add tests that require ownership, stale-version rejection, server movement timing, hidden-player filtering and active-session blocking.
- [x] Implement private position/route/discovery persistence with restricted service-role RPCs, ordered locks and bounded visible-neighbour queries. Reuse existing PvP encounter construction and transactional battle persistence.
- [x] Test the migration against local Postgres when available; explicitly record missing runtime infrastructure if unavailable.
- [x] Verify service and domain tests and include in the coherent candidate commit.

### Task 3: Approved visual experience

**Files:** `apps/web/src/components/world/*`, `apps/web/src/app/game/world/page.tsx`, navigation entry/icon, `apps/web/public/media/art/world/*`, media provenance documentation.

**Interfaces:** `WorldWorkspace({ initialView, character })` consumes projected state; `Globe` changes inspected sector only; `SectorMap` submits intents; `Surroundings` opens a current-location panorama and leaves polling active.

- [x] Create original terrain, globe texture and panoramic art matching the approved concepts. Record prompts/source provenance; use optimized local assets.
- [x] Implement parchment toolbar, navy/gold framing, persistent character rail, region/quest/nearby side panels, square map, bottom eastings, centered portraits and distinct textures.
- [x] Implement camera rotation, zoom, region search, layer/motion controls, route preview, Start/Stop Auto-path and guarded Attack. Animate water and environmental accents with reduced-motion support.
- [x] Add keyboard controls, accessible dialog focus/escape restoration, mobile panel layout and a WebGL fallback.
- [x] Verify authenticated interactions and layout in disposable Supabase browser CI; run 35795492891 passed across desktop, laptop and phone. Inspect returned screenshots and guard identified presentation defects. Owner visual acceptance remains a release gate.

### Task 4: Final verification and review

**Files:** map regression tests, Phase 5 ticket/roadmap/task status and delivery notes.

- [x] Run `pnpm check` (all gates passed on initial candidate; rerun after review fixes).
- [x] Inspect actual rendered map/360 views at 1440x900, 1366x768 and mobile using CI artifacts, including all eight regional sector/panorama pairs. Focused browser results and traces are attached to the draft PR checks; no deployed preview was used.
- [x] Refresh current main and reconcile any overlaps; inspect `git diff --check` and full task patch.
- [x] Request one fresh whole-branch review using the executing-plans skill. Address concrete critical/important findings with focused regression tests.
- [x] Commit verified work and prepare a non-deploying draft PR, with precise remaining content and migration/release requirements.


### Authored northern roads continuation — 2026-09-23

Scope follows the approved sector/travel contract: Highland Road (Aureth Crown–Starfall Highlands) and Northern Pass (Starfall Highlands–Frostmere), distinct terrain and ambient panoramas, no new lore or authority layer.

- [x] Verify prior panorama browser results; inspect current main and existing content.
- [x] Observe failing coverage for both traversal directions, blocked terrain, projection/encounters and obsolete saved routes; implement authored sectors and verify the focused suite.
- [x] Generate original map/panorama artwork, retouch wrap joins, register optimized assets with provenance and extend existing browser journeys.
- [x] Run full repository quality gate, fresh independent review and final main reconciliation; prepare draft PR #609 update.
- [x] Inspect latest-head authenticated browser results/screenshots: run 35847548263 passed eleven scenarios; northern maps/reverse panoramas inspected. Owner acceptance remains separate.


### Final initial regional road pair — 2026-09-23

Scope: Eastern March Road (Emberreach–Umbral March) and Old Coast Road (Hollow Coast–Umbral March), using the existing authored-sector contract. This finishes the eight initial connections without claiming all Phase 5 content.

- [x] Verify northern-road browser evidence and inspect the separate database runner failure.
- [x] Observe missing-feature failures, implement both sectors, and pass traversal/authority/all-region connectivity regressions.
- [x] Generate original map/panorama assets, retouch joins, register provenance and extend authenticated journeys.
- [x] Complete full quality gate, fresh independent review, collision correction and main reconciliation; prepare draft PR update.
- [ ] Inspect latest-head browser results/screenshots when available; Owner acceptance remains separate.


### Ambient motion and verification continuation — 2026-09-23

- [x] Inspect existing environmental effects and source illustrations; refine regional water/lava masks, coastal wash, wind and restrained light per Owner request.
- [x] Extend browser checks for actual motion progression, disabling motion and reduced-motion removal.
- [x] Add deterministic authenticated Postgres contention scenarios for distinct commands, identical retries and mutual attacks; verify discovery/types and independently review lock/cleanup behavior.
- [x] Run the local quality gate and fresh independent review; reconcile current-main status and prepare draft PR update.
- [ ] Observe latest-head authenticated browser run and inspect new screenshots; the newly authored contention scenarios require that runtime evidence.
- [ ] Complete remaining staging movement/attack/training/build competition checks and Owner visual acceptance before release.


### Encounter competition verification continuation — 2026-09-23

- [x] Inspect latest PR state and runner status; current main remains `41f2c560` and Atlas CI remains queued.
- [x] Add authenticated due-movement/attack competition and controlled training/build changes after encounter snapshot preparation, using the existing disposable-database lock gate.
- [x] Run full local checks, confirm 48 discovered browser combinations and obtain fresh independent review.
- [ ] Execute these new real-Postgres scenarios in CI and inspect latest-head browser artifacts; authored tests alone do not close the gate.

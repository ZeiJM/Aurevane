# Battle Chronicle and Effect Lifecycle Implementation Plan

> **For agentic workers:** Use executing-plans for the coordinator; dispatching-parallel-agents permits independent domains with explicit file ownership. Tests follow red/green order and a final independent review gates integration.

**Goal:** Implement the approved text chronicle, versioned editable narration, configurable delayed effects, correct rail lifetimes and preview cleanup.

**Architecture:** Reuse viewer-projected persisted history and pinned combat-content resolution for a new shared reading component. Reuse typed authoring/persistence authority for timing and narration; expose pending status data without client mechanics. Independent domain workers report their exported interfaces before integration.

**Tech Stack:** Existing TypeScript game core, Next/React, Vitest, Playwright and audited Supabase services; no new dependency.

**Spec:** `docs/superpowers/specs/2026-10-03-battle-chronicle-effects.md`.

## Global constraints

Current application candidate is `172d276b9cfaa2b2a3daa46fd7cf97b0bcda0222` on `agent/resonance-report-format-20261002`; base Main is `979176da6dcfc79a2f581d1bbf8a93200ed4012a`. PR #809 remains non-deploying until the expanded final candidate passes. Do not reset Main, alter P5/Clash, activate content or apply unrelated migrations.

## Review focus

- Hidden/copied commands must not expose content through metadata enrichment.
- Round transitions, timeout/end-turn, six participants, dead/skipped actors and pending ticks must obey the same lifecycle.
- Master edits must preserve historical definition/policy versions and fail closed on malformed templates/tags.
- Group ownership must distinguish same-name actors and keep multi-target/special outcomes complete.
- Live updates and effect popovers must preserve scroll intent, keyboard combat isolation and battlefield dimensions.

### Task 1: Authoritative context and editable narration

**Files:** `server/battle/battle-log-service.ts`, `battle-log-skill-context.ts`, their tests, dedicated flavor-template helpers and existing Master flavor editors. Coordinate any core validator ownership with timing worker.

**Interface:** Extend the existing optional `BattleLogEntry.actionContext` with family and safe narrator context; enrich current and historical Essence/Resonance only after privacy projection using exact pinned references. Expose a typed template renderer shared with Master previews.

- [x] Write and run failing real-service tests for pinned Essence/Resonance, hidden commands, names/pronouns and missing metadata.
- [x] Implement enrichment and authoring help/validation without changing mechanics or publication gates.
- [x] Run focused service/core/editor tests; report interfaces and evidence.

### Task 2: Effect timing policy and expiry

**Files:** Core action/effect/status lifecycle, dedicated timing policy modules, audited settings/authoring integration, Master timing editor and focused tests. No log view or existing flavor-editor edits.

**Interface:** Server-pinned policy plus pending/active effect lifecycle data, consumed by combat and rail helpers. Send exact types/paths to coordinator and icon worker before they integrate.

- [x] Trace all authoritative end-turn/timeout/status/serialization paths and existing Master settings.
- [x] Reproduce one-turn premature expiry and delayed-next-round activation in failing tests, including six participants and damage/recovery exceptions.
- [x] Implement typed policy, queue/filtering and end-of-affected-turn expiry; retain cooldown semantics and historical compatibility.
- [x] Verify engine/service/authoring boundaries and publish-policy persistence locally; report required migration/activation boundaries before release.

### Task 3: Rail effect identifiers and standard tooltips

**Files:** `battle-combatant-effects.tsx`, its module/tests, `battle-effect-summary.ts` and dedicated identity helper if necessary. Do not edit log view or core scheduling files.

**Interface:** Read timing worker's exported pending/active data; canonical `combatStatusDetails` owns meaning. Unique stable IDs and simple distinct visual identifiers, with remaining-turn overlay and a hover/focus/click reading panel.

- [x] Write and run failing identifier, tooltip, duration and pending-state tests.
- [x] Implement complete identities and standardized descriptions/counts; preserve two-row geometry.
- [x] Verify shared PvP/PvE states and keyboard/click dismissal.

### Task 4: Approved chronicle and preview cleanup

**Files:** New `battle-log-chronicle` model/component/styles/tests; `battle-log-feed.tsx`, `battle-log-panel.tsx` and tests/layout checks. Separate cleanup worker owns canonical Skill rows and full-preview targeting paragraphs; coordinate Master editor touch points.

**Interface:** Consume Task 1's optional context and complete recorded events, produce grouped rounds/actors and compact factual outcomes. No engine state mutation or duplicated mechanics.

- [x] Write and run failing filtered-event, actor-grouping, multi-target, special-family, no-count/header and authored-story tests.
- [x] Implement parchment reader, unobscured standardized effect popovers, bounded scroll and live-review retention; preserve full saved history.
- [x] Remove redundant targeting prose; retain required facts through canonical rows.
- [x] Mount both playable modes and spectator at desktop/mobile sizes, verify no map/cockpit resize and dense readable entries.

### Task 5: Integration and release

- [x] Inspect every worker diff, resolve interface conflicts and update docs/ledger to the final scope.
- [x] Run full `pnpm check`, relevant local database/authoring tests, independent review and exact-head remote workflows.
- [x] Refresh Main and reconcile overlaps; rewrite PR #809 title/body around the final implementation.
- [x] Merge only the verified candidate, release through config-only deployment gating, verify exact READY source/alias and smoke, then restore the lock with evidence. Authenticated live smoke is bounded by the existing unsuccessful sign-in; do not claim unavailable evidence.

Release: verified candidate `990d6c3`, application merge `8a0f1f6`, Production source `96b468dc`, hosted timing migration `20261003040911` and READY deployment `dpl_AFvAEsDpi49ovcvaS6XdnJmPZ1t9`. Full evidence and retained testing limits: `docs/superpowers/verification/2026-10-03-battle-chronicle-effects.md`.

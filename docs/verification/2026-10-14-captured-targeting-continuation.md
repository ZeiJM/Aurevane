# Captured targeting continuation — October 14

Status: WORK IN PROGRESS. Task3 is not independently accepted or released.
The accepted Ability foundation remains live through PR896/source128f7add.
This checkpoint does not publish new Skills, Essences or Resonances.

## Preserved source and implemented controller work

The continuation preserves the original partial targeting checkpoint
91fca778fe75c5e1fe0b41f956f04f3f1a93739c, reconciled with the tested Ability
foundation and main69347f11e4625808df91b033d4139da913116786. No recovered
branch was reset or overwritten. The isolated working branch is
`agent/overhaul-targeting-20261014`.

- Read the owner's captured Manual-action geometry from the safe
  `snapshot.manualActionTargets` projection. Keep its explicit behavior ID in
  ordinary, directional, area and initial command/forecast intents.
- Preserve historical definitions without captures. Multiple Manual groups
  require an explicit choice; missing/stale choices cannot silently use the
  first group or legacy action.
- Collect deliberate ordinary target drafts, up to the authored count1–3.
  Repeat a target to remove it; prevent a fourth distinct target; distinguish
  unit identity from Ground coordinates. Arming does not add an inferred target.
- Wire the shared PvE/PvP controller, pointer/touch selection, native direction
  shortcuts and confirmation to that draft. Use the existing footer for compact
  action choice and confirmation, preserving cockpit artwork and slots.
- Prefer canonical categories over the legacy kind/team envelope. Keep Self
  separate from Ally and allow Ground without inventing a primary unit. Preserve
  the chosen half-plane when aiming a mixed Ground/Enemy action.
- Support geometry3 Line/Circle/All potential coverage and forecast requests.
  New All bypasses Range; spatial checks use the shared canonical resolver.
  Geometry2 retains its historical behavior. The actual arena-derived maximum
  Range is20, covered by the preserved core test.
- Clear target drafts with the existing planning lifecycle, including cancel,
  committed/reloaded state and loss of turn authority. Unit highlights follow
  current placement identity; Ground highlights keep their coordinates.

## Verification and limits

New captured-descriptor tests failed4/4 before implementation, then passed.
Geometry/forecast regressions failed3/37 before implementation, then passed37/37.
Draft painting failed1/4 before implementation; canonical category and aim
regressions also reproduced their mismatches before correction.

Final local verification passes2429 Vitest checks across292 web test files,
all7 Node checks,100 targeted controller/geometry checks, web types, affected
lint, formatting and `git diff --check`. Commands include:
`pnpm --filter @aurevane/web exec vitest run --maxWorkers=2`,
`pnpm --filter @aurevane/web typecheck`, and the actual two Node test scripts.
The existing Vite native-config warning remains; it was not suppressed.
An earlier complete run exposed the canonical Self-envelope directional defect;
the final focused and complete runs pass after correcting that exact branch.

The new browser matrix mounts production PvE/PvP controls at1366×768 and390×844
against real canonical kernel quotes/commits. It checks no payment during draft,
explicit group choice, repeated-target removal, two-target settlement with one
multicost payment, and native keyboard confirmation. It is wired into Browser
smoke before the reader checks, with an artifact and a Playwright wrapper. The original eight-case matrix and full Browser smoke
passed on remote18dd5d5262590b3e606b8ea096d4223172346feb.

## Reviewed corrections checkpoint

The independent review is not whole-Task3 acceptance. Its Ground delivery and
omitted canonical geometry findings were reproduced before correction:

- Ground immunity now follows each actual selected recipient, including mixed
  Ground/unit casts, overlapping explicit unit priority, out-of-turn owner origins,
  delayed resolution and serialized pending state. Payment remains once per cast.
  Malformed pending identities fail closed; absent historical metadata keeps its
  original semantics. Private delivery identities are omitted from public views.
- Canonical definitions with no geometry marker use effective geometry2 in
  materialization, Automatic resolution and safe Manual projection. Real capture,
  participant projection, controller intents and authoritative quotes agree.
  Uncaptured native history is not normalized.
- The review's Self-only Circle/All example is invalid: actual capture rejects it
  with “Self-only targeting uses Single.” Validation was not weakened. A valid
  owner-triggered unit-area definition with omitted geometry did reproduce an
  Automatic suppression defect; the shared geometry default fixes that case.
- Category-based forecasts accept Ally/Enemy categories even when a historical
  envelope says Self. The JSX fixture's two unused destructuring bindings were
  removed without exposing the omitted captures or runtime.

Final local checks for these corrections pass 2,999 core tests in155 files and
2,443 web tests in293 files, direct core/web types, affected web lint (including
its JSX browser fixture), and formatting. Intermediate malformed test-helper
imports and an incorrect stat-bridge fixture failed before correction; those
were fixture errors, not additional product defects. Root lint's captured output
was incomplete; the complete repository Quality CI remains authoritative.

The native matrix is extended to12 cases using actual touch taps on mobile,
cancellation and a same-turn higher-version update in both PvE/PvP. This new
stale-selection assertion is intentionally awaiting an equipped-runner RED;
the production controller has not yet received that correction. Local Chromium
installation still yields a truncated archive. Do not call the new12 cases green
based on the original eight-case success or a launch error.

Latest main0bac86a89d645703e18f690ec0f2b997c3bb5d93 adds the World signed-in
verification receipt; preserve it along with its live source. No deployment,
hosted mutation, roster publication, full-overhaul closure, or Task3 acceptance
is claimed here. Real200% zoom, persistence/CAS and final review remain gates.

## Resume boundary

1. Verify the exact remote checkpoint tree and current main before editing.
2. Inspect the new browser matrix on an equipped runner, correct actual failures
   without weakening payment/target/authority assertions, and retain evidence.
3. Finish Target3's actual controller/AI/native persistence/geometry coverage and
   obtain the combined independent specification/quality gate before treating
   its interfaces as accepted for Move/Controlled implementation.
4. Continue Tasks3A–16 and the Owner follow-up specification. In particular,
   slow/incomplete map loading during movement is queued and has no diagnosis
   or fix in this checkpoint. Weather/day-night, Account portrait, all auxiliary
   editors, Master workspace upgrades and the final all-tag creative balanced
   roster remain outstanding.

High effort remains sufficient for this continuation. Pause for Owner-selected
Extra High only if a later judgment task genuinely needs it.

## Native stale-selection RED and storage follow-up

Remote56348580d88798b499900f46dc5cf0fb6ffd3011/tree48d07a36e155fa47c2d2e2fc0622012a93666070
reproduces the same-turn stale draft on the equipped Chromium runner:
Browser38544333179/job115786531601 fails at the five-second wait for Confirm
to disable (script line244), after the higher-version external battle event.
The existing ally and historical geometry steps pass first. This is an observed
product RED, not a missing-browser launch failure.

The controller correction uses the existing planning cleanup to invalidate the
actual draft/ref, pending intent and forecast sequence on every authoritative
higher version. A still-valid local same-turn action remains armed; its old
recipient selection does not. Native GREEN for this correction is pending.
The matrix now also checks200% CSS content zoom in both modes (14 total cases);
this is enlarged page content, not a claim about browser-chrome zoom controls.

Two real-kernel casts now traverse actual PGlite migration-defined PvE/PvP
creation and commit_battle_intent_v3 authority. Delayed mixed Ground/unit
metadata and immutable captures round-trip in the stored snapshot. One AP/MP/HP
payment is retained; exact replay adds neither payment nor events; conflicting
fingerprints, stale versions and unavailable users are rejected; events, snapshots
and private journals are checked after rejection. Full database suite94/15 and
DB types pass. Initial PvE fixture omitted two participant records and correctly
failed coverage; the fixture was repaired without weakening database authority.
These are local native SQL receipts, not hosted gameplay acceptance.

Current covering controller39 tests, web/DB types and affected lint pass.
Remote56348580 complete CI Quality/Database and Skill Engine/Shared Build/Essence
workflows pass; Browser fails at the intended stale-selection RED. Complete CI
on the controller correction and storage-test head remains required.

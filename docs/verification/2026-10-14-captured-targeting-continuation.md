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
smoke before the reader checks, with an artifact and an8-case Playwright wrapper.

This environment has no local Chromium executable. The attempted Playwright
download returned an invalid/truncated archive. Consequently these new browser
cases have NOT been observed passing here; a launch failure is not a product
RED assertion. Existing native UI and new mobile/zoom cases remain acceptance
work, as does independent whole-Task3 review. No hosted migration, deployment,
signed-in Production gameplay, full-overhaul completion or balance acceptance
is claimed by this checkpoint.

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

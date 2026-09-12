# Phase 4 combat review follow-through — 2026-09-12

This bounded follow-up is based on the combined Atlas/Chronist branch at
`3e9846868031243d95662d5eb246564d5ee5df35`. It preserves the Atlas migration and
testing-access policy. PR #456 was superseded by the integration through #457;
the combined release must include this follow-up before production verification.

## Independently reproduced combat defects

- A last actor with next-round Initiative could surrender after its HP reached
  zero, causing the round boundary to choose that defeated actor. The surrender
  path now explicitly marks the outgoing defeated actor when advancing the turn.
- PvP timeout/quality reconstruction discarded committed build authority and the
  turn origin. That could remove a saved Resonance payoff and Rewind context.
  Reconstruction now preserves the encounter metadata alongside rebuilt state.

Four regressions cover active and terminal surrender, a mixed Chronist/Vanguard
setup followed by timeout/reload/payoff, and movement/quality reset/Rewind. All
four failed before the fixes. The independent reviewer reran its original three
reproductions successfully after the fixes. The preceding audit branch passed
full `pnpm check`: 1,093 Vitest tests plus six Node report tests, formatting, lint,
typechecks and production build. That result is not evidence for later Atlas
changes; the combined tree receives fresh verification.

## Earned-Mastery browser gate

The retained Actions trace from run `34682297420` shows an attack on an empty
tile: board labels are one-based, while authoritative placements are zero-based.
The test now converts coordinates for both targeting and movement scoring, waits
for the local turn and visible occupied destination, and checks the legal target
before clicking. The earlier committed movement-budget and facing-shortcut fixes
are preserved.

The new-account fixture checks release eligibility independently of the Atlas
testing overlay. It leaves that global overlay open and never changes production
accounts. The real UI battle, victory, first claim, reload and duplicate-claim
assertions remain required. The final Profile assertion uses the current Atlas
label. Representative Buildcraft again runs this browser case and the temporal,
effect and AI suites in addition to the Atlas coverage.

CI/browser results must be recorded after execution. This follow-up does not
claim a production deployment, completed human media review or balance acceptance.

## Combined local verification

Reconciled the Atlas publication/gate changes at `483eed04` without overwriting
the other chat's active branch. Full `pnpm check` passed on the combined follow-up
tree `0e5294e40957678875fad8f6a550efe96b158dcf`: 1,100 Vitest tests and six Node
report tests, formatting, lint, all package typechecks and production build. The
stale Manual regression now checks the published Atlas/testing-policy wording.

The subsequent read-only E2E review identified that a Bastion dropdown option
alone could reflect temporary testing access. The final Atlas response is now
also required to report Bastion `releaseEligible: true`, compared with the
fixture's initial false release-eligibility check. This final test assertion
receives focused formatting/lint/type validation and still requires CI execution.

# Accepted Ability foundation release

Owner authorized on October 13, 2026 (America/Port_of_Spain): release the
accepted modular definitions and shared execution foundation first, then
continue the remaining overhaul. This supersedes the earlier combined-only
release boundary for this specific subset; it does not accept unfinished tasks.

## Exact source boundary

- Accepted foundation: `930a5b94a226b2a6a66bc4647e684bea0073be5e`, tree
  `2417ee03add3443385339d025bf3d60960db56fc` (Tasks 1/2).
- Release baseline: current main `0bf7958f37dba19092ce435b9e963b39e5facb95`.
- Preserve incomplete targeting at `91fca778fe75c5e1fe0b41f956f04f3f1a93739c`
  on `agent/unified-engine-recovery-20261010`; that checkpoint is not this release.
- Isolated branch: `agent/foundation-release-20261014`.
- Existing world/map improvements, native combat/history policies, published
  content and the Git deployment lock retain their authority.

## Release steps

1. Reconcile accepted source against current main. Inspect automatic merges as
   well as conflict resolutions; verify current world, AI, PvP, preview and
   persistence consumers, public projection and existing historical behavior.
2. Run covering engine/service/migration tests, affected types, lint/format,
   full quality checks and native browser/CI checks appropriate to scope.
   Give one fresh independent reviewer the complete release diff against its
   actual main baseline. Resolve substantive findings with regressions.
3. Inspect hosted functions/migration history and current published records.
   Apply only the reviewed necessary startup persistence additions, preserving
   service-only grants and old signatures. Merge and deploy the exact verified
   commit under the existing manual deployment gate. Confirm canonical alias,
   READY state, actual source, bounded logs and available smoke flows.
4. Record release identities, migration/validation evidence and practical test
   instructions. Reconcile the remaining targeting checkpoint with the released
   foundation and continue the full approved overhaul.

## Completion boundary

Shipping this foundation does not publish a new roster or claim the unfinished
targeting controller, Move/Controlled mechanics, editors or Master redesign.
No unpublished canonical content is made current merely to demonstrate the
engine. The new Owner follow-ups are preserved in the companion specification.
Every meaningful integration fix needs a failing regression before its fix.

## Review focus

Check native versus canonical capture precedence, current batched build
resolution, world encounter creation/startup persistence, existing terminal and
timeout rules, preview/commit/RNG/cost agreement, private metadata projections,
historical snapshots, and additive hosted migration compatibility. Do not infer
release readiness from the old Task 2 acceptance alone.

## Release milestone completed

Foundation is live through PR896 / source128f7add, exact tested treee38080bc.
All14 final workflows and initial Production smoke pass; startup migrations
are applied. Detailed receipt: docs/verification/2026-10-14-ability-foundation-release.md.
The remaining overhaul continues separately; no remaining task is accepted
by this scoped release.

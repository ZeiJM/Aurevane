# Modular correction release — implementation checkpoint

Status: **IN PROGRESS, NOT RELEASED**. The Owner authorized one combined correction drop before broader Master work, which stays isolated at `0350184a9`. Fresh main remains `2d933b0782f1c6c872782799fc4bc24954b6154d`. No correction push, publication, migration application, merge or deployment has occurred.

## Implemented locally

- Shared bold colored tag labels/magnitudes, Attack/Utility/Heal, compact requirements, conflict-only recipient brackets, ordinary durations, no Stack/Expiry brackets and concise status/Skill prose. Manual, Nexus, popup and battle adapters use the same report data. Master has no per-effect/Ground timing selector or once-per-battle checkbox.
- A complete immutable 294-entry candidate, separate from the historical October10 manifest, preserves stable identities, availability and media. All attached Move Skills select Ground; most targets use elevation0 with14 recorded deliberate exceptions. Every application defaults to one stack. Barrier uses maximum-HP percentages; Blindside is an enemy debuff. Rewind has global Controlled timing; Second Wind uses a three-turn cooldown in place of its once-per-battle limit.
- Global timing is explicitly captured as `tagAuthority: global`, overrides per-Skill timing, persists through later Owner CAS saves, and permits Controlled re-priming after cooldown. Historical captures keep their rules. New actual PvE and both PvP entry points enroll in modular mechanics only with global timing authority, allowing compatible code to be staged before one atomic activation.
- Primed overlays and accessible labels cover all action artwork, independently of release readiness. Published Essence/Resonance resolve from pinned battle sources and current eligible Nexus publications. Production read-only diagnosis found correctly captured extensions and actually empty committed Discipline slots; there is no invented Discipline auto-equip.
- Ground Move validates paths, Jump, Root and allowance, includes movement in Skill cost and permits utility on empty Ground. Ground selected-subject Requirements remain enforced. Hostile misses retain the no-secondary-HP-healing contract.
- Enemy Blindside is a new immutable negative status with authored side/rear incoming Skill vulnerability, one-turn lifetime, ordinary Copy Debuffs eligibility and no outgoing/Basic boost. Legacy caster status remains intact.
- Percentage Barrier acts as temporary HP for direct damage, DoTs, Burn backlash, walking Poison and reflection, with shared forecast/commit consumption. HP costs still spend actual HP. Canonical Pierce now has a trusted shatter marker without enabling legacy Defense bypass; actual Aether Cut proves this distinction. Shared cards display a grey active Barrier layer and accessible amount, excluding pending grants.
- Backwards-compatible migration `20261018141646` carries global timing metadata without activating it or altering older rows. Prepared publication/rollback/readback SQL and a local binding script are under test; publication appends294 rows, expected historical total583/current294. Rollback retains all corrected history and restores previous current pointers plus a new legacy-authority policy; compatible application code must remain deployed for existing corrected captures.

## Observed verification

Repository typecheck passed all8 tasks and lint passed before the new enrollment/release-control additions. Full suite3 passed all core/database/other packages and5430 web tests, with3 failures in2 files (`current-manual.test.ts` and `battle-basic-action-projection.test.ts`) asserting superseded phrases. Those assertions were aligned to approved text/brackets; their focused rerun passed14 tests. Full gate must be rerun after latest changes.

Actual 294-entry parsing/presentation, complete Owner append/history validation and29 natural three-round-or-terminal PvP mirrors passed. The replay suite uses all17 pure builds and six selected mixed pairs in both Primary orders; it does not certify every pair, victory or balance acceptance. Actual Rewind/Chronist ongoing state, HP-cost/Barrier, canonical Pierce/Defense and delayed Copy Debuffs interactions pass. Barrier indirect-damage regressions and related kernels passed80 tests. Timing migration/Owner CAS tests pass4, publication source capture/current-reader tests pass5, and shared Primed command/card parity passes37. Counts overlap; do not sum them as a suite total.

New activation regressions were observed failing for all three real entry points under legacy timing, then passed42 combined service tests after the policy gate. Release control tests are still running; do not claim publication/rollback acceptance yet. Latest read-only Production inventory remains policy7,289 history/current rows, zero drafts, catalogue token `9e08000640ce5867db3ea7c1895217bc` (must refresh before release).

Temporary logs are in `/tmp/aurevane-followup-680b26e4eb86/`, prefixed `modular-`. Local browser acceptance remains pending after an earlier truncated Chromium download. Hosted/human acceptance is unverified.

## Outstanding before the single live drop

1. Complete transaction/rollback/drift/Owner-denial controls and exact-current readback checks; preserve all unrelated Master modes. Finish actual rendered Ground destination, Primed clearing and grey Barrier desktop/mobile acceptance.
2. Run format, lint, typecheck, complete tests/build, native/browser CI and one final whole-branch review. Refresh main and reconcile any changes. Preserve the Git automatic deployment lock.
3. Push the reviewed correction, pass exact-head gates, stage its compatible application, then activate294 corrections and global policy together and verify canonical Production/source, all publications/history and migration bodies/ACLs. No partial correction activation.
4. Only after live verification, resume the paused broader Master branch. Its earlier source-upload approval rejection is separate and is not bypassed by this release authorization.

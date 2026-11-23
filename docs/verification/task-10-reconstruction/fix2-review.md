# Task 10 Stage A — fix round 2 review

## Verdict

- **Spec: PASS for the scoped repair.**
- **Code quality: APPROVED for the scoped repair.**
- **R1: ADDRESSED. R2: ADDRESSED.** The original I1 is now addressed by the cumulative repairs, under the controller's ruling that Effect Profiles remain opaque, read-only, and unsupported by runtime.
- **No new Critical or Important findings within this diff.**

This is a repair gate, not full Task 10, UI, deployment, or human acceptance. M1 and M2 remain explicitly deferred; this review does not claim they were fixed.

## Reviewed scope and method

Reviewed BASE `63cfed33282925cf869955fd724da328c127fd14` through HEAD `3719ddf484167acf2f74cffe049fbb97bb42262e`, tree `34366edb569f28a02fc2f5095c1e78f1d7fe7ffd`. The complete supplied `review-63cfed3328..3719ddf484.diff` is 48,276 bytes. The range includes the preceding documentation-only build-evidence update; product changes are limited to the opaque retention helper, exact Status restore precheck, and two focused test files.

Applied the SDD combined task-review method against the original Stage A brief, the binding R1/R2 findings in `fix1-review.md`, the controller's compatibility ruling, and the appended implementation report. Read the supplied package in bounded chunks. Focused unchanged-source inspection was limited to the existing exact-version RPC and its parser, to establish whether the new precheck uses a real, compatible service-only interface. No helpers, product mutations, hosted operations, or passing-suite reruns were used.

## R1 — legacy opaque Effect Profile preservation

**ADDRESSED.** In `apps/web/src/server/combat/combat-standalone-content.ts:94–109`, `retainOpaqueEffectProfile` checks that the retained body is an object and that the authoritative record envelope is valid. It no longer treats incidental body `id` or `contentVersion` fields as identity or publication authority. It returns a structured clone without rewriting those fields.

This matches the predecessor producer contract established in the round 1 review: historical Effect Profile publication accepted object bodies, including bodies without an `id`. The formerly stricter complete-record parser was not a retroactive constraint on those producers. Absent or contradictory incidental body fields therefore remain readable without poisoning unrelated current-catalogue parsing or saved Skill publication.

The existing explicit authoring blocker and `runtimeSupported: false` treatment remain in place. The repair does not claim semantic validation of opaque bodies, enable new Effect Profile creation/save/duplicate/restore/publication, or invent profile mechanics. The focused preservation tests exercise absent-id, contradictory-id/version, and empty-object bodies through the actual snapshot parser, compiler, complete-record read, exact history, and unrelated Skill publication. They also retain the mutation blockers and compare preserved bodies.

## R2 — unsupported historical Status restore

**ADDRESSED.** In `apps/web/src/server/master/supabase-combat-content-authoring-store.ts:362–402`, Status restore reads the exact requested immutable source before the write RPC. It checks the returned envelope's key, kind, and requested version, applies the existing Status semantic validator, and checks body identity/publication version where present. An unsupported historical body yields an actionable `INVALID_REQUEST` before mutation; a mismatched returned envelope fails closed.

The actual existing interface in `supabase/migrations/20260917214500_combat_content_resolver.sql:41–82` accepts precisely the key/kind/version arguments used here, selects that exact immutable version, and is executable by `service_role`, with public/anonymous/authenticated execution revoked. This is not a mock-only API assumption. The existing `parseSingleVersion` boundary is compatible with its row shape.

At store lines 404–410, the write still receives the original command and actor. The precheck neither refreshes `expectedRevision` nor substitutes a new source body. The existing SQL CAS and selected-actor checks remain responsible for mutation-time authorization and concurrent-current-record changes. Thus checking an immutable historical source does not authorize a stale current-record overwrite.

The focused tests cover unsupported version 1 outside the displayed three-entry history, zero write calls and unchanged state on rejection, exact retained history readability, and a subsequent legitimate save. They also cover a supported restore, exact read before write, original CAS/actor arguments, a concurrent edit producing 409, missing source, wrong returned key/kind/version, and invalid body identity/version. These are application/store tests with stateful mocks; they are not new native concurrency proof.

## Verification evidence and limits

Inspected the appended report and retained evidence. All ten new `i2-*` raw-log SHA-256 values match the ledger. The initial RED output includes fixture failures; the corrected behavioral RED is separately retained and shows six failing cases. Green evidence includes the focused 45-test/two-file run and final **118 tests across seven files**, plus successful Web types, scoped lint, and formatting checks. No passing suites were repeated during review. The integrity evidence preserves the earlier 114 ledger rows rather than relabeling them as new runs.

The exact `63cf` worker/Web affected build passed separately (two executed tasks, zero cache hits, 66 Web pages). It predates this repair and is not represented as a build of `3719`. No new broad suite or build was run for this round.

The predecessor `65f73b`/`dede`-equivalent native PostgreSQL gate passed the actual migrations and physical schedules described in the original review. This repair changes no migrations, native schedules, authority definitions, mechanics, or CI. That earlier native evidence is not a new native execution of this revision. The predecessor full quality workflow was cancelled during the Web build after its earlier test/type/lint steps; it must not be called wholly green. The recorded legacy-editor browser failures remain at the declared Stage D boundary, and later UI/native/human acceptance is separate.

The controller can close R1/R2 and the original I1 on this scoped source review. Final Stage A disposition, source publication, native evidence decisions, and release of later stages remain with the controller.

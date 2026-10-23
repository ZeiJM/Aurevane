# Task 10 Stage A — fix round 1 scoped combined review

FIX_BASE `dedea81e2e46a4ca31fe31572351f3de24f53b7a` → HEAD `63cfed33282925cf869955fd724da328c127fd14`, tree `d7b26baa0e8f92b241d72b583c23b79940f99f08`. Reviewed the supplied complete `review-dedea81e2e..63cfed3328.diff`, original Stage A brief, I1, and appended repair report. Later `2c0af0aa` changes only the report/ledger with affected-build evidence; it is not an additional product review range.

**I1: NOT ADDRESSED in full. Spec: ISSUES. Quality: NEEDS FIXES.** The principal arbitrary-JSON create/save/publication path is repaired, but two Important in-scope preservation/restore failures remain. No Critical finding. M1/M2 remain controller-deferred and were not reopened.

## R1 — Important: legitimate opaque legacy profiles without body IDs poison the current catalogue

**Fix locations:** `apps/web/src/server/combat/combat-standalone-content.ts:94–110`, especially102–103; `apps/web/src/server/combat/combat-content-resolver.ts:286–287` and the Effect Profile branch around656–668. The same helper is used by complete-record parsing.

The repair correctly blocks new Effect Profile create/save/duplicate/restore/publication and labels retained profiles as unsupported/read-only. However, `retainOpaqueEffectProfile` requires `definition.id === contentKey` and a nonempty body ID even for retained opaque bytes. Raw current snapshot parsing invokes it for every Effect Profile. A valid legacy row such as `content_key='owner.profile', content_version=1, definition={"values":[4],"contentVersion":1}` therefore makes the entire snapshot throw `PERSISTENCE_UNAVAILABLE`. This blocks unrelated current catalogue capture and saved Skill publication, rather than retaining that profile as non-executable data.

This is a concrete predecessor compatibility case. In unchanged migration `20260917220000_master_panel_combat_authoring.sql:263–271`, publication accepts an object and requires matching body ID only for `skill`. Migration `20261015095150_typed_combat_authoring_kinds.sql:32–49` adds matching IDs only for Essence and Resonance. Effect Profile had no body-ID requirement. The predecessor current snapshot/compiler accepted this opaque object. The earlier complete-record parser's stricter identity check does not establish that all prior current publications have body IDs; that parser was not the historical producer contract.

**Correction:** use the authoritative stored record envelope to retain historically allowed opaque profiles without inventing or normalizing body fields. Keep the explicit authoring/runtime blocker and all mutation denials. Add a no-body-ID legacy fixture through raw snapshot parsing, compatible catalogue compilation and unrelated saved publication, asserting byte-equivalent opaque preservation. Historical body fields must not become new runtime authority. If an actually contradictory supplied identity needs different handling, make that distinction explicit; absence was previously allowed and must not take down unrelated content.

## R2 — Important: restoring an older unsupported Status mutates before validation and leaves an uneditable draft

**Fix locations:** `apps/web/src/server/master/supabase-combat-content-authoring-store.ts:350–369`, especially360–361; `apps/web/src/server/master/combat-content-record.ts:62–64,70–82`.

For restore, `writeRecord` reloads the current complete record but validates only a Status **save** body. It never loads and validates the requested `sourceVersion`. The complete record includes only the newest three history entries, so an older retained unsupported snapshot can be absent from this precheck. SQL restore still copies the requested physical snapshot into a draft after identity validation; there is no Status semantic SQL validator, by the accepted server/SQL division.

Example: current Status and versions4/3/2 are supported; retained version1 has an unsupported old shape (the focused probe used `maximumStacks:0`). Restoring version1 reaches `write_combat_content_record_v1`. The RPC commits its restored draft and returns it; only then the new complete-record parser rejects it. The client sees `PERSISTENCE_UNAVAILABLE` despite a successful mutation. A subsequent valid save also fails during `readRecord`, before its repair write, because the persisted draft is now rejected. This violates strict saved drafts and failure-before-mutation, and introduces a post-commit failure state in the repair.

**Correction:** for Status restoration, read the exact immutable requested snapshot and validate its supported authoring semantics before invoking the mutation RPC, while leaving its original bytes/history readable. Reject unsupported old forms with an actionable error and zero writes. Preserve the existing expected-revision/CAS checks and validate a supported restore successfully; do not rewrite or delete old snapshots. Add an oldest-version-outside-the-three-entry-window regression that verifies unchanged draft/revision/pointer state and that a valid subsequent edit remains possible.

## Verification and positive repair findings

- Finite Status fields now reuse the actual current `CombatStatusDefinition`/`NamedCombatStatus` contract and `validateCombatStatusDefinition`. Unknown nested fields are checked. Create/save, returned records and raw/prospective catalogue paths invoke that validation. Runtime `version` remains separate from publication `contentVersion`.
- Unsupported Effect Profile mutations are blocked in both command/store paths before their mutation RPC; retained entries carry derived blockers, with `runtimeSupported:false` on catalogue entries. No Effect Profile mechanics were invented. R1 qualifies the retention guarantee.
- No migration, authority/ACL, admission-lock, retirement-signature, released-mechanics, Players hash/version or deployment-lock source change is present in this repair.
- I checked retained raw-log SHA256 values for every appended `i1-*` ledger entry. RED7/6 and RED8/23 summaries match, as do covering114/8files, final52/2files, and final blocker3/36filtered skips. Scoped type/lint/format evidence matches; the initially failing unused-parameter lint remains retained and has a green correction.
- Inspected the subsequently appended `i1-worker-web-build.log`: SHA256 `fb0da009bb1e2f20e079c39874a8387e832aa1c1797368f2efeab37f0826992e`, two successful executed tasks, zero cache hits,39.51s. This closes the reported affected-build gap on the reviewed product source; it does not relabel the predecessor cancelled native job as successful.

No passing suite was repeated. To resolve the two concrete concerns, I ran one read-only, in-memory Node probe loading the actual repaired TypeScript modules through the installed TypeScript compiler, with only infrastructure/RPC dependencies substituted. It wrote no file or database. Actual observed output:

```text
old Status restore: PERSISTENCE_UNAVAILABLE write calls 1 persisted draft maximumStacks 0
repair save: PERSISTENCE_UNAVAILABLE total write calls 1
legacy no-id current profile: PERSISTENCE_UNAVAILABLE The current combat catalogue is invalid.
```

The Status RPC mock models the existing SQL restore's committed returned state; this is a store/control-flow reproduction, not a claim of a new native database test. Its input had supported current/three visible history versions and an older unsupported requested snapshot. The unchanged SQL copy/identity behavior and PostgREST response-before-server-parsing establish the corresponding transaction boundary. The legacy-profile probe invokes the actual raw snapshot parser with the historically allowed envelope. Focused unchanged-source inspection was limited to those predecessor contracts and the actual Status validator/types needed to evaluate the fix.

## Gate limits

The prior source-equivalent65f native PostgreSQL/LZ4/Staff41 and physical admission schedules remain valid predecessor evidence for unchanged SQL, subject to deferred M1. The predecessor native quality job's12055 Vitest +7Node/types/lint followed by cancellation during Web build is not a green full CI run; the new affected local build is separate evidence. M2 remains deferred by controller ruling. No finished editor, browser/physical zoom, hosted/human acceptance, Stage B/C/D completion or whole Task10 acceptance is implied.

**Next action:** one scoped repair for R1/R2, then the same reviewer's scoped re-review. Preserve the exact legacy payloads, the explicit unsupported capability markers, current Status semantics and all existing CAS/authority boundaries.

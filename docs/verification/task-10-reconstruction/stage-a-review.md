# Task 10 Stage A — independent combined spec and quality review

Reviewed source: BASE `b83de822171d8f62726bd8b7a668a82d5d39b523` → HEAD `dedea81e2e46a4ca31fe31572351f3de24f53b7a`, tree `fea5fb0c3c06c195ce37fbcbcc8a9a099470dd11`. Review package: `.superpowers/sdd/2026-10-10-unified-engine-recovery/review-b83de82217..dedea81e2e.diff` (42 files, eight additive migrations). This is the complete Content range, not HEAD~1; accepted Staff/Players/current-main source is outside the reviewed change.

**Spec verdict: ISSUES — Stage A is not ready for source acceptance. Quality verdict: NEEDS FIXES.** One Important source issue, two Minor issues, no Critical finding. The native and later-stage limitations below remain separate gates even after the source issue is repaired. This does not approve deployment, the existing editor, whole Task10, or the Master overhaul.

## Findings

### I1 — Important: Status and Effect Profile authoring bypasses semantic validation

**Changed locations:** `apps/web/src/server/master/combat-content-record-command.ts:51–62`, `apps/web/src/server/master/supabase-combat-content-authoring-store.ts:350–394`, `apps/web/src/server/master/combat-content-record.ts:54–61`. Package locations are approximately lines 1531–1542 and 2220–2269. Relevant new SQL is `supabase/migrations/20261020200612_combat_content_complete_records.sql:121–137,225–230`; the later validator only adds semantic checks for noncombat kinds.

The new `record` command accepts all ten recognized kinds, but its validator only invokes a combat validator for Skill, Essence and Resonance. For `status` and `effect-profile`, `result` is null and a valid `id` is enough. For example, an authorized `create` command with either kind and `definition: {"arbitrary":{"execute":"unsupported"}}` receives a server-derived `id` and reaches `writeRecord`; there is no required typed body, version or supported-field validation. A subsequent saved publication also has no semantic guard for these two kinds.

I inspected the unchanged publication compiler specifically to determine whether it closes this newly exposed path. It does not: `combat-content-resolver.ts:627–634` clones both definitions directly, and `combat-catalogue-timing-compatibility.ts:24` skips both categories. SQL checks identity/size and assigns the publication contentVersion. The returned complete-record parser likewise checks only their identity. Consequently arbitrary recognized-kind data can become a current immutable publication through the real authenticated server workflow. This is a new reachable command surface; the previous HTTP authoring surface admitted only Skill/Essence/Resonance.

This violates the Stage A requirement for strict saved drafts and malformed recognized kinds to fail closed. It is not a claim that arbitrary JSON executes code or that these categories already have a functioning gameplay adapter. The problem is accepting and publishing unsupported content as validated complete records. The five-kind SQL test at `packages/db/src/combat-content-record-lifecycle.test.ts:961–997` only proves opaque payload preservation; its shared mock body is not a legitimate Status or Effect Profile definition and does not cover this boundary.

**Required correction:** define/reuse the actual supported finite schemas for these two stored kinds at create/save, returned-record and prospective-catalogue boundaries, while retaining legitimate stored forms and exact history. If a particular authoring/runtime form is unsupported, return a specific blocker instead of successful publication. Do not remove these legitimate stored kinds or reinterpret historical rows. Add focused actual command/store/catalogue regressions for valid retained forms and malformed definitions, including the above path. The SQL/server semantic split is acceptable only when the trusted server actually validates every admitted kind.

### M1 — Minor: the claimed whole-state rollback snapshot omits physical publication rows

**Changed location:** `.github/scripts/verify-combat-catalogue-concurrency.sh:29–47` (package lines 63–84); reused by `packages/db/src/combat-content-record-lifecycle.test.ts` for late-failure comparisons.

The snapshot includes current definitions through the catalogue, but never serializes `app_private.combat_content_publications`. The catalogue selects `to_jsonb(v)`, not `to_jsonb(p)`, so publication `updated_by`/`updated_at` and the exact physical pointer row are not checked. Those fields are changed by the new publisher at migration `20261020200612:236–238`. A metadata-only pointer mutation would escape the asserted equality. This is an evidence-coverage gap, not an observed rollback defect.

Include deterministic physical publication rows in the snapshot before describing it as exact whole-state coverage. Keep the existing catalogue/token check as well. No passing suite was rerun to identify this omission.

### M2 — Minor: the specified shared category descriptor is still missing

**Changed locations:** `combat-content-record-command.ts:42–62,112–131`; `combat-content-record.ts:11–13`; `packages/game-core/src/content/authored-content.ts:5–57,101–112,194–209`.

Discovery Stage A item 1 explicitly calls for a category descriptor registry for identity, validator, applicable fields, defaults and capabilities. The implementation has multiple independent kind lists/switches and a separate blocker switch, with no shared descriptor. The Status/Effect Profile fallthrough illustrates the maintenance risk. This is not a request to implement the held editor/previews in Stage A. Consolidate the currently supported backend identity/validator/capability contract, or have the controller explicitly carry the remaining descriptor work into a named later Task10 stage. Do not mark that discovery requirement fulfilled by the existing arrays.

## Spec coverage and positive findings

| Requirement | Source/evidence assessment |
| --- | --- |
| Complete record identity, lifecycle, revisions, bounded list/read | PASS for the structural spine. Stable server-derived create IDs, distinct draft/active/archived state, 1–100 list bound, three displayed history entries, 100 Used-by entries with truncation, and 256 links are present. Semantic completeness has I1. |
| Saved-only publication and CAS | PASS by source inspection and retained local evidence. Server reloads the exact saved revision and sends no definition; SQL checks draft and current base under the catalogue lock. Catalogue token includes record lifecycle/revisions plus complete current publications and actual timing policy. Draft sequence/revision prevent archive/restore ABA. |
| Atomicity and physical history | PASS for implementation structure. Publication appends above max physical history, record floor and trusted builtin floor. Old immutable rows are retained. Forced-failure and legacy rollback fixtures cover key paths, subject to M1's exact-snapshot limitation. |
| Restore intent and attribution | PASS. Fresh `restore_pending` is separate from historical restored-from attribution; archive/publication reset intent. Restore remains draft-only until append. Original author metadata, restorer/source and publisher are separate; unknown legacy attribution is not invented. Self-reference is allowed only for fresh restoration, and unrelated archived targets remain denied. |
| Selected actor and live capability | PASS for source/local evidence. All four new protected operations assert the real selected-character operator capability; the wrapper replaces browser-supplied selection. Current native Staff fixture is executed in the real-chain PGlite suite, and actual authenticated invocation denial is included. |
| Actor/retirement/private ACL inventories | PASS for source/local evidence: original33 + Players4 + Content4 = 41; all14 legacy mutation signatures retain their authority assertion before the specific retirement error; all15 new private helpers and private tables deny direct service/browser access. Existing private floor helpers remain private. |
| Current tombstones versus exact history | PASS. Single/batch current reads and captured-current resolution reject archived identities; catalogue projection filters builtin resurrection. Exact old history remains readable. |
| Builtin first edit/duplicate and current Owner priority | PASS for inspected source and retained manifest test evidence. Metadata-only import covers294 identities (141 Skills including five Basics,17 Essences,136 Resonances), preserves existing lifecycle/current/history and takes max floor. Hydration uses existing executable definitions only for nonarchived baselines without a current publication. Basics retain stored kind `skill`; duplication/archive are specifically blocked. |
| Dependencies and archive cleanup | PASS for implemented Stage A relations. Indexed draft/version reverse references distinguish live blockers from retained history, and archive queries the full blocker relation rather than the displayed100 entries. Actual phase4/earned/equipped/saved references and153 implicit builtin E/R selections are included. Archived relationship removal is supported; adding an archived endpoint is denied. |
| Admission locking and caller outcomes | PASS by source and the subsequently supplied native schedule transcript. All four actual tables have shared nonblocking advisory admission triggers, and archive owns the exclusive catalogue lock without acquiring character/build locks. Named retry/archive errors reach real character/build/loadout/mastery/testkit/Players domain paths. No earned predicate, trial formula, sourceHash/buildVersion authority or unrelated XP logic was rewritten. |
| Physical schedules | Both archive orderings, immediate named40001 with prior player mutation rollback, independent shared admissions, timing/content CAS and holder rollback are present and now have actual native PASS output. I checked the actual unchanged earned-Skill RPC specifically for possible same-character row-lock interference; it does not take a conflicting character row lock, so that suspected script issue is cleared. M1 still limits the whole-state assertion. |
| Future definitions and compatible projection | PASS for finite server-side Item/Ascension/Severence and Discipline/Tag draft shapes, reuse of existing Ability/Requirement semantics, specific unsupported-publication explanations, and strict noncombat snapshot validation before combat-only projection. SQL bounds envelopes/Requirements; it is intentionally not a second complete Ability compiler. No future inventory/equipment/transformation runtime is promised. I1 is the exception for the other recognized kinds. |
| Released mechanics and Players preservation | No source change to released combat formulas, simple Requirements, Blindside, current Owner mechanic definitions, ordinary exact snapshots, or private Players sourceHash + buildVersion authority appears in this range. Players changes are narrow error mapping. No deployment-lock change appears. |

## Evidence checked without repeating passing tests

I read the supplied full range in bounded sections, inspected the manifest data, and checked the exact retained ledger/log evidence. All97 ledger records were checked against their available raw files. The only raw-file mismatch was the known truncated final Web log; its separately retained recovery now matches the original frozen SHA256 exactly.

| Retained result | Verification |
| --- | --- |
| DB245 /26 files | `stage-a-db-covering-gate.log` hash and summary match. Includes35 lifecycle cases. |
| Web231 /13 files | `stage-a-web-covering-gate.log` hash and summary match; predates final list guard. |
| Core19 /1 file | `finite-drafts-core.log` hash and summary match. |
| Final Web23 /3 files | Inspected decompressed `freeze-dedea81e/bounded-list-kind-green-confirmed.recovered.log.gz`:4218bytes, SHA256 `6d40f27d92c29d9cf3df7e8148f400a89ecd7684bace17ef8f3e26c370f93385`. Includes the bounded-list case, command group and23-test summary. Recovery provenance is `freeze-dedea81e/evidence-recovery.json`; original truncated3378byte prefix is preserved. Exact frozen-ledger hash closes the count-evidence issue. Cause/actor of later truncation is unproven. |
| ACL3 /47 filtered skips | `stage-a-helper-acl.log` hash and summary match. These are three executed cases, not50 passes. |
| Scoped types/lint/format/shell | Ledger exits and retained hashes checked. No native execution is inferred from shell syntax or empty successful lint output. |
| Behavioral RED | Actual isolated restore/unlink RED has two failures; bounded-list RED has one failure. The empty first RED and empty first final-green logs establish no behavioral result and are correctly disclaimed. |

No test suite or native schedule was rerun for this review. Focused unchanged-source inspections were limited to concrete concerns: whether the new Status/Effect Profile path has a downstream semantic validator; whether the independent admission schedule conflicts on a character lock; existing Requirement grammar correspondence; and whether publication metadata is present in the rollback snapshot. No product mutation, commit, push, hosted access or deployment was performed.

**Native evidence received before finalization:** root supplied `native-stage-a-dede-database-success.log` for CI39500389334 / Database118896090121, remote `65f73b` reported source-equivalent to reviewed dede. I inspected the actual final schedule output:21:30:44–21:30:48UTC contains successful content-versus-timing, timing-versus-content, history-versus-content, holder rollback, admission-before-archive, archive-before-admission immediate, and independent shared immediate schedules. The final line explicitly records immediate40001 and player/content rollback. This is actual physical PostgreSQL evidence, not an inference from PGlite or shell syntax. The run uses the earned-Skill RPC; it does not establish four distinct native table-race schedules. Remote source equivalence and complete run identity are controller-owned attestations. M1 qualifies the transcript's phrase “complete persisted state.”

## Cannot verify here / controller-owned gates

- Native physical behavior for the supplied schedules now has the actual evidence described above. Root owns exact remote-tree reconciliation and the unchanged LZ4/full migration-run disposition; future fixes need their affected checks. M1 remains an exact-snapshot coverage limitation.
- Local retained tests establish the specific fixtures above, not final whole-workspace quality, build/browser acceptance or physical concurrency.
- The legacy editor intentionally still calls retired mutations. Stage A is not an independently deployable UI release. Stage D must migrate real New/Save/Publish/Restore/Archive workflows and provide mounted keyboard/responsive/physical zoom evidence.
- Stage B Discipline/Core/E/R/earned producers, Stage C reference/media/private presentation, and Stage D finished shared editor remain substantive held work. No complete Task10 acceptance follows from this producer review. Root must explicitly reconcile M2 with the next stage's contract.
- Future drafts have truthful publication blockers; they do not prove ownership, acquisition, equipment, transformation, authored Discipline admission or current Tag-presentation runtime. Exact existing gameplay/runtime preservation is assessed only within the changed source and retained focused evidence, not by live/human acceptance.
- The latest Players backend/native disposition must be refreshed by the controller before Stage B. A separately reported full native pass does not itself resolve the known N4 timing-reliability cost or certify unrelated UI/human acceptance.

**Gate recommendation:** repair I1 and obtain one scoped combined re-review. Record/resolve the two Minors explicitly. Retain the native, final quality and later-stage gates; do not publish this as a finished editor.

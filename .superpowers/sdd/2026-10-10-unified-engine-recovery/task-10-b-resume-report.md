# Task 10 Stage B — coherent source-review handoff, 2026-10-22

Status: B consumer integration and focused/native preparation gate completed locally; awaiting the coordinator's single combined whole-B source review. Physical native acceptance and browser execution are pending. C/D is held. No worker remote push, main merge, hosted write or deployment.

## Exact source lineage

- Isolated branch `agent/master-complete-20261022`, recovered exact `c6c54764a1216cd091fc22bc136143b63135ae16`.
- Current main `a31029c04c0ef7be9fd08092c6a70f6f086b48b6` and reviewed Next patch `b0911c35a873bf7adda4eca1f056adf7a9bc1e42` reconciled before consumer edits; composite `c4bc7649d5d709d3f04e917b193bc7c3571fa10e`, tree `65d6449b7d34063db33c85161eeaa0ff10f19c42`. Coordinator re-read main immediately before freeze and confirmed unchanged a310.
- Complete B review base remains original `c96880123b8e31f6d8dec3bbbac024a1ff75609e`; recovered exact equivalent `e2e076753ed87627bca00376d95aa3df2d201708`, tree `6c3a2926440c5827fb0f27f59d3bec2ee4c9a2fd`.
- Cumulative Task10 original `b83de822171d8f62726bd8b7a668a82d5d39b523`; recovered equivalent `43fb472df8fbfd346f99bbf76571adc35d2985f1`, tree `54c7d9fa06fcf9628625d8e4d0975c7d9d066412`. Original objects are absent; equivalents preserve their trees.
- Product consumer freeze `53a8398bec31b620d77844e206378d579dc796ed`, tree `445abcdf4deb63aa594d5f4b77d50bef42ad5e38`; coordinator verified exact remote backup `31a401fe3375ebf8c01426b0b83e17ab1450cb23`. Subsequent local changes only finish native/browser fixtures, their verification, inventory and this handoff. Final source-checkpoint identity is appended below after committing it.
- Review the entire B delta from e2e, with the independent current-main/Next reconciliation identified separately; never review only the last commit. Prior rulings, repair accounting and append-only evidence remain binding.

## Completed contracts and callers

| Contract | Actual implementation/callers |
| --- | --- |
| Explicit selected eligibility | Skill request schema/PUT, build service and repository, one UI row per intrinsic Skill with active-grant choice, named loadout references, Players correction. Duplicate/malformed/inactive/forged selections fail before writes. Learned version and intrinsic source remain separate. |
| Fresh admission | Existing Players sourceHash and numeric buildVersion remain authoritative. Committed v2 additionally pins catalogue generation, selected eligibility and SQL-derived earned facts under policy1. Fresh participant guard holds account/character/build, shared catalogue and selected-grant locks; stale/correction/publication changes reject atomically. Proofs stay private. |
| Trial/historical behavior | Actual claim classifies new-policy events using immutable selected earned eligibility and battle-pinned Primary, with once-only Skill credit and unchanged50XP/variety/receipt rules. Historical omitted-policy trial and exact captures retain prior semantics. |
| Published Core | Actual current/pinned SQL readers feed profile, previews, allocation and creation. Creation v4 accepts five personal bonuses plus expected profile; stale review leaves no character/receipt, successful replay survives later publication. Named activation uses v3. Same-identity refresh preserves personal points and cooldown. Core31, six positive bases,2–3 focus,60/40, four Skills, AP/resources and all existing formulas remain. |
| Public/Players facts | Current catalogue supplies Manual/Atlas, including Secondary-only definitions. Authored metadata and native actual prerequisite facts replace stale static authority; planned presentation remains. Players joins actual grants, rejects client earned fields and labels unearned access truthfully. Mastery exposes actual earned/unearned counts. |
| Builtin/readiness | Migration imports builtin index metadata without publication/history/grant writes. First-edit reader returns real native Core, stages, prerequisites and selected E/R; retained Atlas presentation completes the body. Server80/240 limits and complete publication-readiness validation share the category descriptor. Discipline capability is enabled after focused consumer integration; unsupported kinds remain explicit. Final editor/reference/media work belongs to C/D. |

New consumer migration: `supabase/migrations/20261022200753_discipline_consumer_admission.sql`. Earlier B migrations `20261020222401_published_discipline_producers.sql` and `20261020225734_discipline_skill_earned_provenance.sql` remain part of the full review. Production adapters require actual current/pinned policy and content; optional static fallbacks are confined to legacy isolated adapters. No second catalogue, learned authority or progression/Core formula.

Fresh reproducible SQL inventory: `docs/verification/task-10-reconstruction/inspect-stage-b-freeze.cjs` and `stage-b-freeze-inventory.json`:152 migrations,71 matched actual function definitions/signatures/SHA256s,205 matched columns. This is a bounded producer-name inventory, not a claim to enumerate the entire database. Native Staff SQL also executes actual41 actor contracts,30 private helpers,7 enabled BEFORE INSERT/UPDATE guards, private relation ACL/RLS and ordinary service-only reader/creation grants.

## Evidence and exact rerun boundaries

All executed argv/cwd/timestamps/exit codes/raw-log SHA256s are in the append-only `docs/verification/task-10-reconstruction/verification.jsonl`; every referenced raw log is committed. Earlier reports/logs remain unchanged. Detailed RED/GREEN and intermediate failed fixture/type attempts are appended to `report.md`; misleading older filenames containing green do not override their actual nonzero exit.

- Actual SQL consumer covering command: `corepack pnpm --filter @aurevane/db exec vitest run src/combat-content-discipline-producers.test.ts src/combat-content-record-lifecycle.test.ts src/master-players-recovery.test.ts` —134 passed across3 files before the additional native preparation regression. No product SQL changed after that run.
- Focused Web command: `corepack pnpm --filter @aurevane/web exec vitest run src/server/character/character-published-creation.test.ts src/server/character/combat-content-admission.test.ts src/server/master/players-service.test.ts src/server/master/combat-content-records.test.ts src/server/combat/combat-content-categories.test.ts src/components/character/discipline-library.test.tsx src/components/character/character-skill-build-reconciliation.test.tsx` —70 passed/7 files. Final catalogue-refetch UI follow-up —16 passed/3 files.
- Earlier actual service/transport/roster/route73, battle/transport45–46, authored text/readiness30 and precise publication-versus-admission boundary controls are retained with real RED/GREEN evidence. They are overlapping scoped checks; do not sum them as a unique full-suite count.
- Web bounded typecheck, DB/game-core/validation typechecks, actual package-scoped touched Web lint, native shell/Python syntax and source-only whitespace pass. PGlite executes the actual native Staff fixture and expanded rollback-state projection; it cannot prove physical waits.
- Added native preparation regression extracts the real `producer_b`/grant functions from the shell schedule and executes all7 prepared mutation statements against the complete migrated schema, asserting each named guarded table actually changes before savepoint rollback. It caught an ineffective allocation-reset fixture. Final fixture uses a real level point and `spend` through the existing RPC. The intermediate guessed mode failure is retained; final exact real producer/write check passes. No product guard or assertion was relaxed.
- `master-discipline-consumers.pw.ts` lists3 projects. It uses the real local Supabase producers and actual Nexus UI/PUT/refetch, explicit touch Equip action, a genuine empty starting loadout and immutable earned snapshots. Discovery/typechecking is preparation only, not browser execution.

## Coordinator native gate after source review

Use disposable local Supabase with the full unmodified migration chain, Docker, psql/jq, pinned Node/pnpm, normal local test Auth env and the built Next app. No hosted URL/credentials. Existing CI ordering supplies the sole disposable Owner through Staff verification; reuse it. Run the catalogue race script last because it intentionally retains immutable local fixture history until stack destruction.

| Native entry | Required predicates/outcomes |
| --- | --- |
| `verify-master-panel-staff-authority.sh` / `.sql` |41 actor contracts,30 private helpers,7 actual enabled guards, ACL/RLS and retired overloads. |
| `verify-combat-catalogue-concurrency.sh` | Actual learned/equipped/named/import/active/personal/grant producers in both lock orders. Observe granted shared/exclusive advisory modes and `pg_blocking_pids`/Lock wait; catalogue-first denies immediately with exact40001, producer-first blocks until rollback. Compare complete player/content/grant/personal/pointer/audit/idempotency state. Preserve existing same-target archive dependency and CAS races. |
| `verify-master-players-recovery.py` | Existing correction/recovery/trial races plus actual selected-grant earned upgrade against prepared admission: immediate retry/no orphan, old capture stale, fresh capture admits. Reverse real admission holds grant SHARE lock while real writer waits; admitted facts stay immutable. Completion keeps one50XP receipt. |
| Persistence/event/privacy/Pv1 native scripts | Actual committed v2 build snapshot is supplied through `current-character-test-snapshot.sh`, retaining existing independent assertions. |
| `verify-p4-mastery.sh` | Historical omitted-policy completed encounter is explicitly imported inside rollback with only fresh-admission trigger bypassed around that one fixture insert; retain legacy classification/receipt assertions. This is not new-admission proof and never weakens product source. |
| Full Chromium/native focused browser | Execute the new shared-eligibility case on desktop/laptop/mobile, plus existing build/Players/current combat flows and broad quality gates at the reviewed exact head. |

Outstanding: actual PostgreSQL physical races, full native/browser/quality gates, combined B reviewer acceptance and later C/D/T13 integration. StageA physical pointer snapshot carry-forward remains the recorded Task13 finding. This handoff does not claim a finished full Master Panel, final UI acceptance or live release.

Final complete source/fixture/evidence checkpoint: `1fbbd6db411476a5dc462248c9b1b7b774a44bc7`, tree `fb92531151b87048db25620e0e8cbaa6ae10f4c9`. This identity addendum is documentation only; the final review HEAD/tree is also reported directly to the coordinator. No product or test edits follow this checkpoint. Final fixture types/lint/syntax/discovery and formatting all pass after the typed state-projection fix; the failed intermediate type command remains in the ledger.

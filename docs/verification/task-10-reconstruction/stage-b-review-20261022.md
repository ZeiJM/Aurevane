Spec compliance: ❌ Issues found. Code quality: Needs fixes.

## Reviewed submission and scope

Reviewer: sole independent combined reviewer, no helpers. Requested frozen submission: `b80127af8aa46ecb19d23e94c63118149b5f328e`, tree `f133bc93805d16245739b2bb82bf22f187a2bc79`, complete B diff from `e2e076753ed87627bca00376d95aa3df2d201708`. The main production-source/SQL review and focused reproductions completed before a scratch-environment loss. Review then continued only through the remaining bounded hunks and line mapping on the coordinator-restored `24b797b551748dff54d2fb370c12d0e2c525fd67`, verified by the coordinator to have the identical frozen tree. The regenerated `review-e2e076753..24b797b55.diff` differs in commit-list metadata; reviewed net source is unchanged. No tracked file, index, HEAD or branch was changed by this reviewer.

The gate is Stage B under `stage-b-producer-contract.md`. Accepted A, later C references/media, later D finished editor/shell, and bounded Task13 physical pointer metadata are treated as staged context. The submitted joined earned-grant design is evaluated on its merits. No second combat/roster balance pass is requested.

## Reproduced findings

### Important I1 — New Discipline text bounds also reject retained Stage A drafts

Locations: `packages/game-core/src/content/authored-content.ts:180–181`; `apps/web/src/server/combat/combat-content-categories.ts:173–174`; `apps/web/src/server/master/combat-content-record.ts:49` and `:87`.

The Discipline name/description parser now limits text to 80/240 characters, where the prior parser accepted 120/4000. The category descriptor uses that same parser for both authoring input and retained bodies. Consequently a previously valid saved draft with an 81-character name or 241-character description cannot be loaded so the author can correct it; record parsing treats the body as unavailable persistence. Publication bounds are legitimate, but applying them indiscriminately to retained records breaks the preservation/readiness boundary required by `docs/verification/task-10-reconstruction/stage-b-producer-contract.md:7`. The predecessor actual SQL validator at `supabase/migrations/20261020201807_combat_content_typed_record_writes.sql:18` accepted those older limits, and its identity-validation injection at `:62` applied them to real record writes; this is not merely a formerly permissive client parser.

Focused reproduction invoked the actual `parseRetained` descriptor with a prior-shape Discipline containing `unlock:{kind:'unavailable'}`, valid Core 31 and two focus attributes. An 81-character name failed with `name: Enter bounded, trimmed text.`; a 241-character description failed with the corresponding description error. No database mutation or broad test run was performed.

Requested repair: preserve the former accepted text range for retained reads, while enforcing the new 80/240 envelope at the appropriate authoring/publication readiness boundary. Add regression controls for both legacy retained fields and new publication rejection.

### Important I2 — Actual producer blockers collapse into an unactionable generic error

Locations: `apps/web/src/server/master/supabase-combat-content-authoring-store.ts:199–222` and `:40`; `supabase/migrations/20261020222401_published_discipline_producers.sql:127`, `:138` and `:294`.

The authoring error map recognizes `DISCIPLINE_ESSENCE_INVALID` and `DISCIPLINE_RESONANCE_CONFLICT`, while the producer actually raises `DISCIPLINE_ESSENCE_UNAVAILABLE` and `DISCIPLINE_RESONANCE_SELECTION_CONFLICT`; `DISCIPLINE_CORE_BASE_MUST_BE_UNIQUE` is absent. SQLSTATE 22023 then becomes “The content request contains unsupported or invalid fields.” The canonical conflict helper supplies the conflicting pair in SQL `detail`, which the current transport also discards. These are real publication blockers that the Stage B author needs to resolve, particularly the canonical E/R pair and unique Core requirement. The accepted ruling explicitly requires an actionable conflict blocker and a named dependent side (`.superpowers/sdd/2026-10-10-unified-engine-recovery/progress.md:183`); the unique-Core requirement is preserved in the actual producer test (`packages/db/src/combat-content-discipline-producers.test.ts:294`).

Focused reproduction called the actual authoring store with authentic producer error names injected at the common RPC error mapper. Each of `DISCIPLINE_RESONANCE_SELECTION_CONFLICT`, `DISCIPLINE_ESSENCE_UNAVAILABLE`, and `DISCIPLINE_CORE_BASE_MUST_BE_UNIQUE` returned `INVALID_REQUEST` with the same generic unsupported/invalid-fields message. The archive branch was used only to reach the common mapper without constructing an unrelated publication; it is not claimed to emit those errors itself.

Requested repair: map the actual SQL names, retain sufficient structured pair/target information to make the blocker actionable, and cover the publication transport with those real producer failures.

### Important I3 — The production v3 Discipline mutation loses the admission retry contract

Locations: `apps/web/src/server/character/supabase-character-build-repository-v3.ts:33` and `:72–77`; production use at `apps/web/src/app/api/character/build/disciplines/route.ts:144`; new lock error and v3 patch target at `supabase/migrations/20261020222401_published_discipline_producers.sql:231` and `:239`.

The migration introduces `lock_current_discipline_selection_v1` into both v2 and v3 mutations. A competing catalogue transaction raises SQLSTATE 40001 `COMBAT_CONTENT_ADMISSION_RETRY`. The actual production route uses the v3 adapter, whose override does not call the shared admission-error mapper. Its final fallback turns that retryable contention into `PERSISTENCE_UNAVAILABLE`, rather than the named 409 retry contract. Newly added adapter coverage imports the base v2 repository (`apps/web/src/server/character/combat-content-admission.test.ts:15`) and therefore misses the production override. Named retry/archived outcomes are an explicit preservation requirement in `docs/verification/task-10-reconstruction/stage-b-producer-contract.md:13`.

Focused reproduction injected `{code:'40001',message:'COMBAT_CONTENT_ADMISSION_RETRY'}` into the actual v3 repository RPC and observed `PERSISTENCE_UNAVAILABLE / Character build data is unavailable right now.` The database remains atomic; this finding concerns the promised retry/error interface, not partial writes.

Requested repair: apply the shared admission mapping in the production v3 mutation and cover its real route/adapter path for retry and invalid-current-selection responses.

### Minor M1 — Existing native Vite loader warning remains visible

`docs/verification/task-10-reconstruction/b-resume-b-consumer-final-focused.log:1–2` warns that the Vite native config loader does not support ESM syntax in the CommonJS-loaded `vitest.config.ts`. This is the existing Staff/Players warning, also recorded in `docs/verification/master-deferred-findings.md:8` and `:10`. Carry it forward without suppression or a zero-warning claim. It is nonblocking for this B source gate.

## Strengths observed

- The published Discipline producer validates complete envelopes, projects immutable current profiles, preserves exact historical selections, uses shared catalogue locking, blocks referenced target changes, and retains service-only helper ACLs.
- The earned grant table is joined to the actual learned version, keeping grant source, testing entitlement, and selected eligibility distinct. Selection resolution rejects ambiguity and malformed provenance instead of inventing fallback authority.
- Fresh admission compares the actual source hash, numeric build version, exact Primary/Secondary pins and selected grant facts under coordinated account/catalogue/build/grant guards. Trial classification uses immutable battle-start facts and does not double-credit multiple qualifying grants.
- Creation uses current published Core under the same guard, validates five personal choices, checks stale expected profiles before writes, and checks the idempotency receipt before current pointers. Named loadout/pin handling preserves history and existing allocation clocks.
- The actual-chain database tests exercise migrations with bounded platform substitutions; native preparation includes producer races, real waiting predicates, rollback controls and ACL probes. The prepared browser scenarios use SQL fixtures and actual application routes.
- The shared descriptor registry centralizes category parsing/readiness rather than maintaining independent API and persistence registries. Public consumers retain the distinction between current bodies and pinned learned authority.

## Evidence and review boundaries

Read first: Task10 brief; then Stage B contract, requested reviewer template, implementer report, detailed historical report, staged deferred-findings context and relevant upstream reconciliation context. The complete product-source diff, all three new B SQL migrations, producer-chain database tests, changed unit/UI tests, native preparation and evidence/report hunks were reviewed in bounded passes. The remainder was completed after restoration without restarting accepted passes. Large independent upstream release JSON/embedded SQL payloads and hash inventories received structural/identity/version review; their existing combat balance was not independently regraded. The separately reviewed Next 16.4.1 lockfile changes were inspected as reconciled upstream context. No concrete B interaction defect was found in those imported changes.

Existing raw evidence was inspected for actual outcomes rather than inferred from filenames. Examples: the initial battle-eligibility “green” attempts still failed before the later 45-test success; the first Core “green” had a ReferenceError and the next still had 3 failures before 73 passed; admission/trial fixture failures were distinguished from product red tests; the final SQL log reports 134 passed across 3 files (`b-resume-b-consumer-final-sql.log:5–6`) and final focused web log 70 passed across 7 files (`b-resume-b-consumer-final-focused.log:8–9`). Some early lint invocations did not run the intended package and were followed by actual web lint evidence. The coordinator independently verified all 93 appended raw-log checksums and the unchanged 136674-byte original ledger prefix; this review does not substitute that integrity check for outcome inspection.

Only named concrete interface risks justified focused inspection outside the diff: (1) whether the v3 mutation's returned build remains compatible with the new Core parser—its refetch does, but its error mapping yields I3; (2) whether trials read pinned Primary identity—the original claim path loads immutable battle version 1, so no finding; (3) whether the producer error mapper exposes the new blockers—its cutoff fallback yielded I2; (4) whether the former SQL draft writer actually accepted longer text—the predecessor finite validator confirms the 120/4000 limits behind I1. These were bounded checks of the named interfaces, not a separate whole-repository review. No broad suites were rerun. Focused actual-module executions were limited to the concrete retained-read/error-transport doubts above and wrote no tracked files.

Cannot verify here: real PostgreSQL concurrent sessions/ACL acceptance, the prepared browser projects, and the final whole-quality acceptance run. These are explicitly pending coordinator execution after source review, not claimed complete by the implementer. Stage C/D deliverables and the recorded Task13 metadata carry-forward are not graded as missing B work.

## Assessment

There are no Critical findings established. The three Important findings require bounded compatibility/error-interface fixes; they do not justify replacing the joined earned-grant design or changing current combat/progression rules. The bounded source review is complete. Source acceptance is withheld pending those fixes. Physical acceptance remains a separate coordinator gate.

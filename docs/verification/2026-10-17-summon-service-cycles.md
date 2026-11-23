# Earned Summon persistence, AI and idle-clock service cycles — October 17

This Task15 continuation adds16 local service integration cases. It verifies saved casts/cleanup, replay/reload, child AI lifetime, paid-turn timeout exemption and fully idle parent penalties. Runtime, roster, shared helpers and prior fixtures are unchanged. It is not a new runtime bugfix or live release. Original battle/editor/native integration remains before combat release; broader Master/world work follows it.

Base083faeae23562f0dc91a9bb3a84de2ab5b62741f; frozen source0438def0312dda640fd91215344abcf0e8299721 on agent/overhaul-resume-20261017. Main began at29506e293e81abef1b0b8a46099618ab3ae3f0ae and advanced concurrently to3d6594f795708746af8f69025e1c8fd80b1bb83e through PR910. All five changed files were inspected: mobile World shell/workspace styles, compact online presence and a World UI test. They do not overlap the combat services/runtime/helpers/roster or deployment lock. The frozen test branch remains isolated; those changes are not merged here or claimed as jointly verified. Combined current-main release reconciliation stays open.

## Actual scope and outcomes

The unchanged legal-duel helper performs proposed local publication, earned save/load, exactly four selected Skills, current/pinned authority, capture and startup. Pure Wildwarden replaces Field Remedy with renewing-herbs v7 and faces pure Vanguard. Levels1/100 × PvE/PvP captured authority contexts use seed1 and the same6×4 open board. The actual returned buildAuthority is attached to the saved snapshot. Native zero-valued quality tracking metadata is initialized at admission; HP/MP/AP, RNG, statuses, placements and effects are not patched to force outcomes.

The child retains its source v7, owner/team and captured profile:36HP/12MP, five completed own turns and one authored45AP ability per turn. Parent price50AP/6MP and cooldown4 owner turns (five initial stored ticks) remain unchanged.

The actual battle-session submit/get service, child AI service, AI/PvP timeout services, native command/economy/turn logic and privacy-journal builders run. The external clock RPC and repository factories use an in-memory adapter with JSON copies, version comparison and replay storage. This does not execute hosted SQL, physical database CAS/locks/rollback, account authentication, route admission, a scheduler or elapsed wall time.

Both captured contexts deliberately use a two-character duel. Humanoid setup turns are manually completed through their respective fixture participants; only the companion acts autonomously. These cases therefore do not establish real PvE NPC/party creation, production player/opponent control routing or a complete PvP networking flow.

| Service cycle, four cases each | Actual result |
| --- | --- |
| Saved cast, replay, reload and expiry | Real player submit pays50AP/6MP and saves one v7 child. Repeating the same saved request returns version2/replayed:true without a second payment, child or commit. A distinct stale request rejects without mutation. A fresh service get returns the saved public projection without private kernel fields. Actual child AI actions plus humanoid face commands complete exactly five child turns; expiry removes combatant, placement, initiative, profile and turn-trigger authority while the battle stays active. |
| Paid turn timeout and stale clock | The server-clock fixture expires the parent after its paid cast. Native timeout commits once with hadActivity:true/consecutiveMisses0, advances only the parent turn and adds no Lowered Guard. The child instance/lifetime is unchanged. A subsequent stale expired clock is rechecked against the saved current turn and produces no new commit or state mutation. |
| Fully idle parent timeout | After actual manual turns reach the next owner turn, the deferred child has completed zero turns. With no successful owner command, timeout commits hadActivity:false/consecutiveMisses1 and queues Lowered Guard only on the parent for the following global round. The child instance/lifetime and living parent's HP are unchanged; no completion/win occurs. |
| Saved player Basic kill and replay | The opponent pays20AP for actual service movement into Basic range. Real player submit commands each pay30AP, allowing native misses, until the child is defeated. The lethal command saves the cleaned profile/trigger/state and defeat event together. Replaying that same command returns its saved public result without another payment or removal receipt. No expiry or victory is fabricated. |

The local adapter receives coherent snapshots/events/privacy journals from the real services. Each accepted snapshot JSON-validates, retains captured sources and exact build authority, and increments the saved version once. Assertions on replay/stale behavior use actual service results and resulting state rather than only mock call counts. The adapter does not prove its simulated transaction contract against a real database.

## Verification

The fresh existing service baseline passes72 cases/3 files (`104244379179Z-8f515a11`). Initial new12-case execution passes8 and fails4 because it assumed the deferred child had already completed a turn before the owner started the next round (`104335131273Z-9be3ed65`). Native order correctly leaves it at0. Correcting that fixture assumption and asserting actual pending Lowered Guard makes all12 pass (`104415926130Z-db908a1a`). Added saved-kill cases initially selected Basic from distance2 and correctly rejected out of range (`104506680003Z-0a819dd4`); a real paid move into distance1 fixes setup. Neither failure is claimed as a production defect or product RED. The corrected16 pass (`104540400893Z-7e89b4a7`); web types pass (`104540844107Z-3c803c57`).

Frozen-source trace execution passes all16 (`104631910140Z-61ddb038`). The16 unique records total7,597,480 bytes, SHA256a3cf4584a65aca8c2ff8327d8baa7c06fb4a634750e4fe003d75172985e1a675. Independent audit verifies every cohort, initial/saved versions, exact parent payment/stored cooldown/profile/source, one spawn, coherent capture/build preservation, actual five child turn handoffs, lethal HP0/removal, activity-specific timeout receipts, parent-only next-round pending penalty, unchanged child instance and living active battle. These are initial/final snapshots and committed receipts, not a standalone replay engine or wall-clock proof.

Initial full gate104631910737Z-4527993c passes all9,062 Vitest tests,7 Node checks, formatting, lint and all8 typechecks, then exits1 during the web build. Next/Turbopack cannot open its persisted cache: “Loading persistence directory failed” / “invalid digit found in string.” Raw failure and hashed package logs are preserved. Inspection finds two incomplete temporary SST files alongside valid numeric persistence records. The minimal experiment reversibly quarantines only those two files, preserves their sizes/hashes plus CURRENT/LOG metadata, and keeps valid cache, product source, configuration and dependencies unchanged. The unchanged-source retry70c0645f exits0 with both builds; isolating only those temporary files is sufficient to restore the build. No application/runtime fix is claimed.

Exact-source full quality passes **9,062 Vitest plus7 Node checks**, formatting, lint, all eight package typechecks and both builds. Source remains0438def03. Successful gate105111302587Z-70c0645f exits0 with all seven root test counts (4137core/4679web/246other), Node7/0fail and the explicit build command; its saved stdout stops after Next routes before the final Turbo summary. Raw output and hashed package archive remain. ONE cached same-source replay105241490488Z-058a9610 also exits0, but its saved root stdout stops immediately after the formatting command. That incomplete log is preserved too; no third blind whole-gate replay is performed.

A dedicated cached root build105352135386Z-e48b1e7e exits0 and retains the literal two-success build summary and both package build commands. The final audit requires all seven counts/Node checks/build marker from70c0645f, both successful whole-gate receipts, the independent literal two-build receipt, hashed package logs and nonempty parseable Next build manifests. No single complete end-to-end stdout transcript is claimed. This is explicit aggregate evidence rather than silently treating a cut root log as complete. Existing Vite/DOM advisories remain visible; telemetry is disabled as before. Node24.19.0/pnpm11.25.0 fallback remain unchanged.

Preservation uses exact source diff and hashes: before this report only the new service test differs from base. All runtime, catalogue, helpers and prior fixtures are identical. Proposed manifest SHA256b86cfec056bbac582810e7da80f9bc687f02518892eb5d11275fc7b5ced19f05 and all six protected AI/helper/native-display hashes match. Do not repeat separate unchanged141 preview/284 Manual/294 reader/289 mirror diagnostics: the previous verified Summon checkpoint retains the bounded289 execution. This pass expands service evidence, not balance or complete native UI acceptance.

## Review and rulings

ONE fresh combined gpt-6-astra High review reports0Critical/0Important/1newMinor on frozen0438def03. Parent accepts the grade: the local replay adapter does not model same-key/different-fingerprint conflict and can treat it as a miss/overwrite; production instead raises IDEMPOTENCY_CONFLICT. None of these16 cases exercises conflicting reuse. Defer this test-helper enhancement as M20, keep identical-request replay/distinct-key stale acceptance precise, and retain19 inherited Minors separately. Cost: the helper cannot establish conflicting-key behavior and could mislead a future test if reused without enhancement. No C/I repair, incidental Minor fix or rereview. The reviewer inspected the full513-line addition and actual consumers, ran diff hygiene and did not duplicate suites.

1. Ruling: exercise real service orchestration with simulated external transport. Reason: native command success alone does not prove that caller saves/returns the correct state. Cost if wrong: hosted SQL/transaction/security behavior remains unverified.
2. Ruling: initialize only native quality tracking metadata at fixture admission. Reason: timeout primitives require those creation-time counters; combat resources/outcomes remain native. Cost if wrong: this is not a fresh production encounter creation test.
3. Ruling: retain two-character legal authority contexts and deliberately complete humanoid setup turns. Reason: this isolates child service lifetime and timeout behavior without forced damage or battle completion. Cost if wrong: real PvE NPC/control/party and network PvP acceptance remains open.
4. Ruling: correct fixture ordering and range assumptions without rewriting correct runtime or inventing product RED. Reason: actual deferred turn order and Basic reach are authoritative. Cost if wrong: this checkpoint is evidence expansion only.
5. Ruling: preserve19 inherited Minors; do not incidentally edit their fixtures/readers. Reason: approved review scope defers them. Cost if wrong: the known lower-severity gaps listed in the prior earned-Rewind report remain.

6. Ruling: use explicit aggregate green gate/build/package/artifact evidence after both successful root stdout captures truncate. Reason: repeated whole gates do not repair this capture limitation. Cost if wrong: a single complete root transcript remains unavailable; all constituent commands and counts are independently checked.
7. Ruling: inspect the concurrent five-file World UI main advance without merging unrelated work into this frozen combat slice. Reason: no overlapping authority/runtime source changes. Cost if wrong: combined current-main/browser release acceptance remains required.

Each review disposition is explicitly adopted with its evidence limit:

| Behavior considered | Parent ruling and reason | Cost if wrong |
| --- | --- | --- |
| Earned four-Skill/content/level/context provenance | Accept actual local helper admission/capture only. | Progression awards or hosted publication can differ. |
| Fixture metadata/initial turn alignment | Accept zero tracking metadata and native alignment. | Production creation is untested. |
| PvE/PvP meaning | Accept captured contexts; deliberate humanoid faces isolate the child. | NPC/party/routing/autonomous humanoid/PvP control remain open. |
| Selected saved cast/cost | Accept this v7 cast; retain prior rejected-cast/cooldown evidence. | Broader cast conditions are not newly covered. |
| Replay/stale/reload | Accept identical-request replay and distinct-key stale only; reload uses a fresh object on local store. | Conflicting-key/process restart/database durability are unproved. |
| Commit-input coherence | Accept snapshots/events/journal/build authority passed together. | Physical rollback/SQL locking/hosted CAS/concurrent writers remain open. |
| Public privacy | Accept selected private-key projection/journal guards through real builders. | Recursive/all-viewer/route/auth privacy is not complete. |
| Child AI/lifetime | Accept exact five-turn native service cycle. | General AI profiles/seeds/strategy/balance can differ. |
| Once-authored-child-ability gate | Retain prior native rejection evidence; do not claim a new per-turn service count assertion. | A service orchestration regression could need its own count witness. |
| Paid timeout exemption | Accept selected paid cast/activity marker. | Move/miss/AP-restoration/history cases are not newly covered. |
| Stale expired clock | Accept state/version no-op and source-traced recheck. | Refresh RPC count and physical scheduler/time remain unproved. |
| Idle parent Lowered Guard | Accept saved next-round queue and unaffected child. | Later activation and complete-round expiry are not executed here. |
| Actual Basic defeat/positioning | Accept selected real player service and lethal replay. | Other damage/Automatic/terminal interactions need separate evidence. |
| Cleanup | Accept combatant/placement/initiative/profile/trigger removal. | Every collection and post-removal tile reuse are not reasserted here; prior native evidence remains. |
| False win/reward | Accept living nonterminal selected scenarios. | Terminal settlement/rewards remain open. |
| Fixture execution isolation | Accept sequential cases and bounded loops. | Concurrent conversion would require isolated adapters. |
| Production/RED claims | Accept tests-only current behavior evidence. | This pass does not fix a newly found runtime bug. |
| Remaining original release scope | Keep full combat/editor/native/othercycles/balance/Ownercurrentcontent/hostedCAS/Atlas/human/Task15/16 open. | Passing this slice cannot justify broad completion or release. |

Inherited19 Minors retain their individual prior deferrals, including the prior Rewind purity/cooldown witnesses; none is incidentally modified here. NewM20 is solely the conflicting-key behavior of this local test adapter.

## Remaining work and checkpoint

This closes the directed local saved-service/parent-timeout witness. Physical scheduler/SQL/CAS/security, actual battle entry/control routing, original Targeting/Move/five editable Basics/Controlled editor-to-battle-to-reader chains and native controller acceptance, other distinct earned cycles, natural full-match balance, current Owner content/history reconciliation, keyboard/touch/AT/mobile/zoom/Atlas and human acceptance remain open. Task15/16 and release are not finished. Broader Master/world/Environment and creative-library complexity labels remain after combat release. High remains sufficient.

Only this verification report follows frozen tested source. Save the source/evidence on the existing non-deploying backup branch with expected-parent protection, remote byte/hash checks and fresh incremental restoration. No hosted content write, publication/activation, migration, main merge or deployment.

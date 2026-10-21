# AUREVANE — Master panel continuation handover

Prepared for Nick on October 20, 2026 (Trinidad and Tobago). This is a transfer of an existing implementation, not a new design exercise. Nick is moving the work to another chat and deleting the old chat. Preserve this handover, its accompanying evidence and the published feature branches before resuming. Do not assume old agent identities or scratch paths survive.

## Paste this into the receiving chat

> Take over the wider AUREVANE Master panel overhaul from this handover package. Read `HANDOVER.md`, `FINAL_CHECKPOINT.json`, the approved Task10 brief/StageB contract and the progress ledger first. Reconcile with your existing task ownership before editing shared files. Preserve all completed/live work and original review/failure evidence. Resume the unfinished Game Content StageB integration from the exact backed-up checkpoint; do not restart Staff, Players, accepted Content StageA or the released roster. Continue the remaining Master work through the existing scoped review gates. Source checkpoint publication/native CI is authorized; merging feature work into remote main, hosted database changes and deployment remain held until the applicable final acceptance/release authorization. Do not ask me again whether to continue ordinary authorized implementation.

## 1. Scope and overlap boundary

This workstream owns the wider Master overhaul: Staff & Access; Players/support corrections/no-reward recovery; complete Game Content authoring and its real Discipline/Core/earned-Skill producers; contextual text references and immutable media; shared editor/navigation; Rules; Site Music; World Environment controls; Events & Live Ops; final integration and operational verification.

The active task is **Task10 StageB**, integrating published Discipline/Core/Essence/Resonance selection and actual per-Skill/per-Discipline earned eligibility into existing gameplay producers and consumers. StageA is accepted as a bounded backend foundation. StagesC/D and Tasks11–13 remain substantive work.

Do not absorb World movement/travel/networking, map/globe art/layout, geography, NPC conversations or an unrelated combat/roster rebalance. Preserve those independent changes from fresh main. **World Environment is the likely cross-chat overlap:** this mandate includes positive-whole-minute forced weather/expiry, real configurable day/night authority, regional weather labels and a compact time/phase/weather reader in the World right panel. Reconcile ownership with the receiving chat before either chat implements those same controls. No known agreement has transferred that scope away from this handover.

The live roster and combat correction work originally listed as Tasks14–16 is already released. Do not unlock a second creative/balance pass or republish Owner definitions as a new Master task. The remaining implementation sequence is Task10B → C → D → 11 → 12 → 13, subject to actual accepted producer interfaces.

## 2. User intent and release authority

- Blindside must never apply from head-on attacks; only eligible successful side/rear hits against that same enemy, from the actor's actual reached position, apply/refresh it. **This correction is already live.**
- Nick repeatedly authorized continuing the wider Master work and non-deploying feature source checkpoints/native CI. Ordinary reversible work should proceed without repeated permission questions.
- No permission is inferred to merge this unfinished Master feature into remote main, mutate the hosted database, publish catalogue changes or deploy it before the final gate/appropriate explicit release authorization.
- Merging **fresh main into the isolated feature** is authorized and required. This is different from merging the feature into main.
- Git auto deployments must remain locked. `apps/web/vercel.json` Git blob is `b8a4e0e3c57b95a8da49c05d1fe5f60ba2181b5f`; SHA256 is `31ac08447408c265666f3a0e92d0a7aff07582bc6f168af3a036e440763e6b9c`; `git.deploymentEnabled` is `{"**":false}`. Do not confuse a Git blob hash with SHA256.

## 3. Exact recovery anchors

Repository: **ZeiJM/Aurevane**, `https://github.com/ZeiJM/Aurevane`.

`FINAL_CHECKPOINT.json` in the package is the final authority for the active paused checkpoint and exact publication receipts. The table below gives the stable checkpoints before final handover packaging. Local and GitHub commit SHAs differ because source is published through GitHub blob/tree/commit APIs; **the complete Git trees are identical**, proven by fetch and zero diff. Do not cherry-pick equivalent local and remote copies together.

| Purpose                                          | Local commit                               | Exact GitHub commit / branch                                                                                                | Tree                                          |
| ------------------------------------------------ | ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| **Final paused active Content WIP**              | `1323b016d15e41c10c714565a3035a89ec299ffe` | `c6c54764a1216cd091fc22bc136143b63135ae16`, `agent/content-stage-b-20261020`                                                | `43d76f078d6a803a447f55cbfafef2373aafd665`    |
| Fresh main, last verified                        | `4793b77c607b98bc8a8ccf783da56d69f429f0fe` | `main`, same SHA                                                                                                            | Fetch before resuming; never reset newer main |
| Coordinating feature before handover             | `eb00a39d1176d5008605257c3131ef0677c04336` | `2b54465cdc80fb8e0c1d793485f49e9dc5007941`, `agent/master-panel-recovery-20261020`                                          | `9febbafdbaac183ae733522e60572b93d2dee3ac`    |
| Last published active Content merge before pause | `f7aefc9358035173c0fa0b2639e0e272aac64c5b` | `1d596b435cfd16f16fbfd03795984910a3a15755`, `agent/content-stage-b-20261020`                                                | `39ad8cbd1d45ba0c06d1bf134ce023850607bfb1`    |
| Application transport checkpoint                 | `0d1804d18c066b5c254d3e3e091993fa70aa5dcc` | `d62e944d72e03426f09836429682ad9215a98fad`                                                                                  | `6da7de88cb3d900232c91822ca6236c3d521465e`    |
| SQL selected eligibility/loadouts checkpoint     | `4d228ec375b55d2d5242a9136e8113439f5adc67` | `89aedef647d0dee778107aded45959edce155bbf`                                                                                  | `f7a094be2f7c0429aaaa71f73c691117023bab23`    |
| Accepted Content StageA                          | `3719ddf484167acf2f74cffe049fbb97bb42262e` | `9a84f49a175f3b8a62436067071a77400b2af698`, `agent/content-recovery-backup-20261020` and `agent/content-fix-stage-20261020` | `34366edb569f28a02fc2f5095c1e78f1d7fe7ffd`    |
| Players final reviewed source/native head        | `59b6372826df3805e22a9d383a9d4d0d4fb74f50` | `43ff3cad58b66dac5febfe52d69f11a9efdae251`, `agent/players-fix-stage-20261020`                                              | `0cd6429bcbdb51218b4be1773705db05f5257fb3`    |

Current scratch paths, if they still exist:

- Coordinator: `/workspace/scratch/081f137b6a6d/aurevane-recovery-20261020`, local branch `agent/master-recovery-20261020`.
- Sole active Content implementer: `/workspace/scratch/081f137b6a6d/aurevane-content-20261020`, local branch `agent/content-recovery-20261020`.
- Players: `/workspace/scratch/081f137b6a6d/aurevane-players-20261020`.

The coordinator intentionally contains accepted StageA plus fresh main and coordination/evidence. **Unreviewed StageB product changes have not been integrated into that coordinating feature.** Continue B in its dedicated branch.

Draft PRs: Staff **#945**, Players **#953**, accepted Content foundation **#955**. ContentB currently uses its isolated backup branch rather than a PR for every small checkpoint. PR955 stays at acceptedA9a; do not silently pretend it contains B. Earlier PR952 is historical; consult retained receipts rather than restarting it.

## 4. Read these authorities first

Use repository truth, not this narrative alone:

1. `AGENTS.md`, `docs/GAME_MASTER_PLAN.md`, `docs/MASTER_PANEL.md`, `docs/OWNER_OVERRIDE.md`.
2. `docs/ENGINEERING_EXECUTION_STANDARD.md` and `docs/CONCURRENT_AGENT_WORKFLOW.md`.
3. Approved plan `docs/superpowers/plans/2026-10-10-unified-engine-recovery.md`, its linked approved design/specs, and `.superpowers/sdd/2026-10-10-unified-engine-recovery/progress.md`.
4. Task10 brief/discovery/reconstruction contracts in that same plan workspace. `coordination/` in this package retains the workspace, including files that were not tracked.
5. `docs/verification/task-10-reconstruction/stage-b-producer-contract.md`, `backend-handoff.md`, `stage-b-producer-handoff.md`, `report.md`, `verification.jsonl`.
6. `docs/verification/task-9-reconstruction/backend-handoff.md`, `native-completion-status.md`, `native-completion-artifacts.json`.
7. `docs/verification/2026-10-20-master-acceptance-map.md`, `master-deferred-findings.md`, `2026-10-20-master-work-recovery.md` and this handover.
8. `docs/COMBAT.md`, the build-system/attribute progression addenda, current Requirements/Tag authority, `docs/MEDIA_PIPELINE.md`, `docs/PLAYER_MANUAL.md` and relevant domain documents.

Use applicable skills. Supabase instructions were read and actual explicit private RLS/table/function grants remain required. Official guidance was checked; no hosted upgrade/advisor/mutation is authorized by that read. Follow existing skill/plan review discipline rather than restarting planning or requesting duplicate acceptance.

## 5. Execution discipline and review budget

The approved plan explicitly uses **one capable High implementer and one independent combined spec/quality reviewer per task**, no helpers or duplicate reviewers. Root coordinates evidence, source publication and gates; root does not write unreviewed product repairs. Reuse the existing worktree and completed task artifacts. Existing agent identities were `/root/content_reconstruction_20261020` and `/root/content_review_20261020`; they may not survive chat deletion. Their files and verdicts do.

Task10 has one repair ledger across A/B/C/D, maximum five rounds. Rounds **1,2,3 are already used**. Do not reset the count for a new stage. Round3 only corrected an obsolete test fixture and was independently approved. A next repair round4 requires a fresh frontier High implementer under the recorded ruling: the original already used `gpt-6-astra` High, so use a fresh context at that same frontier High rather than silently escalating effort. Root is to stay on High; do not silently spend Extra High credits.

**Binding StageB delta review BASE:** `c96880123b8e31f6d8dec3bbbac024a1ff75609e`, tree `6c3a2926440c5827fb0f27f59d3bec2ee4c9a2fd`, exact remote `e2e076753ed87627bca00376d95aa3df2d201708`. This is acceptedA plus current main4793, with no B product commits. It supersedes old25968315. Full cumulative Task10 audit BASE remains `b83de822171d8f62726bd8b7a668a82d5d39b523`, with independent-main preservation context. Never review only `HEAD~1`.

At coherent B freeze, produce one complete B delta package, same task combined review and actual native evidence; then unlock C. Do not pay for repeated broad/native runs at every partial checkpoint. Later C/D gates retain the same task repair ledger and original findings. One broad whole-branch review follows final integration.

## 6. What is live and must remain intact

Blindside correction: PR941, merge `28ff6a1b0113cf7183ddd2fc513397a96a2b7a18`. Side/rear only, same enemy, successful eligible hit, actual reached origin; head-on never grants it. Preserve pending activation, Copy Buffs, old captures and all current facing coefficients.

Latest last-verified canonical production is the separate PR954 reader release, source `acd82a21b9980c5c99af61301e53f8a20d6c1540`, deployment `dpl_3DZxtQMmXYukhKaaD1d1TVC8idGu`, READY October20 at22:34:49.990UTC (18:34:49 Trinidad), `https://aurevane.vercel.app`. Main4793 includes its PR956 receipt. This chat did not deploy that separate release. Refresh remote truth before making a new current-live claim.

Preserve PR954's Resonance-only omission of redundant Automatic/usage-limit notes, bold/palette Requirement tags and the deduplicated captured-policy explanation footer. Ordinary Skill/Essence notes and actual mechanics remain. Postmerge focused378 tests/5files plus both browser script syntax checks pass.

Preserve PR950 simple modular Requirements/finite Tag + Self/Target + strict HP/MP percentage conditions/None, separate automatic timing and Conditional Cleanse; PR948 Barrier expiry/Primed/modular Resonances; earlier Covert, Barrier casting/effectiveHP, movement compression, attached-Move included cost, Controlled/Rewind, Ground/Airborne and released roster. No character/build reset, historical definition rewrite or unsolicited rebalance.

## 7. Completed Staff and Players producer gates

### Staff Task8

Reviewed source PR945/f6ba4876, tree `7174dd6ca0960d92ace1feb96ad5a72346cb2263`, passes all eight exact-head workflows. Native quality10279Vitest/605files +7Node/eight types/two builds. Browser full358/focused73/Edge10 and actual five-layout screenshots inspected. Selected-character live capability/expiry/revocation and single protected Owner bootstrap are preserved; original33 actor APIs, six retired management overloads.

Staff is **not deployed**. Final common-shell composition, physical/hosted/human acceptance and deferred focus restoration remain integration obligations.

### Players Task9

Final source59b63728/remote43ff3cad has independent source approval and all required exact native gates green:

- CI39498465457 Database job118889547615: complete actual migrations, Staff37 actor/Players physical races/Event/API/catalogue chain.
- Quality job118889547386:11957Vitest/634files +7Node, eight types, lint/format and both executed production builds, clean source.
- UIlayout39498465427/job118889547436 succeeds: mobile1, serial110/61skip, large1/2skip.
- Browser39498465423/job118889547171 succeeds22:44:40UTC: early8 including both complete Players flows, fullChromium360/282projectskips, focused73/21skip, Edge10/2skip, password6/training3. Its long bundled step was not a stall.

Dedicated Players flows execute under desktop Chromium and inspect five viewports including CSS2x. Project mobile/laptop skips are documented; this is not physical browser zoom/touch/device acceptance. Three WebServer destination-stream-close diagnostics remain in the successful output; do not claim zero runtime errors or suppress them speculatively. N4's unchanged AI test approached30seconds (25935/28271ms in the final successful quality run); final reliability disposition remains required.

Task9 authority/mechanics contract:

- Owner-only `staff.manage`/`assert_game_owner`, trusted currently selected actor, four service-only Players APIs; no new delegated moderator power.
- Bounded neutral name search20 without World/presence cleanup side effects.
- XP/Core/build/earned-support edits use CAS, fingerprints, idempotency and audit. Every correction increments numeric buildVersion. Real Core31/focus caps/five+level−1/currentXP1–100 remain authoritative.
- AP is `temporaryResources['pv1f.action-economy'].current`, not `unit.ap`.
- Exact private sourceHash plus numeric buildVersion, under account/character/build locks, protects real PvE/PvP/World admission. Prepared stale corrections reject atomically; public projections recursively strip private captures.
- Whole-encounter noContest terminalizes exact participants/version with explicit confirmation, immutable receipt/head/events/audit before cleanup. Every callable commitv1/v2/v3/head/replay/retry/trial/reward path rejects revival. Completion-first legitimate receipts remain; rollback/idempotency preserve unrelated XP/progression/history/pins/resources.
- Queues/status/Ground/summons/primes/clocks/spectator links clear appropriately. Character/account deletion retains privacy-safe terminal guards and identity-free anti-reopen marker. Preserve normal PvE/PvP/spectator client behavior and recovery denial/retry handling.

Original rounds1–5 and all source/native failures remain in `task-9-reconstruction/`; do not restart completed repair work. Source/native gates are complete; shared shell/frozen integration/physical/hosted/human acceptance is separate.

## 8. Accepted Content StageA

StageA3719ddf4/remote9a84 is accepted after two scoped repairs. It supplies typed complete records for ten kinds; identity/lifecycle/draft/current/history/CAS; saved-revision-only publication; restore intent and attribution; bounded list/create/duplicate/link retry; five legacy kinds and Basics as reserved Skill identities.

Supported Status semantics are strictly finite. Opaque old EffectProfile objects retain authoritative bytes/history and stay read-only/non-runtime; do not invent an execution schema. Item/Ascension/Severence can have meaningful future drafts but publication/runtime stays explicitly blocked where unsupported.

Selected live `content.combat.author` protects four service-only actor APIs:

```text
read_combat_content_record_v1(uuid,uuid,text)
list_combat_content_records_v1(uuid,uuid,text,text,text,text,integer)
write_combat_content_record_v1(uuid,uuid,text,jsonb)
publish_saved_combat_content_v1(uuid,uuid,text,bigint,integer,text,integer)
```

Original33 +Players4 +Content4 =41 actor signatures. Fourteen unsafe legacy mutation overloads are retired after actual authorization; direct legacy writes/private helpers are denied. Current tombstones return named `COMBAT_CONTENT_ARCHIVED`; returning null would resurrect builtin fallback. Exact old reads remain intact. Four original guard tables use shared **nonblocking** admission and exclusive archive locking; named40001 maps409, archived outcomes are explicit400. Used-by is bounded100+truncated but blockers query all dependencies; links bounded256. Builtin294 metadata-only records +153 implicit E/R consumers retain actual publication/history/mechanics, with no invented rows/floors or overwriting Owner edits.

Exact9a native result is **not all green**: eleven workflows succeed; CI39505910633 Database118914649654 succeeds through full actual migration/LZ4/41actor/Players/Event/API/physical catalogue chain. Quality118914649206 fails only an obsolete compatibility fixture after12113passingVitest; Node/builds are not reached. Browser39505910549/job118914648154 passes both full Players scenarios but fails two legacy Master editor Confirm-publish cases400expected200. StageD must migrate that editor.

Task10 round3 source repair21926f00 (exactremote192486cde074b7b3134835c68aebee6b25b97bc3, treefe878259cf4016bd2f1100cc7d14519219c15ff0) changes only the original compatibility test/report/ledger. A valid finite retained Status still yields INVALID_REQUEST with zero writes; malformed identity-only current Status yields PERSISTENCE_UNAVAILABLE with zero writes.74/3covering/types/lint/format pass; same reviewer specPASS/qualityAPPROVED, no new Critical/Important. Failed native jobs stay failed. The repair is already in B, not silently relabeled as native success.

## 9. Current StageB implementation and binding decisions

Read the latest `FINAL_CHECKPOINT.json`, worker report and exact append-only ledger for the paused active source. Before final pause the following were implemented and backed up:

1. Shared backend category descriptor for actual identity/validation/capability/projection; editor defaults/fields remain D. Do not restore duplicate kind switches or weaken the accepted Status/opaque profile boundaries.
2. Strict supported Discipline envelope: real Core/focus/Atlas/current linked Skill stages, Essence/Resonance declarations, actual unlock/mastery/Rekindling/prerequisites. Unsupported secret/flag discovery explicitly blocks rather than inventing runtime.
3. Actual saved-publication append-only domain/Core versions/current pointer, not `max(version)`. Existing primary selection/public/owned/Atlas SQL current projections; exact pinned joins remain historical. Migration `20261020222401_published_discipline_producers.sql`.
4. Canonical current Essence/Resonance SQL and strict service RPC resolver with catalogue-token mismatch→existing STALE_VERSION. Old exact pins do not consult current selection.
5. Publication/archive guards reject selected disabled/archived/malformed targets before writes, preserve losing-writer rollback and release only obsolete implicit builtin dependencies after actual declaration removal/replacement.
6. Attached per-Discipline earned grants: migration `20261020225734_discipline_skill_earned_provenance.sql`, mandatory `(character_id,skill_id)` FK to actual learned row, atomic actual producer writes, one shared joined availability. Actual initial18-function trace/inventory retained.
7. Actual SQL equipped save, committedv1/v2 serializers, named save/activate and pruning retain selected eligibility independently of intrinsic source and learned contentVersion. Four-total capacity and actual mixed3+1 case retained. Old absent eligibility materializes native only in activation's working value, without rewriting saved body.
8. Actual application joined learned/equipped v2 repository reads, strict committed/named reference parser, explicit save forwarding and actionable ambiguous-choice error.10RED→GREEN, named5RED, covering46/4GREEN plus separate actual HTTP20GREEN/types/lint/format. The first covering argv included a nonexistent fifth test path; actual output is4files, and the intended HTTP suite subsequently ran separately. No five-file claim.

### Core/selection decisions

- Preserve the existing unique Core base combination constraint across different Disciplines. Expose an actionable publication blocker; do not silently remove uniqueness.
- A Resonance pair is canonical sorted/unordered with one current winner under catalogue/record CAS, never last-published recency. Per-Discipline selections are declarations/views of that one authority. Conflicting other-side non-null declarations block before publication and name the dependent side; omission cannot erase another side's explicit choice.
- Untouched pairs retain actual builtin selection. An authored current declaration/absence is authoritative; disabled/archived/malformed selected content never falls back to a seed. Replacement/removal must be reachable, with both publication orders, stale CAS, rollback and old pins proved. StageD must explain bilateral reconciliation outcomes.
- Preserve Core31, six positive bases,2–3focus stats,60/40caps, five personal creation choices, four selected Discipline Skills, pure/mixed caps, AP/resources/progression and immutable intrinsic source/pins. No new equipment/transformation mechanics or parallel formula.

### Earned eligibility decisions

- “No second eligibility store” means no disconnected competing authority. The attached normalized grant relation is explicitly approved after comparing the real footprint: widening the learned PK would change two ONCONFLICT targets, single-row replay/readers and phase4 activation/update cardinality; the attachment preserves existing learned bytes/PK/version/provenance.
- Backfill actual native acquisition time/provenance. Existing support/`discipline-testing-open:v1` remains **unearned but usable**. Publication, links and testing entitlement do not manufacture earned facts. Preserve other legitimate existing durable provenance.
- A newly learned cross-only Skill must **not fabricate native eligibility**. Native current read/save requires a real native grant; native writers attach it atomically. New earned grants use legitimate actual unlock/mastery thresholds/producers.
- Multiple eligible active Disciplines require explicit player selection; only a sole active grant may infer. Present malformed eligibility fails closed. Intrinsic source is never overwritten with chosen eligibility.
- A retained unequipped grant blocks archive of its eligibility Discipline even after unlink. Skill and intrinsic dependencies also remain. Real linked/unlinked/rollback/FK/RLS/helper/service read controls are retained.
- The current SQL inventory has **seven guarded tables** and **fifteen new B private helpers**. Ordinary v2 owned reads are service-only, not new Master actor mutations. Full41-actor/native helper inventory execution and physical new-table races remain B freeze obligations.

### Admission and remaining B work

The final pause checkpoint1323b016/remote c6c54764 adds the existing current-build service slice: six meaningful RED regressions become27 whole-file GREEN, affected transports21/2GREEN, Web types/touched lint/format pass. All235 prior ledger rows remain unchanged, seven new raw hashes are verified (242 total). Tracked worktree is clean, only the two preserved untracked Task10 guides remain, and no worker processes are running. This is explicit WIP, not a complete B consumer/admission gate. The current build/profile/application integration remains unfinished. Carry selected eligibility through actual services/UI/profile/Atlas/Manual/Players; v2 can return multiple grants for one Skill, so never choose the first by skillId. Finish actual authored Core/current definition consumers, creation/personal allocation adapters and builtin first-edit behavior. Immutable trial capture/one-time credit must use the selected earned eligibility for the battle-pinned Primary, retaining historical omitted-native behavior and old receipts/XP.

Feed the same locked authoritative Players sourceHash +numeric buildVersion contract through real fresh encounter admission; no alternative formula/hash/recovery. Cover actual fresh/stale/correction/publication/deletion interleavings and whole losing transactions. Current selection catalogue tokens and historical exact pins retain their separate roles.

**Server descriptor still blocks Discipline authoring publication until the full consumer integration is complete. Do not unlock it merely because SQL projections pass.** No B freeze/review acceptance, C/D implementation or finished editor claim is implied.

## 10. Later work, still required

### StageC: references/media/privacy

Typed contextual references and Tag presentation metadata; actual immutable finalized PC uploads, crop, audio, checksums and retention across current/history/captured readers. A URL or label is not finalized media. Recursively strip private Accuracy. Use existing handlers/registry/capability boundaries, no arbitrary execution or invented future schema.

### StageD: finished content workspace/common Master shell

Compact six primary destinations plus World Environment, no decorative Overview hero. Category lists/New/Duplicate/Archive, Parameters/Text/Media/History, clear dirty/saved/published state, actual saved-revision publication, history/restore/Used-by/link pickers and shared full/compact/live/message previews. Migrate the old editor caller that fails the native publication tests. Complete descriptor-backed applicable fields/defaults and accessibility/keyboard/responsive geometry.

Every independent Guard, HP Recovery and MP Recovery behind Support Action slot3 must be editable/published/restorable/previewable even when not selected. Prove real editor→saved revision→publication→new battle→readers, not registry enumeration or mock UI. Preserve four Discipline Skill slots and actual cooldown/resource rules.

### Task11: Rules, Music, World Environment

Use `coordination/remaining-master-contracts.md` and Task11 brief. Remove routine reason/policy/history bureaucracy through actual UI/TS/relevant SQL while retaining internal CAS, attributed history and execution compatibility. Timing display order Instant/Normal/Delayed/Controlled must not alter execution order or historical captures.

Music already has slash-boundary longest matching, disabled override silence, same-URL continuity, native loop, pause intent, volume/mute and20MB PC upload/direct URL. Do not rebuild working authority. Actual gap: early global-disabled return prevents a custom page track under global silence. Persistent Use Global/Custom Track/No Music, truthful route coverage, reset/replace and visible actual upload/playback errors remain. Site music is separate from Skill audio.

World Environment remains explicitly in scope pending cross-chat ownership reconciliation: positive whole minutes/expiry, real configurable day/night clock authority/consumers, regional weather labels/explanation and right-panel time/phase/weather. Preserve existing Frostmere snow, gradual cosine night tint, header UTC time, World movement/rendering/compression. Existing dayLengthMs is only a fixed returned constant; do not claim it already configures the clock.

### Task12: Events & Live Ops

The persistent SQL/pg_cron kernel, pause60s shift and real XP reservation/run/claim receipt locks already exist. Do not replace the actual executor with worker ready/status acknowledgements. Audit real stop→resolving→ended, emergency/late jobs/settlement, both concurrency orders and rollback; retain completed claims/unrelated XP and reject replay.

Compact integrated Builder/Live Ops with actual audience/timezone/schedule/fingerprint/references/setup/live controls, routine reason removal with attribution retained. Selected Event Staff/global emergency authority remains Task8's contract. Expose specific unsupported domain blockers, no invented battle join/economy. Existing bounded48 World objective navigation is real navigation, not proof of domain execution.

### Task13: final integration

Trace all20 Owner sections plus Move/auxiliary addenda to actual producers/consumers and evidence. Reuse passing tests, add guards for real gaps. Prove actual saved publication/new encounter/current+captured readers, direct RPC/ACL/security, noContest late claims, event settlement and music precedence. Run native physical two-session SQL and actual browser/device/keyboard/touch/200% checks where possible; clearly identify unexecuted physical/hosted/human evidence.

After focused checks are green, one frozen full quality/native gate and one whole-branch review. No duplicate broad suite absent changed source/failure/unresolved risk. All original failures/rulings/deferred Minors remain review inputs. Final feature integration/release requires the actual acceptance/authorization boundary.

## 11. Deferred findings to carry into final integration

- StaffM1: focus restoration after Close/Save/Revoke; reassess in final shell/keyboard flow.
- StaffM2 and PlayersM2: existing Vite/CommonJS/NO_COLOR notices and three actual stream-close diagnostics; disclose/triage, no speculative suppression or blanket zero-error claim.
- PlayersM1: testing eligibility copy must distinguish published testing access, links and earned per-Discipline mastery.
- PlayersN4: unchanged AI simulation/validation timing approaches its30second test limit; exact43 passes, previous failures/profile retained. No performance repair or individual timeout increase has been made.
- ContentA M1: checked-state snapshot omits physical `combat_content_publications` pointer metadata (attribution/timestamps). Add those deterministic rows at13; current native schedules pass only their actual checked state.
- ContentA M2: backend descriptor is candidateB implementation; editor fields/defaults remain D and same reviewer must verify the real consumers.
- Inherited21 combat Minors remain in prior release handoffs; no unsolicited roster rewrite.
- Aggregate CI budget ruling: only `.github/workflows/ci.yml` `jobs.quality.timeout-minutes`15→25 is authorized/implemented in B. Exact43 full quality14m41s; predecessor65 genericcancel15m15s during Webbuild (cause consistent but unproven);9a failure14m19s before builds. Keep commands/order/runner/concurrency, Database20minute budget, individual test limits/assertions and deployment lock unchanged. This is bounded aggregate headroom, not an N4 fix; complete final frozen gate still required.

## 12. Verification and preservation notes

Node24.19/pnpm11.17 were used. Docker/psql and pinned Chromium are absent locally; actual PostgreSQL/physical/browser gates run in native Actions. PGlite may substitute PGLZ only for the unchanged LZ4 storage ALTER in migration20261019035553, inside its fixture; it must load actual Aurevane authority/function bodies. This is not native/storage acceptance or permission to edit the original migration. Native full migration/LZ4 execution has passed on the accepted sources.

All verification rows append to `verification.jsonl`, retaining actual argv/cwd/timestamps/exit/raw SHA256. Some filenames contain “green” despite intermediate failure; read exit/result, not filename. Keep original RED/failure evidence. Native transcripts are sanitized deterministic gzip, with redaction/checksum manifests. Supabase CLI emits `sb_secret_` tokens; JWT-only scanning is insufficient. Never print/export raw credentials, signed URLs, unredacted logs or full base64 blobs.

A StageA frozen bounded-list log later existed as a3378byte prefix; its exact4218bytes were reconstructed from the original tool output with original SHA match. `freeze-dede` provenance retains both prefix and recovery. Cause is unknown; no rerun/relabel of frozen evidence. Do not discard this record as a new product issue.

Key complete transcript references:

- Players final Browser gzipSHA `49975ede10a55e56942ace81f2b145437c778133404631c3f61ce20e17237b8b`; raw362551bytes, one CLIkey redacted/noJWT.
- A9a Database gzipSHA `8dc8c9bca4dae4fcecd16611a0a80351c829e13c8567c5fc997c74bcf1be9f7d`.
- A9a quality failure gzipSHA `f30df4e9adede231298b131416d1c078a65e53de0fb23bb6404939f15cfa78f8`.
- A9a Browser failure gzipSHA `b67406ff551787355f71dcc7532352d575a5ec7020b9e7d9f99226bbaf3551bb`.

Use manifests in the package for complete IDs, raw hashes and all checkpoint logs; do not substitute these headline hashes for their full evidence.

## 13. Resume and recovery procedure

1. Confirm existing task ownership with the receiving chat, particularly World Environment. Read final receipt and plans before changing code.
2. Prefer the latest published `agent/content-stage-b-20261020` for active B. Fetch fresh main and verify expected head/tree against `FINAL_CHECKPOINT.json`. Preserve newer main rather than resetting to4793.
3. If current scratch worktrees remain, inspect status before checkout/merge. Never reset/clean away untracked guides, raw logs, pending edits or another chat's work. The final source checkpoint is explicitly incomplete; resume its next recorded obligation.
4. Keep coordinator accepted product separate until B review. A docs/evidence merge does not accept B product.
5. If local objects are unavailable, use the published exact-tree remote. The package includes binary source patches against4793 and optional prerequisite-based Git bundles when available. Check the manifest and bundle verification report before use. Patches apply only to their recorded base; never apply them blindly over a newer tree or duplicate equivalent commits.
6. Inspect the final paused worker report and tests. The next recorded trace is `rg -n 'saveCharacterDisciplineSkills|skillIds|eligibilitySelections' apps/web/src/app/api apps/web/src/components/character/character-skill-build-panel.tsx packages/validation/src`. Finish route/UI eligibility selection, then immutable trials/fresh admission/current consumers/native inventory and one complete B gate. Do not rerun Staff/Players/A from scratch.

Useful read-only commands (adapt paths to the new environment):

```bash
git fetch origin main agent/master-panel-recovery-20261020 agent/content-stage-b-20261020
git show origin/agent/content-stage-b-20261020:docs/verification/task-10-reconstruction/report.md
git show origin/agent/content-stage-b-20261020:docs/verification/task-10-reconstruction/stage-b-producer-handoff.md
git ls-tree origin/agent/content-stage-b-20261020 apps/web/vercel.json
git status --short
```

Git fetch works here; ordinary git push lacks credentials. Feature checkpoints were published through the GitHub connector: create blobs with exact Git hashes, create tree using exact local tree, create commit with mapped remote parent(s), leased `update_ref(expected_sha=..., force=false)`, then fetch/zero diff/tree/lock verification. Never overwrite someone else's branch. A PR snapshot may lag a moved ref; do not repeat ref mutation on stale PR metadata.

For large blobs, read base64 in bounded chunks and validate expected length/hash rather than exposing/truncating tool output. Independent reads/uploads can batch with inspected Promise.allSettled results; dependent ref mutations stay sequential. Use `set -euo pipefail` for shell verification/mutation sequences. Do not put unescaped multiline content/backticks/command substitutions in shell arguments; prefer structured tools or body files.

## 14. Package contents and final state

`HANDOVER.md` is this document. `FINAL_CHECKPOINT.json` names the exact final paused active source, remote receipts, tree, clean/dirty status, next work and checked gates. `MANIFEST.json` hashes every packaged payload. `verification/` carries the current task reports, reviews and sanitized transcripts; `coordination/` retains plan-workspace artifacts; `authority/` carries approved plans/specs and key project documents. `recovery/` contains source patches and any verified Git bundles. No node_modules, caches, environment files, credentials or screenshots are intentionally included.

The source is intentionally paused for transfer. No worker should continue editing from the old chat after the final pause. **None of the unfinished Master feature has been released by this handover.**

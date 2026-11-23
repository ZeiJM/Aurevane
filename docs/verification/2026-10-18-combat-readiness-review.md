# Final whole combat branch review — 2026-10-18

## Verdict

**Not ready for combat release. 0 Critical, 1 Important acceptance finding, 1 new Minor.** No additional Critical/Important authority, persistence or kernel defect was confirmed in this review. This is not a claim that the unexecuted acceptance gates passed, nor an exhaustive proof of every possible roster/context combination.

The Important finding is an observed full-match pacing failure, not an inferred infinite loop. The new Minor is an inaccurate post-commit Guard notice. Preserve all 20 inherited Minors: **21 total deferred Minors** after this review. No source repair, remote operation, child reviewer or rereview was performed. The parent retains the single authorized C/I repair wave; this report does not spend it.

Reviewed frozen HEAD `54c0d3f3cf86d454e5b3e8003ff970b2edaa8dc7` against actual current-main merge-base `b2d275269433f69ab1824e1f4ce110f730f9aa1a`. I read the final review package fully and independently checked HEAD, merge-base and clean tracked status. Scope is the whole combat release branch, including the production inventory, actual consumers and relevant tests/evidence, rather than the last Basic-only checkpoint. The supplied inventory has 189 production paths; the full branch includes 470 paths and extensive tests/docs. I used risk-directed inspection across the branch, not a claim that every line in all 470 files received equal scrutiny.

## Important finding I1 — defensive entry kits fail the required natural match-pacing acceptance

**Requirement:** `docs/superpowers/specs/2026-10-10-roster-rebalance.md:96` requires representative Level100/Core40/HP40 four-Skill mirrors to preserve the natural roughly twelve-round standard, without scripting the finish. A good average must not hide a nonfunctional class or dominant loop.

**Observed effect:** The new natural diagnostic uses the approved earned entry kits, actual save/build authority, proposed published definitions, immutable capture, derived stats, native preparation/commit and High AI. At Level100/PvP/seed12345, its first 25 mirrors have 22 terminal outcomes at rounds9–24 (reported median13) and three still active beyond the32-round horizon. Extending those same three naturally to128 rounds produces:

| Kit | Actual result | Relevant observed actions |
| --- | --- | --- |
| Wildwarden | Completes at round50 | 248 Basic Attacks; 24 Field Remedy actions |
| Dawnshield | Completes at round94 | 324 Basic Attacks; 56 Radiant Strikes; 36 Dawn’s Oath and 36 Sacred Guard actions |
| Bastion | Still active at round129 | 359 Basic Attacks; 77 Stalwart Strikes; 73 Shield Bashes; 56 Hold Fast; 28 Guard; 2 Last Bastion |

Bastion survivors have57/500 and234/500 HP, with3/131 and15/131 MP. This establishes excessive duration under an actual supported natural-play scenario. It does **not** establish an infinite loop, identify a particular root formula error, or prove every human matchup has that duration. The four-round289-kit matrix cannot answer this finding.

**Locations/evidence:** `apps/web/src/server/battle/roster-legal-duel.test-utils.ts` supplies the real local admission/execution diagnostic path. `docs/superpowers/specs/2026-10-10-roster-rebalance-coverage.json` selects the approved entry kits. Relevant complete proposed records include `...roster-rebalance-proposals.json:15950` (Hold Fast), `:22230` (Field Remedy), `:26168` (Sacred Guard), `:39675` (Last Bastion) and `:41378` (Dawn’s Oath); these are investigation entry points, not an assertion that each individually causes the result. I independently read the helper and the final diagnostic audits. The preserved source/JSONL/audit under this review directory reproduce the case with `createLegalRosterDuel({kit,level:100,context:'pvp',seed:12345})` followed by `playLegalRosterDuel(...,{maximumRounds:128})` for those three kits. Extended evidence SHA256 is `20b1e1e3ccd0c0cff85b27e4afe381cf4ebddbdd4bd12f96e4a5dd947173ce80`, 3,185,332 bytes.

**Required disposition:** Keep balance acceptance and roster activation blocked. Diagnose natural decision/usefulness, sustain, pressure and resource tradeoffs for these defensive kits and revise only explicitly authorized roster/AI scope as appropriate. Demonstrate natural terminal pacing and meaningful counterplay after the change, with neighboring controls to avoid breaking working kits. Do not force terminal state, shorten the diagnostic and call it a full match, or infer success from legal execution alone. Creative tuning may require the parent’s prescribed effort-switch boundary. This review does not authorize changing protected hashes or silently weakening the benchmark.

## New Minor M21 — Guard success notice ignores the captured published definition

**Location:** `apps/web/src/components/battle/battle-experience.tsx:1404–1405`.

After every successful PvE `GUARD_ID` commit, the component says “Guarded for 2 turns at -15% incoming damage.” The branch now permits publishing complete Guard records with different duration/potency and replacement effects, and execution/readers consume those captures. The notice still describes the historical default solely from the command ID.

**Reproduction:** Publish a valid `basic.guard` record with a different supported Guard duration, or replace its effect with an allowed self-healing packet; enter a fresh PvE battle with Guard selected and commit it. The saved/captured outcome follows the edited definition, but this success branch still announces the fixed two-turn/-15% result. The source branch is deterministic; I did not run a mounted browser reproduction. A renamed Guard also retains the default wording.

**Impact/grade:** Misleading immediate feedback about the action just performed. The actual state, safe captured report and AP total can remain correct, so this is Minor rather than an authority or payment failure. Prefer a captured-definition/outcome-derived notice or a neutral truthful commit notice. Defer under the existing no-incidental-Minor-repair policy; do not erase it from the release ledger.

## Actual code and integration coverage

- **Admission and authority:** Inspected `battle-session-service` creation/submit/replay, `battle-build-authority` current resolution and exact immutable reads, shared Basic capture, PvP lobby projection, recruit service, repository RPC mapping and existing commit/version-check chain. Basic admission shares one current Basic read across build owners, captures only the saved Support plus the explicit Guided Guard exception, and old encounters do not re-read current Basic records. Newly primed commands remain behind the existing controlled-turn and commit CAS path.
- **Definitions and persistence:** Inspected Basic parser/native-binding restrictions, canonical parser/target validation, capture identity equality, Controlled persisted inventories, command selection schemas, catalogue resolver, authoring service/store, timing compatibility compilation and all new catalogue/publication/version-floor SQL guards. The service-only v3 publication path retains underlying immutable append/CAS and takes the catalogue token lock; older writers are revoked. The proposed roster remains a publication artifact, not silently active builtin replacements.
- **Kernel:** Followed canonical preparation through structural modifiers, simultaneous costs, free prime/cancel, release consumption, return anchors, native walking, actual reached-position validation, after-effect settlement and summon cleanup/returned stat bridge. Inspected ordinary/plural/area/Ground targeting, selected subject propagation, pending recipient delivery, secondary HP-recovery hit gating, controlled timing compilation and native event frame/budget integration. Free priming returns no paid action-use events; used identity survives cancel/release. Attached Move previews projected geometry but execution checks live steps and final selection.
- **Privacy and historical readers:** Inspected final recursive public projection, explicit private-state omission, owner-only action/modifier geometry/report projection, pinned Basic/Skill/Essence/summon log metadata and preview command-cost outputs. Exact missing historical metadata is not replaced by today’s definition in the inspected paths. Recursive public projection removes private hit-authoring aliases after composition; this is an additional boundary, not a replacement for validation/viewer entitlement.
- **Controller/editor/readers:** Inspected relevant Basic editor restore/review/publish state and request metadata, shared review gating, player preview freshness/version checks, modifier pins, plural selection and Controlled readiness/commit handling, plus shared Skill/Basic information consumers and changed component inventory. The editor invalidates prior review on edits; Restore copies a complete historical record to a draft and normal publication remains separate. This source inspection exposed M21. It does not establish browser geometry or real native input behavior.
- **AI/roster:** Inspected build-aware canonical candidates, structural Controlled trial preparation, Move path preparation, plural candidate re-quotation, native movement fallbacks, summon selection and bounded service paging. Read the full-match diagnostic source/helper and both audits. The long-match result is material regardless of the legality assertions passing. I did not independently redesign or rebalance289 records.

## Considered concerns that are not additional confirmed findings

1. **Timing-policy/current-content read interleaving at admission.** The admission code reads timing and current definitions separately; the new catalogue snapshot/lock validates publication, not a single atomic whole-admission read. Reconciliation applies the pinned policy and rejects unsupported canonical combinations before persistence. I did not establish a reproducible committed invalid encounter or an authorization bypass from this interleaving, so I do not promote it to C/I. **Cost:** publication/admission concurrency remains an explicit live acceptance boundary; the code review must not be described as a proof of one atomic catalogue-and-admission snapshot.
2. **PvE recruits and published Basics.** The new capture helper is scoped to `authority.combatants` (build owners); the ordinary PvE fixture recruit remains on native historical behavior when it has no owned captured Basic source. This matches the documented admission checkpoint’s build-owner contract and is not evidence that the human player ignores a publication. No explicit approved requirement that every fixture recruit use player-published Basics was established here. **Cost:** no universal all-recruit publication-propagation claim; player-built AI/PvP captured-owner acceptance and native fixture compatibility are distinct.
3. **Pending Root and Rewind checks.** The native root lookup initially looked suspicious, but pending presentation statuses are generated separately and do not enter engine status rows through the actual pending-effect path. No reachable new pending-Root rejection was established. **Cost:** this does not certify arbitrary corrupt state acceptance.
4. **Automatic Self area selection.** The selector has a Self shortcut, but canonical area validation rejects Self-only non-Single targeting. I did not report an unsupported authored combination as a runtime bug. **Cost:** broader novel authoring combinations still need actual parser-to-command coverage.

## Verification evidence and its limits

The parent’s final exact-source `pnpm --reporter=append-only check` receipt is `e7fa0417`, 2026-10-18T02:11:35.677425Z–02:12:38.789124Z, exit0. I read `continuous-main-gate-final-audit.json` and the root transcript summary lines: **9,162 Vitest tests +7 Node checks**, format/lint, eight typechecks and both builds pass. The complete transcript and package hashes matter: initial97e’s truncated stdout is retained, and one cached same-source replay supplies the complete final receipt. I did not duplicate this full suite.

I read `continuous-preservation.json`: six protected source/test hashes, proposal manifest SHA256 `b86cfec056bbac582810e7da80f9bc687f02518892eb5d11275fc7b5ced19f05` and deployment-lock blob `b8a4e0e3c57b95a8da49c05d1fe5f60ba2181b5f` are recorded unchanged at the frozen head. I did not perform a separate full remote-byte recovery audit.

Parent reports six migrations tested via PGlite (five test files, eef5e067); actual PostgreSQL/concurrent-hosted acceptance was not renewed by this reviewer. Parent’s read-only hosted inventory reports no combat content versions/publications/drafts, policy7 unchanged, RLS enabled, old relevant executable RPCs service-only and required new catalogue/guard RPCs absent. This corroborates that activation/migration acceptance remains open; it is not a live write test. The prepared real-handler native browser journey has only its SSR probe executed. Public source push was rejected by automatic approval review, and the browser CI journey therefore has not run. Passing local checks do not remove any of these boundaries.

## Every declined or uncompleted boundary

| Boundary | Reason/disposition | Practical cost |
| --- | --- | --- |
| Native browser journey for the new real-handler Basic editor | Prepared but not executed; no local browser evidence and source publication/CI blocked. | Restore→review→publish physical interaction remains unaccepted. |
| Desktop/mobile touch, native Enter, focus and long-name layouts | Source/callback tests do not operate a browser. | Real primary controls and wrapping may still fail. |
| 200% zoom | No mounted measurement performed. | Compact-panel readability and control access remain open. |
| Assistive technology and human gameplay acceptance | No actual AT/human session in this review. | Semantic code alone does not prove usable experience. |
| Hosted account/selected-character expiry and revocation races | Read-only source/RPC inspection and local fixture authority only. | No renewed real-account/direct-RPC live revocation proof. |
| Hosted deployment of the six migrations | Reviewer scope forbids hosted mutations. | New catalogue/publication writer compatibility is not yet active or verified live. |
| Physical PostgreSQL concurrent catalogue publication/timing races | PGlite/local evidence exists; no fresh multi-connection production-equivalent run here. | Lock ordering, rollback and deployed privileges still need acceptance. |
| Atomic whole-admission catalogue snapshot | Separate current/policy reads were inspected; no new transaction was added or proven. | No stronger admission-atomicity guarantee than actual code. |
| Concurrent build save versus admission | Existing authority/CAS path inspected, not newly exercised against hosted races. | Fresh real simultaneous-build consistency evidence remains required. |
| Recovery/claim/settlement concurrency and late workers | Existing unrelated transactions not changed by this review and no hosted mutation allowed. | No new no-contest/reward/concurrent-worker acceptance. |
| Fresh-account/routing/network failure browser flows | Local handler transport controls auth/navigation. | Deployed session and network recovery remain unproven. |
| Full all-pair, all-seed, all-arena balance |25 natural mirrors plus3 extensions are bounded samples. | Other dominant/weak kits may remain; I1 already blocks acceptance. |
| Finishing Bastion beyond128 rounds | Horizon is a diagnostic bound, not a completion claim. | Exact eventual terminal time is unknown; excessive pacing is already established. |
| Independent creative retuning | Read-only review; protected manifest/runtime not to be opportunistically changed. | I1 remains open for the parent’s authorized repair/effort process. |
| Additional broad suite reruns | Parent completed the exact-source full gate; repetition adds no new coverage. | This report relies on recorded executed evidence and source checks, not a second execution. |
| Exhaustive malformed-state fuzzing across every nested/pending/summon shape | Inspected parsers/restore/projection paths and existing coverage; no new fuzz campaign. | No universal integrity proof for all corrupt states. |
| All historical versions in every reader | Inspected exact/pinned handling and relevant tests, not each historical record physically. | Missing metadata/layout edge cases may remain. |
| Every line of all470 changed paths | Whole-branch review used risk-directed trace inspection, not equal line-by-line attention. | Uninspected low-risk details can contain defects; no absolute correctness claim. |
| Wider current-main social/mobile/World behavior | Current main is actually merged; checked identity and combat overlap, not a second complete World/social review. | No fresh comprehensive noncombat regression verdict. |
| Broader Master/Staff/Players/Events/Music/Environment redesign | Explicit combat-first scope leaves these later. | Whole overhaul and Tasks15/16 are not complete. |
| Generic non-Basic Restore/create/archive redesign | Existing legacy workflow is separate from complete Basic Restore. | Other kinds do not gain new Restore semantics from this release review. |
| New disabled Basic publication semantics | Existing restriction intentionally retained; restored disabled drafts remain editable. | No new disable/archive workflow certification. |
| Public source push, remote main merge or deployment | Read-only review and automatic approval rejection prohibit treating these as completed. | CI/native release checks and live release cannot be claimed done. |
| Durable remote restoration of this exact source/evidence | Parent owns recovery/publication; reviewer made no remote mutations. | Local report is not proof of a durable remote backup. |
|20 inherited Minors and newM21 | Preserve the approved deferred backlog; no incidental repair. | All listed low-severity issues remain unresolved. |
| Complete release-ready verdict | I1 plus native/hosted/human acceptance remain open. | Combat activation, Task16 completion and overhaul completion are blocked. |

## Preserved inherited Minors

These retain their original scopes/grades; this review does not silently close a finding because a newer helper happens to have a similar assertion.

1. Rewind witness origin.
2. Supporting Shot version pin.
3. Ongoing pair dynamic identity pin.
4. Repeated bounded AI discovery.
5. Original admission double-prefix provenance.
6. Ranged direct negative-commit witness.
7. Independent Defense positive-HP reconciliation.
8. Exact Arsenal history labels/values.
9. Singular clock grammar.
10. Burn tick wording.
11. Master inline-reference sizing.
12. Cross-status actual-input immutability witness.
13. Legacy duplicate component keys.
14. Unknown-reference matching-text witness.
15. Automatic local RNG-consumption display.
16. Automatic owner-only resource/status sample-copy bound.
17. Direct End Turn input-immutability witness in the earlier concealment helper.
18. Positive Rewind preparation occurs before its own input-purity snapshot.
19. Restored Rewind cooldown state is not independently read after release.
20. Summon-service local replay adapter does not model same-key/different-fingerprint `IDEMPOTENCY_CONFLICT` and may treat it as miss/overwrite; production conflict behavior is not proven by that helper.

The separately noted existing Vite native config-loader advisory also remains documented; no tooling cleanup was attempted. NewM21 is the Guard notice above.

## Handoff

Keep the frozen branch and all evidence. The release has a passing local quality gate and substantial integrated execution coverage, but **I1 must be resolved and the explicit native/hosted/human gates must be completed before a combat release verdict**. Do not spend another reviewer seat or claim a rereview. The parent’s single C/I repair wave remains available; any revised source requires appropriate fresh verification. No merge/deploy or overall-completion recommendation is made.

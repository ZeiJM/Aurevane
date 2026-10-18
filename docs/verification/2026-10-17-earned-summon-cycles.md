# Earned Summon actions, AI and canonical cleanup — October 17

This Task15 continuation closes the explicitly missing earned Verdant Stalker action/AI/lifecycle witness and fixes a real canonical-command cleanup defect. It adds28 earned-build cases plus one focused historical-wrapper regression. It is not a live release. The original unfinished battle/editor/native integration still precedes combat release; broader Master/world work follows it.

## Result and actual authority

Base is d34ddeba83469f9295af699f661555c98037f36c on isolated agent/overhaul-resume-20261017. The single combined review inspected54ba4267b69d9899347b998a81d156020ec50cb1. Runtime repair is0e4089906; final tested source after the test-only type clarification is1949f6b02 (full SHA retained in checkpoint metadata). Main freshly remains29506e293e81abef1b0b8a46099618ab3ae3f0ae. Deployment lock remains unchanged.

The proposed roster contains one Summon packet: Wildwarden renewing-herbs v7. Pure Wildwarden replaces Field Remedy with this earned Skill, retains exactly four selected Skills plus separate Essence, and faces pure Vanguard. All directed cohorts use Levels1/100 × PvE/PvP, seed1, actual local proposed publication, earned save/load, current and pinned build authority, captured source and native startup through the existing unchanged helper. Learned/mastered facts are fixture inputs, not acquisition-award acceptance. No stats, status, RNG, resource or placement patch appears in these earned cases.

The parent pays50AP/6MP; authored cooldown4 owner turns is independently read as5 initial stored ticks. The spawned captured profile has36HP/12MP, lifetime5 own completed turns and authoritative parent/team/source v7. Thorn Rake and Verdant Mend each cost45AP/0MP. Native policy permits one authored ability per Summon turn despite55AP remaining. Mend restores4% maximum HP, floored and capped by actual missing HP. These rules are preserved.

| Directed cycle | Cases | Actual witness |
| --- | ---: | --- |
| Mend then Rake | 4 | Real opposing Basic wounds owner; child Mend heals for the native capped amount; a second same-turn authored action rejects without mutation/payment; next child turn Rake damages the actual opponent. |
| Native support AI | 4 | Real repeated opposing Basics wound the owner to60% or below; opponent pays to retreat; native AI selects Mend, which executes; next AI decision offers no authored action that turn. Legitimate setup misses remain paid and have exact native miss receipts. |
| Natural expiry | 4 | Only completed child turns advance its lifetime; exactly five expire it, prune authority and free its tile. Owner pays to walk onto it. |
| Lethal command cleanup | 12 | Four contexts each exercise canonical AI dispatch, direct canonical command, and the actual native player Basic wrapper. Real Basics kill the child; one defeat receipt accompanies complete removal and the owner can occupy the freed tile. Living-owner battle remains active. |
| Occupied spawn and repeat | 4 | Occupied target rejects before payment/cooldown; free tile spawns; immediate repeated cast with sufficient resources rejects on the actual cooldown without mutation or duplication. |

Positive and negative preparation calls bracket serialized input purity. Every recorded command, movement and End Turn checks input immutability, prefers the actual returned stat bridge, and JSON-restores/validates state. Removal checks active instance, combatant, placement, initiative, stat profile and turn-trigger authority. Stale child evaluator/executor/AI calls reject. Ordinary manual End Turns are not idle timeouts.

## Defect and single review repair

Canonical AI action dispatch and the player canonical Skill service call commitCombatAbilityCommand directly. Unlike the older native wrappers, this branch did not call removeDefeatedCombatSummons. The child could remain an active Summon at0HP with its profile and turn-trigger metadata. The next attack then rejected an already-defeated target.

The focused pre-fix24-case run101633207846Z-e84822aa passes16 and fails all8 direct/canonical-AI defeat cells on an immediate active-record assertion. Cleanup now reuses the existing helper after root command native outcomes and Automatic children settle. Nested eventSession children defer cleanup to their outer command/native wrapper, preserving recipients until event processing completes. Current active Summon death remains owned by the existing turn lifecycle. No new removal rule or balance mechanic is introduced.

One independent combined review found0Critical/1Important/0newMinor. I1 correctly identified a follow-on regression: actual player Basics use executePv1fAction, whose command consumer restored prepared.statBridge after the new root cleanup had removed the child profile. Validation then rejected the lethal result. The analogous historical native Mature Skill command consumer had the same issue. The initial route named player directly called the command kernel; it was relabeled canonical rather than claimed as actual player Basic acceptance.

ONE repair wave adds the actual native-player route, observes all4 new cases fail with exact profile-coverage validation (`102047195557Z-4db90a2e`), and preserves the returned bridge in both command consumers. A separate focused historical-native regression uses a real legacy Forceful Strike v2 plus a valid authored Manual modifier and a current spawned companion. Its high-offense scenario profile is constructed at setup; it is separate from the unpatched earned-build evidence. The first attempt used an invalid1000-power authored modifier and failed authoring validation (`102153626700Z-0f8b4fc3`), which is a fixture mistake, not product RED. With valid20-power modifier and initial scenario physicalPower200, the historical wrapper produces the exact stale-bridge failure (`102221579825Z-521d4481`) before correction. Both wrapper branches now retain the returned bridge. Covering tests pass144 in7 files (`102236583588Z-517bc378`). The first repaired full gate caught missing explicit mysticPower in this new test’s current-profile construction (`102257348168Z-e9aa6549`, exit2 before tests/build). Adding mysticPower20 matches the existing helper’s actual value and makes core typechecking pass (`102439493053Z-9412416c`). It changes only the unimported core test file, not runtime. No rereview or unrelated Minor repair.

The initial new20-case run101151927304Z-2476fffa also assumed every real Basic hit; that assertion was corrected to allow native paid misses, require exact hit:false receipts and reconcile damage on actual hits. No future RNG sampling or forced setup outcome was added.

## Final verification

Exact final source1949f6b02a1fc38dbfabcd3197090a69ad58af6d passes **9,046 Vitest plus7 Node checks**, formatting, lint, all eight package typechecks and both builds. Initial complete gate102452985269Z-fc5f14ec exits0; its root stdout cuts during tests with five package counts. Raw output plus hashed complete package logs are retained as partial-evidence. ONE cached same-source replay103000235338Z-aaa03555 exits0 with all seven root counts, Node7/0fail, explicit `$ turbo run build` and successful two-build tail. No source change or third replay. Core4137 + web4663 + other246 =9046. Existing loader/DOM advisories remain visible; Turbo/Next telemetry was explicitly disabled. Node24.19.0/pnpm11.25.0 fallback remain as previously documented.

The28 unique directed traces pass102257348169Z-b7f0039b:14,649,590 bytes, SHA256884ed2808d766742a7a8a9b0e511467a1ae23867414f9e5716893b98d6f24904. Independent audit checks every cohort, v7 source/profile/lifetime, parent payment/stored cooldown, capped healing, one child action per actual turn, separate-turn damage, complete removal and paid occupation of the freed tile. Traces include every recorded native End Turn state/events, but they are snapshots and receipts, not a standalone deterministic replay engine.

Trace and matrix executions use0e40899063cdbdd5876e689c02541621d72e3a82. A source-diff guard proves final1949 differs only by one explicit mysticPower20 field in the new core regression file, which neither web suite imports. Runtime, roster, helpers and both web suites are identical. Reuse these executions honestly with their original source provenance rather than repeat them for an unrelated test type clarification. Final full quality executes all29 new cases on1949.

The explicit complete289-kit bounded Level100 PvP mirror matrix passes102257341864Z-a619bb19 (exit0,289/289). Every kit executes four natural rounds or a real earlier terminal result, using seed12345. The289 unique trace rows total2,826,307 bytes, SHA256d60cb8110a8ad3f74342c52fbaf368c2c52aa04c6e44f22d0fd1dfcdd6cba280. Independent audit checks the full cohort, nonempty commands, actual round/terminal boundary and source provenance. This is bounded execution coverage, not natural full-match balance.

The superseded reviewed-source root gate and partial matrix were deliberately interrupted after I1, tool sessions16355/27885 exiting130. Their raw logs and partial traces remain, with an explicit cancellation record; neither is a passing gate. SIGTERM/KILL attempts did not close the tool sessions, so session Ctrl-C performed the interruption. No silently discarded failure or completed-matrix claim follows from partial rows.

Runtime changes are limited to shared command cleanup and the two native command consumers. The proposed roster manifest retains SHA256b86cfec056bbac582810e7da80f9bc687f02518892eb5d11275fc7b5ced19f05. All six protected AI/helper/native-display paths retain their prior hashes. This is not a runtime-unchanged checkpoint: the preservation record lists both changed runtime files and the shared command's old/new hash. Existing helpers and prior fixtures remain unchanged; the historical regression is a new file. No separate141 preview/284 Manual/294 reader diagnostic is repeated because prices, definitions, quotes, adapters and presentation are unchanged. The explicit289 bounded mirror run is required here because shared runtime changed; it does not establish natural full-match balance or twelve-round acceptance.

## Review scope rulings and costs

Accepted review findings include earned local authority, pinned profile, real wounds/paid movement, capped Mend, later Rake, once-per-turn, native support choice, own-turn expiry, rejected payment/cooldown, pure preparation and serialization. I1 is fixed in the one repair wave. The parent rules individually on behavior set aside:

| Behavior | Ruling and reason | Cost if wrong |
| --- | --- | --- |
| Progression award acquisition | Seed earned/mastered facts; real acquisition is not exercised. | Acquisition defects can remain. |
| Hosted publication, permissions and durable transactions | Local in-memory repositories only. | Hosted authorization or atomicity can differ. |
| Network/controller implementations | Four authority contexts, not four network clients. | Transport/controller failures remain. |
| Full Summon service loop/reload | Native decision plus matching execution and JSON restoration accepted. | Scheduling/service-loop defects remain. |
| Reaction/backlash killing active Summon | Existing outgoing-turn lifecycle remains unchanged. | New earned cases do not prove this death boundary. |
| Nested movement/activation boundaries | Do not claim all native boundaries fixed; existing enclosing wrappers own deferred cleanup. | Another native boundary may retain a defeated child. |
| Owner defeat with surviving child | Living-owner scenario only. | Team/terminal integration may differ. |
| Simultaneous deaths | Existing broader native gate stays open. | Ordering/terminal faults may remain. |
| No-input/idle-timeout | Manual End Turn is not scheduler input. | Timeout lifecycle remains unaccepted here. |
| Already-terminal cleanup | No new terminal fixture or rule. | Terminal snapshot cleanup can differ. |
| Chronicle visibility/rendering/replay | Existing removal receipts reused; no UI change. | History or privacy presentation needs native/browser acceptance. |
| Malformed generic state without valid bridge | Valid Summons require current bridge; no permissive malformed-state guarantee. | Corrupt external state needs existing admission validation. |
| Physical AI repository/CAS | Actual code path traced; physical hosted operations not executed. | Persistence races/infrastructure faults remain. |
| Player canonical Skill service | Code path preserves bridge; direct command witness is accurately labeled. | Full service/network acceptance remains separate. |
| Natural full-match balance, distributions, mixed builds, human play | Directed endpoint/one-seed evidence plus bounded matrix only. | Other play patterns and balance may differ. |
| Current hosted Owner content/history/CAS reconciliation | Keep final release reconciliation gate open. | Hosted edits may differ from local proposal. |
| Original complete battle/editor/equipped integration | This witness closes a specific Summon gap only. | Unfinished original work must not be forgotten. |
| Keyboard/touch/AT/mobile/zoom/Atlas | No new physical browser witness. | Native interaction and readability remain open. |
|19 inherited Minors | Preserve individual deferrals in prior earned-Rewind report. | Known lower-severity gaps remain. |
| Full Task15/16 and broader Master/world work | Tasks remain unfinished; Master/world follows combat release. | Premature closure would hide remaining scope. |
| Publication, deployment and human acceptance | No release operation or readiness approval. | Local passing checks could be mistaken for live acceptance. |

## Checkpoint and remaining work

Original battle/editor/native integration, other distinct earned cycles, complete AI/PvP/counterplay and natural full-match balance, native interaction/Atlas evidence, current Owner content/history/CAS/hosted reconciliation, final combined release gates and human acceptance remain open. Task15/16 are unfinished. Broader Master/world/Environment work and creative-library complexity labels remain after combat release. High remains sufficient.

Only this report follows the frozen tested source. Save the source/evidence on the existing non-deploying backup branch with expected-parent protection and verify remote bytes plus incremental recovery. Main/deployment lock remain unchanged. No hosted content write, publication/activation, migration, main merge or deployment.

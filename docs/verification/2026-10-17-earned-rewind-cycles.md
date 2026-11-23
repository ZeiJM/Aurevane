# Earned Rewind prime, return and counter cycles — October 17

This Task15 continuation connects the accepted Controlled Rewind definition to a real earned four-Skill build and battle startup. It adds20 integration cases without changing runtime, roster, prices, shared helpers, prior fixtures or presentation. It is not a live release. The original unfinished combat integration still precedes combat release; broader Master/world work follows that release.

## Restored source and actual scope

Workspace maintenance removed the previous local checkout. The saved source was recovered from the existing Git backup branch:47 imported bundles each matched retained metadata bytes/SHA256, prerequisites were resolved before import, and the final source0caefd0b0e0e2619b0784b8201a11cf3edf978d1/tree3a123057a997b47a8b25ee6840645ccbf43f9857 matched exactly. Two older unreferenced bundles were unnecessary and not imported. The latest evidence archive also matched its saved bytes/SHA256 before safe extraction. This is an actual cold source-chain recovery after pruning, stronger than the previous prerequisite-only restoration checks. Its exact inventory/order is retained in `2026-10-17-cold-source-restoration.json`.

The isolated continuation branch is agent/overhaul-resume-20261017. Frozen tested/reviewed source is1766e84e9eb20a1bb3ab8e6e58ce7e3aefb5d43a, based on0caefd0b. Pure Chronist replaces Temporal Ward with earned Rewind Step while retaining exactly four selected Skills and its separate Essence. Pure Vanguard opposes it. The cases cover Levels1/100 and PvE/PvP using seed1, actual local proposed publication, earned save/load, current and pinned authority, captured Rewind v6 and actual native startup. Learned/mastered facts are fixture inputs, not progression-award acceptance.

## Resulting acceptance

The authored Rewind v6 costs40AP/4MP with a three-owner-turn cooldown receipt. The real route walks from original turn originO(0,1) to prime tileA(1,1), primes free, then walks toB(2,1). These distinct positions catch a return incorrectly rebound to turn origin or release position. No stats, status, RNG, placement or resource state is patched.

| Cycle, four cases each | Actual outcome |
| --- | --- |
| Same-turn return | Two ordinary paid walking steps leave60AP/zero Movement. Free priming changes neither resources, tactical state, statuses nor paid usage. Release returns toA for40AP/4MP, leaving20AP and zero Movement. Actual return, payment, action and cooldown receipts occur once; the prime is consumed and cannot be reopened. |
| Wounded later return | A real opposing Basic causes positive HP damage with an exact action/source/target receipt. After the next turn begins atB, the actor pays to walk toC(3,1), then returns toA. HP stays damaged, MP falls by4, AP80→40 and remaining Movement1 is preserved. Current turn origin, turn number, round and facing are preserved. |
| Occupied then vacated anchor | The opponent pays40AP to walk two tiles ontoA and uses a real Basic. The actor’s release fromC rejects before payment without changing its serialized state or saved prime. On a later turn the opponent pays20AP to vacateA. The retained prime then releases legally for40AP/4MP and returns to the sameA. No fabricated refund or landing substitution. |
| Held prime | Eight deliberate native End Turns cross four rounds while retaining the exact private prime/admission and positionB. No automatic activation, mana payment, healing or arbitrary expiry occurs. A later legal paid release returnsA. These are ordinary completed turns, not idle timeouts. |
| Cancellation | Cancellation emits no action, return or payment, retains the position/resources and once-per-battle admission, removes the prime and prevents both reprime and release. |

Commit, prime, cancellation, walking and End Turn transitions check input immutability, prefer the actual returned stat bridge and validate JSON-restored states. The positive preparation call has no separate before/after purity snapshot; that is a deferred Minor. The negative occupied-release path brackets preparation and commit. Cooldown evidence checks the emitted receipt; an independent persisted clock read is the second new deferred Minor.

## Verification and evidence limits

The existing native Controlled Rewind baseline passes13 cases (`091910407736Z-30ef8b90`). Final covering Rewind/concealment/ranged suites pass65 cases in3 files (`092248715303Z-8cc11a62`); web types pass (`092249920108Z-0f29448e`). Exact frozen-source trace execution passes all20 new cases (`092340498247Z-3ec8256f`).

The20 unique scenario traces total4,393,088 bytes, SHA256e026dae9f834ce94d5f84d3e59d2cb6d531cc8f78807f13a054cd0a46f97d646. Independent audit checks the full20-cell cohort, captured v6 source, actual O/A/B/return positions, unchanged free-prime tactical state, one40AP/4MP release, final AP, admission, lifecycle and actual opposing-damage HP preservation. Traces contain native state snapshots and selected command events. End Turn results are restored and validated, but their events are not retained; this is not a complete event replay artifact.

Failed new-test assumptions remain in the raw evidence: `092038356871` used an incorrect committed-build field (`id` instead of `skillId`); `092106463835` froze the entire legacy current-turn action flag and expected an accuracy event from this Basic path; `092140018292` assumed that flag was always spent and mixed controller action ID with captured content ID; `092233032941` retained only the Basic action-ID mismatch. The correct damage receipt uses PV1F_BASIC_ATTACK_ID while its content provenance is unarmed.basic. Remaining-AP compatibility state legitimately varies, so assertions now check the actual Movement, turn-origin, round, turn number and facing contract. The initial typecheck (`092140533013`) caught unsafe access to an unknown native event; explicit narrowing fixes it. These were fixture/assertion corrections, not production defects or claimed product RED→GREEN fixes.

Exact-source full quality passes **9,017 Vitest plus7 Node checks**, formatting, lint, all eight package type checks and both builds. Initial root092427530730Z-4d7bbd44 exits0 with complete hashed package logs, but saved root stdout stops during tests with only three package counts. Its raw log and partial-evidence archive are preserved. ONE cached replay092943981622Z-4ed45460 exits0 with all seven root package counts, Node7/0fail, explicit `$ turbo run build` and a successful two-build tail. No source change or third replay. Final web count4635 plus core4136 and other246 totals9017. Turbo/Next telemetry is explicitly disabled; existing loader/DOM advisories remain unsuppressed. Node24.19.0/pnpm11.25.0 fallback match the prior environment; the repository declares11.17.0. Frozen dependency installation changed no lockfile. Initial offline installation lacked cached registry metadata; normal frozen installation completed without package edits.

Preservation is structural and hashed: before this report only the new test differs from base. Runtime, roster, helper and all prior fixtures are unchanged. Proposed manifest SHA256b86cfec056bbac582810e7da80f9bc687f02518892eb5d11275fc7b5ced19f05 and all six protected AI/native hashes match. No separate unchanged141 preview/284 Manual/294 reader/289 mirror diagnostic was repeated. The required normal full suite retains its own bounded roster cases; no new complete289-mirror or natural12round balance acceptance is claimed.

## Rulings and costs

1. Restore the verified source chain from Git after workspace pruning rather than recreate previous implementations. Reason: metadata and exact final tree establish the saved authority. Cost if wrong: a missing prerequisite would prevent recovery; all47 imported bundles and exact source/tree were verified before edits.
2. Add real earned-Rewind acceptance instead of rewriting an already-correct Controlled kernel. Reason: proposed v6 needed a distinct equipped setup/payoff/counter witness. Cost if wrong: this is no production bugfix or broad balance/lifecycle acceptance.
3. A tests-only integration expansion may pass existing correct behavior; do not invent product RED, alter mechanics or patch a fixture into success. Cost if wrong: no runtime regression-fix claim follows from passing new tests.
4. Eight deliberate native End Turns establish finite ordinary-round holding only. Reason: manual completion does not exercise idle-timeout/scheduler authority. Cost if wrong: true timeout behavior remains a separate gate.
5. Use exact source-diff and protected hash guards rather than repeat unchanged diagnostics. Reason: only a new test changes. Cost if wrong: broader presentation and all-roster acceptance are not expanded here.

## One combined review

Fresh read-only gpt-6-astra High review reports0Critical/0Important/2newMinor. Parent accepts the grades: no runtime defect is established. No repair wave and no rereview. Positive preparation purity and an independent persisted cooldown read are deferred under the approved policy;17 inherited findings remain,19 total. The reviewer inspected the whole372-line diff and relevant authority/helper/Controlled/landing/bridge/cooldown paths and ran diff hygiene. It did not duplicate the parent’s broad execution.

### Individual review scope rulings

| Behavior set aside | Parent ruling and reason | Cost if wrong |
| --- | --- | --- |
| Production bugfix correctness | Accept evidence expansion only; runtime is unchanged. | Tests could be misrepresented as fixing a live defect. |
| FullTask15/overhaul | Keep the remaining requirement map open. | Other unfinished integration could be overlooked. |
| Progression/mastery acquisition | Use seeded earned facts with real save/load/capture. | Actual acquisition remains unaccepted. |
| Hosted publication/transactions/permissions/CAS | Local repositories/publication only. | Hosted integrity or authorization failures remain possible. |
| Current hosted Owner content/later edits | Verify local proposed v6; preserve final reconciliation gate. | Hosted Owner edits could differ. |
| Browser/controller/AT/readers/Primed visuals | No presentation change or physical witness. | Usability, readability and interaction gaps remain. |
| Autonomous AI strategy | Explicitly select the opposing native Basic action. | Planner opportunity quality is not established. |
| Balance/seeds/mixed builds/human play | Keep one-seed pure endpoint witnesses bounded. | Other builds, distributions or human play can differ. |
| Terrain/elevation/Root/reactive interruption | Accept occupation only; existing kernel variants remain separate. | Another interruption or landing variant can fail. |
| Idle-timeout/scheduler | Manual End Turns are not scheduler input. | No-input service behavior remains open. |
| Unlimited holding duration | Four rounds prove finite retention. | Later-boundary failures remain untested. |
| Full cooldown advancement/expiry | Receipt checked; persisted read is explicitly MinorM19. | Stored clock regressions could escape these cases. |
| Defeat/terminal/source-removal/maintained ownership | No such transition is introduced here. | Those lifecycle guarantees require their own integration evidence. |
| Concurrent/stale/network/durable battle operations | Synchronous commands and JSON restoration only. | Service-level races or persistence defects remain possible. |
| Historical migration/old Rewind-origin fixtures | Leave existing versions and old fixtures unchanged. | Historical/hosted reconciliation remains open. |
| Complete event replay | Retain selected native events/states and disclose omitted EndTurn events. | Trace alone cannot reproduce every intervening event. |
|17 inherited Minors | Preserve their individual deferrals. | Known low-severity gaps remain. |
| Release/deployment/human acceptance | No release operation or readiness claim. | Passing local tests could be mistaken for live acceptance. |

### Deferred Minors

Inherited17: Rewind witness origin; Supporting Shot version pin; Ongoing pair dynamic identity pin; repeated bounded AI discovery; original admission double-prefix provenance; ranged direct negative-commit witness; independent Defense positive-HP reconciliation; exact Arsenal history labels/values; singular clock grammar; Burn tick wording; Master inline-reference sizing; cross-status actual-input immutability witness; legacy duplicate component keys; unknown-reference matching-text witness; Automatic local RNG display; Automatic owner-only copy bound; direct End Turn input-immutability witness in the prior concealment helper. This new helper checks End Turn input but does not modify or close that older fixture finding.

New18: positive preparation occurs before its own input snapshot. New19: restored cooldown state is not independently read after release. Both are assertion-strengthening findings with no observed current runtime defect; neither triggers incidental product changes.

## Still outstanding and checkpoint

Other distinct equipped cycles, complete roster AI/PvP/counterplay and natural full-match balance; original full battle/editor/equipped integration; native keyboard/touch/AT/mobile/zoom and Atlas motion; current Owner content/history/CAS/hosted reconciliation; combined final review, authorized publication/deployment and human acceptance remain open. Task15/16 are unfinished. The broader Master/world/Environment work and creative-library complexity labels remain after combat release. High remains sufficient.

Only this report follows the tested/reviewed source. Save and verify the exact bundle/evidence on the existing non-deploying source-backup branch, preserving its parent. Main and the Git deployment lock remain unchanged. No hosted write, publication/activation, migration application, main merge or deployment.

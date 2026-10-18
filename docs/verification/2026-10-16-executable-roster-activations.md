# Executable final-roster activation combinations

Status: focused implementation, combined review and final source gate complete for this bounded checkpoint. Local test evidence only, no roster activation or release. Base `ea04a581392e57b867c7f6fd2350072f030c4e7c`.

The new suite compares its executed case map with the accepted four selected activation/mode combinations. It pins the primary proposed record/version and asserts the actual captured first group's activation/mode before running each scenario through real preparation/commit, JSON restore and stat validation. The design's `automatic/modifier` remains explicitly unselected for the final roster; this does not mean the generic engine capability is removed or unsupported.

| Combination | Primary final witness | Actual outcome and counter/bound |
| --- | --- | --- |
| manual/action | vanguard.forceful-strike@6 | Actual hit removes28HP and spends45AP/0MP; one no-input round deals nothing; attempted replay rejects only its cooldown. |
| automatic/action | ironfist.counter-palm@5 | A real own physical Skill grants12Barrier and spends3MP without additionalAP; a second distinct physical command in that owner turn gives no additional Barrier/payment. Mystic action, insufficientMP and no-input round give none. An actual opponent physical Skill still damages the owner28HP without granting the owner's Barrier or spending itsMP. Direct explicit-group manual invocation rejects without an engine event. |
| manual/modifier | farstrider.keen-focus@5 | Actual Aimed Shot alone leaves974enemyHP,55AP/20MP; explicit attachment leaves971enemyHP,45AP/17MP. There is no independent modifier cast. On the next actual owner turn an available distinct Pinning Shot is legal alone; attachment rejects only the modifier cooldown. Omission charges no modifierMP. |
| ongoing/modifier | resonance.aetherist-ravager.linked-sequence@6 | At350/1000HP and20MP, actual Arc Bolt leaves973enemyHP,55AP/17MP;351HP,9MP or source removal gives ordinary975enemyHP. No separate cast exists; a no-input round spends noMP and deals no damage. |

Resource figures distinguish expenditure from remaining balances. Paired source/state fixtures are mechanical isolates, not granted unlocks or a claim that these particular mixed sources form a legal four-Skill build. Companion ability definitions are captured unchanged; primary versions are pinned. Source removal reconciles active eligibility rather than rewriting accepted or historical captures.

## Evidence

Inventory RED `072958304889` fails with all four selected combinations missing. The first scenario run `073055069933` exposed a test-admission mistake: selecting no behavior on an Automatic-only source fails action-group selection before reaching the event guard. The test now explicitly selects its real `counter-palm` group and reaches the intended `automatic-event-required` boundary. No production change was needed. Initial GREEN `073116660911`:5tests. Added genuine opposing-action ownership boundary; final covering GREEN `073309331986`:105tests/5files, including all existing41representative outcomes and executable effect/status/Requirement witnesses. Core types `073338985410`, scoped lint `073443891844` pass. Static source audit `073655408012` proves the20existing executable effect scenario/completeness bodies and entire original41outcome file remain byte-identical to `883b63a7`.

The earlier reviewed checkpoints separately cover19effect IDs,24authorable statuses plus system/historical exceptions, and8Requirement kinds. This checkpoint closes only the selected activation/mode executable inventory boundary. It does not turn four witnesses into proof for every record, interaction or equipped cycle.

## Remaining AI and release acceptance

Read-only tracing finds a specific next integration gap: `canonicalSkillCandidates` in `recruit-ai-build.ts` enumerates Manual/action roots; `RecruitAiIntent` in `recruit-ai.ts`, AI execution options and `battle-recruit-ai-service.ts` do not carry explicit Manual modifier references. The command engine's correct attachment execution does not establish that an AI can choose those attachments. Existing automatic/ongoing composition remains separate. Settle bounded candidate selection, cost/utility comparison, deterministic tie-breaking, exact Controlled bundle capture and authoritative intent propagation before claiming complete final-roster AI integration. This is a recorded missing acceptance path, not a runtime change or an assumption that every modifier should always be attached.

The existing Level100 twelve-round test uses current native resolved definitions for Vanguard/Aetherist; the older Phase4 analytical harness explicitly retains derived-statV3. Neither is a new receipt for the exact proposed294records. Required next evidence includes actual current-stat legal four-Skill class/pair/Essence cycles, real AI choices, Levels1/100 PvE/PvP and natural duel pacing, then fresh currentOwner/publication/timing/CAS reconciliation and the remaining native browser/reader/Atlas gates. No hosted write, merge or deployment occurs here.

## Single combined review

Reviewer `/root/activation_review`, gpt-6-astra High, reviewed exactly `ea04a581392e57b867c7f6fd2350072f030c4e7c..f72ea2f3b361f959f21613a63c21e3972e397058`:0Critical/0Important/1Minor. Read-only bounded approval, conditional on parent full gate; no reviewer suites duplicated and no rereview.

Deferred Minor M1: the Ongoing primary witness uses `pair('aetherist', 'ravager')` rather than a literal assertion for `resonance.aetherist-ravager.linked-sequence`. The current identity, version6 and outcomes are correct; a future same-version identity replacement could silently rebind the test and leave its report stale. Add the explicit stable-ID assertion during later test hardening. This remains Minor because no current runtime or evidence claim is wrong; do not expand the scoped fix pass to polish. The prior distinct-Rewind-anchor and companion-version Minors remain carried. No Critical/Important fix pass was required.

## Individually ruled review exclusions

These remain explicit parent obligations or bounded historical evidence, not silent waivers.

| Excluded behavior | Parent ruling/reason | Cost if incorrectly closed |
| --- | --- | --- |
| All294 record outcomes | Open; four mode witnesses are not individual coverage. | Broken abilities. |
| All17 class cycles | Open; no complete kits in this fixture. | Weak/unusable classes. |
| All136 pair cycles/uniqueness | Open; no full equipped comparisons. | Duplicate/unusable pairs. |
| All17 Essence cycles | Open; no Essence-cycle claim. | Unusable signature choices. |
| Legal earned four-Skill builds | Open; sources are mechanical isolates. | Eligibility/slot errors. |
| Level1/100 budgets/balance | Open; current legal-stat tests still required. | Power/resource imbalance. |
| Natural twelve-round pacing | Open; no scripted-finish proxy accepted. | Wrong combat duration. |
| Full PvE/PvP acceptance | Open; direct kernel is not full mode integration. | Mode-specific failures. |
| AI optional modifier selection/utility | Open; actual missing planning path recorded above. | AI ignores equipped choices. |
| AI Controlled attachments/server propagation | Open; preserve exact immutable bundle through authoritative intent. | Wrong/free/stale AI release. |
| Generic Automatic/modifier | Retained generic capability, deliberately unselected for this final roster. | Invented or removed capability. |
| Automatic reset on later owner turns | Dedicated existing lifetime tests retained; this case proves same-turn suppression only. | Permanently disabled/repeated reaction. |
| Terminal/simultaneous/replay reaction matrix | Existing runtime gates retained; two distinct commands are not exhaustive replay evidence. | Duplicate/late effects. |
| Free prime/interrupted Move | Existing Task2/3A/4/14–16 acceptance retained; unchanged implementation here. | Free attacks/unreached origin. |
| Prior effect/status/Requirement reviews | Retained reviewed checkpoints; inspect dependencies without restarting those reviews. | Lost prior regressions. |
| Prior2 deferred hardening findings | Carry explicitly; not resolved here. | Weaker future test detection. |
| Complete malformed/private-state matrix | Existing fail-closed/privacy gates retained; shared validation covers exercised states only. | Invalid state/private accuracy leaks. |
| Entire historical replacement matrix | Existing capture compatibility gates retained; no full replacement claim. | Historical battle drift. |
| Stale browser/alternate character/directRPC expiry/CAS | Task8/16 authoritative paths remain required. | Unauthorized stale mutation. |
| Concurrent publication/build/claim/recovery/settlement | Existing transaction/rollback/no-contest gates retained; no writes changed here. | Lost/duplicated state. |
| Owner edits/hosted timing/publication/Ground materialization | Open; no hosted write or full publication acceptance. | Overwrites/divergent clocks. |
| Picker/Automatic-only cockpit/conditional preview | Actual consumer acceptance remains open; kernel tests cannot prove usability. | Misleading or missing controls. |
| Editorial/derivedTags/all readers | Open full294-record audit; this report checks only its actual witnesses. | False player/Owner decisions. |
| Long names/history metadata/keys/touch/mobile/200%zoom | Open native/rendered acceptance. | Inaccessible controls/readers. |
| Atlas motion/hosted human acceptance | Separate inherited gates remain unresolved. | Bad real movement/experience. |
| Final repository/exact-head checks | Parent owns source gate below; no independent duplicate run required. | Untested source released. |
| Merge/activation/deploy/whole branch/Task15–16 closure | Not performed or authorized by this bounded review; release gates stay open. | Premature release. |

## Final source gate

Exact tested source `f72ea2f3b361f959f21613a63c21e3972e397058`, tree `e5c244ed9b0ffc47731e68f835576fae26f6838f`. Full `pnpm --reporter=append-only check` receipt `20261016T073535418800Z`,07:35:35–07:38:02UTC, exit0:7,758Vitest tests (4,083core/3,429web/246other) plus7Node checks, formatting/lint/all8package types,2successful build tasks (unchanged worker cached, fresh web production build completed with the full route summary). Preexisting Vite native-config advisory remains recorded rather than suppressed. No source edit followed this full gate; final descendant changes only this report.

Main remains `29506e293e81abef1b0b8a46099618ab3ae3f0ae`, an ancestor of this source; deployment lock remains false. A new exact incremental recovery bundle will require `ea04a581`, preserved by the preceding status/Requirement archive. Both ignored workspaces and their receipts/reviews are retained because Task15 remains open. Next integration is documented in the saved AI/cycle preflight; the source is not live and this checkpoint establishes no firm live ETA.

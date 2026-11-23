# Conditional Burn Ward and source-aware Taunt — verified development checkpoint

Shared compact-card inspection now describes Burn Ward's combined incoming-damage factor only **against burning opponents**, and Taunt's outgoing factor only **against targets other than the source**. Pending rows explicitly say **on activation**. The report retains the condition qualification and “Other damage modifiers still apply.” Burn Ward also retains its secondary rule: damage that bypasses incoming protection is unaffected. This does not claim every current Pierce action bypasses protection.

Ward combines recorded applications under its common Burn condition. Two default 20% reductions show 64% under current application stacking and 80% under historical whole-row rules; default then 30% shows 56% or 70%. Native damage is unchanged: without Burn the conditional kernel is 100%; with Burn the exact displayed factors apply, and actual 100-damage enemy attacks cause 64 or 80 HP damage under the respective rules.

Taunt combines current applications only when every application records the same known source. Two default 25% reductions show 56.25% current or 75% historical; default then 20% shows 60% or 80%. Current mixed sources show no invented combined rate; the explanation says combined damage depends on which source is attacked and retains the recorded per-application descriptions. Historical rules apply the root potency/latest native source once. Source identity is used internally for equality and is never printed as a raw caster ID. This is an isolated conditional effect fact, not a selected-target forecast, command-readiness claim or final HP prediction.

The combined review exposed one real shared-path defect: public pending Taunt rows have a root source but no applicationModifiers; the existing card grouper merged two sources and retained the first. That made a false common-source factor possible. The ONE Important repair preserves Taunt source distinctions in the shared grouping key, as the existing source-scoped Mark path already does. Separate pending casters now retain separate 75% rows; same-source pending casts still combine. No application set is reconstructed from lost data. On actual activation current sources yield 75% against either caster and 56.25% against a third target. Historical activation uses the latest caster, yielding 75% against the first and 100% against the latest.

## Scope and live consumers

Actual BattleCombatantCard consumers hardcode compact, across the shared playable PvE/PvP cockpit and spectator surface. Compact icons open the shared BattleEffectPopover/BattleEffectInformation report, which inherits these facts on both breakpoints. Source tracing found no production caller of the retained noncompact EffectModifiers branch; that unused branch is unchanged. Its individual-delta design is not a reason to add dead-path UI. If a future Master/other consumer mounts it, revisit its readouts then.

Four source/test files changed from BASE 92cdee2eb60a68db728666c956c8aa00f521934b; this report is a fifth, docs-only file. No native operator, policy, DTO, schema, validation, AI, manifest, command, control, CSS, artwork or geometry change. Grouping separates Taunt source conditions without exposing new public data. Unknown ID/version rules remain unavailable; positive Ward remains hidden from a spectator under actual Covert. Input state remains unchanged by reading.

## Verification and review

- Initially reviewed source: 7b6f813e03c4b946836c69a006a3354dc8ea8a0f. Final tested repaired source: 7262d0f0800da87914bcb8419bf2eda3ff30c3d1. Final report is a docs-only descendant.
- Initial RED 192519385233:16 valid missing conditional-row/qualification failures, three unknown/Covert guards passing. Native checks passed before reader failures. The old negative guard now rejects an exact unqualified label, preserving its intent while allowing explicit conditional labels. Existing 30 unconditional cases are retained.
- Initial 83 cases GREEN 192601771810. Two actual native protection-bypass cases then failed for the missing Ward secondary-rule note in RED 192643076992 before that note was added. Initial focused 995 tests / 87 files, native conditional 722/3 files, webtypes and zero-warning lint passed.
- Important repair RED193316620357: two valid distinct-source grouping failures; 23 cases already passed. GREEN193335309415:25/25. Four added cases run real pending casts, public spectator projection, actual live grouping, shared report/SSR, then actual native round activation and target comparisons; same-source current/historical aggregation also remains correct.
- Repaired focused **999 tests / 87 files GREEN 193349867191Z-e3d63ebd**; webtypes193349872727Z-6a8b9ada and zero-warning scopedlint193349862354Z-9b5c2c53 GREEN. **25 new cases overall** from the previous 8,608-case baseline.
- Final exact-source root: **8,633 Vitest plus seven Node checks**, formatting, lint, all workspace typechecks and both builds GREEN. Receipt 20261016T193500220138Z-78b64a70, 2026-10-16T19:35:00.220138+00:00 → 2026-10-16T19:38:54.880250+00:00. Package counts: realtime 3, audio 17, validation 106, db 118, worker 2, game-core 4136, web 4251. Complete root build tail/package-log hash audit preserved.
- Initial reviewed-source root192842001155 exited 0 with 8,629 + 7; its saved combined stdout omitted the final build-summary lines, and initial root/diagnostic timestamp collision interleaved their logs. Initial audit/package logs and raw data are preserved. Ignored evidence runner now adds a UUID suffix to prevent filename collisions. Repaired production source required the fresh final root above; the initial incomplete stdout is not used as final proof.
- All 294 named Skill reports and HTML strings remain exactly unchanged from the preceding recovery-rate checkpoint:294 records, 297 groups, 604 effects, observation SHA256 935d142977fea59f266c03a75931176df9939e2c22c434c77a5030b5f3c042e3. Repaired-source diagnostic193501475530Z-3007cba7 GREEN. Manifest and six AI/native source hashes remain unchanged. No fresh289-case gameplay matrix is claimed for this presentation-only work.

### Combined review outcome

One fresh combined review at7b6f813e03c4b946836c69a006a3354dc8ea8a0f: 0Critical,1Important(I1),0newMinor. Parent accepts I1 for player-visible target-dependent misinformation; ONE repair wave only and no rereview. Grouping retains source identity for Taunt. Four native regression cases cover current/historical different-source pending casts and same-source aggregation. RED193316620357: two expected grouping failures,23cases GREEN; GREEN193335309415:25cases including actual next-round activation and native target comparisons. Fifty-five declined behaviors each have an individual parent reason/cost in live-conditional-strength-review-rulings.md. Thirteen inherited Minors remain deferred; no incidental fixes. Final verification receipts appear above; durable backup is recorded separately.

Actual native casts/turns/kernel/commands, public spectator projection, shared grouping/report and SSR are exercised. Only the server-only import marker is mocked. Source parity and SSR do not establish mounted DOM, native mouse/touch/keyboard, AT, focus restoration, physical overflow/clipping or 200% zoom acceptance. No new browser installation/tunnel attempt was made.

## Remaining release work

The modular foundation already live, proposed Skill rebalance and original unfinished combat integration remain distinct. Original Targeting/Move/five editable Basics/Controlled, full controls/editors/readers/previews and native acceptance remain pre-release requirements. Whole-action readiness, public Manual rich references, historical Chronicle fallback and complete editor previews remain open. Other conditional/non-damage values require actual context and must not infer target/source/facing from an isolated status.

Full Task 15/16, natural roster cycles, twelve-round pacing/balance, current Owner edits, hosted authority/CAS, Atlas motion (.830568 versus < .75), human acceptance and final release gates remain open. Broader unrelated Master/Staff/Players/Events/Music/world work follows combat. No publication, activation, hosted migration, merge or deployment is performed. The deployment lock is retained. High remains sufficient for routine integration.

## Deferred Minors

Thirteen inherited items remain deferred: Rewind witness origin; Supporting Shot version pin; Ongoing-pair dynamic identity pin; repeated bounded AI discovery; admission double-prefix provenance; ranged negative direct-commit witness; independent defense-positive HP reconciliation; exact Arsenal historical values; singular status-clock grammar; Burn ordinary tick-boundary wording; Master inline reference-button sizing; cross-status input-immutability witness; legacy duplicate component keys. No new Minor was found and no incidental repair was made.

## Initial implementation decisions

1. Leave unused noncompact trigger summaries unchanged. Reason: all actual cards use compact icons/shared popups. Cost: that retained branch has no new combined readouts if mounted later.
2. Combine Ward under one Burn condition and Taunt only under one known source condition. Reason: one conditional aggregate requires every included application to qualify together. Cost: mixed-source Taunt retains per-application facts without a single aggregate.
3. Compare public recorded source identity internally without naming the caster. Reason: mechanics need equality while source naming requires a separate privacy-aware presentation contract. Cost: no full source-named target forecast.
4. Preserve Taunt source distinctions in grouping. Reason: pending rows have no captured application set to reconstruct. Cost: separate pending casters occupy separate existing rows, and future legacy duplicate-key mounted acceptance remains open.

## Every parent set-aside ruling

### Parent review rulings

I1 accepted as Important: the live compact-card path can present a false source-bound conditional rate before activation. Repair the grouping authority, retaining source IDs for challenged rows exactly as existing source-scoped Mark retains them. Do not synthesize application data. Reason: each pending source must retain its condition through projection → grouping → reader; actual native activation differs by target. Cost: different pending casters occupy separate existing rows; this avoids inventing a merged target forecast and does not display raw source IDs. Current/legacy and same-source preservation must pass actual native tests.

ONE Critical/Important repair wave only; no new reviewer or rereview. No new Minor. Thirteen inherited Minors remain deferred.

1. **Mounted mouse interaction** — Ruling/reason: Keep native gate open; no browser execution was permitted. Cost if wrong: Click/dismiss behavior remains physically unaccepted.

2. **Mounted touch interaction** — Ruling/reason: Keep device gate open; no touch/browser execution was permitted. Cost if wrong: Touch behavior remains physically unaccepted.

3. **Mounted keyboard navigation and focus restoration** — Ruling/reason: SSR/source tracing cannot establish mounted physical behavior. Cost if wrong: Keyboard/focus restoration remains unaccepted.

4. **Assistive-technology output** — Ruling/reason: No AT execution; plain accessible text coverage is narrower. Cost if wrong: Actual spoken output remains unaccepted.

5. **Long-report physical overflow** — Ruling/reason: SSR has no layout measurements. Cost if wrong: Long reports still need mounted overflow checks.

6. **Small-screen clipping and geometry** — Ruling/reason: No viewport execution. Cost if wrong: Small-screen layout remains unaccepted.

7. **200% zoom geometry** — Ruling/reason: No physical zoom execution. Cost if wrong: Zoom layout remains unaccepted.

8. **Popup/button CSS sizing** — Ruling/reason: CSS unchanged; no physical inspection. Cost if wrong: Sizing remains unaccepted.

9. **Inspection-backdrop dismissal behavior** — Ruling/reason: Interaction owner unchanged; this cohort changes values/grouping. Cost if wrong: Backdrop dismissal still needs native acceptance.

10. **Unused noncompact EffectModifiers trigger summaries** — Ruling/reason: Actual cards hardcode compact; no production caller was found. Cost if wrong: Retained unused branch gains no combined summary.

11. **Source-specific forecasts or caster naming** — Ruling/reason: Conditional facts use private source equality; naming needs its own privacy-aware contract. Cost if wrong: No full source-named target forecast is supplied.

12. **Other conditional modifier families** — Ruling/reason: Known Ward/Taunt scope is bounded; other conditions require their own real context. Cost if wrong: Other conditional readers remain unfinished.

13. **Whole-action readiness** — Ruling/reason: Effect helper does not own command legality or eligibility. Cost if wrong: Whole-action readiness remains unfinished.

14. **Legacy whole-attack global min/max** — Ruling/reason: Isolated effect factors cannot represent the whole attack budget. Cost if wrong: Combined attack forecast remains separate.

15. **Ordinary incoming-summary arithmetic** — Ruling/reason: Separate implementation unchanged; do not mix unrelated arithmetic repair. Cost if wrong: Existing incoming-summary behavior remains.

16. **Extreme native arithmetic capacity policy** — Ruling/reason: Preserve truthful bounded unavailable fallback; no numeric-policy redesign. Cost if wrong: Extreme nominal rates may be unavailable.

17. **Full malformed persisted-state validation** — Ruling/reason: Relevant capture constraints traced; no comprehensive parser audit. Cost if wrong: Malformed-state audit remains open.

18. **Full malformed pending-payload validation** — Ruling/reason: Projection traced; no comprehensive pending-schema audit. Cost if wrong: Malformed pending-state audit remains open.

19. **Summon serialization/validation** — Ruling/reason: Unchanged and unrelated to Ward/Taunt. Cost if wrong: Summon validation remains outside this checkpoint.

20. **Live expiry/revocation enforcement** — Ruling/reason: Authority unchanged; no hosted execution. Cost if wrong: Live authority acceptance remains open.

21. **Alternate selected-character enforcement** — Ruling/reason: Authority unchanged. Cost if wrong: Selected-character enforcement acceptance remains open.

22. **Direct RPC/CAS bypass resistance** — Ruling/reason: No hosted/RPC checks authorized here. Cost if wrong: Hosted bypass-resistance acceptance remains open.

23. **No-input/free-priming bounds** — Ruling/reason: Native command execution unchanged. Cost if wrong: Priming gameplay acceptance remains open.

24. **Duplicate payment behavior** — Ruling/reason: Payment authority unchanged. Cost if wrong: Payment acceptance remains open.

25. **Extra-turn behavior** — Ruling/reason: Turn authority unchanged. Cost if wrong: Extra-turn acceptance remains open.

26. **Interrupted Move reached-origin legality** — Ruling/reason: Movement execution unchanged; preserve original required integration. Cost if wrong: Movement acceptance remains open.

27. **Concurrent publication** — Ruling/reason: Transactions unchanged; no publication performed. Cost if wrong: Publication race acceptance remains open.

28. **Concurrent build and claim** — Ruling/reason: Transactions unchanged. Cost if wrong: Build/claim race acceptance remains open.

29. **Concurrent recovery and settlement** — Ruling/reason: Worker/settlement unchanged. Cost if wrong: Settlement race acceptance remains open.

30. **Manual/public authored-content completeness** — Ruling/reason: Separate content acceptance; not inferred from effect readers. Cost if wrong: Manual/public content remains unfinished.

31. **Historical Chronicle/modal redesign** — Ruling/reason: Historical reader owner unchanged. Cost if wrong: Chronicle integration remains unfinished.

32. **Rewind witness origin** — Ruling/reason: Keep inherited Minor deferred; unrelated fixture. Cost if wrong: Witness still starts at origin.

33. **Supporting Shot version pin** — Ruling/reason: Keep inherited Minor deferred; unrelated capture coverage. Cost if wrong: Explicit version witness remains absent.

34. **Ongoing-pair dynamic identity pin** — Ruling/reason: Keep inherited Minor deferred; unrelated identity witness. Cost if wrong: Dynamic identity witness remains incomplete.

35. **Repeated bounded AI discovery** — Ruling/reason: Keep inherited Minor deferred; AI unchanged. Cost if wrong: Redundant bounded discovery remains.

36. **Admission double-prefix provenance** — Ruling/reason: Keep inherited Minor deferred; wording unchanged. Cost if wrong: Duplicate-prefix wording remains.

37. **Ranged negative direct-commit witness** — Ruling/reason: Keep inherited Minor deferred; native preparation/commit unchanged. Cost if wrong: Negative witness remains preparation-only.

38. **Independent defense-positive HP reconciliation** — Ruling/reason: Keep inherited Minor deferred; event witness unchanged. Cost if wrong: Events lack independent HP reconciliation.

39. **Exact Arsenal historical values** — Ruling/reason: Keep inherited Minor deferred; history unchanged. Cost if wrong: Exact historical values/labels remain incompletely pinned.

40. **Singular status-clock grammar** — Ruling/reason: Keep inherited Minor deferred; no incidental editorial repair. Cost if wrong: Grammar defect remains.

41. **Burn ordinary tick-boundary wording** — Ruling/reason: Keep inherited Minor deferred; ordinary Burn unchanged. Cost if wrong: Boundary wording remains imprecise.

42. **Master inline reference-button sizing** — Ruling/reason: Keep inherited Minor deferred; different surface. Cost if wrong: Master geometry remains unaccepted.

43. **Cross-status direct-input immutability witness** — Ruling/reason: Keep inherited Minor deferred; separate cohort. Cost if wrong: That witness remains weaker.

44. **Legacy duplicate component keys** — Ruling/reason: Keep inherited Minor deferred; no demonstrated mounted failure; source separation fixes the reviewed Taunt loss only. Cost if wrong: Legacy expiry/replacement state reuse still needs mounted acceptance.

45. **Complete original combat/editor/control integration** — Ruling/reason: This bounded reader cohort cannot establish full integration. Cost if wrong: Original pre-release work remains unfinished.

46. **Full roster natural combat cycles** — Ruling/reason: Representative native fixtures are not exhaustive cycles. Cost if wrong: Full natural cycles remain unaccepted.

47. **Whole-roster balance and twelve-round pacing** — Ruling/reason: No balance evaluation in a reader cohort. Cost if wrong: Balance/pacing remains unaccepted.

48. **Full Task15 acceptance** — Ruling/reason: Bounded implementation is part of the larger task. Cost if wrong: Task15 remains unfinished.

49. **Full Task16 acceptance** — Ruling/reason: Final integrated gate not performed. Cost if wrong: Task16 remains unfinished.

50. **Current Owner-hosted content acceptance** — Ruling/reason: No hosted access or changes. Cost if wrong: Current Owner edits remain to reconcile.

51. **Atlas motion acceptance** — Ruling/reason: No animation/runtime inspection; existing .830568 versus <.75 gap remains. Cost if wrong: Atlas motion remains unaccepted.

52. **Human gameplay acceptance** — Ruling/reason: Source/fixtures cannot establish human acceptance. Cost if wrong: Human acceptance remains open.

53. **Publication/activation/migration readiness** — Ruling/reason: No operational review/authorization in this checkpoint. Cost if wrong: No publication, activation or hosted migration is authorized.

54. **Merge/deployment/release readiness** — Ruling/reason: Keep final integration/release gates open. Cost if wrong: Combat overhaul remains unreleased.

55. **Independent reviewer test-total verification** — Ruling/reason: Reviewer was prohibited from executing tests; parent must verify receipts directly. Cost if wrong: Totals depend on parent-run evidence, not independent rerun.

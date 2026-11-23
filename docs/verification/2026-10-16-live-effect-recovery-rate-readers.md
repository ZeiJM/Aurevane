# Healing Down combined recovery rates — verified development checkpoint

The shared live-effect reader now shows Healing Down's combined HP and MP recovery rates from its recorded applications. Values explicitly say **before rounding**, because native recovery rounds down after each applied modifier and caps restoration by missing resources. Two25% modifiers show56.25% before rounding; an actual9-point recovery restores4, rather than a nominal5.0625. Default then20% shows60% under current application stacking and80% under historical whole-row rules.

The captured recovery policy is independent of stacking policy. Current recovery rules apply Healing Down to HP, MP and Absorb. Historical rules leave MP recovery and Absorb unchanged; the reader explicitly retains that exception and shows MP100%. Previously captured percentage recovery keeps its recorded amount despite later status changes. Actual future ticks after cleansing and replacing Healing Down verify the existing captured56HP/MP (or100legacyMP), without recalculation or a second reduction.

Exact nominal rates use the existing shared BigInt ratio utilities. The damage helper now imports the same extracted functions with no arithmetic changes. Rates requiring more than two decimal places carry an approximation marker: two33.33% reductions show≈44.45% before rounding, while native10,000-point recovery is4444 after per-modifier truncation. A positive rate below displayed precision is never called zero. Extreme nominal precision beyond the shared65,536-bit capacity is unavailable, even when native integer recovery has already reached zero; the reader does not invent an exact nominal value or run an unbounded calculation.

The existing gold/orange summary rows and accessible report share the same HP/MP facts and qualifications. Pending rows say on activation. Exact known ID/version checks retain unavailable rules for unsupported captures. Covert retains its existing polarity rule: positive Damage Up is hidden from a spectator, while negative Healing Down remains public. No new public metadata, native operator, validation, persistence, schema, command, AI, manifest, control, CSS, artwork or geometry change.

## Verification and review

- BASEb4e3e537d01817b78e75ecb6810500009e8a3120 → initial reviewed `df53d50ba49ea70094fceb7945927018d9a031fb` → final tested `df53d50ba49ea70094fceb7945927018d9a031fb`. Five initial web source/test files; **34new cases overall**. The final report is a docs-only descendant of tested production source.
- Initial190903562217 had32 valid missing-rate/qualification failures, one incorrect Covert fixture expectation and one unsupported-version guard passing. The unchanged production filter intentionally retains negative debuffs under Covert. The corrected fixture checks positive Damage Up hidden and Healing Down visible with its rate. Corrected190949897695:33 valid missing-fact RED plus one guard GREEN. No privacy behavior was changed to fit a test.
- First implementation191017896193 passes64tests in two files:34new recovery-rate cases plus all30 previous damage-strength cases after extracting their arithmetic unchanged. Final initial focused **974tests/86files GREEN191122445549**, native Recovery/percentage/Absorb **125tests/5files GREEN191122446669**, web types191122448673 GREEN and zero-warning scoped lint191122445251 GREEN. Exact body and accessible HP/MP values, approximation/precision, pending, unknown rules, input immutability, capture freeze and Covert are covered.
- Native command cases cover flat HP/MP rounding across the full stacking/recovery-policy cross-product; actualMPDrain remains unmodified; actual restoration is capped by missingHP/MP. A real100damage command under25%Absorb and two25%HealingDown modifiers recovers13HP/MP under current recovery policy and25 under historical policy, matching the reader's explicit exception.
- Final exact-source full check: **8,608Vitest plus seven Node checks**, formatting, lint, all workspace typechecks and both builds GREEN. Receipt `20261016T191706229103Z`, 2026-10-16T19:17:06.229103+00:00 → 2026-10-16T19:17:37.031997+00:00. Package counts: worker 2, game-core 4136, db 118, audio 17, validation 106, realtime 3, web 4226. Complete final root build tail and package-log hash audit preserved. The initial fresh root191248136192 exited0 with all test counts and complete web package build log, but its combined saved stdout omitted the final build-summary lines. Initial audit/package logs are preserved; ONE cached root replay supplies this complete final receipt. No production source changed between them.
- All294 named Skill reports and HTML strings remain exactly unchanged from the preceding damage-strength checkpoint:294records,297groups,604effects; raw observation SHA256 `84defd352e91da4396a97663c24d346e553524fa5b7b6f8ce8ed4a2207c5f95c`. Manifest and six AI/native source hashes are unchanged. No new289-case gameplay matrix is claimed for this presentation-only cohort.

## Combined review disposition

One fresh read-only combined review finds **0Critical,0Important,0newMinor**. Parent accepts the assessment against actual native semantics and public/shared consumers. No repair wave or rereview. The extreme nominal-rate precision fallback is an explicit truthful limitation. Thirteen inherited Minors stay deferred. All52 separately declined behaviors receive individual parent reason/cost rulings below.

The new tests execute real native casts, turns, public spectator projection, shared report and actual SSR body. Only the server-only import marker is mocked. Source parity and SSR are not mounted DOM, native browser, assistive-technology or physical geometry acceptance. Both breakpoints and shared PvE/PvP/spectator readers inherit the same facts; native acceptance remains required.

## Remaining release work

The modular foundation already live, proposed Skill rebalance and original unfinished combat integration remain distinct. Original Targeting/Move/five editable Basics/Controlled, complete controls/editors/readers/previews and native acceptance remain pre-release requirements. Other non-damage/conditional strength and whole-action readiness, noncompact trigger summaries, historical Chronicle and public Manual references remain open. Full roster cycles, natural pacing/twelve-round balance, current Owner edits, hosted authority/CAS, Atlas motion and human acceptance remain open. Broader unrelated Master/Staff/Players/Events/Music/world work follows combat.

No publication, activation, hosted migration, merge or deployment is made here. High remains sufficient for routine integration. The provisional16–30activehours/roughly2–4fullworkingdays is an uncertain working estimate, not a calendar launch promise or a mechanically reduced count.

## Deferred Minors

Thirteen inherited items remain deferred: Rewind witness origin; Supporting Shot version pin; Ongoing pair dynamic identity pin; repeated bounded AI discovery; admission double-prefix provenance; ranged negative direct-commit witness; independent defense-positive HP reconciliation; exact Arsenal history values; singular status-clock grammar; Burn ordinary tick-boundary wording; Master inline reference-button sizing; cross-status input-immutability witness; legacy duplicate component keys. Any new reviewed Minor is listed in the review outcome above.

## Initial implementation decisions

1. Show nominal combined rate before integer rounding, with actual caps and frozen-capture qualifications. Reason: a rate alone cannot represent per-step truncation or missing resources. Cost if wrong: actual captures/outcomes remain necessary for exactHP/MP.
2. Keep recovery policy independent of stacking policy. Reason: native MP and Absorb paths check their own captured flag. Cost if wrong: cross-product coverage is required to prevent historical changes.
3. Extract and reuse the existing web ratio and percentage functions. Reason: damage and recovery nominal rates should not duplicate exact arithmetic. Cost if wrong: old30damage cases and full-root checks must guard the refactor.
4. Bound nominal exact precision and show unavailable at the existing shared capacity. Reason: native integer recovery can stop at zero while a positive formal fraction requires arbitrarily large precision. Cost if wrong: extreme valid nominal rates may be unavailable even when actual recovery is zero; no invented zero nominal value is shown.

## Every parent set-aside ruling

1. Final: Ruling: Final HP/MP forecasts — Keep nominal rates with rounding/cap/capture qualifications; final state is absent. Cost if wrong: Exact restoration still needs actual capture/outcome.

2. Final: Ruling: Conditional opponent/source/facing/HP damage — Leave unchanged context-aware damage integration for later. Cost if wrong: Conditional combined magnitude remains open.

3. Final: Ruling: Other non-damage strength — Keep separate from Healing Down. Cost if wrong: Other categories remain unfinished.

4. Final: Ruling: Controlled readiness — Keep captured action-state ownership. Cost if wrong: Controlled readiness acceptance remains open.

5. Final: Ruling: Other whole-action readiness — Keep separate state-aware integration. Cost if wrong: Other readiness remains open.

6. Final: Ruling: Noncompact EffectModifiers triggers — Retain unchanged individual deltas; popup/report only here. Cost if wrong: Trigger summary audit remains open.

7. Final: Ruling: Manual/authored-content acceptance — Keep separate public content reader gate. Cost if wrong: No full Manual/content acceptance.

8. Final: Ruling: Historical Chronicle/modal redesign — Keep unchanged historical fallback for later integration. Cost if wrong: Historical readers remain unfinished.

9. Final: Ruling: Ordinary incoming-damage summary arithmetic — Keep unchanged summary; extracted ratio module is separate. Cost if wrong: No fresh ordinary-summary arithmetic audit.

10. Final: Ruling: Legacy global damage budget — Do not infer a global clamp from an isolated rate. Cost if wrong: Full legacy damage-budget presentation remains open.

11. Final: Ruling: Mounted mouse — Leave native acceptance open; no browser session. Cost if wrong: Mouse behavior unverified.

12. Final: Ruling: Mounted touch — Leave native acceptance open; no browser session. Cost if wrong: Touch behavior unverified.

13. Final: Ruling: Mounted keyboard/focus — Source parity and SSR are insufficient. Cost if wrong: Native keyboard/focus acceptance remains open.

14. Final: Ruling: Assistive technology — Keep shared strings without claiming actual AT execution. Cost if wrong: AT output remains unverified.

15. Final: Ruling: Long-report layout — Reuse existing layout with physical gate open. Cost if wrong: Added text may expose overflow.

16. Final: Ruling: Small-screen geometry — No mounted viewport evidence closes this gate. Cost if wrong: Small-screen clipping remains unverified.

17. Final: Ruling: 200%zoom geometry — No physical zoom evidence closes this gate. Cost if wrong: Zoom clipping remains unverified.

18. Final: Ruling: Button/popup CSS sizing — No geometry changes or physical evidence. Cost if wrong: Physical sizing remains unverified.

19. Final: Ruling: Inspection backdrop dismissal — Retain unchanged outside-click ownership. Cost if wrong: Outside inspection still closes the whole inspection.

20. Final: Ruling: Whole malformed persisted validation — Keep parser authority; relevant constraints traced only. Cost if wrong: Whole-parser audit remains open.

21. Final: Ruling: Whole malformed pending validation — Keep pending parser authority; relevant projection traced. Cost if wrong: Full pending malformed-state acceptance remains open.

22. Final: Ruling: Whole summon validation — Summon behavior unchanged and separate. Cost if wrong: No fresh summon-parser audit.

23. Final: Ruling: Live expiry/revocation — Keep unchanged authority under Task8/16 gate. Cost if wrong: Hosted expiry/revocation acceptance required.

24. Final: Ruling: Alternate selected-character authority — Keep unchanged selected-character enforcement gate. Cost if wrong: No fresh alternate-character authority evidence.

25. Final: Ruling: Direct RPC/CAS bypass — Keep unchanged hosted authority gate. Cost if wrong: Hosted direct-RPC/CAS verification remains required.

26. Final: Ruling: No-input bounded gameplay — Execution unchanged; keep gameplay gate. Cost if wrong: No fresh complete no-input acceptance.

27. Final: Ruling: Duplicate payment/extra turns — Native payment/turn authority unchanged. Cost if wrong: Fresh complete payment/turn acceptance remains open.

28. Final: Ruling: Interrupted Move origins — Movement execution unchanged. Cost if wrong: Reached-origin gameplay acceptance remains open.

29. Final: Ruling: Publication/build/claim concurrency — Transactions/workers unchanged. Cost if wrong: Hosted concurrent operations remain unaccepted.

30. Final: Ruling: Recovery/settlement concurrency — Settlement authority unchanged. Cost if wrong: Reader tests do not establish concurrency safety.

31. Final: Ruling: Rewind witness origin — Keep inherited Minor deferred; unrelated test. Cost if wrong: Witness still starts at origin.

32. Final: Ruling: Supporting Shot version pin — Keep inherited Minor deferred; capture test unchanged. Cost if wrong: Exact version coverage remains incomplete.

33. Final: Ruling: Ongoing pair dynamic identity pin — Keep inherited Minor deferred; identity test unchanged. Cost if wrong: Identity witness remains weaker.

34. Final: Ruling: Repeated bounded AI discovery — Keep inherited Minor deferred; AI unchanged. Cost if wrong: Redundant bounded discovery remains.

35. Final: Ruling: Admission double-prefix provenance — Keep inherited Minor deferred; admission wording unchanged. Cost if wrong: Duplicate prefix wording remains.

36. Final: Ruling: Ranged negative preparation/direct-commit witness — Keep inherited Minor deferred; no native change. Cost if wrong: Negative witness remains preparation-only.

37. Final: Ruling: Defense-positive HP reconciliation — Keep inherited Minor deferred; event test unchanged. Cost if wrong: Events lack independent HP reconciliation.

38. Final: Ruling: Exact Arsenal history values — Keep inherited Minor deferred; history unchanged. Cost if wrong: Exact historical value/label coverage incomplete.

39. Final: Ruling: Singular status-clock grammar — Keep inherited Minor deferred; no incidental editorial repair. Cost if wrong: Grammar defect remains.

40. Final: Ruling: Burn ordinary tick-boundary wording — Keep inherited Minor deferred; Burn unchanged. Cost if wrong: Burn boundary wording remains imprecise.

41. Final: Ruling: Master reference-button sizing — Keep inherited Minor deferred; different UI owner. Cost if wrong: Master inline geometry remains unverified.

42. Final: Ruling: Cross-status input-immutability witness — Keep inherited Minor deferred; separate cohort. Cost if wrong: Its direct-input witness remains weaker.

43. Final: Ruling: Legacy duplicate component keys — Keep inherited Minor deferred: no new status rows or demonstrated mounted failure. Cost if wrong: Expiry/replacement may misassociate popup state.

44. Final: Ruling: Whole-roster balance — Keep separate balance gate. Cost if wrong: Roster balance remains unaccepted.

45. Final: Ruling: Full natural combat cycles — Representative native fixtures cannot establish exhaustive cycles. Cost if wrong: Natural/full-cycle acceptance remains open.

46. Final: Ruling: Original combat/editor/control completion — A bounded reader does not complete those systems. Cost if wrong: Original combat integration remains unfinished.

47. Final: Ruling: Full Task15/16 — Keep whole-task acceptance separate. Cost if wrong: Task15/16 remain unfinished.

48. Final: Ruling: Owner-hosted acceptance — No hosted execution establishes acceptance. Cost if wrong: Hosted gate remains open.

49. Final: Ruling: Atlas motion/acceptance — Unchanged and outside reader checks. Cost if wrong: Atlas gate remains open.

50. Final: Ruling: Human gameplay acceptance — Source review and fixtures cannot establish human acceptance. Cost if wrong: Human gate remains open.

51. Final: Ruling: Publication/activation/migration readiness — Review supplies no operational approval. Cost if wrong: No content activation or hosted migration is authorized here.

52. Final: Ruling: Merge/deployment/release readiness — Keep final integration and release gates open. Cost if wrong: Combat update remains unreleased.

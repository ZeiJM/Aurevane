# Captured combined damage multipliers — verified development checkpoint

The shared live-effect reader now shows the combined damage multiplier for Damage Up, Suppress, Reckless and Fortified. Reckless and Fortified show incoming and outgoing values separately. Values use the existing gold/orange summary rows and equivalent accessible descriptions. Current encounters retain each recorded application/default magnitude; historical encounters apply their recorded row once. Pending values explicitly say on activation. These are multipliers from this effect; other damage modifiers and combat rules still apply, so the reader does not claim final HP damage.

Damage Up follows native integer flooring after each application. Reckless and Fortified follow native exact-ratio composition with the final basis-point rounding. A three-application1.99% case yields106.07% for Damage Up and106.08% for Reckless, matching their different operators. Suppress uses its strongest recorded percentage once, including a genuine0% outgoing multiplier at full suppression. Default then20% Damage Up shows132% under current application stacking and120% under historical whole-row rules. Two default Reckless applications show196% outgoing/156.25% incoming; two default Fortified applications show64% outgoing/49% incoming.

Unsafe or unsupported exact totals are unavailable without crashing the reader. Integer formatting preserves hundredths without floating-point percentage drift. Current minimum authored/persisted potency is100basispoints; native safe-total overflow occurs before the defensive16,384-step Damage Up rendering limit. Exact-ratio arithmetic uses the native65,536-bit capacity ceiling and bounded exponentiation. Native execution and validation are unchanged.

Condition-dependent damage, Healing Down/recovery rates, other non-damage strength and whole-action readiness remain separate work. The reader does not invent missing attacker/recipient/source/facing context. Existing per-application descriptions, lifetime, unknown-version behavior and Covert privacy remain shared. No projection, persistence, schema, native operator, command, control, AI, manifest, CSS, artwork or geometry file changes.

## Verification and review

- BASE505b00cc253fdeeff966edffd152b7b19750cb84 → initial reviewed `2fdb2f36d9e2dc97dfce177075f91c1c7e056223` → final tested `2fdb2f36d9e2dc97dfce177075f91c1c7e056223`. Three initial web source/test files; **30 new cases overall**. The report is a docs-only descendant of tested production source.
- TDD184715734384 failed before tests because combat-suppress is not a package subpath export; the test now imports that native source directly without changing exports.184732890331 had19 valid missing-row failures, two invalid multiple-application Suppress fixtures and six guards passing. Corrected184815374988 had21 valid missing-row failures and six guards passing; initial implementation184841655477 passed27cases.
- A zero assertion was strengthened to inspect the actual summary row rather than matching0% inside100% dictionary prose. Added an actual native100-damage attack after120% Damage Up and60% Suppress, which deals72HP, plus large-count/capacity cases. Temporarily removing only the new reader integration produced184922453937:23 valid missing-row failures, two invalid potency1 fixtures and five passing guards. Authored and persisted potency minimum is100basispoints, so the fixtures were corrected.185012292738 then reproduced both corrected large cases as missing-row RED. The earlier ruling about discarding a valid low-potency total was explicitly withdrawn; such potency is invalid.
- Restored185026002871 had29 cases pass and one test-only row-order assertion fail; focused185035335286 had939 pass/one same assertion fail. Fortified's native definition orders incoming before outgoing; the test now checks both directions without an invented ordering requirement. No production ordering change was made. Final initial focused **940tests/85files GREEN185101256902**; web types185035334144 and zero-warning lint185035334221 GREEN. Core58/2 GREEN185101777557; the third requested conditional-modifiers filename does not exist and is not counted. Actual native conditional suites **722tests/3files GREEN185155843703**.
- Final exact-source full check: **8,574Vitest plus seven Node checks**, formatting, lint, all workspace typechecks and both builds GREEN. Receipt `20261016T185155842818Z`, 2026-10-16T18:51:55.842818+00:00 → 2026-10-16T18:55:45.898170+00:00. Package counts: worker 2, audio 17, validation 106, realtime 3, db 118, game-core 4136, web 4192. Complete root build tail and package-log hash audit preserved.
- All294 named Skill reports and HTML strings remain exactly unchanged against the preceding amount-reader checkpoint:294records,297groups,604effects; observation SHA256 `8ed95936c035ece0fae96fba4d104696ece0cfd07b94dc87e3db3979c22345d0`. Manifest and six AI/native source hashes unchanged. No fresh289-case gameplay-matrix claim for this presentation-only change.

## Combined review disposition

One fresh combined read-only review finds **0Critical,0Important,0newMinor**. Parent accepts the assessment after tracing the reported native rules and public/shared consumers. No repair wave is needed; no rereview. Thirteen inherited Minors remain deferred. All39 individually declined behaviors receive the reason/cost rulings below.

Tests use real native casts, conditional kernels, actual public spectator projection and the real shared report/SSR body, with only the server-only import marker mocked. They check current/legacy captured defaults and mixed strengths, native rounding, pending labels, zero, unsafe totals, source input immutability, conditions/unknown versions, Covert, and an actual direct-damage outcome. SSR and source parity are not mounted DOM, native browser, assistive-technology or physical geometry acceptance. Both desktop/mobile PvE/PvP/spectators inherit the existing shared reader path; their native acceptance remains open.

## Remaining release work

The modular foundation already live, proposed rebalance and original unfinished combat integration remain distinct. Original Targeting/Move/five editable Basics/Controlled, complete controls/editors/readers/previews and native acceptance remain pre-release requirements. Further strength categories, conditional/readiness context, historical Chronicle, public Manual references, full roster cycles, natural pacing/twelve-round balance, current Owner edits, hosted authority/CAS, Atlas motion and human acceptance remain open. Broader unrelated Master/Staff/Players/Events/Music/world work follows combat.

No publication, activation, hosted migration, merge or deployment is made here. High remains sufficient for routine integration. The provisional16–30activehours/roughly2–4fullworkingdays is an uncertain working estimate, not a calendar launch promise or mechanically reduced count.

## Deferred Minors

Thirteen inherited items remain deferred: Rewind witness origin; Supporting Shot version pin; Ongoing pair dynamic identity pin; repeated bounded AI discovery; admission double-prefix provenance; ranged negative direct-commit witness; independent defense-positive HP reconciliation; exact Arsenal history values; singular status-clock grammar; Burn ordinary tick-boundary wording; Master inline reference-button sizing; cross-status input immutability witness; legacy duplicate component keys. Any new reviewed Minor is listed in the review outcome above.

## Initial implementation decisions

1. Scope multipliers to this effect, preserving conditional/full-damage context for separate work. Reason: isolated public rows lack actual attacker/recipient/other modifiers. Cost if wrong: a per-effect reader cannot replace the full damage forecast.
2. Preserve native per-application flooring for Damage Up and exact-ratio arithmetic for always modifiers. Reason: these operators differ. Cost if wrong: kernel comparisons and native final-damage tests remain necessary.
3. Historical rows apply once; Suppress never multiplies by stacks. Reason: captured native policies govern strength. Cost if wrong: visible counts do not independently establish multiplier count.
4. Defensive rendering limits show unavailable rather than freeze or pretend zero. The initial low-potency computable-total concern was withdrawn after inspecting both validation boundaries. Cost if wrong: malformed/unsupported arithmetic remains unavailable rather than receiving invented values.

## Every parent set-aside ruling

1. Final: Ruling: Final actor/recipient HP forecast — Retain per-effect multipliers because other modifiers and combat state are absent. Cost if wrong: These rows do not establish final HP.

2. Final: Ruling: Conditional opponent/source/facing/HP damage — Leave unchanged conditions for their own context-aware integration. Cost if wrong: Conditional combined magnitude remains open.

3. Final: Ruling: Legacy global damage-budget presentation — Do not attribute a global clamp to one effect; isolated supported legacy values stay within it. Cost if wrong: Per-effect rows are not the complete legacy damage budget.

4. Final: Ruling: Other non-damage strength — Keep separate from the four selected damage effects. Cost if wrong: Other category readers remain incomplete.

5. Final: Ruling: Controlled and other readiness — Keep action-state ownership and separate integration. Cost if wrong: Readiness acceptance remains open.

6. Final: Ruling: Noncompact EffectModifiers trigger summaries — Retain existing individual deltas; this cohort changes popup/report strength. Cost if wrong: Trigger summaries are not fully audited or combined.

7. Final: Ruling: Manual/authored-content reader acceptance — Leave separate public Manual/content gate. Cost if wrong: No full content-reader acceptance.

8. Final: Ruling: Historical Chronicle/modal redesign — Keep unchanged historical fallback for later work. Cost if wrong: Historical readers remain unfinished.

9. Final: Ruling: Existing ordinary incoming-damage summary arithmetic — Keep unchanged helper; new arithmetic is limited to its applicable native operators. Cost if wrong: This cohort does not reverify all ordinary summary rounding.

10. Final: Ruling: Mounted mouse — Leave native acceptance open; no browser execution. Cost if wrong: Mouse interaction remains unverified.

11. Final: Ruling: Mounted touch — Leave native acceptance open; no browser execution. Cost if wrong: Touch interaction remains unverified.

12. Final: Ruling: Mounted keyboard/focus — Source parity is insufficient for physical acceptance. Cost if wrong: Keyboard/focus acceptance remains open.

13. Final: Ruling: Assistive technology — Keep shared accessible strings without claiming actual AT execution. Cost if wrong: AT output remains unverified.

14. Final: Ruling: Long reports/small screens/200%zoom — Keep existing layout and physical acceptance gate. Cost if wrong: Added content may expose clipping/overflow.

15. Final: Ruling: Button/popup CSS geometry — No geometry changed; no physical evidence to close gate. Cost if wrong: Physical sizing remains unverified.

16. Final: Ruling: Inspection backdrop dismissal — Keep existing outside-click ownership. Cost if wrong: Outside inspection still closes the whole inspection.

17. Final: Ruling: Whole persisted/pending/summon malformed-data validation — Keep parser authority; relevant constraints traced, not whole parser. Cost if wrong: Broader parser audit remains open.

18. Final: Ruling: Expiry/revocation/character authority/CAS/direct RPC — Keep separate Task8/16 gate; authority unchanged. Cost if wrong: Hosted security acceptance remains required.

19. Final: Ruling: No input/duplicate payment/extra turns/interrupted Move origins — Native execution unchanged; keep gameplay gate. Cost if wrong: Fresh gameplay acceptance remains required.

20. Final: Ruling: Publication/build/claim/recovery/settlement concurrency — Transactions and workers unchanged. Cost if wrong: Hosted concurrency acceptance remains required.

21. Final: Ruling: Rewind witness origin — Keep inherited Minor deferred; unrelated witness. Cost if wrong: Witness still starts at origin.

22. Final: Ruling: Supporting Shot version pin — Keep inherited Minor deferred; unrelated capture test. Cost if wrong: Exact version coverage remains incomplete.

23. Final: Ruling: Ongoing pair dynamic identity pin — Keep inherited Minor deferred; unrelated test. Cost if wrong: Identity witness remains weaker.

24. Final: Ruling: Repeated bounded AI discovery — Keep inherited Minor deferred; AI unchanged. Cost if wrong: Redundant bounded discovery remains.

25. Final: Ruling: Admission double-prefix provenance — Keep inherited Minor deferred; admission unchanged. Cost if wrong: Duplicate prefix wording remains.

26. Final: Ruling: Ranged negative preparation/direct-commit witness — Keep inherited Minor deferred; no relevant execution change. Cost if wrong: Negative witness remains preparation-only.

27. Final: Ruling: Defense-positive HP reconciliation — Keep inherited Minor deferred; unrelated event test. Cost if wrong: Events lack independent HP reconciliation.

28. Final: Ruling: Exact Arsenal history values — Keep inherited Minor deferred; history unchanged. Cost if wrong: Exact history value/label coverage incomplete.

29. Final: Ruling: Singular status-clock grammar — Keep inherited Minor deferred; unrelated wording. Cost if wrong: Grammar defect remains.

30. Final: Ruling: Burn ordinary tick-boundary wording — Keep inherited Minor deferred; Burn unchanged. Cost if wrong: Burn boundary wording remains imprecise.

31. Final: Ruling: Master reference-button sizing — Keep inherited Minor deferred; different UI owner. Cost if wrong: Master inline geometry remains unverified.

32. Final: Ruling: Cross-status input-immutability witness — Keep inherited Minor deferred; different cohort. Cost if wrong: That direct-input witness remains weaker.

33. Final: Ruling: Legacy duplicate component keys — Keep inherited Minor deferred: no new status rows or demonstrated mounted failure. Cost if wrong: Expiry/replacement may still misassociate popup state.

34. Final: Ruling: Whole-roster balance/full cycles — Keep separate natural/full-cycle/balance gate. Cost if wrong: Roster balance remains unaccepted.

35. Final: Ruling: Full Task15/16 — Bounded readers cannot close original combat integration. Cost if wrong: Task15/16 remain unfinished.

36. Final: Ruling: Owner-hosted acceptance — No hosted execution establishes acceptance. Cost if wrong: Hosted gate remains open.

37. Final: Ruling: Atlas acceptance — Unchanged and outside this reader check. Cost if wrong: Atlas motion/acceptance remains open.

38. Final: Ruling: Human gameplay acceptance — Source review/tests cannot establish human acceptance. Cost if wrong: Human gate remains open.

39. Final: Ruling: Merge/deployment/activation/release readiness — Review supplies no operational authorization; preserve no-release boundary. Cost if wrong: Combat update remains unreleased.

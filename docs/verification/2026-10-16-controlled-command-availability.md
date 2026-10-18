# Spent Controlled commands — verified development checkpoint

After a Controlled action has been released or its prime cancelled, its captured group can no longer arm an executable command. The shared cockpit disables the artwork when every group is spent. Its information button stays accessible. When another ordinary Manual group remains, artwork instead offers an explicit group chooser. Opening it clears the old group, attachments and targets without selecting or casting a replacement. A stale ready signal or prime hint cannot override the captured spent state or turn a chooser into a ready action. The accessible command label explains “already used this battle”; no new primed decoration, Release button, artwork change or command slot is introduced.

Native once-per-character/ability/battle admission already rejected another prime or release. The defect was in the consumers: captured descriptor resolution and cockpit cost presentation did not consume the terminal phase. The shared descriptor now becomes unavailable for a selected spent Controlled group, so existing target/initial/directional/range factories and the executeIntent guard reject it. The payment adapter separately reports controlledSpent without changing affordability or definition costs. Skill, Essence and active Manual Resonance buttons use that flag; actual BattleExperience forwards aggregate owner-captured availability to Move, Basic Attack and the current Support artwork, even when no group is resolved.

This applies through the shared playable PvE/PvP cockpit on both breakpoints. Other ordinary Manual groups in the same source remain selectable and legal. Unprimed/free-prime and legally primed release behavior remain unchanged. Historical absence of Controlled metadata retains existing behavior. Private source identity, capture fields, payment, cooldowns, limits, effect execution and prime reconciliation remain native authority.

## Verification

BASE f8ff229b28245151cb22399c3c59f452f167df97 → reviewed 465020f2c89f38691b7ad596932e36f14701ee1e → final tested 97d4b3d0da7d6135d740da446276e1ffab92b353. Six source/test files changed initially; this report is a docs-only descendant. No game-core, schema, public projection, persistence, AI, manifest, control bindings, CSS, artwork or geometry changes.

- Initial RED195400566375Z-893bf67b reproduced eight real failures: spent descriptor intent creation plus enabled Skill/Essence/Resonance artwork after native release/cancel. Three guards passed. The native state already reported spent and rejected reuse.
- Basic fixtures initially attempted unsupported Controlled timing on Move, then attached extra effects to per-terrain-point walking. Both parser rejections were correct. Fixtures were corrected to an explicit flat overall Move price and a supported Controlled damage payload alongside the other effects. No native legality or cost rule changed to fit a test.
- With Basic spent gating removed, corrected RED195612060404Z-1c7abfd1 showed five actual enabled-spent Basic commands, with no fixture error. Restoring that guard made them pass. Default per-terrain-point native walking remains unchanged.
- **35 new native lifecycle cases overall (19 initial plus 16 review regressions)** cover prime/release/cancel, owner projection, descriptor/intent factories and actual shared SSR for Skill/Essence/Manual Resonance and all five editable Basics. Basic coverage includes the current equipped Guard/HP Recovery/MP Recovery choices. Ordinary Manual groups remain legal after the same ability's Controlled action is consumed. Cancel spends no HP/MP; the displayed captured 11 AP / 2 MP / 1 HP price remains intact; spectators receive no owner action choices. Before prime there is no readiness glow; a legally primed action remains available with its existing ready signal.
- Final initial focused **876 tests / 82 files GREEN**195646317858Z-33b41d99; web types195713495744Z-efd5f02a and zero-warning scoped lint195713495745Z-ce7d94ed GREEN. Correct native Controlled/configured/bundle/composition suite **73 tests / 4 files GREEN**195713491291Z-e91fd0bd. An earlier command used a nonexistent bundle filename and therefore ran only the other two matching files (72 tests); the later correctly named four-file run is the evidence for 73.
- The combined review found two Important multi-group gaps. ONE correction wave adds a deliberate chooser for a spent selected group with another ordinary group, and independent all-spent Basic aggregation. Review RED200244124487:11 valid failures/19 passing; additional Basic mixed-choice falsification200426997652:five valid failures/30 skipped. Final repaired focused **1,034 tests / 88 files GREEN**200454694110Z-7e5f6f2c;types200454709745Z-36739318 and zero-warninglint200454688617Z-0ccff72c GREEN. No rereview.
- Initial reviewed-source full check195801168899 exited 0 with 8,652 + 7, but saved stdout lacked its final build summary despite the tool completion tail. Initial audit/package logs are preserved. The changed repaired source required the fresh full check below, not a redundant cached replay.
- Final exact-source root: **8,668 Vitest plus seven Node checks**, formatting, lint, all workspace typechecks and both builds GREEN. Receipt 20261016T200529920491Z-9af33b15, 2026-10-16T20:05:29.920491+00:00 → 2026-10-16T20:09:24.752071+00:00. Counts: realtime 3, audio 17, validation 106, db 118, worker 2, game-core 4136, web 4286. Complete root build tail and package-log hash audit are preserved.
- All 294 named Skill reports and HTML are exactly unchanged from the preceding conditional Ward/Taunt checkpoint: 294 records, 297 groups, 604 effects. Observation SHA256 53993a97d7b856591c63d22cf08ddae50dd6d48f4b9d6297ef6e1e3d9e65ab39. Manifest and six AI/native source hashes remain unchanged. This does not claim a fresh 289-case gameplay matrix.

## Combined review and parent decisions

One fresh combined review of 465020f2: **0 Critical, 2 Important, 0 new Minor**. Parent accepted I1 (pointer/touch access to another ordinary group) and I2 (ambiguous all-spent Basic aggregation). Both addressed in ONE test-first repair wave, final tested 97d4b3d0da7d6135d740da446276e1ffab92b353. Eleven valid review regressions RED200244124487 plus five Basic mixed-choice falsification failures200426997652 → 1,034 focused tests / 88 files GREEN200454694110; types/lint GREEN. 35 new native cases overall. No rereview; 13 inherited Minors deferred. Every reviewer-declined behavior has an individual parent reason/cost below (65 rulings; expanded grouped review lines). Native/AT/geometry/fullTask 15/16/release remain open.

## Evidence limits and next work

Only the server-only import marker is mocked in the new fixture. Actual native lifecycle, projection and shared SSR are tested; this is not mounted browser, physical keyboard/touch, assistive-technology, focus or geometry acceptance. No repeat browser installation or tunnel attempt was made.

The existing Manual picker already carries exact selected references through prime, locked release, preview and direct commit. This checkpoint fixes spent-command availability; it does not replace that implementation or claim every readiness flow accepted. Whole-action current-intent readiness, complete Manual/public references, Chronicle fallback and full editor previews still need final integration/acceptance.

The live modular foundation, proposed rebalance and original unfinished combat integration remain separate. Original Targeting/Move/five editable Basics/Controlled and controls/editors/readers/previews remain pre-release requirements until their complete chains and native acceptance pass. Full Task 15/16, full natural cycles, twelve-round pacing/balance, current Owner edits, hosted SQL/CAS, Atlas motion and human acceptance remain open. Broader unrelated Master/Staff/Players/Events/Music/world work follows combat.

No publication, activation, hosted migration, merge or deployment is performed. Deployment lock retained. High remains sufficient for routine integration. The provisional 16–30 active-hour estimate remains uncertain and is not a calendar launch promise.

## Deferred Minors

Thirteen inherited Minors remain deferred: Rewind witness origin; Supporting Shot version pin; Ongoing-pair dynamic identity pin; repeated bounded AI discovery; admission double-prefix provenance; ranged negative direct-commit witness; independent defense-positive HP reconciliation; exact Arsenal historical values; singular status-clock grammar; Burn ordinary tick-boundary wording; Master inline reference-button sizing; cross-status direct-input immutability witness; legacy duplicate component keys. Any new reviewer Minor is listed in the review outcome.

## Initial rulings

1. Disable only the selected spent Controlled group, preserving ordinary Manual groups and information access. Reason: native phase owns availability. Cost if wrong: consumed Controlled artwork cannot arm a command; unrelated Manual groups must remain available.
2. Keep definition price/affordability independent of spent availability. Reason: unavailable does not mean free. Cost if wrong: consumers must read the new derived spent flag as well as affordability.
3. Preserve no primed decoration/no extra Release button. Reason: approved cockpit contract. Cost if wrong: readiness still depends on a complete legal current-intent forecast and native acceptance.
4. Correct Basic fixtures to supported flat-price Move composition. Reason: per-terrain-point walking is pure native movement; follow-up effects require a flat overall Skill price. Cost if wrong: this lifecycle test does not claim a new per-tile composition mechanic.

## Every parent set-aside ruling

# Parent rulings

I1 accepted Important: a legal ordinary group must remain reachable from artwork with pointer/touch after consuming selected Controlled group. Repair provides an explicit choose-another-action route, clears group/draft/targets and arms only the group selector, never silently chooses/casts replacement. UI affordability/cooldown no longer prevents opening that chooser; legal execution keeps server/payment guards. Reason: preserving a legal group in data is insufficient if its only selection path disappears. Cost: artwork may remain enabled solely to choose another group, without readiness or a current action claim.

I2 accepted Important: Basic all-spent aggregation must consume actual owner captures independently of group resolution. Shared battleCapturedControlledAvailability serves both cost adapter and actualBasicforwarding. All-Controlled/spent groups disable artwork even with no selected group; mixedordinary groups retain choice. Reason: an ambiguous descriptor intentionally has no selectedcontrolledrecord, which is insufficient evidence ofavailability. Cost: Basicforwardingnowtakesderivedaggregateavailability;selectedgroupstillownsmechanics.

ONE Critical/Important repair wave. InitialnewrepairRED20024412448711validfailures/19passes. AdditionalBasicmixedchoicefalsification200426997652fivevalidfailures/30skippedbeforecorrectbranchrestored. GREEN repairedfocused1034/88files200454694110/types200454709745/lint200454688617.35newnativecasesoverall(19initial+16repair). No rereview;13inheritedMinorsremain;no newMinor.

1. **Changing once-per-group admission** — Ruling/reason: Native ownership is once per battle/character/ability; consume that authority. Cost if wrong: Native once-per-ability admission remains; no per-group reprime.

2. **Making spent costs zero** — Ruling/reason: Availability and payment remain separate. Cost if wrong: Price still shows the captured activation cost.

3. **Allowing stale ready to override spent** — Ruling/reason: Component gates suppress readiness; actual readiness also checks descriptor availability. Cost if wrong: Readiness is not accepted without a legal current intent.

4. **Changing free-prime affordability** — Ruling/reason: Structural admission and paid release are intentionally different. Cost if wrong: Free admission still differs from paid release.

5. **Adding primed decoration or Release button** — Ruling/reason: Approved interaction contract excludes both. Cost if wrong: No primed decoration/extra Release control is added.

6. **Disabling every group when one is spent** — Ruling/reason: Ordinary Manual groups remain native-legal; I1 identifies access regression. Cost if wrong: Ordinary-group access must be preserved by I1 repair.

7. **Automatically choosing another Manual group** — Ruling/reason: Ambiguity requires deliberate selection. Cost if wrong: The player must choose the group explicitly.

8. **Historical captures without Controlled metadata** — Ruling/reason: Optional metadata does not infer spend; historical envelope/cost fallback remains. Cost if wrong: Historical metadata remains weaker but is not invented.

9. **Replacing missing canonical captures with current definitions** — Ruling/reason: Missing/ambiguous canonical references fail closed. Cost if wrong: Missing canonical captures remain unavailable.

10. **Changing native/Manual attachment selection** — Ruling/reason: References remain bound through intent metadata; primed metadata exclusively owns captured refs/empty set. Cost if wrong: Exact attachment ownership/locked set remains required.

11. **Reopening spent attachments for editing** — Ruling/reason: Primed/spent resolution stays locked; spent intents blocked. Cost if wrong: Captured attachment editing remains forbidden.

12. **Keyboard command bypass** — Ruling/reason: Unavailable descriptors still guard executeIntent; no native authority change. Cost if wrong: Actual mounted keyboard acceptance remains open.

13. **Directional/target/range bypass** — Ruling/reason: Existing factories consume descriptor unavailability. Cost if wrong: Physical input and full targeting acceptance remain open.

14. **Rearm notice** — Ruling/reason: Not an independent Important; corrected chooser branch explains deliberate selection. Cost if wrong: Other rejected hotkey notices may remain generic.

15. **Per-terrain-point Move follow-up damage** — Ruling/reason: Unsupported by native parser; preserve pure walking. Cost if wrong: Controlled composed Move must use a flat overall Skill price.

16. **Attached Move price** — Ruling/reason: Unchanged included-cost contract. Cost if wrong: No new per-tile fee is authorized.

17. **Reached-origin mechanics** — Ruling/reason: Execution unchanged. Cost if wrong: Interrupted Move acceptance remains open.

18. **Guided Practice Guard** — Ruling/reason: No real exposure established; do not change hypothetical practice content. Cost if wrong: If edited Controlled practice Guard becomes reachable, it needs an explicit gate.

19. **Stale browser** — Ruling/reason: No authority change; keep actual Tasks8/16 verification separate. Cost if wrong: Live authority acceptance remains open.

20. **Alternate selected actor** — Ruling/reason: No authority change; keep actual Tasks8/16 verification separate. Cost if wrong: Live authority acceptance remains open.

21. **Direct RPC bypass** — Ruling/reason: No authority change; keep actual Tasks8/16 verification separate. Cost if wrong: Live authority acceptance remains open.

22. **Live expiry** — Ruling/reason: No authority change; keep actual Tasks8/16 verification separate. Cost if wrong: Live authority acceptance remains open.

23. **Revocation** — Ruling/reason: No authority change; keep actual Tasks8/16 verification separate. Cost if wrong: Live authority acceptance remains open.

24. **Authority CAS** — Ruling/reason: No authority change; keep actual Tasks8/16 verification separate. Cost if wrong: Live authority acceptance remains open.

25. **Malformed nested state** — Ruling/reason: Parser/serialization/projection unchanged; no full audit in this review. Cost if wrong: The dedicated validation/privacy acceptance remains required.

26. **Malformed captured data** — Ruling/reason: Parser/serialization/projection unchanged; no full audit in this review. Cost if wrong: The dedicated validation/privacy acceptance remains required.

27. **Malformed pending data** — Ruling/reason: Parser/serialization/projection unchanged; no full audit in this review. Cost if wrong: The dedicated validation/privacy acceptance remains required.

28. **Malformed summon data** — Ruling/reason: Parser/serialization/projection unchanged; no full audit in this review. Cost if wrong: The dedicated validation/privacy acceptance remains required.

29. **Private accuracy serialization** — Ruling/reason: Parser/serialization/projection unchanged; no full audit in this review. Cost if wrong: The dedicated validation/privacy acceptance remains required.

30. **Duplicate payment** — Ruling/reason: Native execution unchanged; representative reader tests are narrower. Cost if wrong: Broader execution acceptance remains required.

31. **Repeated events** — Ruling/reason: Native execution unchanged; representative reader tests are narrower. Cost if wrong: Broader execution acceptance remains required.

32. **No-input/extra-turn bounds** — Ruling/reason: Native execution unchanged; representative reader tests are narrower. Cost if wrong: Broader execution acceptance remains required.

33. **Interrupted movement** — Ruling/reason: Native execution unchanged; representative reader tests are narrower. Cost if wrong: Broader execution acceptance remains required.

34. **Concurrent publication** — Ruling/reason: Transaction/worker authority unchanged. Cost if wrong: The corresponding concurrency gate remains open.

35. **Concurrent build** — Ruling/reason: Transaction/worker authority unchanged. Cost if wrong: The corresponding concurrency gate remains open.

36. **Concurrent claim** — Ruling/reason: Transaction/worker authority unchanged. Cost if wrong: The corresponding concurrency gate remains open.

37. **Concurrent recovery** — Ruling/reason: Transaction/worker authority unchanged. Cost if wrong: The corresponding concurrency gate remains open.

38. **Concurrent settlement** — Ruling/reason: Transaction/worker authority unchanged. Cost if wrong: The corresponding concurrency gate remains open.

39. **Mounted keyboard** — Ruling/reason: Source/SSR does not establish physical interaction. Cost if wrong: Actual interaction acceptance remains open.

40. **Mounted touch** — Ruling/reason: Source/SSR does not establish physical interaction. Cost if wrong: Actual interaction acceptance remains open.

41. **Native browser** — Ruling/reason: Source/SSR does not establish physical interaction. Cost if wrong: Actual interaction acceptance remains open.

42. **Assistive technology** — Ruling/reason: No physical/AT execution. Cost if wrong: Physical/accessibility acceptance remains open.

43. **Long-name layout** — Ruling/reason: No physical/AT execution. Cost if wrong: Physical/accessibility acceptance remains open.

44. **Narrow-screen geometry** — Ruling/reason: No physical/AT execution. Cost if wrong: Physical/accessibility acceptance remains open.

45. **200%zoom** — Ruling/reason: No physical/AT execution. Cost if wrong: Physical/accessibility acceptance remains open.

46. **Full roster natural cycles** — Ruling/reason: Bounded availability cases do not establish whole-roster acceptance. Cost if wrong: Gameplay/balance acceptance remains open.

47. **Natural pacing** — Ruling/reason: Bounded availability cases do not establish whole-roster acceptance. Cost if wrong: Gameplay/balance acceptance remains open.

48. **Twelve-round balance** — Ruling/reason: Bounded availability cases do not establish whole-roster acceptance. Cost if wrong: Gameplay/balance acceptance remains open.

49. **Current hosted Owner edits** — Ruling/reason: Outside this source-only cohort; no hosted changes. Cost if wrong: The named final acceptance gate remains open.

50. **Hosted SQL/CAS reconciliation** — Ruling/reason: Outside this source-only cohort; no hosted changes. Cost if wrong: The named final acceptance gate remains open.

51. **Atlas motion** — Ruling/reason: Outside this source-only cohort; no hosted changes. Cost if wrong: The named final acceptance gate remains open.

52. **Human acceptance** — Ruling/reason: Outside this source-only cohort; no hosted changes. Cost if wrong: The named final acceptance gate remains open.

53. **Rewind witness origin** — Ruling/reason: Inherited Minor retained; unrelated witness. Cost if wrong: The inherited Minor remains deferred; no incidental repair in this cohort.

54. **Supporting Shot version pin** — Ruling/reason: Inherited Minor retained; capture hardening unchanged. Cost if wrong: The inherited Minor remains deferred; no incidental repair in this cohort.

55. **Ongoing pair dynamic identity pin** — Ruling/reason: Inherited Minor retained; identity witness unchanged. Cost if wrong: The inherited Minor remains deferred; no incidental repair in this cohort.

56. **Repeated bounded AI discovery** — Ruling/reason: Inherited Minor retained; AI unchanged. Cost if wrong: The inherited Minor remains deferred; no incidental repair in this cohort.

57. **Admission double-prefix provenance** — Ruling/reason: Inherited Minor retained; wording unchanged. Cost if wrong: The inherited Minor remains deferred; no incidental repair in this cohort.

58. **Ranged negative direct-commit witness** — Ruling/reason: Inherited Minor retained; witness remains preparation-only. Cost if wrong: The inherited Minor remains deferred; no incidental repair in this cohort.

59. **Independent defense-positive HP reconciliation** — Ruling/reason: Inherited Minor retained; event witness unchanged. Cost if wrong: The inherited Minor remains deferred; no incidental repair in this cohort.

60. **Exact Arsenal history values** — Ruling/reason: Inherited Minor retained; historical coverage unchanged. Cost if wrong: The inherited Minor remains deferred; no incidental repair in this cohort.

61. **Singular status-clock grammar** — Ruling/reason: Inherited Minor retained; unrelated wording. Cost if wrong: The inherited Minor remains deferred; no incidental repair in this cohort.

62. **Burn ordinary tick-boundary wording** — Ruling/reason: Inherited Minor retained; timing description unchanged. Cost if wrong: The inherited Minor remains deferred; no incidental repair in this cohort.

63. **Master inline reference-button sizing** — Ruling/reason: Inherited Minor retained; separate geometry surface. Cost if wrong: The inherited Minor remains deferred; no incidental repair in this cohort.

64. **Cross-status direct-input immutability witness** — Ruling/reason: Inherited Minor retained; separate cohort. Cost if wrong: The inherited Minor remains deferred; no incidental repair in this cohort.

65. **Legacy duplicate component keys** — Ruling/reason: Inherited Minor retained; no mounted reconciliation claim. Cost if wrong: The inherited Minor remains deferred; no incidental repair in this cohort.

# Resonance Manual-action preview — verified development checkpoint

The Master Resonance editor can now select a canonical Manual action group and simulate it through the existing combat engine. Previously the editor used a null preview and no-op callback, while the endpoint ignored the Resonance content kind and sent its definition through Skill validation. A valid Resonance therefore could not use the shared battle preview.

The existing authenticated endpoint now passes the typed Resonance lane to strict Resonance validation. The service requires a supported selected Manual/action group, with an explicit choice when several exist, and rejects disabled, malformed, unknown and absent-ability definitions instead of falling back to legacy mechanics. The native capturedResonanceAbilitySource retains the exact sorted Discipline pair, version and resonance source kind. No Skill alias or invented source Discipline is used.

The existing fixture and native command preparation own targeting, Requirements, pricing, Controlled priming and outcomes. The shared canonical public projection and existing safe Summon projection are reused. An edited Summon shows its actual profile and selected spawn position. Attached Move remains included in the authored overall cost. Preview does not execute or pay a real battle command and consumes no battle RNG.

The actual editor uses the shared action selector and client/handler/service path. Switching groups clears the previous preview and closes publication confirmation. Draft edits invalidate review; late preview responses cannot restore the stale result. An enabled canonical Manual action needs a completed current matching preview before the existing Publish confirmation can proceed. Historical sequence/immediate and canonical sources with no Manual action retain their prior validation/diff workflow; they are not fabricated as independent casts. Their event or root-context simulation remains unfinished.

## Source and verification

BASE ab359650becb091b5eb87887c653a0a498753dca → reviewed 5b55bb6f4c992d04d1e38f3e4a72e42b63e554f9 → final tested 0a901b495d3b694ecb69dbad870ac730c995135b. Eight implementation/test files; this report is the only subsequent docs change. No native engine, schema, SQL, roster, AI, CSS, artwork, battle control, server publication authority or deployment change.

- **155 new root tests**: 149 real handler/service/native/SSR cases and six controlled React-hook callback cases. All **130 accepted Manual Resonance groups** prepare through the actual authenticated handler and strict typed service. A valid definition is not automatically legal in the fixture: native resource/status/other Requirements remain authoritative.
- Actual Steamfront Quench/Flare and Aether in Poise Release are covered in PvE/PvP. Costs remain 35 AP/4 MP, 50 AP/6 MP and 50 AP/8 MP respectively; Release's Move is included. The selected group, recipients, effects, deterministic repeat, privacy, no RNG and input immutability are checked. Edited Controlled and Summon paths, malformed/disabled/ambiguous/unknown/unauthorized admission, historical sequence handling and truthful native Requirements are covered.
- The actual editor callbacks drive the real client/handler/service/native chain. They check group invalidation, confirmation closure, draft edits during an in-flight preview, informative native illegality, successful local conditional/disabled publication and preservation of passive review workflow. Only React hook lifecycle, navigation/server-only marker and the transport boundary are substituted. No mounted DOM, keyboard, touch, assistive technology, focus or layout acceptance is claimed.
- Missing-lane/selector **11 valid RED** failures214759158391Z-cb7f08c1; firstGREEN214849086629Z-7484f307. The original editor was temporarily restored for a three-case callback regression witness, **RED215034429951Z-77bc46fd**, then the implementation was restored. Edited Summon profile stayed RED after correcting an initially guessed name to the actual existing Verdant Stalker, receipt215023868348Z-694baa83. Tests and types caught an incorrect native input field; the implementation now uses SpawnCombatSummonInput.position. A passive workflow RED215157912308Z-fce676e9 narrowed the preview gate to Manual/actions only.
- Final focused **431 tests / 22 files GREEN**, receipt220310077981Z-88ffcc8f. Final repair web types220310616343Z-405bea80 and correct web-config zero-warning lint220246712429Z-8f4bef2e passed; final root rechecks both on the frozen source. An earlier root-config lint invocation ignored web files and is not counted as lint coverage.
- All **136 latest built-in native Skill previews plus five default Basic previews** exactly match the prerequisite's full JSON results. Final frozen diagnostic220410820635Z-7095d30d; SHA256 49050e22e414dd9ada6e16f69e809170c09b8b0dab2f57b915dd44bf337b3127. Exact BASE module SHA256 5289b7744d3e4345ac7687d5b405010606649fd75c4e43b85cf2ff730a98197a, with only its relative viewer-projection import rebased for the isolated diagnostic. Latest/default coverage does not mean every historical version.
- All **294 named Skill reports and HTML** remain exactly unchanged: 297 groups/604 effects. Final frozen diagnostic220410818347Z-6ecd9983; observation SHA256 3b16fcc59d378f6aa06c491b4a57e3d6ab369a6110d70dd76124abc1fb779d25. Proposal manifest and six AI/native source hashes remain unchanged. No new gameplay balance matrix is claimed.
- Exact final root **8,877 Vitest tests plus seven Node checks**, formatting, lint, all workspace types and both builds GREEN. Receipt 20261016T220814457459Z-9b2003b9, 2026-10-16T22:08:14.457459+00:00 → 2026-10-16T22:08:44.514764+00:00. Package counts: db 118, audio 17, worker 2, realtime 3, validation 106, game-core 4136, web 4495. Complete root build tail and package-log hash audit retained. The initial root run omitted a complete summary despite exit0; its audit/package logs are retained, and ONE cached exact-source replay supplies the complete receipt.

## One review repair pass

The independent review found 0 Critical / 3 Important / 0 new Minor. Parent accepted all three by actual author impact. I1: a valid single-group Covert-dependent Resonance could not publish even a text edit because the fixed fixture was not legal; require a completed current matching preview and show unmet conditions, preserving the strict default for Skill/Basic callers. I2: disabled Manual drafts could neither simulate nor publish; retain their prior validation/diff publication path without an enabled cast. I3: geometry2 Fire Ground Circle/Line lost explicit Ground intent; derive the selected behavior's Fire flag as the existing Skill/Basic paths do.

Conditional and disabled publication cases reproduced RED220138361397Z-7fa2be76. That run also had a real Circle Ground failure and one Line-fixture range error; after correcting authored Line reach, both area regressions were valid RED220301349245Z-de6cbe6d with the missing-flag behavior temporarily restored. Corrected implementation then passed 431 tests / 22 files, receipt 220310077981Z-88ffcc8f. Actual conditional and disabled publication use only an in-memory store; saved versions retain the original Ability and disabled flag. No hosted publication occurred. A test-helper override type was narrowed after TypeScript exposed an overly broad union. Shared ReviewPanel/workflow default still requires legal previews for existing Skill/Basic callers. No rereview or incidental Minor repair.

## Restoration and evidence limits

Automated maintenance removed the previous local checkout. The verified recovery branch f18e515740520cabcb85a99a5e41fc4c3b8c8e07 was cloned; all 41 saved Git bundles were imported with native bundle verification. Exact source ab359650/tree65b82b5a877a560ae49032c86f7883a70913855b was restored. Latest bundle/evidence sizes and SHA256 matched saved metadata; archive paths were inspected before safe extraction. Offline dependency restore left the lock unchanged. The restored baseline passed 44 tests / 3 files. The missing ignored evidence-local dependency link initially caused diagnostic import failures, then both diagnostics passed after its restoration. The pre-existing Vite native-loader advisory remains visible and is not suppressed.

These are local deterministic authoring fixtures, static rendering and controlled callbacks. No signed-in browser, hosted persistence/publication, physical concurrency, native input, assistive technology or human acceptance is established. Full Task 15/16, Automatic/Ongoing/event and modifier-root previews, legacy sequence simulation, complete combat cycles, natural twelve-round balance, current Owner hosted edits, SQL CAS, Atlas motion and human/release gates remain open. Original unfinished combat integration must still finish before the rebalance release; broader unrelated Master work follows combat. Modular foundation is already live; this checkpoint is not deployed. High remains sufficient.

## Independent review

Fresh combined review of 5b55bb6f4c992d04d1e38f3e4a72e42b63e554f9 against ab359650: **0 Critical, 3 Important, 0 new Minor**. Parent accepted all three Important findings by actual author impact and repaired them in ONE wave at 0a901b495d3b694ecb69dbad870ac730c995135b.

- **I1 fixed:** valid conditional actions no longer require the sample fixture itself to be legal before a current reviewed text/mechanical definition can publish. Native failure remains visible; completed matching draft/group preview is still required for enabled Manual sources. Strict Skill/Basic defaults remain unchanged. Actual Covert-dependent single-group publication to the in-memory store is covered.
- **I2 fixed:** loaded disabled Manual drafts preserve validation/diff publication without any fabricated enabled simulation. Direct disabled-preview rejection remains covered. Actual disabled version publication to the in-memory store is covered.
- **I3 fixed:** geometry2 Fire Ground Circle/Line retain explicit Ground intent and persistence; geometry3 category authority is unchanged.

Conditional/disabled publication and Circle Ground RED220138361397Z-7fa2be76; corrected Line fixture and both valid Ground RED220301349245Z-de6cbe6d; all fixes then **431/22 focused GREEN220310077981Z-88ffcc8f**, web types220310616343Z-405bea80 and scoped web lint220246712429Z-8f4bef2e GREEN. Final exact-source root is independently required by the guarded report/saver. **No unresolved Critical or Important** in this bounded source cohort after the single repair pass. No rereview was requested; repaired code is verified by regression tests and the full required checks, without pretending it received another independent review.

No new Minors. Fourteen inherited Minors remain deferred and are enumerated in the report. Review/source tests do not establish hosted, mounted/native/AT, balance or release acceptance. Every parent set-aside decision and its cost is recorded separately.

## Initial rulings

1. Reuse native Resonance capture and command authority. Reason: the preview must preserve pair/source identity and actual rules. Cost if wrong: a fixture still cannot establish live build ownership or execution acceptance.
2. Add typed contentKind to the existing preview service interface rather than a parallel endpoint. Reason: retain the current shared client/authentication/validation chain. Cost if wrong: the legacy method name previewSkillDefinition now also supports an explicit Resonance lane; a future rename is separate cleanup.
3. Gate enabled canonical Manual actions by completed current matching preview; preserve prior disabled/legacy/passive workflow. Reason: the fixed sample cannot satisfy every valid conditional action, and disabled versions have no legal cast. Fixture illegality stays visible, while definition validation remains mandatory. Cost if wrong: completing a preview does not prove its Requirements can be met in the final roster; gameplay/balance acceptance remains required.
4. Factor existing safe Summon/canonical projection for reuse. Reason: a native edited Summon needs truthful visible preview data without duplicating its serialization contract. Cost if wrong: default Basic and legacy Skill behavior must remain protected by the exact 141-result comparison; arbitrary historical versions remain separate.
5. Restore source and evidence before coding after maintenance. Reason: exact checkpoint identity outranks reconstructing code from memory. Cost if wrong: current source integrity is verified, but ignored historical evidence outside the latest archive still lives in the retained older recovery archives.

## Every parent set-aside decision

1. **Automatically satisfying Requirements** — Ruling/reason: Native fixture failures remain truthful; I1 changes publication eligibility instead. Cost if wrong: A completed preview does not prove that every real battle can satisfy the definition.

2. **Every resource scenario** — Ruling/reason: A fixed sample is narrower than a scenario editor. Cost if wrong: Resource-specific scenario acceptance remains open.

3. **Every status scenario** — Ruling/reason: No fabricated Covert or other status is added. Cost if wrong: Status-conditioned actions may correctly be unavailable in the sample.

4. **Filling every plural cap** — Ruling/reason: The fixture uses available actors within the authored cap. Cost if wrong: Maximum population is not demonstrated for every definition.

5. **Conditional Move succeeds** — Ruling/reason: Native Requirements retain authority. Cost if wrong: A conditional Move may correctly fail in the sample.

6. **Interrupted Move succeeds** — Ruling/reason: No execution transition is changed. Cost if wrong: Interrupted execution acceptance remains open.

7. **Automatic simulation** — Ruling/reason: This work adds Manual action preview only. Cost if wrong: Event-context preview remains unfinished.

8. **Ongoing simulation** — Ruling/reason: No lifecycle simulator is added. Cost if wrong: Ongoing preview remains unfinished.

9. **Manual modifiers without root** — Ruling/reason: A modifier is not an independent cast. Cost if wrong: Root-context preview remains unfinished.

10. **Historical sequence simulation** — Ruling/reason: Existing non-cast workflow is retained. Cost if wrong: Sequence simulation remains unfinished.

11. **Historical immediate simulation** — Ruling/reason: Existing non-cast workflow is retained. Cost if wrong: Immediate event simulation remains unfinished.

12. **Live expiry** — Ruling/reason: Authoring authorization remains unchanged; no hosted expiry witness. Cost if wrong: Task8/16 expiry acceptance remains open.

13. **Live revocation** — Ruling/reason: No hosted revocation witness is produced. Cost if wrong: Revocation acceptance remains open.

14. **Alternate-character authority** — Ruling/reason: Local actor injection is narrower than live selected-character admission. Cost if wrong: Hosted alternate-character acceptance remains open.

15. **Direct gameplay RPC** — Ruling/reason: The authoring endpoint is not the gameplay RPC path. Cost if wrong: Direct gameplay authority acceptance remains open.

16. **Database publication concurrency** — Ruling/reason: Local immutable publication is exercised, not simultaneous physical sessions. Cost if wrong: Concurrency acceptance remains open.

17. **Publication lock ordering** — Ruling/reason: No real database locks are executed. Cost if wrong: Lock-order acceptance remains open.

18. **Publication rollback** — Ruling/reason: No hosted/physical rollback race is executed. Cost if wrong: Rollback acceptance remains open.

19. **Build concurrency** — Ruling/reason: No build transaction change exists. Cost if wrong: Build concurrency acceptance remains open.

20. **Claim concurrency** — Ruling/reason: No claim transaction change exists. Cost if wrong: Claim concurrency acceptance remains open.

21. **Recovery concurrency** — Ruling/reason: No recovery transaction change exists. Cost if wrong: Recovery concurrency acceptance remains open.

22. **Settlement concurrency** — Ruling/reason: No settlement transaction change exists. Cost if wrong: Settlement concurrency acceptance remains open.

23. **Malformed historical captures** — Ruling/reason: Authoring admission does not establish all persisted restore paths. Cost if wrong: Historical capture acceptance remains open.

24. **Malformed pending persistence** — Ruling/reason: No pending restore parser change exists. Cost if wrong: Pending restore acceptance remains open.

25. **Malformed Summon persistence** — Ruling/reason: Edited Summon preview uses native preparation, not saved battle restore. Cost if wrong: Summon persistence acceptance remains open.

26. **No-input execution** — Ruling/reason: Preview is preparation and does not execute full lifecycles. Cost if wrong: No-input acceptance remains open.

27. **Repeated-event bounds** — Ruling/reason: No native event executor change exists. Cost if wrong: Repeated-event acceptance remains open.

28. **Duplicate payment execution** — Ruling/reason: Preview costs are deterministic but no real battle payment commits here. Cost if wrong: Execution payment acceptance remains open.

29. **Interrupted settlement** — Ruling/reason: Native preparation was inspected; actual interruption is not executed by these new cases. Cost if wrong: Settlement acceptance remains open.

30. **Unreached-origin attacks** — Ruling/reason: Move command authority is unchanged. Cost if wrong: Full execution acceptance remains open.

31. **Mounted keyboard** — Ruling/reason: Controlled hook callbacks are not mounted native input. Cost if wrong: Keyboard acceptance remains open.

32. **Assistive technology** — Ruling/reason: No AT session is performed. Cost if wrong: AT acceptance remains open.

33. **Mobile geometry** — Ruling/reason: No browser measurements are made. Cost if wrong: Mobile acceptance remains open.

34. **Long-name geometry** — Ruling/reason: No browser measurements are made. Cost if wrong: Long-name acceptance remains open.

35. **200% zoom** — Ruling/reason: No browser measurements are made. Cost if wrong: Zoom acceptance remains open.

36. **Creative balance** — Ruling/reason: No balance definition is changed. Cost if wrong: Natural gameplay/balance acceptance remains open.

37. **Roster mutation** — Ruling/reason: Accepted definitions are inputs only and hashes stay unchanged. Cost if wrong: No proposed roster is activated by this checkpoint.

38. **Fourteen inherited Minors** — Ruling/reason: Approved deferred backlog is unchanged; no incidental repair. Cost if wrong: All fourteen remain unresolved and are listed in this report.

39. **Hosted publication** — Ruling/reason: Only in-memory test publication is performed. Cost if wrong: Current Owner hosted publication acceptance remains open.

40. **Migration** — Ruling/reason: No schema or migration is changed/applied. Cost if wrong: Hosted migration readiness remains separate.

41. **Deployment** — Ruling/reason: The deployment lock is retained. Cost if wrong: This checkpoint is not live.

42. **Release readiness** — Ruling/reason: This is one editor integration slice. Cost if wrong: Original combat/native/balance/human release gates remain open.

43. **Full Task15** — Ruling/reason: Event/root previews and other original integration remain. Cost if wrong: Task15 is unfinished.

44. **Full Task16** — Ruling/reason: Final acceptance exceeds local fixtures. Cost if wrong: Task16 is unfinished.

45. **Natural twelve-round balance** — Ruling/reason: Existing full checks run their current coverage; no new balance matrix is claimed. Cost if wrong: The final natural-cycle/balance gate remains open.

46. **Atlas motion** — Ruling/reason: No Atlas implementation or measurements change. Cost if wrong: Recorded motion acceptance remains open.

47. **Human playtest** — Ruling/reason: Automated checks are narrower than human play. Cost if wrong: Human acceptance remains open.

## Deferred minors

Fourteen inherited findings remain deferred: Rewind witness origin; Supporting Shot version pin; Ongoing pair dynamic identity pin; repeated bounded AI discovery; admission double-prefix provenance; ranged negative direct-commit witness; independent defense-positive HP reconciliation; exact Arsenal historical labels/values; singular status-clock grammar; Burn ordinary tick-boundary wording; Master inline-reference sizing; cross-status direct-input immutability witness; legacy duplicate component keys; unknown-reference matching-text witness. New review Minors, if any, are listed in the review outcome above.

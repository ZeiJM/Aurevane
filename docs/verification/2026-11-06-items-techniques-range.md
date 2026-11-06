# November 6 Item, Technique Manager and range-tag followup

Status: implemented; final verification pending; not live. Nick explicitly authorized ONE combined controlled production release for testing after required checks. All prior November 5 releases are complete and must not be replayed.

## Scope and implementation

- Equipment position captions move outside the cards; Item names/artwork remain. Consumable stock appears once as an image-corner badge; no `owned` suffix.
- Item characteristics use Item Type and Cost in QP, removing the top QP fact. Manual use costs remain separate. Imbued technique reports keep ordinary Skill Type/AP. Master Item authoring exposes Cost (QP) using the same authoritative qualityPoints field/range.
- Only replacement proposals show the compact lower-right stat comparison. Gains green, losses red, affected unchanged values white. Two-handed removals are included; conditional stats and Evasion without authoritative base are not invented. No redundant summary returns on equipped armor.
- Four original generated technique images: Quickstep, Tower Guard, Storm Ward and Kindle. See artwork manifest. Optional weapon Support media uses existing finalized upload/identity/ACL protections; captured absent media retains weapon art. Current technique media/name flows through manager, Nexus, battle projection and recorded logs.
- Support choices share the eight-column desktop Discipline lane. Remove separate Details/source text. Hover and keyboard focus open standard Support reports; touch keeps deliberate selection. Technique names omit source slot/weapon qualifiers.
- Range Up and Range Down are ordinary delayed TAGS with editable tile strength/duration and global panel timing authority. Attack/Utility/Recovery Basic/Discipline/imbued eligible; Target All, self-only, consumables, movement, area sizes and minimum range unchanged. Dedicated policy and SQL registration work remains under implementation.

## Completed evidence (not final combined gates)

- Parent focused UI/stat runs: 56 tests passed. Dedicated manager hover/focus/shared-preview regression: 7 passed.
- Shared pending-media tracker + authoring workspace integration: 70 passed. Independent media review found two separate upload boundaries could clear another pending upload; one encompassing boundary now owns both Item artwork and technique editors. Tracker concurrency and actual workspace ancestry regressions pass; scoped re-review approved.
- Media implementation: 33 core, 80 web, 20 finalized-media SQL and 28 inventory SQL tests pass. These use actual disposable migration paths, parser/identity/ACL/history and published-image readback.
- Web TypeScript passed after local report presentation row override and narrowed image source, before current range-tag edits. Scoped Web ESLint passed. Final combined types/lint/build/configured CI still required.
- Fresh main observed `64da0c1ced9d63db5e2662e4204ea515d65950eb`; independent task branch is `agent/equipment-tile-labels-20261106`.

## Browser limitation and remaining gates

The local Arsenal browser regression did not launch: required Chromium executable absent. Playwright's original-version browser download returned corrupt/incomplete ZIP repeatedly within its installer. OS package installation failed on environment setgroups/setuid restrictions. No browser pass is claimed and no coverage/gate was removed. Configured Browser Smoke already runs the actual nine-size Arsenal and Item-editor regression scripts; the mobile management workflow retains its real manager tests. Required native CI must pass on final source before release.

Finish range implementation, independent UI/range/final reviews, affected checks and exact-source configured CI. Preserve original limits and report all accidental/interrupted local broad-suite evidence separately. Reconcile fresh main before final source integration. No new migration, content registration/publication or application deployment has been performed for this followup.

## Range implementation development evidence

The range worker reports focused six-file core853, six-file web160 and real disposable SQL6 passing, with AI regression and final type/lint checks still pending. One accidental broad game-core invocation (a pnpm forwarding form did not filter) was interrupted with exit130. Observed failures: new-status exhaustive classifier/count expectations (being updated with explicit Range contract coverage), and timeouts in starter-items-combat, combat-reflect-barrier, combat-absorb-mp and combat-all-target-policy under resource contention. These are not passing full-suite evidence and their configured timeouts remain unchanged. Final exact-source CI remains mandatory.

Independent UI review found mismatched desktop Support tracks and an incorrect neutral caption for unproven Evasion. Shared grid breakpoint rules and an explicit unavailable state replace those paths; actual CharacterItems SSR now tests undefined/NaN/negative/out-of-range bases and a known437 base yielding+4%. Focused3files/28tests pass. Review also caught accidental removal of the common touch-reader block during CSS edits; the original block was restored exactly. Technique radios keep names concise with accessible source/position descriptions. Final narrow review and native browser verification remain required.

## Scoped review resolution checkpoint

Item/media and UI reviews are approved. Shared pending uploads now cannot clear one another; the workspace/tracker integration run passes70 tests. Exact unknown-Evasion SSR and hover/focus regressions pass in28tests. The full historical/current armor×weapon Support matrix passes6 tests after visible-label expectations changed; original capture/Attack/fallback assertions remain. Support now consumes precisely the same grid tracks/gaps/name rows as Discipline at each breakpoint; the original common mobile reader was restored exactly. No rendered browser pass is claimed.

Range focused final development results: core885, web160, actual SQL8 and timing authority14 passing. Independent review found valid huge-strength arithmetic could overflow and AI reposition still used authored reach. Exact net BigInt arithmetic now cancels opposing applications before technical saturation, and AI reposition uses shared effective targeting. New focused Range/AI regression run passes37 tests. Narrow re-review and final compiler/check results are pending; these figures do not replace the required full exact-source configured CI gate.

## Final source handoff

All requested source behavior is implemented. Scoped Item/media, UI and Range reviews are approved after the fixes described above. Range policy admission covers PvE, ordinary/quality PvP, World encounters and Master preview; historical reattachment remains literal. Final core types pass, scoped core/db and Web ESLint pass, and final changed parent files pass formatting. Range review independently ran15tests; final authoring/Dispel-default coverage passes28. Final combined Web `tsc --noEmit` passes on the complete source.

Whole-branch review found one remaining configured-browser integration mismatch: the Arsenal scenario retained four old `Kindle · Main Hand` locators, an obsolete negative Warding Prayer locator and two touch equipment selection steps that omitted the deliberate preview commit. The final fix wave updates those exact selectors and explicit mobile commits while retaining all dialog, late-read, persistence and unequip fallback assertions. No test is skipped or weakened. Native browser execution and required CI remain release gates.

The source handoff includes exactly two reviewed additive migrations (`20261106100000_item_technique_media.sql`, `20261106110000_range_tags.sql`) and four exact source8 media successors in `2026-11-06-item-technique-successors.json`. Publication necessity, current revision/version floors, predecessor bodies, Owner drafts and existing remote installation must be inspected afresh during the controlled release. No successor/publication/migration/deployment has been installed for this batch; prior production remains live. Do not replay prior November5 operations.

Git CLI push cannot authenticate in this environment. Source is being published using the GitHub connection, with every blob and the complete tree checked against local Git object identities. This is one branch/PR/source, not an additional implementation or deployment.

Final browser-script fix passes `node --check`, scoped Prettier and diff validation; native execution remains pending configured CI.

## First exact-source CI diagnosis — 6de92266

The first configured Quality execution failed at Web ESLint, before the broad type/test/build chain: `jsx-a11y/role-supports-aria-props` rejects `aria-description` on the imbued Support radio. The red execution and Quality summary are the same underlying failure. The warning was reproduced locally with zero-warning lint intact; a new real-component regression failed before the repair. The radio now uses `aria-describedby` with a linked hidden source/position description, retaining its short technique name. Its focused regression passes; no lint suppression or threshold change was introduced.

The actual Browser Smoke execution passed the production nine-viewport Arsenal shell and desktop1366/mobile390/mobile412 inventory/equipment interactions, proving no-scroll equipment fit, shared image sizing, dialog/actions and source controls for those cases. It then failed `battle-items-browser-regression.mjs:691`, whose equipment Support assertion still expected `Iron Shortsword,` although the fixture's actual Support binding is `Mend`. The assertion now expects `Mend,`; the separate Attack assertion still requires `Iron Shortsword,`. All command, cost, persistence and settlement assertions remain. This is partial browser evidence, not a full native Browser Smoke pass. Complete exact-source CI must rerun after the fix.

## Guided browser expectation correction — 328f2714

The next Browser execution (`127975633601`) progressed beyond the prior battle Item case and failed at `guided-items-browser-regression.mjs:156`: expected Support `/^Tower Shield,/`, received the intended `Tower Guard, 30 AP`. Its red summary is the same failure. The real guided fixture captures Tower Shield with selected Support binding Tower Guard. Corrected only this expected prefix; tutorial Practice HP Recovery, movement/Attack/Recovery commits, progress persistence, completion and private-data assertions remain. A new test starts that actual guided fixture and verifies weapon Attack name versus technique Support name and unique artwork; all4 projection tests pass. The remaining browser/e2e weapon-name/Support-slot assertions were audited; the remaining Iron Shortsword prefix belongs to Attack and remains correct. TypeScript, scoped lint, script syntax, formatting/diff checks and independent narrow review pass. This is not a full browser-suite pass; rerun the configured gate on the updated head.

## Second Quality diagnosis — 328f2714

Complete Quality execution `127975584541` passed all7,167 Core tests and then failed3 of642 Database tests (639 passed). The red Quality summary wraps that same execution. Blind/Seal migration tests run the full migration chain and compared complete writer definitions without the new Range whitelist entries; their exact expectations now include those approved additions, retaining all full-definition/history/ownership/ACL and real publisher authorization/CAS assertions.

The third failure exposed a real publication-metadata defect: specified removal of Range Up classified as Dispel in the engine but Conditional Cleanse in SQL. The new Range migration now extends only the installed explicit positive-removal vocabulary, requiring exactly one anchor and preserving omitted-mode historical classification and all other classifier branches. An actual tag-snapshot binding regression reproduced the missing Dispel wording before the fix. No historical migration, captured snapshot, existing publication or Owner draft is rewritten. Full-function ownership/ACL equality, repeat idempotency and missing/duplicate-anchor rollback tests cover the migration repair. All5 focused files/37 tests, scoped DB ESLint, DB types and diff/format validation pass. Independent migration/security review is approved with no findings. This is focused evidence; the full updated exact-source Quality and Browser gates remain required.

Adjacent Counter/Endure classification audit: Endure3/3 passed locally. Counter's existing first standalone PGlite test exceeded its unchanged5s limit both alongside Endure and once in isolation; the second Counter test passed in both runs. That fixture reads only the historical wording/Counter migrations and does not load the new Range migration. The same unchanged Counter2/2 and Endure3/3 had passed in complete prior-head central CI (`127975584541`, 4,601ms and4,082ms). The local timeout remains honestly unresolved, with no timeout/assertion change or further retry; the complete next-head CI gate remains mandatory.

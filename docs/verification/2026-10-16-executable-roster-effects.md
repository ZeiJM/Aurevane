# Executable final-roster effects checkpoint

Status: local test implementation; combined review addressed; final post-fix repository gate passed. No runtime definition, catalogue activation, hosted write, merge or deployment. ParentTask15/16 remain open.

The new registry-driven suite requires one concrete scenario for each of the19actual `COMBAT_TAG_REGISTRY` effect IDs. Each scenario captures an exact proposed final record/version, verifies that its selected first behavior actually contains the claimed payload, then executes the real prepare/commit path and asserts mechanical state. Preview and commit leave the original input unchanged. Resulting states go through actual JSON serialization and stat-driven encounter validation. Finite/blocked counterparts use actual clocks, Requirements, target geometry, resource caps or cooldown checks.

The existing41roster outcome checks retain their assertions and use extracted shared test fixtures. The extraction adds only an already-approved Ground-group adapter for native Ground proposals; runtime source and the accepted294-record manifest remain unchanged (SHA256bdceab2a7547845d15f20654c1dc758a97d6c104d2dad76c906364e4504cdd9f).

| Effect ID | Exact proposed playable record | Version | Observable result and counter/bound |
| --- | --- | --- | --- |
| move | vanguard.sweeping-strike |6| Move one tile before actual hit; total50AP, no MP or walking surcharge; excessive otherwise legal route rejects with only the authored maximum-tile issue; both original and reached positions are within attack range. |
| damage | vanguard.forceful-strike |6| Enemy loses28HP;45AP price;100Barrier absorbs it, leaving72; cooldown blocks replay. |
| pierce | vanguard.guard-break |5| Without explicit equipment Armor, current Defense is not bypassed: Defense20 yields18damage versus22at0; cooldown blocks replay. |
| healing | resonance.cinderweaver-lifebinder.linked-sequence |5| Wounded ally gains20HP, caps at1000, hostile selection rejects. |
| percentage-recovery | lifebinder.mending-light |6| Ten percent of1000maxHP restores100; caps at1000; hostile selection rejects. |
| resource-change | aetherist.arcane-field |7| Real Circle activation drains4MP from both enemies, preserves allyMP and pays owner6MP; targetMP caps at0. |
| apply-status | vanguard.brace |5| Owner receives Guard, enemy does not; finite clock removes it, cooldown blocks replay. |
| remove-status | runeblade.unbinding-rune |5| Explicit Dispel removes enemyCovert while leaving unrelatedSuppress; cooldown blocks replay. |
| return-to-turn-start | chronist.rewind-step |6| Free prime captures real tile; after paid walking, release returns to prime tile for40AP/4MP and restores no Movement; repeat rejects. |
| create-terrain | frostweaver.chilling-mist |8| Approved selected canonical Ground bridge creates a two-round source and actual FrozenGround after activation; area and terrain expire without input. |
| displace | vanguard.shield-bash |5| Enemy moves one tile when free; occupied destination stops displacement while the paid hit still lands. |
| poison | resonance.farstrider-wildwarden.linked-sequence |6| Marked ranged target receives captured three-tick Poison, loses HP at turn boundary, then loses the finite instance; missingMark rejects. |
| burn | cinderweaver.cinder-bolt |8| Captured three-tick Burn damages at real turn boundary then expires; cooldown blocks replay. |
| bleed | ravager.gash |6| Captured three-tick Bleed damages at real turn boundary then expires; cooldown blocks replay. |
| barrier-change | vanguard.brace |5| Owner gains12Barrier; enemy gains0; cooldown blocks replay. |
| copy-statuses | shadehand.quick-hands |6| Owner gains donorGuard and donor retains it; empty donor rejects, costs unchanged on preview, cooldown blocks replay. |
| sensory | farstrider.scouts-mark |5| Removes Covert and eligible Guard, applies Revealed and sourceMark with no damage; Revealed expires. |
| summon | wildwarden.renewing-herbs |7| Captured36HP/12MP companion has two abilities; occupied spawn rejects; after exactly five summon turns, the companion and summon state disappear. |
| damage-bonus | farstrider.keen-focus with farstrider.aimed-shot |5/5| Explicit attachment changes26damage to29 after native flooring, costs an extra10AP/3MP; omission gives no bonus or modifier price, modifier cooldown blocks a distinct available compatible root with sufficient AP/MP; plain root remains legal. |

Pierce equipment-Armor bypass is explicitly future capability under the accepted design’s explicit Pierce ruling; this case verifies meaningful current damage and zero invented Defense bypass. It does not claim an implemented equipment system. Ground bridge execution is not immutable full-catalogue publication preparation, reader/browser acceptance or hosted timing reconciliation.

## Evidence

Registry completeness RED054527899042: the empty case registry fails against all19actual IDs. No production code was changed to create or repair these test scenarios. Initial fixture failures exposed incorrect guessed prices/rounding, use of unit selection for a native Circle, an incorrect terrain property name, and an incorrect flat-Armor assumption; the accepted manifest and actual established formulas/selection/timing contracts settled them. No runtime bound or existing assertion was relaxed. A temporary missing local variable during type narrowing is retained in failure logs. All41existing outcome checks continued to pass through fixture extraction.

Focused GREEN055036560484:61tests/2files, comprising20new registry/scenario tests and41existing outcomes. Core types055038039048pass. Covering GREEN055208056319 and final055305900212:829tests/4files including the complete design manifest and actual canonical Ground groups. Core types055307370604 and scoped lint055220598909pass. Full suite and combined review follow.

## Remaining acceptance

This is complete effect-ID coverage only. All24authorable statuses,2system/historical status classifications,8Requirement forms,4activation combinations and distinct combinations still need their complete executable mapping. An effect occurring in a record does not prove every status parameter or Requirement path. Full individual294-record/class/four-Skill/pair cycles, Level1/Level100 realAI/PvE/PvP balance and twelve-round standards remain open. No fixture is claimed to be a legal full Level100 build or a genuine AI choice.

Native browser/picker/editor/layout/accessibility, actual prose/orange-effect/reader consistency, canonical derivedTags, currentOwner-edit/whole-catalogue timing/hostedCAS reconciliation and inherited Atlas motion remain release gates. The source suite establishes bounded mechanics, not release readiness.

## Single combined review and scoped fix pass

The fresh review ofeec45d64..d8562a2f found0Critical/2Important/2Minor. No production defect, extraction regression or manifest drift was found. Both Important test-evidence findings were accepted and fixed:

- I1: modifier damage was checked only through events. The final case asserts actual restored enemyHP974without the modifier and971with it. A temporary test-only negative control held boosted-command HP at the ordinary974while preserving its29damage event. The old test passed055757508419; the new HP assertion failed055808813368. Removing that temporary control restored the genuine production path. The negative-control patch is retained separately for reproduction; no simulated outcome remains in committed tests and this is not reported as a production bug.
- I2: negative checks could reject for unrelated reasons. New precondition assertions failed055831446613 against the old Move endpoint and unavailable root. The final excessive route starts and ends within attack range, is contiguous/free, and returns only the exact authored-Move-maximum issue. The modifier retry uses a second available Farstrider Attack with sufficient100AP/20MP in a paired fixture, retains the captured cooldown, proves the plain root legal, and asserts only cooldown-active when Keen Focus is attached. Resource setup is a test counterfixture, not a game refund. A first route correction still exposed the old origin’s range issue055904259121; the final paired route isolates both endpoints.

Deferred minors: M1this proposed Rewind witness primes at turn origin, so it does not itself distinguish prime-position from turn-start; the existing dedicated Controlled Rewind tests cover that distinction. M2the19primary witness versions are pinned, but supporting Aimed Shot’s currentversion5 is reported rather than independently version-pinned in this suite. The counterfixture also resolves current Pinning Shot. These remain test-hardening follow-ups; no claim of their isolated coverage is made.

The initial full check055349114225 atd8562a2f passed7,714Vitest+7Node, formatting/lint/all8types/2build tasks. That receipt predates the review fixes and is not final post-fix evidence. No reviewer rerun or duplicate full suite was requested; the final covering run060007106028 passes829tests/4files; core types and scoped lint055926pass. The final post-fix gate follows.

## Review-declined scope rulings

| Item | Decision and reason | Cost if wrong |
| --- | --- | --- |
|24authorable statuses/2system-history classifications | Open: effect IDs do not prove each status rule. | Missing or misleading status use. |
|8Requirement forms and parameter combinations | Open: need explicit eligible/ineligible event/context paths. | Incorrect admission or free reactions. |
|4activation combinations/interactions | Open: representative cases do not establish all modes. | Unsupported or repeated activation. |
|Class/four-Skill/Resonance cycles | Open: isolated mechanics are not complete kits. | Unusable or dominant playstyles. |
|Individual294-record execution | Open: only the listed effect witnesses are added here. | Untested individual definitions. |
|LegalLevel1/100/PvE/PvP/twelve-round balance | Open: this Level1mechanical fixture is not a legal full build. | Bad pacing or power imbalance. |
|Genuine AI choices/viability | Open: no AI decision execution in these cases. | Mechanics AI cannot use. |
|Every DoT tick/decay/interaction | Open: this suite pins profiles/basis/first tick/expiry; retain dedicated engine coverage and finish roster interactions. | Missed later clock interactions. |
|Every status’s downstream benefit/penalty | Open alongside status mapping, rather than counting status presence as mechanic proof. | Decorative or incorrect status outcomes. |
|Summon abilities/AI | Open: actual spawn/profile/lifetime only here. | Companion actions or choices fail. |
|Future equipmentArmor | Keep accepted future boundary; currentDefense stays authoritative. | Narrower future Pierce benefit. |
|Whole-catalogue Ground conversion/publication/hosted timing | Open: reviewed adapter is test-only. | Lost metadata or mismatched clocks on publication. |
|Owner edits/immutable publication/migration/hostedCAS | Open: no hosted operation or reconciliation here. | Stale edits/history or publication races. |
|Derived tags/prose/orange/readers | Open: unchanged consumer audit. | Misleading visible mechanics. |
|Native picker/editor/browser/keys/touch/layout/accessibility/Atlas | Open: browser remains unavailable and Atlas motion remains blocked. | Unusable controls or failed motion acceptance. |
|Deployment/hosted smoke/release | Not authorized or established by this checkpoint. | Premature release. |
|Independent replay of parent receipts/full gate | Parent runs and reads exact full receipts; reviewer duplication deliberately avoided. | Verification error if receipts are misread. |
|Unchanged broader branch | Preserve prior checkpoints and their gates; this review covers the four-file diff. | Older unrelated failures remain possible. |

## Final frozen-source verification

Exact tested source `6f246f7b76e5bca52c309c2fb2d8ae772215c073` (tree`1fdfc822f2606a0cca8024f2eada8fd1f34488fb`) passes `pnpm --reporter=append-only check`:7,714Vitest (4,039core/3,429web/246other) plus7Node checks, formatting, lint, all8package types and2build tasks. Receipt20261016T060117688565Z,06:01:17–06:03:35UTC,exit0. Source remained frozen; the final descendant updates only this report. No production code or accepted manifest changed in the entire bounded milestone.

Both Important findings are fixed with falsification/failed-precondition evidence and final full GREEN; both Minor test-hardening findings are explicitly deferred above. No second reviewer or redundant post-green suite was run. All41original outcome-test bodies and assertions are independently compared byte-for-byte againsteec45d64 and remain identical.

Fresh main remains29506e293e81abef1b0b8a46099618ab3ae3f0ae and an ancestor; automatic Git deployments remain locked. Recovery metadata on the separate authorized archive identifies exact source/tree/tested source, full receipt, hashes and prerequisiteeec45d64, retaining all prior bundles. Archive ancestry is never implementation ancestry.

This bounded effect-ID checkpoint is complete; parentTask15/16 are not. The next saved preflight covers24authorable statuses,2system/history classifications,8Requirement forms and4activation modes with actual downstream mechanics. Browser/Atlas/whole-catalogue/realAI-Level100/reader/release gates remain open.

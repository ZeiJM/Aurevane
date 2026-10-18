# Proposed roster: legal loadout admission and first AI command

Status: bounded evidence passes covering checks, one fresh combined review and the final frozen-source gate. Task15/16 and release remain open. Base `0354e2c3f849e0c0bd6ccb1f089df1519222bf31`. This milestone adds regression evidence only, with no production definition, formula, entitlement, publication policy, hosted data or deployment change.

## Actual integration exercised

The test publishes all289 non-Basic proposals through the real local Master authoring service, backed by `InMemoryCombatContentRepository`, and uses the real current/pinned content resolver. Each loadout then calls actual `saveCharacterDisciplineSkills`, loads the committed snapshot, validates `toCombatBuildSnapshot`, creates catalog3 battle authority and restores it through the actual parser. Exact current definitions are read by their pinned versions, compared to the complete proposed records, and passed through actual battle source capture. No proposed version is inserted into the old builtin resolver or rebound in place.

There are306 coverage builds: two complementary four-Skill pure loadouts for each of17 sources, plus each of136 authored2+2 Resonance kits in both Primary orders. The pure halves cover all136 Skills; they are coverage fixtures, not newly authored class strategies. Each build runs at actual Levels1/100 (legal full pools36/135) and in PvE/PvP authority contexts: **1,224 admission and opening-command combinations**. Level100 preserves Vitality40 and a Primary focus Core40 and asserts actual500HP. Current derived rules are used, with no historical V3 analytical stats or power override.

The local character repository provides explicit earned Skill/mastery records and active build facts, then records the real service's save. These are trusted repository fixtures, not proof that progression/learning, advanced prerequisites or discipline-selection transactions awarded those facts. Historical learned/committed versions remain unchanged; the existing battle admission upgrades to the exact current publication. Pure builds receive only their Essence, mixed builds only their unordered-pair Resonance. Four slots, source capacity, immutable committed/earned records, exact source/version, serialized authority and current build bridge are checked.

Actual captured canonical sources, pinned native definitions and current derived profiles feed the real build-aware AI chooser. Each opening command is chosen twice to check determinism/read-only behavior, then actually executed through the shared executor. A paid action or free prime must change state, preserve input, survive JSON/stat validation and keep HP/MP in bounds. The adjacent mirrored-stat enemy has no separate equipped build; these are opening-command integration cases, not full PvP encounters or distinct class/pair cycles. The AI may correctly choose a Basic; this does not assert that it used every class mechanic or found an optimal strategy. Both context admissions are real; command mechanics use the existing shared build-aware executor contract, without inventing a second PvP AI executor.

The three persistent Ground Skills remain their exact native proposed definitions: `wildwarden.venom-shot@8`, `cinderweaver.flame-burst@10`, `frostweaver.chilling-mist@8`. Their definitions are admitted and passed as pinned native Skills; no fake modular capture or test-only Ground conversion is used in this suite. All other equipped Skills and extensions are checked as exact captured canonical sources. Three actually selected default Basics are captured per build. This is not complete Ground canonical publication or all five support-action selection evidence.

Five isolated negative saves verify specific errors before any repository commit: unlearned, duplicate, fifth Skill, learned-but-inactive source, and four Skills from the same source in a mixed build. The inactive case includes a genuine learned record from that inactive source, avoiding an unlearned confound.

## Executed checks

Admission-only GREEN `20261016T093310269784Z`:312tests/1file. Initial306failures (`093224055054`) came from the fixture's actor ID lacking the production `character:` prefix. The next run (`093239947152`) exposed noncanonical fixture Skill key order in the fingerprint; the actual repository's `parseSnapshotSkill` returns slotIndex first. Matched that actual repository shape, without changing production hashing or claiming a production defect.

Opening-command covering GREEN `20261016T093423961845Z`:312/312,09:34:23–09:36:35UTC,130.91seconds. A process-inspection command emitted `fatal library error, lookup self`; this was initially misattributed to the suite. The actual suite completed normally, exit0, with its full312test summary. No combat fix was made for that inspection error. A single-build diagnostic (`093626135697`) also passed,1test/311intentionally filtered. The verbose covering diagnostic already started during investigation is retained rather than hidden.

Web typecheck `093328071726` initially caught lost contextual typing inside `vi.fn`; explicit `SaveDisciplineSkillsInput` fixes the fixture typing, with no production cast. Actual web typecheck GREEN `093458463383`. App-package scoped ESLint GREEN `093458462217`, zero warnings. Strengthened negative guards GREEN `093733188159`:5tests/307intentionally filtered; each checks its exact reason. The final gate will cover the added exact non-Basic capture-set assertion and all final source together.

## Parent scope rulings

Ruling: use the approved Task15 legal-build requirement and existing save/current-publication/pinned-capture authority. No new design approval is needed for a test-only application. Cost if wrong: mechanically legal fixtures could be mistaken for actual earned progression; that boundary is explicit above.

Ruling: retain genuine historic earned references and current admission resolution, rather than change character persistence to pretend the proposals are already builtin. Cost if wrong: stale or silently rewritten history; exact current definitions and unchanged committed records are asserted separately.

Ruling: use complementary pure coverage halves and the136 already authored pair kits. No new class strategy, numerical reprice or kit recommendation is introduced. Cost if wrong: coverage can be misread as experiential uniqueness, so distinct cycles and balance stay open.

Ruling: retain all four level/context combinations and real opening choices, with no forced twelve-round finish or assertion that an arbitrary class action must outrank a Basic. Cost if wrong: bounded integration is slower and does not establish pacing; actual cycles and seeded matchup balance remain required.

Ruling: report the three native Ground definitions honestly, without materializing only a test copy or claiming their complete editor/reader/publication path. Cost if wrong: premature canonical activation would drop persistent-area mechanics; that gate remains open.

All individual294outcomes,17class/17Essence/136pair distinct cycles, multi-turn real AI, Level1/100 PvE/PvP balance and natural pacing remain open. So do the existing Owner-edit/timing/hostedCAS, full Ground materialization, public/editor/orange/prose/derivedTags, native browser/keys/touch/mobile/zoom and Atlas acceptance gates. Prior four Minors remain carried. No hosted write, activation, merge or deployment is authorized by this evidence.


## Combined review and parent rulings

Fresh read-only combined review at `4c7f4b707d456c545a2630930654c3a6d7c115cc`, tree `d555502890e556488edf796334f3bd8159b3e091`, found **zero Critical, zero Important and one Minor**. No reviewer suite was duplicated. Parent agrees with the Minor classification and defers it under the selected workflow: the actor profile fixture passes the prefixed combatant ID to the factory's character-ID argument, producing `character:character:22222222-2222-4222-8222-222222222222` provenance. Numeric current derived stats, build authority and opening outcomes are unaffected; exact character provenance identity is not established by this fixture. At its next relevant change, use the raw character ID and assert provenance separately. No Minor polish fix or rereview is included. Four earlier Minors remain carried, five total.

The already-running verbose diagnostic also finished normally: `093645742505`,09:36:45–09:38:54UTC,312/312,exit0,128.12seconds. It was started during the misattributed process-inspection error investigation, before the original full run's receipt had been read. It is redundant evidence, not a second review or a runtime fix.

| Review exclusion | Parent ruling, reason and cost |
| --- | --- |
|1 Progression awards/learning/mastery/advanced prerequisites|Open actual awarding acceptance: fixtures seed trusted earned facts; this suite cannot establish that those facts were correctly awarded.|
|2 Discipline selection/hosted persistence/CAS|Open actual transaction/hosted acceptance: stateful repository confirms local save/load only; concurrent or unauthorized transaction behavior is unproven.|
|3 Later/concurrent publication stability|Retain existing pinned-publication regressions; no new concurrent claim here. Cost: a future publication race must still be caught at its actual boundary.|
|4 All Basic publication/support selections|Existing retained-Basic coverage remains required: this suite captures only the three defaults; alternate support choices are not established here.|
|5 Canonical Ground materialization|Open: exact three native definitions remain native. Cost: activating a partial canonical conversion could lose persistent-area mechanics.|
|6 PvP-specific native command mechanics|Open beyond the disclosed shared executor contract: PvP authority admission is checked, but no alternate native PvP execution is invented. Cost: this evidence cannot establish PvP-specific native differences.|
|7 Multi-turn AI/distinct cycles/exhaustive effects/optimal strategy|Next Task15 cycle work: opening commands may be Basics. Cost: an admitted playable opening can still have a broken or weak longer cycle.|
|8 Balance/pacing/seeds/full opposing PvP builds|Open: one seed and an unequipped mirrored-stat opponent are bounded fixtures. Cost: matchup fairness, sustainability and natural twelve-round pacing are not established.|
|9 Owner edits/UI/readers/prose/tags/browser/input/mobile/zoom/Atlas|Existing actual acceptance gates remain open: no affected implementation is changed here. Cost: mechanically valid content can still be illegible, inaccessible or overwrite Owner edits; the inherited Atlas failure is not waived.|
|10 Parent final gate/historical run receipts|Parent owns actual command receipts and the final frozen-source gate, without duplicate reviewer runs. Cost: completion depends on inspecting successful exits and full summaries, not the review verdict alone.|

Final frozen-source **full repository gate PASS** at `4c7f4b707d456c545a2630930654c3a6d7c115cc` / tree `d555502890e556488edf796334f3bd8159b3e091`: receipt `20261016T093919298285Z`, `pnpm --reporter=append-only check`,09:39:19–09:42:50UTC,exit0. Actual **8,086 Vitest** (4,097core,3,743web,246other) plus **7 Node** tests pass, along with format, lint, all eight package typechecks and both build tasks. The fresh web build has the complete route summary; unchanged worker build is cached. Fresh main remains `29506e293e81abef1b0b8a46099618ab3ae3f0ae`, ancestor of this source, and deployment remains locked false. Final report descendant is documentation only; no product or test changes follow this successful gate. All review exclusions have individual parent rulings above; no Critical/Important fix pass or rereview was needed. The remaining Task15/16 release gates are unchanged.

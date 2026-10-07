# Combat corrections — 2026-10-07

This records the Owner-approved continuation after the earlier combat release, tracked in PR #847: https://github.com/ZeiJM/Aurevane/pull/847. Implementation and the targeted final-review corrections are present. Verification of the revised final source, authenticated CI and Production release remain pending. Do not read this checkpoint as a live-release claim.

## Implemented contracts

- Canonical entitled participant responses preserve typed active DoTs through Recruit and Final Turn responses, pending activation and reload.
- Shared targeting shows exact orange Ground footprints, clear Circle caster tiles and no off-footprint red outlines. Direction arrows retain identity colors with a readable compass backing. Escape/cancel restores neutral hotkey focus.
- Completed battle logs use a dominant scrollable Chronicle with compact summary and unchanged reward actions.
- Canonical reports include Self alongside Ally when actual geometry permits the caster. Elemental interactions retain authored target/team restrictions; Fire does not gain automatic friendly/self damage permission.
- Current Resonance wording describes Setup/Trigger/Result consistently. Chronist Skills Setup accepts any Chronist Skill, including attacks; tagged matchers and historical versions retain their narrower contracts.
- New encounters pin DoT trigger policy 1: Burn backlash defaults to 10% of actual hostile HP damage from the burning unit's own attack command, rounded down, once per character's turn cycle. Poison allows one extra authored percentage tick after five traversed tiles per cycle, with partial modulo-five carry and no banked extra ticks. Scheduled ticks remain independent. Reapplication, Copy and reload cannot reset allowances.
- New encounters pin Ground policy 1: fixed authored tiles, 1–4 global rounds, next-round default/Instant override, ordinary cast effects and one active entry pulse per area/character/cycle. Push/Pull checks each traversed tile; relocation only its landing tile. Source movement/defeat does not change pinned areas. Expiry and every terminal transition clear areas.
- Ground entry reuses canonical supported unit effects and frozen caster/current recipient calculations, with no repeated command cost, cooldown, actor buffs, Copy, displacement, reactions or Resonance. Percentage DoTs use only their own pulse's positive hostile HP damage.
- Shared participant/spectator layers show pending markers, registered Embers/Frost/Arcane pulse and static reduced motion beneath portraits. Public responses contain only ID, tiles, activation/expiry and preset.
- Master Skill/Essence controls edit Ground enablement, duration, activation and finite animation presets, plus precise Burn backlash percentages. Existing validation, reason, expected-version, audit, immutable publication and rollback authority remain intact.

## Verification checkpoint

Tasks 1–7 each completed with the full repository test suite. Task 7 typecheck passed all eight packages. Actual local Chromium matrices passed 66 production-component targeting/Ground/Master cases and 54 completed-result renderer cases. Desktop/mobile Ground and Master screenshots were inspected. Authenticated Master Ground/Burn publication, actual battle cast, persistence/reload and surrender cleanup cases are added to the existing mandatory browser suite; their CI result is still pending.

Fresh hosted read-only inspection found no published Skill, Essence or Resonance overrides. No Production content rewrite or new schema migration is needed for this continuation. Earlier elevation settings remain independently published at their existing authority.

Local mounted browser fixtures are not an authenticated Production playtest. Automated mechanics evidence is not human balance acceptance.

## Final-review corrections — pre-release checkpoint

The whole-branch review identified four Important issues. Each was reproduced with a failing focused regression before its correction:

- A Ground pulse caused by Push/Pull could complete the battle inside the original damaging command, before that command settled Burn backlash. Nested movement pulses now defer completion to the enclosing command so its damage, one legal backlash and final verdict settle together. This preserves lethal/draw handling without emitting a premature result.
- An entrant who was also the Ground caster used live outgoing values. Ground damage now reads the frozen caster's outgoing stats, placement and modifiers independently from the entrant's current incoming defenses and Guard. Self-entry retains current HP and ordinary mutations; the saved caster is calculation data rather than a resurrected combatant.
- Ground persistence accepted an incomplete pinned stat profile. Reload validation now requires the profile and fields appropriate to the encounter's pinned stat-bridge and balance policies, together with valid provenance. Missing or malformed frozen values fail closed instead of producing later damage failures.
- Historical Skill readers used current Burn/Poison extra-trigger descriptions. Battle Skill readers now receive the encounter's pinned DoT-trigger policy: policy 1 explains percentage backlash and once-per-cycle movement ticks; pre-policy encounters retain the two-HP backlash and uncapped five-tile wording. Current Nexus/Master readers retain current wording.

The authenticated browser gate also exposed a Guard/pure self-buff highlight regression. Restoring the canonical inherent Guard target metadata restores the shared filled blue selection without changing command legality or the stronger green recovery/orange Ground priorities.

Targeted verification after these corrections passes 31 core Ground tests and three reader tests. The actual Chromium percentage matrix was extended from 60 to 72 cases and all 72 current/historical Skill, Essence and pending/active rail cases pass with no recorded errors. The four desktop/mobile PvE/PvP ally-inspection and self-selection cases also pass. The full 66-case targeting matrix passes again after the Guard metadata repair; current and historical reader screenshots were inspected at desktop/mobile widths. Evidence: `/tmp/aurevane-final-review-green-core2.log`, `/tmp/aurevane-final-review-green-reader2.log`, `/tmp/aurevane-final-review-percentage.log`, `/tmp/aurevane-final-review-ally.log`, `/tmp/aurevane-final-review-targeting.log` and `/tmp/aurevane-corrections-review-percentage/results.json`.

The earlier Task 8 full quality result applies to its pre-review source. A fresh full gate exposed TypeScript boundary errors in the frozen-profile validator/test and shared description callers. Those were corrected using the actual persisted stat-profile type, explicit pinned trigger options in server-rendered Skill/Essence readers, and valid test metadata; the revised full gate passes. Fresh `NEXT_TELEMETRY_DISABLED=1 corepack pnpm check` passes formatting, lint, all eight typecheck packages, 4,328 Vitest tests, seven Node checks and the production build (exit 0; `/tmp/aurevane-final-review-check4.log`). Exact-head authenticated CI, merge and deployment remain pending; final source identities and release evidence remain to be recorded.

## Authenticated CI follow-up

Candidate `8ae8e2c3a5a76b677566ef8e784f8c69e96902be` passed 11 of its 13 triggered workflows. Browser smoke `37681822697` passed every mounted targeting/reader/rail/result/input matrix and reached actual Supabase Master authoring. Its new Ground test then skipped the required semantic Diff operation, leaving Preview correctly disabled; both repeated runs reproduced that omission. The saved error context confirms valid content and enabled Diff with disabled Preview. The test now performs and verifies Ground/backlash Diff before Preview and checks button readiness before awaiting a response.

Representative Buildcraft `37681822570` reproduced a stale exact-text expectation (`Lifebinder · heal`) against the approved current text (`Lifebinder Skills tagged Heal`). Its strict Setup/Trigger expectations now use the canonical current wording, including `Vanguard Skills tagged Attack + Melee`; no assertions or scenarios were removed. Fresh `NEXT_TELEMETRY_DISABLED=1 corepack pnpm check` passes again after the test corrections (4,328 Vitest, seven Node checks, format/lint/types/build; exit 0, `/tmp/aurevane-ci-followup-check.log`). Both workflows require a successful run on the revised candidate before release. These corrections change acceptance tests only, preserving the production authority and approved UI.

## Complete Owner testing checklist

Start a new battle for current content and policy checks. Existing encounters preserve their pinned versions/maps.

1. Essence readers such as Aether Nova include Damage and every authored bottom tag explanation.
2. Damage explains Skill Power 1–20 clearly without repeating each Skill's Power value. Elemental interactions appear where relevant.
3. Guard, Vulnerable, Defenseless, Damage Up and other timed effects affect actual damage and remain visible for their full stated rounds. Compare ordinary hits separately from criticals.
4. A fully idle timeout applies Lowered Guard. Timeout after a successful move/action and manual End Turn do not.
5. Move reports 20 AP, N/A requirements, Move [1]/Instant, Move-stat range and Jump-stat elevation, with concise wording. Terrain still changes actual AP costs.
6. Basic Attack uses the higher Physical/Mystic offense; equal values choose Physical.
7. Lobby and battle share the larger animated VS. Reduced motion remains readable.
8. New raised tiles independently use heights 1/2/3 at default 60/30/10; neighboring heights may differ. Master elevation percentages total 100%, publish/reload precisely, affect new battles and leave existing maps intact.
9. Equal initiative randomly chooses the initial actor and remains pinned on reload. Chronicle actor order follows actual round initiative.
10. All borders and facing arrows use each character's unique color. The map arrow's direction is readable against terrain.
11. Skill/effect popups have no black highlighted explanations or redundant arm-move footer. Root, Slow and each named tag identify their own description.
12. Pending yellow tags become live green/red without flashing an empty rail. Burn, Poison and other DoTs remain visible after the first tick until their actual expiry/removal.
13. Chronicle distinguishes actual Fire/other elemental damage and critical hits. Ground entry receipts read Ground Effect without internal identifiers.
14. Cleanse consistently removes Burn, Bleed, Poison, Slow, Rooted, Vulnerable, Marked and Taunted across Skill/Essence/Resonance, including qualifying independent applications.
15. Basic Attack shows every legal empty cardinal tile. Damaging Discipline/Essence Skills retain their full authored Single/Line/Circle/All potential coverage when a character is detected, with no legacy styling flash.
16. Circle's excluded caster tile has no blue center fill. Units outside any legal footprint have no red outline.
17. Ordinary self buffs and Guard fill exposed tile space blue. Any Heal/HP or MP recovery tag makes unit targeting green. Ground targeting takes orange priority.
18. Ground Single selects one legal tile, Line the chosen lane, Circle the authored caster-centered footprint and All only its authored eligible field. Orange coverage changes with the current aim.
19. Cast an eligible persistent Ground Skill on empty ground: the area is placed, command costs occur once, and fixed markers appear. Current defaults include Flame Burst 3 rounds, Venom Shot 4 and Chilling Mist 2.
20. Pending areas become animated at activation; their fixed tiles/preset survive source movement, defeat and reload. Expiry and battle completion/surrender remove the visual.
21. An eligible occupant receives the cast effect. Moving through or re-entering the active area applies its supported unit payload at most once per character turn cycle per cast. Separate casts are independent; Push/Pull checks crossed tiles and relocation only the landing tile.
22. Entry does not repeat AP/MP costs, cooldown, caster buffs, summons, Copy or Resonance. Root/defeat can stop actual movement, charging only traversed tiles. Unit statuses can remain after the area expires.
23. Burn scheduled damage uses its captured attack percentage/decay. Extra backlash is the authored percentage of actual enemy HP damage caused by the burning unit, defaults to 10%, and occurs only once per turn cycle. Misses, friendly damage and zero hostile HP loss do not trigger it.
24. Poison scheduled ticks use its authored attack percentage. Five traversed tiles allow one extra tick per turn cycle; further movement that cycle causes none, partial progress carries, and excess thresholds do not bank future ticks.
25. Burn/Poison valid reapplications replace/restart the application while per-cycle extra-trigger caps remain consumed. Copy/reload cannot renew the cap. Scheduled ticks remain independent; Bleed applications retain separate lifetimes.
26. Self/Ally labels reflect actual caster eligibility. Positive Fire damage clears Wet/Frozen from legal damaged recipients and converts eligible Frozen terrain to Steam; it does not automatically allow attacks against self/allies.
27. Current Resonance Setup saying Chronist Skills accepts both Chronist attack and non-attack Skills. Other Discipline/tag requirements stay explicit, and the next Skill must satisfy Trigger for Result.
28. After clicking an action then Escape, another battle hotkey works immediately without a clearing click or Tab focus box. Reading/dialog input guards remain intact.
29. Post-battle Review Battle Log gives a readable complete Chronicle, scrolls internally and retains summary/reward controls on desktop/mobile.
30. Master Ground duration, activation, animation and Burn percentages validate, publish, reload and roll back exactly. Invalid definitions, stale updates and unauthorized requests are rejected; existing battles keep pinned content.
31. Compare desktop/mobile PvE, PvP and spectators, including reduced motion. Previewing/reading never spends AP/MP or changes RNG/state, and spectators receive no private area payload.

## Rulings carried from implementation

- Preserve native execution and the existing isolated task checkout under standing implementation/release authorization. Cost if wrong: exact-source review and clean-branch gates remain mandatory.
- Append current wording revisions for all 136 Resonances and broaden only Chronist Setup to any Skill; Any Skill remains Setup-only. Cost if wrong: historical versions remain pinned and actual published overrides must be checked.
- Turn-cycle trigger claims live independently from status applications so reapplication/Copy cannot reset them. Ground entry consumes the same cycle authority. Cost if wrong: forced movement before the first turn and reload tests gate release.
- Ground creation trusts the canonical server-resolved footprint rather than recalculating it later. Cost if wrong: fixed placement, validator and privacy tests remain mandatory.
- Mount one shared per-tile Ground layer in playable and spectator maps because the presentation bundle receives no runtime tile state. Cost if wrong: a later bundle interface can expose tile state without changing mechanics.
- Replace the raw Final Turn projector after reproducing missing Burn rows after the first tick. Cost if wrong: entitled projection and frozen-build tests remain mandatory.
- Clear Ground before surrender validation after reproducing terminal-state failure. Cost if wrong: actual persisted surrender cleanup gates release.
- Aggregate movement step receipts into one command receipt and charge only traversed steps. Cost if wrong: interruption/AP/placement tests gate release.
- Accept current frozen caster Accuracy up to 140% before Evasion, while bounding ordinary probability fields separately. Cost if wrong: validator regression tests remain mandatory.
- Strengthen reduced-motion selector specificity after actual Frost animation remained running. Cost if wrong: all three presets are checked in Chromium.
- Defer terminal completion for nested displacement-triggered Ground pulses until the enclosing command settles Burn backlash. Cost if wrong: lethal push, surviving-ally and draw regressions must prove one final result.
- Separate frozen Ground outgoing calculation values from live entrant incoming values, including caster self-entry. Cost if wrong: saved offense/current Guard and dead-source regressions gate release; no calculation shadow may replace live HP mutations.
- Require complete frozen stat profiles for the pinned bridge/balance rules on Ground reload. Cost if wrong: missing/null profile, required-field and provenance failures must reject before execution.
- Carry the pinned DoT-trigger policy into historical Skill readers rather than deriving it from today's content. Cost if wrong: the 72-case current/historical reader matrix and immutable-version checks gate release.
- Restore inherent Guard's canonical target metadata for shared self-selection paint. Cost if wrong: desktop/mobile PvE/PvP Guard and pure self-buff checks must retain blue, while recovery stays green and Ground stays orange.

Final review closeout, exact source/CI identity and Production receipt will be recorded at release.

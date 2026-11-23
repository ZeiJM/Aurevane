# Owner stat balance and battle reader specification

Approved by the Owner's 2026-10-05 requests in the active conversation. This batch includes the keyboard tile outline correction, viewport-fitting result readers, standardized ability parameters and the following stat rules.

## Authority and compatibility

New character calculations use derived ruleset 4. Historical rulesets 1–3 remain explicit and immutable. New encounters pin `statBalancePolicyVersion: 1` separately from existing combat bridge schema/rules 4, preserving all Level/Critical/current damage adapters. Encounters without that policy retain their recorded movement, damage, hit chance and RNG semantics. Internal `armor`/`ward` keys remain; all current visible labels are Physical Defense/Mystic Defense.

Primary Discipline still contributes its approved Core base and focus/non-focus caps (60/40). Retired Primary Adventure-stat offsets/caps are not applied to ruleset 4; equipment/explicit modifiers remain separate. Level no longer adds to these baseline derived curves; existing relative-Level combat scaling remains.

## Curves

Core means the relevant effective attribute including Primary Core base. Base is a mathematical intercept; real characters retain positive Core values. Round down final integer units/basis points. Core 40/60 anchors hold before equipment or temporary effects.

| Stat              | Core      | Base | At 40 | At 60 |
| ----------------- | --------- | ---: | ----: | ----: |
| Physical Power    | Might     |   40 |   120 |   160 |
| Mystic Power      | Intellect |   40 |   120 |   160 |
| Physical Defense  | Vitality  |   40 |   120 |   160 |
| Mystic Defense    | Resolve   |   40 |   120 |   160 |
| Maximum HP        | Vitality  |   80 |   160 |   200 |
| Maximum MP        | Intellect |   16 |    32 |    48 |
| Accuracy          | Finesse   |  85% |  110% |  140% |
| Evasion           | Agility   |   0% |   25% |   55% |
| Critical Chance   | Finesse   |   0% |   15% |   20% |
| Initiative        | Agility   |   10 |   100 |   120 |
| Movement          | Agility   |    2 |     4 |     4 |
| Jump              | Agility   |    0 |     3 |     3 |
| Status Resistance | Resolve   |   0% |   10% |   15% |

Power/Defense/HP add 2 per Core. MP adds .4 through 40, .8 thereafter. Accuracy/Evasion add .625 percentage points through 40, 1.5 thereafter. Critical adds .375 percentage points through 40, .25 thereafter. Initiative adds 2.25 through 40, 1 thereafter. Movement is `2 + floor(Core/20)`, capped 4. Jump is `floor(3*Core/40)`, capped 3. Resistance is .25 percentage points per Core, capped 15%. Accuracy is a rating up to 140%, never clamped before subtracting Evasion; final hit probability clamps 0–100%. Existing authored accuracy/status modifiers remain additions to effective Accuracy.

The delegated Power/Defense/HP/MP choice uses the current shared formula `raw = magnitude + floor(Power * AP / 200 / packetCount)` and `damage = floor(raw * 100 / (100 + Defense))`, minimum 1. Equal-Core, equal-Level physical magnitude20/AP60 gives 22/25/26 damage at base/40/60 against HP80/160/200; mystic16 gives20/23/24. Ordinary mystical AP45–60 cost3–4MP, providing bounded initial casting pools before recovery. Published recovery/drain effects may refill or exhaust these pools; AP, cooldowns and prerequisites remain their existing limits. Existing mystical resource/healing/Barrier scaling remains intentionally powerful tempo; this release does not silently rewrite published immutable Skills. Physical/mystic 20/16 are authored base-magnitude guidance, not final HP damage caps. Preserve documented rare authored exceptions and audit current catalog.

## Elevation

For policy1, entering a raised tile requires Jump >= destination absolute elevation, including chained adjacent height steps and sideways entry. Descending is allowed so a character is never trapped after displacement; normal terrain, AP/path and occupancy rules still apply. Rewind/push/pull reuse the same policy. Historical movement retains delta-only access.

While at height1/2/3, dynamic Evasion adds15/20/25 percentage points and both defenses are multiplied by .8 (floor before damage mitigation). A Skill's authored Target Elevation >= target absolute height bypasses only this terrain Evasion. Basic Attack retains it. Existing delta-based target legality is unchanged. Elevation bonuses are position-derived: leaving removes them immediately, they are never persistent/copyable/cleansable statuses. Rail projection shows both active effects with "while on elevated terrain" and respects viewer/Covert privacy.

## Status Resistance

Pin resistance in every new combat profile. For a successful ordinary Skill, draw once per living hostile recipient with nonzero resistance and at least one eligible harmful debuff; filter resisted ordinary debuff ordinals before pending scheduling. Retain damage/resource outcomes/costs/cooldowns, and never reroll at activation. Eligible ordinary negative statuses, Poison/Burn/Bleed and hostile Curse transfer resist. Damage, MP drain, cleanses, beneficial effects, self-costs, terrain/displacement/rewind do not. Curse resistance leaves donor provenance unchanged. Sensory purge remains even if Revealed resists.

Per-effect canonical origin family controls exemptions: Essence, Resonance, Ascension and Severance always bypass. No ability-name guessing. Ordinary debuffs may resist while the same cast's Resonance bonus succeeds. Forecasts expose probability without drawing RNG; AI discounts eligible ordinary debuff utility.

## Reader and input requirements

Attack Skill Type shows `Attack [Physical]` (red) or `Attack [Mystic]` (green), determined by canonical damage family, throughout Skill parameter readers. Resonance type is exactly Resonance; ability headings contain the canonical name without redundant family prefix. Discipline/Resonance effect labels, magnitude and duration share their approved white/gold/teal palette. Retain complete information and contrast on parchment.

Suppress native unrelated map focus rectangles for unselected tiles in all shared playable/spectator battle modes; preserve intentional inspection/range/target cues and controls.

Open result-log windows fit the actual viewport in PvE/PvP victory/loss/draw, with no outer scroll needed to reach the log. Keep complete summary/artwork, visible controls/footer and internal log scrolling. Short/mobile screens may use separate bounded summary/log readers. Preserve all artwork dimensions.

## Verification and release

Focused red/green core tests, historical snapshot regression, production-renderer browser matrices, full `pnpm check`, browser suite and build are required. No new dependencies, client authority, DB rewrite or unrelated Phase5 work. Freeze/review exact candidate after fresh Main reconciliation. Publish one combined Owner-authorized Production release only after all checks pass; restore the deployment lock and record actual evidence.

# Minimum Skill information contract

Owner-approved 2026-10-02. This is the minimum report for **every full Skill detail view**, including Discipline Skills, Essence, inherent commands, Support Actions and passive/triggered effects such as Resonance. It is a presentation rule, not a change to combat mechanics.

## Required fields and order

| Field | Convention |
| --- | --- |
| Skill Type | Attack, Recovery or Utility for active Skills; Passive plus the passive family for triggered/passive effects. |
| Cost | Numeric AP, with MP when used: `45 AP / 3 MP`. Zero is a real cost (`0 AP`), not N/A. Conditional/formula costs state their basis and modifiers. |
| Cooldown | `1 turn`, `2 turns`, etc., using the definition's owner-turn boundary. `None` means an active action has no cooldown; a passive without an independent cooldown uses `N/A`. |
| Requirements | Actual use prerequisites/trigger conditions. `None` means no additional prerequisites. Passive equipment, setup and trigger conditions remain visible. |
| Effects | Every executable effect, in authored order, with magnitude and duration when applicable. Compact values use `Dmg [12]` or `Guarded [15%] [2 Turns]`; formulas/percentage recovery remain formulas instead of fabricated character-specific amounts. Retain recipient information and full explanations where needed. |
| Range | Maximum tile range, matching the current compact parameter design. Self-only and untargeted passive actions use `N/A`. Movement states its remaining allowance. Owner refinement 2026-10-02: omit the duplicate Legal range prose from full detail views; engine targeting constraints remain authoritative. |
| Target | Actual target policy/recipient: Self, Enemy, Ally, Any Unit, Ground or Empty Ground. Passive reports identify result recipients instead of pretending the passive has a separate selection. |
| Target Method | Single, Circle or Line for authored targeting; Path/Facing where appropriate to an inherent command. Untargeted passives use `N/A`. |
| Target Elevation | Authored maximum elevation difference; `N/A` when no independent elevation constraint applies. Movement states its committed Jump/profile rule. |
| Line of Sight | Required or Not required for targeted actions; `N/A` for self-only actions or passives with no independent targeting. |

All ten labels must appear exactly once, in this order. Area geometry belongs in Target Method (including radius/length), and distinct recipients/friendly-fire behavior belongs in Target. Applicable effect explanations, trigger timing, caps, repeat-use rules and mode overrides follow the fields. Do not add a redundant targeting-summary paragraph below the table. A compact action bar, forecast or card may summarize information, but its full detail view must provide the complete minimum report. Do not enlarge or reflow the fixed battle cockpit/forecast to hold this report.

Owner refinement 2026-10-03: Resonance uses the active Skill's single aligned table, compact highlighted effect values and explanation bullets. Remove Mode, Setup and Trigger rows. Requirements contains the setup matcher, or N/A when no setup applies. Each Effects line is `trigger matcher: result`; Target already identifies Self, so omit duplicate Self recipients from Effects. Retain other result recipient distinctions. Nexus, battle-pinned reports and Master draft previews share `ResonanceParameters`; passive execution remains governed by the pinned engine definition and triggering Skill legality.

## N/A, None and unavailable history

Use **N/A only for genuinely inapplicable fields**. Do not hide the label, display an empty value, replace a numerical zero with N/A, or imply that an active action has no cost/cooldown because metadata is missing. **None** describes an applicable rule with no prerequisite/cooldown. **Unavailable** honestly describes missing immutable historical metadata; never reconstruct old battle mechanics from today's catalogue.

Resonance currently has no independent resource cost, cooldown, range, target shape, elevation or line-of-sight check. Those fields use N/A. Requirements reports the setup matcher or N/A; the trigger matcher prefixes each Effects result. The triggering Skill's legality still governs execution. Preserve actual setup/trigger/recipient rules. If a future passive has an authored independent cooldown or targeting constraint, report it rather than inheriting today's N/A defaults.

## Shared implementation and authoring

`skill-information-contract.ts` owns the labels/order and requires all fields at the typed call site. `skill-detail-presentation.ts`, `basic-action-presentation.ts` and `resonance-detail-presentation.ts` derive values from canonical definitions. Nexus, full Skill details, battle parameter views and Master Panel read-only draft projections reuse them. Full battle reports consume committed definitions and effective battle costs; Nexus consumes current resolved definitions; Master Panel reports its editable draft and keeps validation/publication separate.

The Master Panel must retain typed mechanics as the source of truth. These report fields are derived display output, not another editable set of mechanics or publishable author-supplied claims. New Skill/passive families and future equipment/supernatural editors must add a contract adapter before exposing a full detail view. Validation must continue rejecting malformed definitions through canonical engine authority; a complete-looking report never implies validation, publication or combat legality.

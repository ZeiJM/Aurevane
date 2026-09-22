# A03 Phase 4 Roster Rebalance Design

**Date:** 2026-09-22  
**Status:** Owner-approved design; implementation pending written-spec review  
**Branch:** `agent/a03-phase4-roster-rebalance-20260922`

## Purpose

A03 is reopened because the existing Phase 4 balance work did not perform a complete parity pass across all 17 published Disciplines. The goal of this work is to correct systemic combat-value inconsistencies first, then tune class-specific outliers against one coherent Level-100 combat model.

This work does not attempt to make all Disciplines produce equal raw DPS. AUREVANE's role identities remain intentionally asymmetric: tanks buy protection/control, supports buy healing/cleanse/utility, controllers buy denial and setup, ranged classes buy reach and positioning, and burst classes buy damage through conditions or risk.

## Scope

This design covers:

- current combat rules v3 and Level 1-100 characters;
- all 17 published Disciplines;
- all current regular Discipline Skills;
- all current pure Essence Skills;
- Basic Attack;
- derived-stat combat payoff where it directly affects A03;
- AP efficiency, MP cost, direct-damage scaling, Critical Chance, repeat-use interaction, range/control/support compensation, and representative Resonance implications;
- version-safe migration/publication so historical battles retain pinned old semantics;
- automated balance-harness coverage used to identify class-specific follow-up changes.

A04 human differentiation tests remain separate and should run after A03 stabilizes. A07 audio/art work and A10 final Owner acceptance remain out of scope for this implementation.

## Current defects being corrected

### 1. Direct Skill Power scaling is not AP-weighted

Current combat-rules-v3 mature Skills receive the same total 25% offensive-Power contribution regardless of AP cost. This makes cheap attacks disproportionately efficient at high Power and compresses the intended value of expensive finishers.

### 2. Basic Attack is too efficient relative to authored Skills

Basic Attack costs 30 AP and currently uses a 25% Physical Power coefficient while remaining repeatable without mature-Skill consecutive-use falloff. A high-Might character can therefore execute three full-strength Basic Attacks in one ordinary 100-AP turn, creating a risk that the universal filler command outperforms class identity.

### 3. Mystic MP costs are inconsistent by content age

Later advanced mystic Skills use the established authored convention `max(2, floor(AP / 15))`, while several older Foundation mystic Skills and Essence Skills were authored before this policy and still cost zero MP. Resource economy therefore differs by library age rather than intended class identity.

### 4. Finesse has an advertised offensive payoff that is absent from live combat

The current derived-stat rules calculate Critical Chance from Finesse and Profile text presents Critical Chance as a Finesse benefit. The current combat stat bridge does not carry Critical Chance into authoritative live combat resolution. Accuracy also reaches its hard cap well before maximum Finesse, so high-Finesse builds can spend a meaningful part of their focus budget on a stat with no second offensive payoff.

### 5. Combat documentation contains stale Basic Attack math

Canonical COMBAT documentation still contains an older Basic Attack equation that conflicts with current Physical Power plus separate relative-Level combat rules.

## Approved systemic balance model

### AP-weighted offensive Power scaling

Regular damaging Skills and Essence Skills under current combat rules v3 use a total offensive-Power coefficient proportional to AP cost:

```text
totalPowerCoefficientBasisPoints = AP cost × 50
```

Representative values:

| AP | Power coefficient |
|---:|---:|
| 25 | 12.5% |
| 30 | 15% |
| 35 | 17.5% |
| 40 | 20% |
| 45 | 22.5% |
| 50 | 25% |
| 55 | 27.5% |
| 60 | 30% |
| 65 | 32.5% |

For commands with multiple ordinary direct-damage blocks, the total coefficient is divided deterministically across eligible damage blocks using the same single-command total budget principle already present in the engine. Multi-hit attacks must not multiply the total Power budget by their hit count.

Historical battle snapshots keep their pinned definitions/rules. Current content changes are versioned rather than silently reinterpreting old persisted battles.

### Basic Attack normalization

Current-rules-v3 Basic Attack remains:

- 30 AP;
- universal;
- melee;
- repeatable;
- Physical Power based;
- subject to ordinary accuracy, Armor, facing, statuses and relative-Level damage.

Its Physical Power coefficient changes from 25% to 15%, matching the new 30-AP scaling baseline.

Basic Attack remains a dependable filler action, but should not be the highest-efficiency default damage rotation for high-Might builds.

### Mystic MP normalization

Every current published regular Skill or Essence Skill tagged `mystic` uses:

```text
mpCost = max(2, floor(AP cost / 15))
```

unless a deliberately authored future exception is separately versioned and justified.

This migration fills missing MP costs on older Foundation content and keeps existing advanced costs that already match the formula. Non-mystic Skills are not charged MP merely for balance symmetry.

Consecutive mature-Skill repeats continue to pay unchanged AP/MP costs while quantitative effectiveness is halved.

### Critical Chance becomes authoritative

Combat-rules-v3 stat profiles gain authoritative `criticalChance`.

For eligible direct-damage commands:

- Critical Chance is read from the committed attacker profile.
- A critical result multiplies qualifying direct damage by 150%.
- Critical resolution occurs only after a successful hit for hostile accuracy-gated targets.
- One critical roll is made per affected target per command.
- All eligible direct-damage packets against that target share that result.
- Multi-hit Skills therefore do not roll independently per hit.
- DoT ticks, Burn, Bleed, Poison, Reflect, Vengeance-derived reactive output, fixed/system damage and other non-direct damage do not crit unless a future explicit typed rule says otherwise.
- Crit preview shows probability only and never samples RNG.
- Commit uses deterministic battle RNG and records a versioned receipt.
- Historical stat-bridge versions remain valid without Critical Chance.

This restores the second offensive payoff of Finesse instead of compensating Finesse-focused classes with artificial blanket base-damage buffs.

## Balance principles for all 17 Disciplines

The first class pass occurs after the systemic model above is in place. Do not numerically change a class merely because its raw DPS is lower.

### Vanguard

Preserve frontline bruiser identity. Re-evaluate authored Skill bases after Basic Attack normalization. Keep durability/guard value in the budget.

### Farstrider

Critical activation is the primary missing offensive payoff. Preserve range as meaningful value. Aimed Shot and Longshot should only change if the balance harness still shows a material deficit/excess after crit and AP scaling.

### Shadehand

Preserve facing/opportunist identity. Critical activation plus positional multipliers should be tested before any raw base buff. Perfect Opening and rear-facing rotations receive dedicated ceiling tests.

### Ironfist

Audit cheap conditional payoff efficiency after AP scaling. Counter Palm, Hammer Knuckle, setup-to-payoff turns and Hundredfold Rush receive dedicated tests.

### Aetherist

Normalize MP costs and AP-weighted Mystic Power scaling before any base-damage change. Ranged area coverage remains part of its budget.

### Lifebinder

Normalize MP costs on mystic offense and Verdant Rupture. Healing/support output remains role value and is not judged against pure DPS classes.

### Bastion

Low raw offense is intentional when compensated by protection, Challenge, Guarded/Fortified and control. No blanket damage buff.

### Ravager

Preserve high-risk/high-output identity. Test Frenzy, Bleed, low-HP execution and self-exposure together.

### Edgedancer

Critical activation is central. Preserve facing and setup/payoff skill expression. Do not automatically buff direct bases.

### Wildwarden

Evaluate range, Root/Slow/Mark/Poison and attrition as part of total value. Critical activation restores Finesse payoff.

### Runeblade

Audit hybrid Might/Intellect access, MP drain/recovery and Physical/Mystic split. Avoid rewarding dual offensive-stat access twice for the same effect.

### Dawnshield

Healing, cleanse, Guarded/Inspired and rescue utility are part of the budget. Test Radiant Strike into Judgment after systemic normalization.

### Cinderweaver

Burn, area pressure and Fire interactions remain role value. Re-evaluate direct damage only after AP scaling.

### Frostweaver

Root/Frozen/terrain denial is major combat value. Do not compensate control with unnecessary damage.

### Stormsinger

Wet/Conductive and lane control remain part of damage budget. Test elemental 20% payoff after new scaling.

### Tidecaller

Healing, cleanse, Wet, Slow/displacement and sustain are part of its budget. Lower raw damage is acceptable if support/control value is competitive.

### Chronist

Tempo, Haste, Slow, Root, Rewind and initiative effects require dedicated utility scenarios. Raw DPS is not its primary parity metric.

## Balance harness

A03 adds a deterministic balance harness that reports comparable representative scenarios rather than fabricating a single universal class score.

Minimum scenario matrix:

- Levels 25, 50 and 100;
- representative offensive allocation and representative balanced allocation;
- equal-Level opponent profiles;
- representative Armor/Ward targets;
- PvE and PvP context where an override exists;
- no-movement 100-AP damage turns;
- one-normal-tile movement plus remaining action economy;
- common setup → payoff pairs;
- pure Essence turns;
- representative mixed Resonance setup/payoff turns;
- repeat-use penalty cases;
- healing/recovery output;
- mitigation/protection value;
- movement/control AP denial;
- MP spent and MP restored;
- range/area target-count assumptions kept explicit.

The harness produces raw comparable measures and flags outliers; it must not encode a hidden single-number “class power score” that treats all roles as interchangeable.

## Versioning and historical safety

- Existing battle-pinned Skill and Essence versions are immutable.
- Current content receives new versions for any MP/base/metadata change.
- Combat rules/stat bridge changes are versioned.
- Existing historical v1/v2/v3-compatible snapshots remain readable under their original semantics.
- No migration rewrites historical battle snapshots.
- New battles pin the new current versions only after publication/activation.
- Database publication remains through the existing versioned combat-content authority; no client direct-write path is introduced.

## Tests

Required automated coverage includes:

1. AP-weighted Power coefficient exact values and multi-hit coefficient conservation.
2. Basic Attack 30-AP coefficient is 15%.
3. Current mystic regular Skills and Essences all have the normalized MP formula; non-mystic content does not gain MP cost.
4. Historical Skill/Essence versions retain their prior MP values.
5. Critical Chance is carried through current character-derived combat profiles.
6. 0%, intermediate and capped crit chances resolve deterministically.
7. One target gets at most one crit roll per command regardless of packet count.
8. Multi-target attacks resolve crit independently per target in stable order.
9. Missed targets do not consume a crit roll.
10. DoTs/reactive/fixed damage cannot crit.
11. 150% multiplier is applied in the documented deterministic resolution stage.
12. Preview does not advance RNG.
13. Serialization/reconnect preserves current critical-capable battle state.
14. Representative 17-Discipline balance-harness scenarios remain finite, deterministic and schema-valid.
15. Existing authority, repeat-use, accuracy, Resonance, Essence, PvP, AI and battle-history tests remain green.
16. Repository format/lint/type/test/build and applicable database/browser gates pass on the exact head before publication.

## Documentation

Update canonical combat documentation to remove the stale Basic Attack Level/Might/Finesse equation and describe:

- current Level-100 derived-stat ownership;
- Basic Attack's current Physical Power coefficient;
- AP-weighted mature-Skill Power scaling;
- normalized mystic MP policy;
- Critical Chance resolution;
- the fact that relative Character Level remains a separate damage multiplier.

Update Phase 4 closeout documentation to record A03 as rebalanced/automated only after exact-head verification. A04 remains the human tactical-differentiation gate.

## Non-goals

This work does not:

- close A04, A07 or A10;
- redesign the 100-AP turn economy;
- change the four-Technique loadout rule;
- redesign Resonance/Essence identity;
- add equipment catalogs;
- add supernatural systems;
- add world/Phase-5 systems;
- change character Level cap or 60/40 focus/non-focus caps;
- alter production deployment settings without separate release authorization.

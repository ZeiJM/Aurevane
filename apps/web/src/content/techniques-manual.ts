import { latestEnabledMatureSkills } from '@aurevane/game-core/combat/mature-skills'
import {
  currentSkillDamageScaling,
  CURRENT_SKILL_POWER_SCALING_PER_AP_BASIS_POINTS,
} from '@aurevane/game-core/combat/damage-scaling'
import {
  combatLevelDamageModifierBasisPoints,
  COMBAT_LEVEL_CLOSE_RANGE,
  COMBAT_LEVEL_CLOSE_STEP_BASIS_POINTS,
  COMBAT_LEVEL_FAR_STEP_BASIS_POINTS,
  COMBAT_LEVEL_DAMAGE_MIN_BASIS_POINTS,
  COMBAT_LEVEL_DAMAGE_MAX_BASIS_POINTS,
} from '@aurevane/game-core/combat/combat-level-scaling'
import { COMBAT_CRITICAL_DAMAGE_BASIS_POINTS } from '@aurevane/game-core/combat/combat-critical'
import {
  CONDITIONAL_DAMAGE_MINIMUM,
  CONDITIONAL_DAMAGE_MAXIMUM,
} from '@aurevane/game-core/combat/damage-modifiers'
import {
  CURRENT_BURN_DAMAGE_BY_STAGE,
  CURRENT_BURN_BACKLASH_DAMAGE,
  CURRENT_POISON_DAMAGE,
} from '@aurevane/game-core/combat/combat-dots'
import { getFoundationDiscipline } from '@aurevane/game-core/character/foundation-disciplines'
import { previewEffect } from '@/components/character/skill-effect-preview'
import {
  skillDisplayName,
  skillCostDescription,
  skillEffectsSummary,
  skillRequirementsSummary,
  skillCompactRangeDescription,
  skillTargetDescription,
  skillTargetMethodDescription,
} from '@/components/character/skill-detail-presentation'
import type { ManualArticle } from './public-information'
import { techniqueMagnitudeBands } from './technique-magnitudes'

const skills = latestEnabledMatureSkills()
const statusIds = [
  ...new Set(
    skills.flatMap((skill) =>
      skill.effects.flatMap((effect) => (effect.type === 'apply-status' ? [effect.statusId] : [])),
    ),
  ),
].sort()
const bandRows = techniqueMagnitudeBands(skills).map((band) => [
  `${band.family} (${band.unit})`,
  band.count ? `${band.minimum}–${band.maximum}` : 'Not in this catalog',
  band.count ? `${band.lowerQuartile}–${band.upperQuartile}` : '—',
  String(band.count),
])
const disciplineIds = [...new Set(skills.map((skill) => skill.sourceDisciplineId))]

export const techniquePowerSummary = `Authored quantitative Skill effects use a 1–20 Power scale. For direct damage, that authored Power is the base component and AP also controls the added contribution from the matching character Power rating: AP cost × ${CURRENT_SKILL_POWER_SCALING_PER_AP_BASIS_POINTS / 100}% of Physical Power or Mystic Power, divided among normally scaled damage blocks. Higher-AP Skills therefore gain more output without multiplying every effect without limit.`

export const techniquesManualArticle: ManualArticle = {
  id: 'manual.techniques-damage-effects',
  slug: 'techniques-damage-effects',
  title: 'Techniques, Damage & Effects',
  summary:
    'Read a Technique, understand each step of damage, and compare magnitudes across the current regular Skill catalog.',
  category: 'Combat',
  lastUpdated: '2026-09-27',
  rulesVersion: 'Current combat rules v4 · regular Skill catalog',
  body: [
    {
      id: 'technique-basics',
      title: 'Skills and your four Techniques',
      paragraphs: [
        `Skill is the umbrella term for combat abilities. The current regular catalog contains ${skills.length} Techniques across ${disciplineIds.length} Disciplines, with eight learnable Techniques per Discipline. Select up to four in Nexus → Manage Techniques. A pure build selects from its Primary library and gains a separate Essence Skill; a mixed build selects four total from its Primary and mastered Secondary libraries, with a 1+3, 2+2 or 3+1 full loadout and a separate Resonance passive.`,
        'Primary supplies the base stat profile; Secondary does not add a second base profile. Learned availability and earned Mastery still govern which Techniques you can select. Battles use committed content versions: editing your build does not rewrite a battle in progress.',
        'Equipment Skills, Essence Skills and copied battle Skills have their own sources. The magnitude comparisons below cover only the current regular catalog, excluding those sources, historical versions and temporary battle modifiers. Published overrides or already-pinned battles may differ; their actual Technique and battle previews take precedence.',
      ],
    },
    {
      id: 'read-preview',
      title: 'Reading the Technique Preview',
      paragraphs: [
        'Read Skill Type, Cost, Cooldown, Requirements, Effects, Range, Target, Target Method, Target Elevation and Line of Sight in that order. Requirements must be satisfied before use. Costs are AP and, where listed, MP. A circle radius and a line length describe affected tiles, not damage multipliers.',
        'Quantitative effect numbers use a bounded 1–20 authored Power scale. Dmg [7] means damage Power 7 for that block before character Power, Level, defenses and other combat modifiers. Healing [4] and MP Restore [4] use the same bounded authoring scale for their own effect families. Equal repeated damage entries are separate hits, not duplicate labels to discard.',
        'A named status keeps its identity, but its percentage can be authored by the specific Skill. One Guarded application can reduce incoming damage by 15% while another can be tuned to 10%. “pp” means percentage points: an Accuracy modifier adds or removes points rather than multiplying damage. Setup, melee and other design tags are not extra effects.',
      ],
    },
    {
      id: 'power',
      title: 'Base damage and Power magnitude',
      paragraphs: [
        techniquePowerSummary,
        `For a normally scaled direct-damage block: coefficientBP = floor(AP cost × ${CURRENT_SKILL_POWER_SCALING_PER_AP_BASIS_POINTS} ÷ number of normally scaled damage blocks); Power bonus = floor(matching Power × coefficientBP ÷ 10,000); raw damage = authored damage Power + Power bonus. A basis point is 0.01%. Explicitly authored scaling is retained; Vengeance uses its recorded-damage rule instead of receiving another automatic Power budget.`,
        'The budget is split across hits before integer rounding. It is not granted in full to each hit. Area effects resolve independently against each recipient; damage is not divided by the number of targets. The runtime uses the effective command AP cost, including a relevant override.',
      ],
      table: {
        caption: 'Current AP-driven Power contribution',
        headers: ['AP / hits', 'Power coefficient per hit'],
        rows: [
          [25, 1],
          [30, 1],
          [35, 1],
          [40, 1],
          [45, 1],
          [50, 1],
          [55, 1],
          [60, 1],
          [65, 1],
          [50, 2],
          [60, 3],
          [65, 7],
        ].map(([ap, hits]) => [
          `${ap} AP / ${hits} ${hits === 1 ? 'hit' : 'hits'}`,
          `${currentSkillDamageScaling('physical-power', hits, ap).coefficientBasisPoints / 100}%`,
        ]),
      },
    },
    {
      id: 'damage-order',
      title: 'The damage calculation, in order',
      paragraphs: [
        'The server first checks legality and resolves any Accuracy check. A miss does not apply the missed target’s hostile effects. For each successful direct-damage block, the following order matters because each multiplication rounds down separately:',
      ],
      bullets: [
        '1. Start with the authored damage Power, from 1 to 20 for ordinary current damage blocks.',
        '2. Add floor(matching Power × coefficientBP ÷ 10,000), where the coefficient rises with AP cost and is divided among normally scaled damage blocks.',
        '3. Apply Armor or Ward: floor(raw damage × 100 ÷ (100 + defense)), with a minimum of one for positive raw damage. Piercing skips this defense step.',
        `4. On an eligible critical hit, multiply by ${COMBAT_CRITICAL_DAMAGE_BASIS_POINTS / 10_000} and round down. One critical result is shared by all eligible damage blocks against the same target in that command.`,
        '5. Apply the attacker-versus-defender Level multiplier below, rounding down. Self-damage does not receive this relative-Level adjustment.',
        '6. Apply any authored front/side/rear damage multiplier, rounding down. Only a Skill that specifies a facing multiplier receives one.',
        '7. Apply active damage-taken status modifiers. A Skill can author a status-specific percentage override, so the same named status can have different strength when applied by different Skills. Lowered Guard retains its separate system-owned timeout rule.',
        `8. Apply the combined conditional/status/elemental damage multiplier, bounded to ${CONDITIONAL_DAMAGE_MINIMUM / 100}–${CONDITIONAL_DAMAGE_MAXIMUM / 100}%, and round down. Piercing ignores eligible incoming reductions but not incoming increases.`,
        '9. Barrier absorbs direct damage first. Remaining damage reduces HP, bounded by the recipient’s current HP. Later multipliers can round a small hit to zero; the defense minimum is not a final guaranteed HP loss.',
      ],
    },
    {
      id: 'damage-example',
      title: 'A worked damage example',
      paragraphs: [
        'Example: a physical 40 AP Skill has one damage block at authored Power 7, the attacker has Physical Power 40, and the defender has Armor 25. At equal Levels, with no critical, facing bonus, status modifiers or Barrier: coefficient = 20%; Power bonus = floor(40 × 0.20) = 8; raw damage = 15; after Armor = floor(15 × 100 ÷ 125) = 12 HP.',
        'Raising AP can increase the Power contribution, while raising the authored damage Power changes the base component. Balance uses both levers; neither is intended to make a high-AP Skill unlimited or automatically superior to a lower-cost Skill in every situation.',
      ],
    },
    {
      id: 'level',
      title: 'Relative Level damage modifier',
      paragraphs: [
        `Let delta = attacker Level − defender Level. Within ±${COMBAT_LEVEL_CLOSE_RANGE} Levels, the multiplier is 100% + delta × ${COMBAT_LEVEL_CLOSE_STEP_BASIS_POINTS / 100} percentage points. Beyond that band, each additional Level changes it by ${COMBAT_LEVEL_FAR_STEP_BASIS_POINTS / 100} points in the same direction. The result is clamped to ${COMBAT_LEVEL_DAMAGE_MIN_BASIS_POINTS / 100}–${COMBAT_LEVEL_DAMAGE_MAX_BASIS_POINTS / 100}%. Character Levels run from 1 to 100.`,
        'Level does not directly increase Physical Power or Mystic Power. It supplies this separate direct-damage multiplier. Fixed periodic damage uses its own rules.',
      ],
      table: {
        caption: 'Level matchup examples',
        headers: ['Attacker → defender', 'Damage multiplier'],
        rows: [
          [50, 50],
          [60, 80],
          [80, 60],
          [25, 40],
          [40, 25],
          [50, 80],
          [80, 50],
          [40, 80],
          [80, 40],
        ].map(([a, d]) => [`${a} → ${d}`, `${combatLevelDamageModifierBasisPoints(a, d) / 100}%`]),
      },
    },
    {
      id: 'repeat-use',
      title: 'Cooldowns and requirements',
      paragraphs: [
        'Current authored Techniques and Essence Skills use power-based cooldowns from one to three owner turns. Stronger, broader or more effect-dense Skills generally receive the longer cooldown inside that range.',
        'A Skill with an explicit use Requirement has no runtime cooldown. Its Requirement is the limiter instead: if the condition is still true and you can afford the cost, the Skill can be used again at full authored effectiveness. Consecutive-use 50% falloff is retired.',
      ],
    },
    {
      id: 'effect-families',
      title: 'What each effect family does',
      paragraphs: [
        'Bracketed magnitudes describe authored effects, not guaranteed net results. Recipient, timing and conditions determine what happens.',
      ],
      bullets: [
        'Dmg: direct damage resolved through the full pipeline above. Multi-hit blocks resolve separately. Accuracy, defenses, criticals and active statuses change the actual result.',
        'Healing: restores HP without reviving a defeated unit. Multi-application recovery starts immediately, then continues at recipient turn ends. Hexed reduces both direct and periodic healing. Restoration cannot exceed maximum HP.',
        'MP Restore / MP Drain: adds or removes MP, bounded by the recipient’s resource limits. Repeated recovery lists its application count; a drain does not imply restoration unless another effect grants it.',
        'Barrier: grants a separate pool that absorbs direct damage before HP. No current regular Technique authors a Barrier grant, although the effect is supported by the combat system.',
        `Burn: ${CURRENT_BURN_DAMAGE_BY_STAGE.join(', then ')} fixed damage at the next three turn ends; reapplication restarts the sequence. A burning unit also takes ${CURRENT_BURN_BACKLASH_DAMAGE} backlash after a Basic Attack or damaging command.`,
        `Poison: ${CURRENT_POISON_DAMAGE} fixed damage at turn end and per five voluntarily entered tiles, carrying partial movement progress forward. It persists until removed; it has no finite three- or four-turn total. Forced displacement does not count as voluntary movement.`,
        'Bleed: authored fixed damage per turn-end tick, with an authored tick count. Up to three independent stacks coexist. Fixed DOT damage does not gain Power, Level or critical scaling.',
        'Apply status: grants the named condition; a stack count is not a percentage magnitude. Status percentages can be authored per Skill for incoming damage, outgoing damage, healing received, or Accuracy where relevant. Current Mark improves source Accuracy, while historical Marked increased source damage. Their meanings are not interchangeable.',
        'Cleanse / Dispel: removes the statuses explicitly listed by the Skill. Dispel removes protection; Cleanse removes harmful conditions. Neither automatically removes every effect in the game.',
        'Push / Pull: moves a unit one legal tile at a time, stopping at occupancy, obstacles or illegal elevation. Root prevents displacement. Return moves you to your vacant turn-start tile without restoring resources or undoing actions.',
        'Frozen Terrain: creates a temporary ground overlay affecting both teams; entering it costs extra AP unless Airborne. Fire converts it to Steam, which blocks sight. Unit effects still follow the Skill’s affected-team rule.',
        'Sensory / Skill Copy / Status Copy: supported specialized effects with separate eligibility rules. They are absent from this 136-Technique regular catalog; supported effect types do not imply that every Technique can use them.',
      ],
    },
    {
      id: 'magnitudes',
      title: 'Low, typical and high magnitudes',
      paragraphs: [
        `These figures are generated from the ${skills.length} latest enabled regular Skills. Compare within a family only: seven base damage cannot be ranked against seven MP or a seven-tile line. One observation is one effect block, except command damage totals and shape sizes. Multi-target effects are counted once, not once per potential target.`,
        '“Typical” is the inclusive lower-to-upper quartile interval (Q1–Q3). Low means below Q1; high means above Q3, within the observed range. Quartiles use nearest rank: sort the observations and take positions ceil(n × 0.25) and ceil(n × 0.75). Ties can leave a low or high band empty. A fixed-value or tiny family is a catalog comparison, not a reliable balance tier.',
        'DOT observations include each Burn stage and each authored Bleed tick magnitude; Poison contributes its fixed tick value but no finite duration. Total healing includes only effects with multiple applications, before missing-HP limits and healing modifiers.',
      ],
      table: {
        caption: 'Current catalog magnitude ranges',
        headers: ['Family', 'Observed range', 'Typical (Q1–Q3)', 'n'],
        rows: bandRows,
      },
    },
    {
      id: 'status-magnitudes',
      title: 'Status percentages and movement modifiers',
      paragraphs: [
        'Named status identities have defaults, but current Skills may author a bounded percentage override for the specific application. Damage dealt, damage received, healing received and Accuracy are separate dimensions. Haste and Slow each change movement by 10 AP per tile in opposite directions; Root blocks movement instead of adding an AP magnitude. The table shows default named-status behavior; the Technique Preview shows a Skill-specific override when one exists.',
        'A bracketed percentage may have a source or condition restriction: read its explanation. Reckless and Fortified each link a benefit with a drawback. A larger magnitude alone does not make a Skill stronger: AP/MP cost, range, area, requirements, duration, setup, payoff and repeat behavior all matter.',
      ],
      table: {
        caption: 'Current named effects',
        headers: ['Effect', 'Magnitude', 'Meaning'],
        rows: statusIds.map((id) => {
          const effect = previewEffect({
            type: 'apply-status',
            recipient: 'primary-unit',
            statusId: id,
            stacks: 1,
          })
          return [effect.label, effect.magnitude ?? 'Qualitative', effect.explanation]
        }),
      },
    },
    {
      id: 'catalog',
      title: 'The regular Technique catalog',
      paragraphs: [
        'Open a Discipline to compare its eight current Techniques. Each entry gives cost, effects, targeting and prerequisites. The Technique Preview and battle forecast provide contextual legality and final outcomes.',
      ],
      disclosures: disciplineIds.map((id) => ({
        title:
          getFoundationDiscipline(id)?.name ??
          id.replace(/\b\w/g, (letter) => letter.toUpperCase()),
        bullets: skills
          .filter((skill) => skill.sourceDisciplineId === id)
          .map(
            (skill) =>
              `${skillDisplayName(skill)} — ${skillCostDescription(skill)}. ${skillEffectsSummary(skill)}. ${skillTargetDescription(skill)}; ${skillTargetMethodDescription(skill)}; range ${skillCompactRangeDescription(skill)}. Requirements: ${skillRequirementsSummary(skill)}.`,
          ),
      })),
    },
  ],
}

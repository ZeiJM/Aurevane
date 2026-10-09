import { latestEnabledMatureSkills } from '@aurevane/game-core/combat/mature-skills'
import { standardSkillDamageScaling } from '@aurevane/game-core/combat/damage-scaling'
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
import { percentageDotDescription } from '@aurevane/game-core/combat/combat-percentage-dots'
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

export const techniquePowerSummary = `Current non-percentage Technique effects use a bounded authored power scale from 1 to 20. Higher-AP Skills receive more total effect budget, but area coverage, extra effects, long durations and strong utility consume part of that budget so high cost does not mean unlimited output. In new battles, each ordinary direct-damage packet adds 25% of its matching Physical or Mystic Power before defenses, independently of AP cost or packet count. Historical battles keep their recorded scaling.`

export const techniquesManualArticle: ManualArticle = {
  id: 'manual.techniques-damage-effects',
  slug: 'techniques-damage-effects',
  title: 'Techniques, Damage & Effects',
  summary:
    'Read a Technique, understand each step of damage, and compare magnitudes across the current regular Skill catalog.',
  category: 'Combat',
  lastUpdated: '2026-10-08',
  rulesVersion: 'Current combat rules · independent packets and captured recovery',
  body: [
    {
      id: 'technique-basics',
      title: 'Skills and your four Techniques',
      paragraphs: [
        `Skill is the umbrella term for combat abilities. The current regular catalog contains ${skills.length} Techniques across ${disciplineIds.length} Disciplines, with eight learnable Techniques per Discipline. Select up to four in Nexus → Manage Techniques. A pure build selects from its Primary library and gains a separate Essence Skill; a mixed build selects four total from its Primary and mastered Secondary libraries, with a 1+3, 2+2 or 3+1 full loadout and a separate Resonance passive.`,
        'Primary supplies the base stat profile; Secondary does not add a second base profile. Learned availability and earned Mastery still govern which Techniques you can select. Battles use committed content versions: editing your build does not rewrite a battle in progress.',
        'Equipment Skills and Essence Skills have their own sources. The magnitude comparisons below cover only the current regular catalog, excluding those sources, historical versions and temporary battle modifiers. Published overrides or already-pinned battles may differ; their actual Technique and battle previews take precedence.',
      ],
    },
    {
      id: 'read-preview',
      title: 'Reading the Technique Preview',
      paragraphs: [
        'Read Skill Type, Cost, Cooldown, Requirements, Effects, Range, Target, Target Method, Target Elevation and Line of Sight in that order. Skill Type is Attack, Recovery or Utility. Requirements must be satisfied before use. Costs are AP and, where listed, MP. Range shows only the maximum reach. Target Method shows Single, Line [X], Circle [X] or All. Line starts at the caster and covers X tiles in one cardinal direction, including empty tiles and every eligible occupant. Circle is centered on the caster: Circle [1] covers the eight surrounding tiles; Circle [2] covers 24 tiles including the inner ring. The caster tile is excluded, while separately authored self effects still apply. All reaches eligible units or ground across the board without positional range or line of sight.',
        'Identical effects group on one line with an application count while distinct effects retain separate lines. Bounded non-percentage effect power runs from 1 to 20: Dmg [7] means seven authored base power for each packet. HP Recovery [4%] means 4% of the recipient’s maximum HP, and MP Recovery [4%] means 4% of maximum MP. Recovery amounts are captured at cast, including HP Hex once; later maximum-stat changes do not recalculate the captured amount. Equal repeated damage entries remain separate hits, and the command pays its costs once.',
        'A positive duration is appended to the effect line, for example Slow [+10 AP] [2 Turns]. A duration of 0 is immediate and intentionally has no [0 Turns] label. New battles default to following-global-round activation, except direct damage and HP/MP recovery. Icons appear Pending immediately. After activation, ordinary timed statuses last their authored complete global rounds. Attack-based Burn, Poison and Bleed instead tick at affected turn end for their authored number of ticks. Each reader shows the pinned lifetime. Each battle keeps its pinned timing policy. Persistent duration consumes balance budget.',
        'Percentage-based effects use their percentage instead of the 1–20 power number. The same named status may be authored at different potency on different Skills—for example one Guard application may reduce incoming damage by 10% while another reduces it by 15%. The Technique Preview is authoritative for that Skill version. Current Single Techniques use authored range 1–5. Line and Circle use one reach X from 1 to 5, and All shows Range and Line of Sight as N/A. Target team, friendly fire and explicit elevation limits still govern recipients. Most current Techniques have elevation 0 reach; elevation 1 is uncommon and elevation 2 is rare. Extra reach, elevation access, and bypassing line of sight consume balance budget and therefore reduce available Power or require other tradeoffs.',
      ],
    },
    {
      id: 'power',
      title: 'Base damage and Power magnitude',
      paragraphs: [
        techniquePowerSummary,
        `For a normally scaled direct-damage block: coefficientBP = ${standardSkillDamageScaling('physical-power').coefficientBasisPoints}; Power bonus = floor(matching Power × coefficientBP ÷ 10,000); raw damage = authored damage power + Power bonus. A basis point is 0.01%. Explicitly authored scaling is retained; Vengeance uses its recorded-damage rule instead of receiving another automatic Power budget.`,
        'Ordinary Physical damage uses an authored 1–20 packet; ordinary Mystic damage generally caps at 16 and trades some direct force for stronger tempo effects. Rare and existing pinned exceptions retain their authored versions. This authored number and the per-packet Power contribution are separate. More AP can raise the authored budget but does not change the ordinary 25% Power coefficient. Area coverage, secondary utility, multiple hits, effect potency and duration reduce how much of that authored budget can be concentrated into one damage block. Historically pinned battles keep their own formulas.',
      ],
      table: {
        caption: 'Current ordinary Power contribution per direct-damage packet',
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
          `${standardSkillDamageScaling('physical-power').coefficientBasisPoints / 100}%`,
        ]),
      },
    },
    {
      id: 'damage-order',
      title: 'The damage calculation, in order',
      paragraphs: [
        'The server first checks legality. Repeated timing-tag packets in new battles resolve independent hit and critical checks, with their applicable source exceptions; hostile status resistance also follows each packet. A missed packet does not apply its hostile effects. For each successful direct-damage block, the following order matters because each multiplication rounds down separately:',
      ],
      bullets: [
        '1. Add floor(matching Power × coefficientBP ÷ 10,000) to the authored base damage.',
        '2. Apply Physical Defense or Mystic Defense (reduced 20% while on elevated terrain in new battles): floor(raw damage × 100 ÷ (100 + defense)), with a minimum of one for positive raw damage. Piercing skips this defense step.',
        '3. New battles multiply hostile direct damage by 140% and round down. This applies after defense and before critical; allied and self damage do not receive this multiplier. Historical encounters retain their pinned policy.',
        `4. On an eligible critical hit, multiply by ${COMBAT_CRITICAL_DAMAGE_BASIS_POINTS / 10_000} and round down. Each eligible repeated packet uses its own critical result. Historical encounters retain their recorded shared-result rules.`,
        '5. Apply the attacker-versus-defender Level multiplier below, rounding down. Self-damage does not receive this relative-Level adjustment.',
        '6. Apply any authored front/side/rear damage multiplier, rounding down. Current positional Skills apply Blindside instantly for one owner turn: front 100%, side 160%, rear 220%, per active application; Basic Attack is unchanged. Historical Skills retain their authored facing multiplier.',
        '7. Apply the recipient’s legacy damage-taken multipliers, once per active stack in stored order, rounding down each time. Current Guard multiplies by 85% per application; Vulnerable multiplies by 115%. Defenseless, the PvP timeout penalty, is separate at 250% per stack.',
        `8. Apply the combined conditional/status/elemental damage multiplier and round down. New battles retain the stacked result without the historical clamp; historical policies bound this multiplier to ${CONDITIONAL_DAMAGE_MINIMUM / 100}–${CONDITIONAL_DAMAGE_MAXIMUM / 100}%. Piercing ignores incoming reductions in this budget and legacy incoming reductions, but not incoming increases.`,
        '9. Barrier absorbs direct damage first. Remaining damage reduces HP, bounded by the recipient’s current HP. Later multipliers can round a small hit to zero; the defense minimum is not a final guaranteed HP loss.',
      ],
    },
    {
      id: 'damage-example',
      title: 'A worked hit',
      paragraphs: [
        'Example: a physical 40 AP Skill hits an enemy with one damage block of authored power 10, the attacker has Physical Power 40, and the defender has Physical Defense 25. At equal Levels, with no critical, facing bonus, status modifiers or Barrier: coefficient = 25%; Power bonus = floor(40 × 0.25) = 10; raw damage = 20; after Physical Defense = floor(20 × 100 ÷ 125) = 16; current hostile direct damage = floor(16 × 1.40) = 22 HP, assuming sufficient remaining HP. Every ordinary packet uses the same 25% coefficient even in a repeated-hit Skill.',
        'A higher-AP attack can receive more damage budget, but adding an area shape, a strong status, another effect or a longer duration redirects part of that budget away from direct damage.',
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
        'Current authored Skills use power-based cooldowns from 1 to 3 turns. More powerful, broader or longer-lasting Skills generally receive longer cooldowns.',
        'A Skill with an explicit use Requirement has no cooldown. Its prerequisite is the limiter instead. The old consecutive-use 50% falloff is retired for current Skill versions; cooldown state is server-authoritative and advances on the owner’s turn boundaries.',
      ],
    },
    {
      id: 'attunement-details',
      title: 'Essence and Resonance details in Nexus',
      paragraphs: [
        'A pure build shows its active Essence card in Nexus; a mixed build shows its active Resonance card. The card itself keeps a concise flavor line so the full mechanical description does not crowd the layout.',
        'Hover the active Essence or Resonance artwork, or move keyboard focus to it, to open the detail panel. Moving the pointer or focus away closes it automatically. Essence details use the same Skill rows as Technique details: type, cost, cooldown, requirements, effects, range and targeting where applicable.',
        'Resonance details use Setup, Trigger and Result. Sequence Resonances show the Setup Discipline/tags that arm the Resonance, then the Trigger Discipline/tags that activate its bounded Result effects. In current Setup rows, Chronist Skills means any Chronist Skill, including attacks. Other Setup and Trigger rows retain their displayed tag requirements; these tags do not mean the Utility Skill family. Immediate Resonances have no Setup, activate directly from their Trigger, and use a lighter Result because activation is easier. The panel is informational only; it does not change the committed build or battle state.',
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
        'HP Recovery: the base amount is a percentage of the recipient’s maximum HP, rounded down with a minimum of one for a positive maximum. The amount is captured at cast after applying HP Hex once. One to four applications reuse that captured amount: the first occurs on activation, with later applications at recipient turn ends. Each gain caps at the current maximum HP and never revives a defeated unit. Pinned historical Heal versions retain their old flat/Power behavior.',
        'MP Recovery: a percentage of maximum MP is captured at cast, rounded down with a minimum of one for a positive maximum. Repeated applications reuse that amount while each gain caps at the current maximum MP. MP Drain removes its authored amount; a drain does not imply restoration unless another effect grants it. Pinned historical MP Restore versions retain their old behavior.',
        'Barrier: grants a separate pool that absorbs direct damage before HP. No current regular Technique authors a Barrier grant, although the effect is supported by the combat system.',
        `Burn: ${percentageDotDescription('burn')} Historical pinned profiles and trigger policies retain their recorded behavior.`,
        `Poison: ${percentageDotDescription('poison')} Historical pinned profiles and trigger policies retain their recorded behavior.`,
        'Bleed: each application captures its own attack HP damage, percentage and duration. All applications tick independently at recipient turn end without a stack limit. Damage is rounded down; a zero-damage tick still consumes its duration. Copy Debuffs preserves the captured basis and remaining lifetime, and Cleanse removes every qualifying application.',
        'Apply status: grants the named condition for its authored duration. Percentage-based status potency is authored per effect where supported, so Guard, Vulnerable, Mark and similar effects can differ by Skill version. A stack count is separate from percentage potency.',
        'Effect timing is one Normal/Instant/Delayed choice. Instant activates on resolution; Normal activates the following global round; Delayed activates two global rounds after casting. Each battle keeps its pinned tag policy. Pending Rooted allows movement until its activation round; active Rooted blocks movement. The Chronicle states when the effect will take effect.',
        'Cleanse removes Burn, Bleed, Poison, Slow, Rooted, Vulnerable, Marked and Taunted. Dispel removes its listed protection. Neither removes every effect in the game.',
        'Push / Pull: moves a unit one legal tile at a time, stopping at occupancy, obstacles or illegal elevation. Rooted prevents displacement. Current Rewind records its cast-position anchor before movement and uses Delayed activation by default. On activation it returns to that legal vacant tile without restoring resources or undoing actions. Rooted, occupancy, impassable terrain or illegal elevation can prevent the return. Historical Rewind versions retain their turn-start contract.',
        'Frozen Ground: creates a temporary ground overlay affecting both teams; entering it costs extra AP unless Airborne. Fire converts it to Steam, which blocks sight. Unit effects still follow the Skill’s affected-team rule.',
        'Reveal / Copy Buffs / Copy Debuffs: supported specialized effects with separate eligibility rules. Reveal conditionally removes eligible positive statuses and Covert, then applies Revealed. Amplify copies eligible active Buff statuses; Curse copies eligible active Debuff statuses. They are absent from this 136-Technique regular catalog; supported effect types do not imply that every Technique can use them.',
      ],
    },
    {
      id: 'magnitudes',
      title: 'Low, typical and high magnitudes',
      paragraphs: [
        `These figures are generated from the ${skills.length} latest enabled regular Skills. Compare within a family only: seven base damage cannot be ranked against seven MP or a seven-tile line. One observation is one effect block, except command damage totals and shape sizes. Multi-target effects are counted once, not once per potential target.`,
        '“Typical” is the inclusive lower-to-upper quartile interval (Q1–Q3). Low means below Q1; high means above Q3, within the observed range. Quartiles use nearest rank: sort the observations and take positions ceil(n × 0.25) and ceil(n × 0.75). Ties can leave a low or high band empty. A fixed-value or tiny family is a catalog comparison, not a reliable balance tier.',
        'DOT observations use the authored current-v5 magnitudes for Burn, Bleed and Poison where present. Historical/default fallback profiles remain versioned separately. Total healing includes only effects with multiple applications, before missing-HP limits and healing modifiers.',
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
        'Named status magnitudes are not forced to one global percentage. Percentage potency can be authored per Skill effect where the status supports it, while movement effects such as Haste and Slow use AP-per-tile rules and Root blocks movement instead of adding a percentage magnitude.',
        'A larger magnitude alone does not make a Skill stronger: AP/MP cost, range, area, requirements, duration, setup, payoff and cooldown all matter. The table shows the canonical fallback status wording; the Technique Preview shows the actual authored potency for the selected Skill version.',
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

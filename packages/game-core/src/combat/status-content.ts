import type { CombatStatusDefinition } from './actions'
import type { CombatDamageModifier, DamageCondition } from './damage-modifiers'

export interface NamedCombatStatus extends CombatStatusDefinition {
  name: string
  kind: 'Buff' | 'Debuff' | 'Effect'
  description: string
}
const modifier = (
  direction: CombatDamageModifier['direction'],
  multiplierBasisPoints: number,
  condition: DamageCondition = { kind: 'always' },
): CombatDamageModifier => ({ direction, multiplierBasisPoints, condition })
function status(
  id: string,
  name: string,
  kind: NamedCombatStatus['kind'],
  description: string,
  rules: Partial<CombatStatusDefinition>,
): NamedCombatStatus {
  return {
    id,
    name,
    kind,
    description,
    version: 1,
    maximumStacks: 1,
    durationOwnerTurnStarts: 2,
    damageTakenMultiplierBasisPoints: 10_000,
    polarity: kind === 'Buff' ? 'positive' : kind === 'Debuff' ? 'negative' : 'neutral',
    ...rules,
  }
}

/** Short names and descriptions are shared by Techniques, combat inspection and AI. */
export const PHASE4_STATUSES: readonly NamedCombatStatus[] = [
  status(
    'wet',
    'Wet',
    'Debuff',
    'Storm damage gains 20% per active Wet or Conductive application. Fire removes Wet.',
    { gameplayTags: ['Wet'] },
  ),
  status(
    'frozen',
    'Chilled',
    'Debuff',
    'A Chilled setup tag. Fire removes it. Frozen Ground has a separate duration and movement cost.',
    { gameplayTags: ['Frozen'] },
  ),
  status(
    'conductive',
    'Conductive',
    'Debuff',
    'Storm damage gains 20% per active Wet or Conductive application, consuming Conductive.',
    { gameplayTags: ['Conductive'] },
  ),
  status('inspired', 'Damage Up', 'Buff', 'Deal 10% more damage per application.', {
    gameplayTags: ['Inspired'],
    amplifyCopyable: true,
    reactionClass: 'ordinary',
  }),
  status('hexed', 'Healing Down', 'Debuff', 'Receive 25% less healing.', {
    gameplayTags: ['Hexed'],
    curseCopyable: true,
    reactionClass: 'ordinary',
  }),
  status(
    'invisible',
    'Invisible',
    'Buff',
    'Cannot be selected by hostile direct unit actions. Ground effects can hit. A damaging action or taking damage breaks Invisible.',
    { gameplayTags: ['Invisible'], amplifyCopyable: true, reactionClass: 'ordinary' },
  ),

  status(
    'airborne',
    'Airborne',
    'Buff',
    'Ignore the Frozen Ground AP surcharge. Board bounds, elevation, obstacles, occupancy, Rooted and Movement allowance still apply.',
    { gameplayTags: ['Airborne'] },
  ),
  status(
    'displaced',
    'Displaced',
    'Effect',
    'Records a successful forced move. Grants no turn, AP or Movement refund.',
    { gameplayTags: ['Displaced'], durationOwnerTurnStarts: 1 },
  ),
  status(
    'haste',
    'Haste',
    'Buff',
    'Movement costs 10 less AP per entered tile, to a minimum of 10 AP. Movement allowance is unchanged.',
    {
      movement: { additionalApPerTile: -10 },
      amplifyCopyable: true,
      reactionClass: 'ordinary',
    },
  ),

  status(
    'burn',
    'Burn',
    'Debuff',
    'Lose 4 HP at the end of each of your next two turns. Fixed damage; ignores damage modifiers.',
    { endOfTurn: { type: 'damage', amount: 4 } },
  ),
  status(
    'bleed',
    'Bleed',
    'Debuff',
    'Lose 3 HP at the end of each of your next three turns. Fixed damage; ignores damage modifiers.',
    { durationOwnerTurnStarts: 3, endOfTurn: { type: 'damage', amount: 3 } },
  ),
  status(
    'poison',
    'Poison',
    'Debuff',
    'Lose 2 HP at the end of each of your next four turns. Fixed damage; ignores damage modifiers.',
    { durationOwnerTurnStarts: 4, endOfTurn: { type: 'damage', amount: 2 } },
  ),

  status(
    'slow',
    'Slow',
    'Debuff',
    'Movement costs 10 extra AP per tile. Your Movement allowance is unchanged.',
    {
      movement: { additionalApPerTile: 10 },
      curseCopyable: true,
      reactionClass: 'ordinary',
    },
  ),
  status('root', 'Rooted', 'Debuff', 'Cannot move. Attacks, Skills and facing remain available.', {
    movement: { blocked: true },
    curseCopyable: true,
    reactionClass: 'ordinary',
  }),
  status(
    'reckless',
    'Reckless',
    'Effect',
    'Deal 40% more damage and take 25% more damage. Both effects expire or are removed together.',
    { damageModifiers: [modifier('outgoing', 14_000), modifier('incoming', 12_500)] },
  ),
  status(
    'fortified',
    'Fortified',
    'Effect',
    'Take 30% less damage and deal 20% less damage. Both effects expire or are removed together.',
    { damageModifiers: [modifier('incoming', 7_000), modifier('outgoing', 8_000)] },
  ),
  status(
    'challenged',
    'Taunted',
    'Debuff',
    'Deal 25% less damage to anyone except the unit that applied Taunt.',
    {
      damageModifiers: [
        modifier('outgoing', 7_500, { kind: 'opponent-is-source', matches: false }),
      ],
    },
  ),
  status(
    'mark',
    'Marked',
    'Debuff',
    'The source gains +15 percentage points Accuracy against this target. Other attackers gain no benefit.',
    {
      reactionClass: 'ordinary',
      curseCopyable: true,
      markAccuracyBonusBasisPoints: 1_500,
      effectCategories: ['Debuff', 'Mark'],
    },
  ),
  status('warded', 'Burn Ward', 'Buff', 'Take 20% less damage from opponents affected by Burn.', {
    damageModifiers: [modifier('incoming', 8_000, { kind: 'opponent-status', statusId: 'burn' })],
  }),
]

export const CLEANSE_STATUS_IDS = [
  'burn',
  'bleed',
  'poison',
  'slow',
  'root',
  'exposed',
  'mark',
  'challenged',
] as const

const legacyDescriptions: Record<
  string,
  Pick<NamedCombatStatus, 'name' | 'kind' | 'description'>
> = {
  summon: {
    name: 'Summon',
    kind: 'Effect',
    description:
      'Creates a temporary allied combatant with its own turns and the pinned summon profile.',
  },
  'mp-drain': {
    name: 'MP Drain',
    kind: 'Debuff',
    description: 'Reduces the target’s MP when the effect activates.',
  },
  'mp-recovery': {
    name: 'MP Restore',
    kind: 'Buff',
    description: 'Restores MP when the effect activates.',
  },
  healing: {
    name: 'HP Recovery',
    kind: 'Buff',
    description: 'Restores HP when the effect activates.',
  },
  damage: {
    name: 'Damage',
    kind: 'Debuff',
    description: 'Applies a direct damage packet when the effect activates.',
  },
  'create-terrain': {
    name: 'Terrain',
    kind: 'Effect',
    description:
      'Creates the authored terrain overlay at the selected tiles when the effect activates.',
  },
  displace: {
    name: 'Displacement',
    kind: 'Effect',
    description: 'Pushes or pulls the target along a legal path when the effect activates.',
  },
  'barrier-change': {
    name: 'Barrier',
    kind: 'Buff',
    description: 'Grants a shield that absorbs damage before HP is lost.',
  },
  'return-to-turn-start': {
    name: 'Rewind',
    kind: 'Effect',
    description:
      'Returns the caster to the recorded turn-start position if the destination remains legal.',
  },
  'remove-status': {
    name: 'Cleanse',
    kind: 'Effect',
    description: 'Removes the authored eligible statuses when the effect activates.',
  },
  'copy-statuses': {
    name: 'Effect Copy',
    kind: 'Effect',
    description:
      'Copies eligible positive or negative effects through Copy Buffs or Copy Debuffs when the effect activates.',
  },
  sensory: {
    name: 'Reveal',
    kind: 'Effect',
    description: 'Removes eligible beneficial effects from Covert targets and applies Revealed.',
  },
  barrier: {
    name: 'Barrier',
    kind: 'Buff',
    description: 'Absorbs incoming damage before HP is lost.',
  },
  covert: {
    name: 'Covert',
    kind: 'Buff',
    description: 'Conceals beneficial effects from opposing viewers until revealed.',
  },
  revealed: {
    name: 'Revealed',
    kind: 'Debuff',
    description: 'Counters Covert and increases Skill AP costs.',
  },
  guarded: {
    name: 'Guard',
    kind: 'Buff',
    description: 'Reduces incoming damage by 15% per application. Each use refreshes the duration.',
  },
  exposed: {
    name: 'Vulnerable',
    kind: 'Debuff',
    description: 'Take 15% more damage per application. Each use refreshes the duration.',
  },
  'lowered-guard': {
    name: 'Defenseless',
    kind: 'Debuff',
    description:
      'Each application multiplies incoming damage by 2.5×. Applied after a genuine PvP turn-timer expiry.',
  },
}
const persistentEffectDescriptions: Record<string, string> = {
  poison:
    'Takes poison damage at affected turn ends and after sufficient movement. The applied instance determines its power and lifetime.',
  burn: 'Takes decreasing burn damage at affected turn ends. Attacking while burning causes additional damage. The applied instance determines its power and lifetime.',
  bleed:
    'Bleeding stacks deal damage at affected turn ends. Each applied stack retains its own power and remaining ticks.',
}
export function combatStatusDetails(
  id: string,
): Pick<NamedCombatStatus, 'name' | 'kind' | 'description'> {
  const named = PHASE4_STATUSES.find((status) => status.id === id)
  if (named && persistentEffectDescriptions[id])
    return { ...named, description: persistentEffectDescriptions[id] }
  return (
    named ??
    legacyDescriptions[id] ?? {
      name: id
        .replace(/^(buff|debuff)\./, '')
        .replace(/[.-]/g, ' ')
        .replace(/\b\w/g, (letter) => letter.toUpperCase()),
      kind: 'Effect',
      description: 'An active combat effect.',
    }
  )
}
export function combatStatusDuration(id: string): string {
  const status = PHASE4_STATUSES.find((candidate) => candidate.id === id)
  if (status?.endOfTurn)
    return `Lasts ${status.durationOwnerTurnStarts} end-of-turn ticks; reapplying refreshes the remaining ticks.`
  return `Expires at the start of the affected unit’s ${status?.durationOwnerTurnStarts === 1 || id === 'lowered-guard' ? 'next' : 'second upcoming'} turn.`
}

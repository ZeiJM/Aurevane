import type { CombatStatusDefinition } from './actions'
import { BLINDSIDE_DEBUFF_STATUS_ID, BLINDSIDE_DEBUFF_DESCRIPTION } from './combat-blindside'
import { airborneDescription } from './combat-airborne'
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
    'endure',
    'Endure',
    'Buff',
    'Prevents damage-dealing actions while active. On natural expiry, releases a saved share of HP damage received to nearby chosen teams.',
    { amplifyCopyable: false, curseCopyable: false, reactionClass: 'ordinary' },
  ),
  status(
    'counter',
    'Counter',
    'Buff',
    'Returns the configured share of matching damage received to its source. Counter damage cannot trigger another Counter.',
    { amplifyCopyable: true, reactionClass: 'reactive' },
  ),
  status('wet', 'Wet', 'Debuff', 'Reduces Initiative and increases Storm damage taken.', {
    gameplayTags: ['Wet'],
  }),
  status(
    'frozen',
    'Chilled',
    'Debuff',
    'Prevents choosing a different final facing. Movement still turns the bearer; Cleanse Chilled removes it.',
    { gameplayTags: ['Frozen'] },
  ),
  status(
    'conductive',
    'Conductive',
    'Debuff',
    'Increases Storm damage taken. A damaging Storm hit consumes the existing charge.',
    { gameplayTags: ['Conductive'] },
  ),
  status('inspired', 'Damage Up', 'Buff', 'Increases outgoing damage per application.', {
    gameplayTags: ['Inspired'],
    amplifyCopyable: true,
    reactionClass: 'ordinary',
  }),
  status(
    'blindside',
    'Blindside',
    'Buff',
    'Increases Skill damage from the side and rear for one turn. Basic Attack is unchanged.',
    {
      gameplayTags: ['Blindside'],
      amplifyCopyable: true,
      reactionClass: 'ordinary',
    },
  ),
  status(BLINDSIDE_DEBUFF_STATUS_ID, 'Blindside', 'Debuff', BLINDSIDE_DEBUFF_DESCRIPTION, {
    gameplayTags: ['Blindside'],
    curseCopyable: true,
    reactionClass: 'ordinary',
    durationOwnerTurnStarts: 2,
  }),
  status(
    'suppress',
    'Suppress',
    'Debuff',
    'Reduces outgoing direct damage. Reapplication keeps the strongest potency and longest remaining duration; existing damage-over-time ticks are unchanged.',
    {
      durationOwnerTurnStarts: 3,
      gameplayTags: ['Suppress'],
      curseCopyable: true,
      reactionClass: 'ordinary',
    },
  ),
  status('hexed', 'Healing Down', 'Debuff', 'Reduces HP and MP recovery received.', {
    gameplayTags: ['Hexed'],
    curseCopyable: true,
    reactionClass: 'ordinary',
  }),
  status(
    'invisible',
    'Invisible',
    'Buff',
    'Ordinary hostile unit actions cannot select the recipient. Ground effects and Reveal can hit. A damaging action or taking damage ends Invisible.',
    { gameplayTags: ['Invisible'], amplifyCopyable: true, reactionClass: 'ordinary' },
  ),

  status('airborne', 'Airborne', 'Buff', airborneDescription(), { gameplayTags: ['Airborne'] }),
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
    'Reduces movement AP cost per tile, to a minimum of 10 AP. Movement allowance is unchanged.',
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
    'Increases movement AP cost per tile. Movement allowance is unchanged.',
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
    'Increases damage dealt and damage taken. Both effects end together.',
    { damageModifiers: [modifier('outgoing', 14_000), modifier('incoming', 12_500)] },
  ),
  status(
    'fortified',
    'Fortified',
    'Effect',
    'Increases Physical and Mystic Defense and reduces outgoing damage by the same percentage.',
    { damageModifiers: [modifier('incoming', 7_000), modifier('outgoing', 8_000)] },
  ),
  status(
    'challenged',
    'Taunt',
    'Debuff',
    'Reduces damage dealt to anyone except the unit that applied Taunt.',
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
    'Increases the source’s Accuracy against the target. Other attackers gain no bonus.',
    {
      reactionClass: 'ordinary',
      curseCopyable: true,
      markAccuracyBonusBasisPoints: 1_500,
      effectCategories: ['Debuff', 'Mark'],
    },
  ),
  status('warded', 'Burn Ward', 'Buff', 'Reduces damage taken from opponents affected by Burn.', {
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
  push: {
    name: 'Push',
    kind: 'Effect',
    description:
      'Moves the target away along the authored legal path. Stops at blocked tiles or Rooted; no resource refund.',
  },
  pull: {
    name: 'Pull',
    kind: 'Effect',
    description:
      'Moves the target toward the caster along the authored legal path without entering the caster’s tile. Stops at blocked tiles or Rooted; no resource refund.',
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
    description: 'Returns each target to its saved position if the return remains legal.',
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
    description:
      'A successful hit against Invisible or Covert removes both concealments and applies Revealed.',
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
    description: 'Increases damage taken. Incoming attacks have 100% Accuracy.',
  },
  guarded: {
    name: 'Guard',
    kind: 'Buff',
    description: 'Reduces damage taken per application. Reapplication refreshes the duration.',
  },
  exposed: {
    name: 'Vulnerable',
    kind: 'Debuff',
    description: 'Increases damage taken per application. Reapplication refreshes the duration.',
  },
  'lowered-guard': {
    name: 'Defenseless',
    kind: 'Debuff',
    description: 'Changes incoming damage by the configured multiplier.',
  },
}
const persistentEffectDescriptions: Record<string, string> = {
  poison:
    'Deals damage at turn end. Movement can refresh its duration or trigger damage under older rules; each application keeps its saved triggers and lifetime.',
  burn: 'Deals damage at turn end. Its saved profile determines tick damage, decay and any backlash after damaging an enemy.',
  bleed:
    'Each Bleed application deals damage separately at turn end, using its saved damage and remaining ticks.',
}
export function combatStatusDetails(
  id: string,
): Pick<NamedCombatStatus, 'name' | 'kind' | 'description'> {
  const named = PHASE4_STATUSES.find((status) => status.id === id)
  if (id === 'wet' && named) return { ...named, name: 'Drenched' }
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
  if (id === 'blindside') return 'Expires at the end of the affected unit’s turn.'
  const status = PHASE4_STATUSES.find((candidate) => candidate.id === id)
  if (status?.endOfTurn)
    return `Lasts ${status.durationOwnerTurnStarts} end-of-turn ticks; reapplying refreshes the remaining ticks.`
  return `Expires at the start of the affected unit’s ${status?.durationOwnerTurnStarts === 1 || id === 'lowered-guard' ? 'next' : 'second upcoming'} turn.`
}

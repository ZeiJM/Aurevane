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
    ...rules,
  }
}

/** Short names and descriptions are shared by Techniques, combat inspection and AI. */
export const PHASE4_STATUSES: readonly NamedCombatStatus[] = [
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
    'regeneration',
    'Regeneration',
    'Buff',
    'Restore up to 4 HP at the end of each of your next two turns.',
    { endOfTurn: { type: 'healing', amount: 4 } },
  ),
  status(
    'slow',
    'Slow',
    'Debuff',
    'Movement costs 10 extra AP per tile. Your Movement allowance is unchanged.',
    { movement: { additionalApPerTile: 10 } },
  ),
  status('root', 'Root', 'Debuff', 'Cannot move. Attacks, Skills and facing remain available.', {
    movement: { blocked: true },
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
    'Challenged',
    'Debuff',
    'Deal 25% less damage to anyone except the unit that applied Challenge.',
    {
      damageModifiers: [
        modifier('outgoing', 7_500, { kind: 'opponent-is-source', matches: false }),
      ],
    },
  ),
  status(
    'marked',
    'Marked',
    'Debuff',
    'Take 20% more damage from the unit that applied Mark. Other attackers gain no benefit.',
    {
      damageModifiers: [
        modifier('incoming', 12_000, { kind: 'opponent-is-source', matches: true }),
      ],
    },
  ),
  status('warded', 'Warded', 'Buff', 'Take 20% less damage from opponents affected by Burn.', {
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
  'marked',
  'challenged',
] as const

const legacyDescriptions: Record<
  string,
  Pick<NamedCombatStatus, 'name' | 'kind' | 'description'>
> = {
  guarded: {
    name: 'Guarded',
    kind: 'Buff',
    description:
      'Each stack reduces incoming damage by 15%, up to three stacks. Reapplying adds a stack and refreshes the duration.',
  },
  exposed: {
    name: 'Exposed',
    kind: 'Debuff',
    description: 'Take 15% more damage. Reapplying refreshes the duration; does not stack.',
  },
  'lowered-guard': {
    name: 'Lowered Guard',
    kind: 'Debuff',
    description:
      'Each stack multiplies incoming damage by 2.5×, up to three stacks. Applied after a genuine PvP turn-timer expiry.',
  },
}
export function combatStatusDetails(
  id: string,
): Pick<NamedCombatStatus, 'name' | 'kind' | 'description'> {
  return (
    PHASE4_STATUSES.find((status) => status.id === id) ??
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

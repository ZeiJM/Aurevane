import 'server-only'
import type { CombatActionDefinition } from '@aurevane/game-core/combat/actions'
import type { PreparedCombatAbilityCommand } from '@aurevane/game-core/combat/combat-ability-command'
import type { StatDrivenCombatEncounterState } from '@aurevane/game-core/combat/stat-driven-combat'
import { pv1fCooldownForAction } from '@aurevane/game-core/combat/pv1f-action-economy'
import { readSkillCooldown } from '@aurevane/game-core/combat/skill-cooldowns'

export interface BattleCommandQuote {
  readonly commandCosts: readonly { resource: 'ap' | 'mp' | 'hp'; amount: number }[]
  readonly commandCooldowns: readonly {
    actionId: string
    contentVersion: number
    behaviorId?: string
    role: 'root' | 'manual-modifier' | 'automatic-modifier'
    ownerTurns: number
    ticksRemaining: number
  }[]
}

/** Prepared data is trusted and private; return only current-owner resource and visible-clock facts. */
export function projectBattleCommandQuote(
  state: StatDrivenCombatEncounterState,
  actorId: string,
  input:
    | { quote: Pick<PreparedCombatAbilityCommand, 'costs' | 'participants'> }
    | { native: { action: CombatActionDefinition; apCost: number } },
): BattleCommandQuote {
  const actor = state.tactical.battle.combatants.find((row) => row.id === actorId)
  if (!actor) throw new TypeError('Command quote requires its current actor.')
  const costs =
    'quote' in input
      ? input.quote.costs
      : [
          { resource: 'ap' as const, amount: input.native.apCost },
          { resource: 'mp' as const, amount: input.native.action.cost.mp ?? 0 },
        ]
  const commandCosts = (['ap', 'mp', 'hp'] as const).map((resource) => {
    const amount = costs.find((row) => row.resource === resource)?.amount ?? 0
    if (!Number.isSafeInteger(amount) || amount < 0)
      throw new RangeError('Invalid prepared command cost.')
    return { resource, amount }
  })
  if ('native' in input) {
    const { action } = input.native
    const cooldown = action.cooldown ?? pv1fCooldownForAction(action.id)
    return {
      commandCosts,
      commandCooldowns: cooldown
        ? [
            {
              actionId: action.id,
              contentVersion: action.version,
              role: 'root',
              ownerTurns: cooldown.ownerTurns,
              ticksRemaining: readSkillCooldown(actor, cooldown).ticksRemaining,
            },
          ]
        : [],
    }
  }
  const clocks = new Map<
    string,
    { ownerTurns: number; visible?: BattleCommandQuote['commandCooldowns'][number] }
  >()
  input.quote.participants.forEach((participant, index) => {
    if (!participant.cooldown) return
    const { key, ownerTurns } = participant.cooldown
    const clock = clocks.get(key) ?? { ownerTurns: 0 }
    clock.ownerTurns = Math.max(clock.ownerTurns, ownerTurns)
    const source = state.capturedAbilitySources?.find(
      (row) => row.sourceInstanceId === participant.sourceInstanceId,
    )
    const visible = source
      ? source.ownerCombatantId === actorId &&
        source.abilityId === participant.abilityId &&
        source.contentVersion === participant.contentVersion &&
        state.abilityRuntime?.activeSourceIds.includes(source.sourceInstanceId) &&
        ['basic', 'discipline-skill', 'essence', 'resonance'].includes(source.sourceKind)
      : index === 0 && participant.activation === 'manual' && participant.mode === 'action'
    if (visible && !clock.visible)
      clock.visible = {
        actionId: participant.abilityId,
        contentVersion: participant.contentVersion,
        ...(participant.behaviorId ? { behaviorId: participant.behaviorId } : {}),
        role:
          index === 0
            ? 'root'
            : participant.activation === 'automatic'
              ? 'automatic-modifier'
              : 'manual-modifier',
        ownerTurns,
        ticksRemaining: readSkillCooldown(actor, participant.cooldown).ticksRemaining,
      }
    clocks.set(key, clock)
  })
  return {
    commandCosts,
    commandCooldowns: [...clocks.values()].flatMap((clock) =>
      clock.visible ? [{ ...clock.visible, ownerTurns: clock.ownerTurns }] : [],
    ),
  }
}

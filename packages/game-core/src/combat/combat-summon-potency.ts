import type { CombatContentCatalog, CombatEncounterState } from './actions'
import { normalizeCombatEffectState } from './combat-effect-state'
import { normalBasicAttackDamageAgainst } from './actions-legacy'
import { PV1F_COMBAT_CONTENT } from './pv1f-combat-content'

export function summonDamageSource(state: CombatEncounterState, combatantId: string) {
  return state.effectState?.summonDamageSources?.find((row) => row.combatantId === combatantId)
}

/** Capture one recipient budget for the complete attack, independently of packet count/timing. */
export function allocateSummonDamageCommand(
  state: CombatEncounterState,
  sourceCombatantId: string,
  content: CombatContentCatalog,
): { state: CombatEncounterState; commandId?: number } {
  const source = summonDamageSource(state, sourceCombatantId)
  if (!source) return { state }
  const effects = normalizeCombatEffectState(state.effectState)
  const commandId = effects.nextSummonDamageCommandId ?? 1
  if (!Number.isSafeInteger(commandId) || commandId >= Number.MAX_SAFE_INTEGER)
    throw new RangeError('Summon damage command sequence overflow.')
  const budgetByRecipient = Object.fromEntries(
    state.tactical.battle.combatants.map((target) => [
      target.id,
      Number(
        (BigInt(
          normalBasicAttackDamageAgainst(state, source.ownerCombatantId, target.id, content),
        ) *
          BigInt(source.potencyBasisPoints)) /
          10000n,
      ),
    ]),
  )
  // Retain commands for serialized and already-dequeued pending packets. Native reactions can
  // interleave new casts while an older activation still owns the remainder of its budget.
  return {
    commandId,
    state: {
      ...state,
      effectState: {
        ...effects,
        nextSummonDamageCommandId: commandId + 1,
        summonDamageCommands: [
          ...(effects.summonDamageCommands ?? []),
          {
            id: commandId,
            sourceCombatantId,
            turnNumber: state.tactical.battle.turnNumber,
            budgetByRecipient,
            spentByRecipient: {},
          },
        ],
      },
    },
  }
}

/** Apply after every offensive modifier and before any Barrier or HP mutation. */
export function capSummonDamage(
  state: CombatEncounterState,
  sourceCombatantId: string,
  targetCombatantId: string,
  requested: number | bigint,
  content: CombatContentCatalog = PV1F_COMBAT_CONTENT,
  commandId?: number,
): { state: CombatEncounterState; amount: number | bigint } {
  const source = summonDamageSource(state, sourceCombatantId)
  if (!source) return { state, amount: requested }
  const effects = normalizeCombatEffectState(state.effectState)
  const command =
    commandId === undefined
      ? undefined
      : effects.summonDamageCommands?.find((row) => row.id === commandId)
  if (commandId !== undefined && (!command || command.sourceCombatantId !== sourceCombatantId))
    throw new TypeError('Missing captured Summon damage budget.')
  const budget = command
    ? Object.hasOwn(command.budgetByRecipient, targetCombatantId)
      ? command.budgetByRecipient[targetCombatantId]!
      : 0
    : Number(
        (BigInt(
          normalBasicAttackDamageAgainst(
            state,
            source.ownerCombatantId,
            targetCombatantId,
            content,
          ),
        ) *
          BigInt(source.potencyBasisPoints)) /
          10000n,
      )
  const spent =
    command && Object.hasOwn(command.spentByRecipient, targetCombatantId)
      ? command.spentByRecipient[targetCombatantId]!
      : 0
  const remaining = BigInt(Math.max(0, budget - spent))
  const amount = BigInt(requested) < remaining ? BigInt(requested) : remaining
  if (!command) return { state, amount: Number(amount) }
  return {
    amount: Number(amount),
    state: {
      ...state,
      effectState: {
        ...effects,
        summonDamageCommands: effects.summonDamageCommands!.map((row) =>
          row.id !== commandId
            ? row
            : {
                ...row,
                spentByRecipient: {
                  ...row.spentByRecipient,
                  [targetCombatantId]: spent + Number(amount),
                },
              },
        ),
      },
    },
  }
}

/** Keep the original attack identity on native periodic applications without rewriting retained power. */
export function captureSummonDotCommand(
  before: CombatEncounterState,
  after: CombatEncounterState,
  kind: 'poison' | 'burn' | 'bleed',
  sourceCombatantId: string,
  sourceActionId: string,
  commandId: number | undefined,
): CombatEncounterState {
  if (commandId === undefined) return after
  const prior = new Set<unknown>(before.effectState?.[kind] ?? [])
  const effects = normalizeCombatEffectState(after.effectState)
  return {
    ...after,
    effectState: {
      ...effects,
      [kind]: effects[kind].map((row) =>
        prior.has(row) ||
        row.summonDamageCommandId !== undefined ||
        row.sourceCombatantId !== sourceCombatantId ||
        row.sourceActionId !== sourceActionId
          ? row
          : { ...row, summonDamageCommandId: commandId },
      ),
    },
  }
}

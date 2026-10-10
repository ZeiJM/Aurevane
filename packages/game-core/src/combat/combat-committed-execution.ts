import type {
  CombatActionDefinition,
  CombatEncounterState,
  CombatResolutionContext,
  CombatTargetSelection,
} from './actions'

declare const committedExecutionBrand: unique symbol
export interface CommittedCombatExecution {
  readonly [committedExecutionBrand]: true
}
interface Admission {
  readonly battleId: string
  readonly turnNumber: number
  readonly actorId: string
  readonly manual: boolean
  readonly actionId: string
  readonly action: string
  readonly selection: string
  readonly provenance: string
  consumed: boolean
  settled: boolean
}
const issued = new WeakMap<CommittedCombatExecution, Admission>()

/** Internal command/native handoff. The capability never enters persisted state. */
export function issueCommittedCombatExecution(
  state: CombatEncounterState,
  actorId: string,
  action: CombatActionDefinition,
  selection: CombatTargetSelection,
  context: CombatResolutionContext,
  manual: boolean,
): CommittedCombatExecution {
  const token = Object.freeze({}) as CommittedCombatExecution
  issued.set(token, {
    battleId: state.tactical.battle.battleId,
    turnNumber: state.tactical.battle.turnNumber,
    actorId,
    manual,
    actionId: action.id,
    action: JSON.stringify(action),
    selection: JSON.stringify(selection),
    provenance: JSON.stringify(context.provenance),
    consumed: false,
    settled: false,
  })
  return token
}

export function consumeCommittedCombatExecution(
  token: CommittedCombatExecution,
  state: CombatEncounterState,
  action: CombatActionDefinition,
  selection: CombatTargetSelection,
  context: CombatResolutionContext,
): void {
  const admission = issued.get(token)
  const battle = state.tactical.battle
  if (
    !admission ||
    admission.consumed ||
    admission.battleId !== battle.battleId ||
    admission.actorId !== context.provenance.sourceCombatantId ||
    admission.action !== JSON.stringify(action) ||
    admission.selection !== JSON.stringify(selection) ||
    admission.provenance !== JSON.stringify(context.provenance) ||
    (admission.manual &&
      (admission.turnNumber !== battle.turnNumber ||
        battle.currentTurn?.combatantId !== admission.actorId))
  )
    throw new TypeError('invalid-committed-execution-authority')
  admission.consumed = true
}

/** Legacy emission suppression is possible only after the native wrapper consumed issuance. */
export function committedCombatAttemptRecorded(
  token: CommittedCombatExecution,
  state: CombatEncounterState,
  actorId: string,
  actionId: string,
): boolean {
  const admission = issued.get(token)
  if (
    !admission?.consumed ||
    admission.settled ||
    admission.actorId !== actorId ||
    admission.actionId !== actionId ||
    admission.battleId !== state.tactical.battle.battleId
  )
    throw new TypeError('invalid-committed-execution-authority')
  admission.settled = true
  return true
}

/** Admission is locked, while all native target/effect capability checks remain live. */
export function committedCombatAction(action: CombatActionDefinition): CombatActionDefinition {
  const { cooldown: _cooldown, ...rest } = action
  void _cooldown
  return { ...rest, cost: { mp: 0, spendsAction: false }, requirements: [] }
}

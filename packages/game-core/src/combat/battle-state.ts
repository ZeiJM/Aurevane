export const BATTLE_STATE_SCHEMA_VERSION = 1 as const
export const BATTLE_RNG_ALGORITHM = 'xorshift32-v1' as const
export const MAX_UINT32 = 0xffff_ffff as const

export type BattleLifecycle = 'pending' | 'active' | 'completed' | 'abandoned'
export type BattleActionState = 'ready' | 'spent'
export type BattleFacing = 'north' | 'east' | 'south' | 'west'

export interface BattleRngState {
  algorithm: typeof BATTLE_RNG_ALGORITHM
  seed: number
  state: number
  draws: number
}

export interface BattleTemporaryResource {
  key: string
  current: number
  maximum: number
}

export interface BattleCombatant {
  id: string
  teamId: string
  initiative: number
  baseMovementBudget: number
  hp: number
  maxHp: number
  mp: number
  maxMp: number
  temporaryResources: readonly BattleTemporaryResource[]
}

export interface BattleTurnState {
  combatantId: string
  initiativeIndex: number
  movementMaximum: number
  movementRemaining: number
  movementSpent: number
  actionState: BattleActionState
  finalFacing: BattleFacing | null
}

export interface BattleState {
  schemaVersion: typeof BATTLE_STATE_SCHEMA_VERSION
  battleId: string
  rulesVersion: number
  contentVersion: number
  lifecycle: BattleLifecycle
  rng: BattleRngState
  combatants: readonly BattleCombatant[]
  initiativeOrder: readonly string[]
  round: number
  turnNumber: number
  currentTurn: BattleTurnState | null
}

export interface BattleInvariantIssue {
  field: string
  message: string
}

export interface CreateBattleCombatantInput {
  id: string
  teamId: string
  initiative: number
  baseMovementBudget: number
  hp: number
  maxHp: number
  mp: number
  maxMp: number
  temporaryResources?: readonly BattleTemporaryResource[]
}

export interface CreatePendingBattleInput {
  battleId: string
  rulesVersion: number
  contentVersion: number
  rngSeed: number
  combatants: readonly CreateBattleCombatantInput[]
}

export type BattleEvent =
  | {
      event: 'battle_started'
      battleId: string
      rulesVersion: number
      contentVersion: number
    }
  | { event: 'round_started'; round: number }
  | { event: 'turn_started'; round: number; turnNumber: number; combatantId: string }
  | { event: 'movement_spent'; combatantId: string; amount: number; remaining: number }
  | { event: 'action_spent'; combatantId: string }
  | { event: 'final_facing_selected'; combatantId: string; facing: BattleFacing }
  | { event: 'turn_ended'; round: number; turnNumber: number; combatantId: string }

export interface BattleTransition {
  state: BattleState
  events: readonly BattleEvent[]
}

export interface BattleRngDraw {
  state: BattleRngState
  value: number
}

export function createBattleRngState(seed: number): BattleRngState {
  assertUint32NonZero(seed, 'seed')

  return {
    algorithm: BATTLE_RNG_ALGORITHM,
    seed,
    state: seed,
    draws: 0,
  }
}

export function advanceBattleRng(rng: BattleRngState): BattleRngDraw {
  assertValidBattleRngState(rng)

  if (rng.draws >= Number.MAX_SAFE_INTEGER) {
    throw new RangeError('RNG draw count has reached the safe integer limit.')
  }

  let next = rng.state >>> 0
  next ^= (next << 13) >>> 0
  next ^= next >>> 17
  next ^= (next << 5) >>> 0
  next >>>= 0

  return {
    value: next,
    state: {
      ...rng,
      state: next,
      draws: rng.draws + 1,
    },
  }
}

export function createPendingBattle(input: CreatePendingBattleInput): BattleState {
  assertNonEmptyIdentity(input.battleId, 'battleId')
  assertPositiveSafeInteger(input.rulesVersion, 'rulesVersion')
  assertPositiveSafeInteger(input.contentVersion, 'contentVersion')

  if (input.combatants.length < 2) {
    throw new RangeError('A battle requires at least two combatants.')
  }

  const combatants = input.combatants.map(normalizeCombatant)
  const initiativeOrder = createInitiativeOrder(combatants)

  const state: BattleState = {
    schemaVersion: BATTLE_STATE_SCHEMA_VERSION,
    battleId: input.battleId,
    rulesVersion: input.rulesVersion,
    contentVersion: input.contentVersion,
    lifecycle: 'pending',
    rng: createBattleRngState(input.rngSeed),
    combatants,
    initiativeOrder,
    round: 0,
    turnNumber: 0,
    currentTurn: null,
  }

  assertValidBattleState(state)
  return state
}

export function startBattle(state: BattleState): BattleTransition {
  assertValidBattleState(state)

  if (state.lifecycle !== 'pending') {
    throw new Error('Only a pending battle can be started.')
  }

  const activeTeams = collectActiveTeams(state)
  if (activeTeams.size < 2) {
    throw new Error('A battle requires at least two active teams to start.')
  }

  const first = findFirstEligibleCombatant(state)
  if (!first) {
    throw new Error('No eligible combatant is available to start the battle.')
  }

  const nextState: BattleState = {
    ...state,
    lifecycle: 'active',
    round: 1,
    turnNumber: 1,
    currentTurn: createFreshTurn(first.combatant, first.initiativeIndex),
  }

  assertValidBattleState(nextState)

  return {
    state: nextState,
    events: [
      {
        event: 'battle_started',
        battleId: nextState.battleId,
        rulesVersion: nextState.rulesVersion,
        contentVersion: nextState.contentVersion,
      },
      { event: 'round_started', round: 1 },
      {
        event: 'turn_started',
        round: 1,
        turnNumber: 1,
        combatantId: first.combatant.id,
      },
    ],
  }
}

export function spendMovement(state: BattleState, amount: number): BattleTransition {
  const turn = requireActiveTurn(state)
  assertPositiveSafeInteger(amount, 'movement amount')

  if (amount > turn.movementRemaining) {
    throw new RangeError('Movement spend exceeds the remaining Movement Budget.')
  }

  const currentTurn: BattleTurnState = {
    ...turn,
    movementRemaining: turn.movementRemaining - amount,
    movementSpent: turn.movementSpent + amount,
  }
  const nextState = withCurrentTurn(state, currentTurn)

  return {
    state: nextState,
    events: [
      {
        event: 'movement_spent',
        combatantId: turn.combatantId,
        amount,
        remaining: currentTurn.movementRemaining,
      },
    ],
  }
}

export function spendAction(state: BattleState): BattleTransition {
  const turn = requireActiveTurn(state)

  if (turn.actionState !== 'ready') {
    throw new Error('The Action has already been spent this turn.')
  }

  const nextState = withCurrentTurn(state, {
    ...turn,
    actionState: 'spent',
  })

  return {
    state: nextState,
    events: [{ event: 'action_spent', combatantId: turn.combatantId }],
  }
}

export function selectFinalFacing(state: BattleState, facing: BattleFacing): BattleTransition {
  const turn = requireActiveTurn(state)
  assertFacing(facing)

  const nextState = withCurrentTurn(state, {
    ...turn,
    finalFacing: facing,
  })

  return {
    state: nextState,
    events: [
      {
        event: 'final_facing_selected',
        combatantId: turn.combatantId,
        facing,
      },
    ],
  }
}

export function endTurn(state: BattleState): BattleTransition {
  const turn = requireActiveTurn(state)
  const next = findNextEligibleCombatant(state, turn.initiativeIndex)

  if (!next) {
    throw new Error('No eligible combatant is available for the next turn.')
  }

  const wrappedRound = next.initiativeIndex <= turn.initiativeIndex
  const nextRound = wrappedRound ? state.round + 1 : state.round
  const nextTurnNumber = state.turnNumber + 1
  const nextState: BattleState = {
    ...state,
    round: nextRound,
    turnNumber: nextTurnNumber,
    currentTurn: createFreshTurn(next.combatant, next.initiativeIndex),
  }

  assertValidBattleState(nextState)

  const events: BattleEvent[] = [
    {
      event: 'turn_ended',
      round: state.round,
      turnNumber: state.turnNumber,
      combatantId: turn.combatantId,
    },
  ]

  if (wrappedRound) {
    events.push({ event: 'round_started', round: nextRound })
  }

  events.push({
    event: 'turn_started',
    round: nextRound,
    turnNumber: nextTurnNumber,
    combatantId: next.combatant.id,
  })

  return { state: nextState, events }
}

export function validateBattleState(state: BattleState): readonly BattleInvariantIssue[] {
  const issues: BattleInvariantIssue[] = []

  if (state.schemaVersion !== BATTLE_STATE_SCHEMA_VERSION) {
    issues.push({ field: 'schemaVersion', message: 'Unsupported battle-state schema version.' })
  }

  collectIdentityIssue(issues, state.battleId, 'battleId')
  collectPositiveIntegerIssue(issues, state.rulesVersion, 'rulesVersion')
  collectPositiveIntegerIssue(issues, state.contentVersion, 'contentVersion')
  collectBattleRngIssues(issues, state.rng)
  collectNonNegativeIntegerIssue(issues, state.round, 'round')
  collectNonNegativeIntegerIssue(issues, state.turnNumber, 'turnNumber')

  if (!isLifecycle(state.lifecycle)) {
    issues.push({ field: 'lifecycle', message: 'Unknown battle lifecycle.' })
  }

  if (state.combatants.length < 2) {
    issues.push({ field: 'combatants', message: 'A battle requires at least two combatants.' })
  }

  const combatantIds = new Set<string>()
  for (const [index, combatant] of state.combatants.entries()) {
    collectCombatantIssues(issues, combatant, index)
    if (combatantIds.has(combatant.id)) {
      issues.push({
        field: `combatants.${index}.id`,
        message: 'Combatant IDs must be unique within a battle.',
      })
    }
    combatantIds.add(combatant.id)
  }

  const expectedInitiativeOrder = createInitiativeOrder(state.combatants)
  if (!arraysEqual(state.initiativeOrder, expectedInitiativeOrder)) {
    issues.push({
      field: 'initiativeOrder',
      message: 'Initiative order must match deterministic initiative sorting.',
    })
  }

  if (state.lifecycle === 'pending') {
    if (state.round !== 0) {
      issues.push({ field: 'round', message: 'Pending battles must remain at round zero.' })
    }
    if (state.turnNumber !== 0) {
      issues.push({ field: 'turnNumber', message: 'Pending battles must remain at turn zero.' })
    }
    if (state.currentTurn !== null) {
      issues.push({ field: 'currentTurn', message: 'Pending battles cannot have an active turn.' })
    }
  }

  if (state.lifecycle === 'active') {
    if (!Number.isSafeInteger(state.round) || state.round < 1) {
      issues.push({ field: 'round', message: 'Active battles require a positive round number.' })
    }
    if (!Number.isSafeInteger(state.turnNumber) || state.turnNumber < 1) {
      issues.push({
        field: 'turnNumber',
        message: 'Active battles require a positive turn number.',
      })
    }
    collectCurrentTurnIssues(issues, state)
  }

  if (state.lifecycle === 'completed' || state.lifecycle === 'abandoned') {
    if (state.currentTurn !== null) {
      issues.push({
        field: 'currentTurn',
        message: 'Completed or abandoned battles cannot retain an active turn.',
      })
    }
  }

  return issues
}

function normalizeCombatant(input: CreateBattleCombatantInput): BattleCombatant {
  const resources = [...(input.temporaryResources ?? [])]
    .map((resource) => ({ ...resource }))
    .sort((left, right) => compareStableString(left.key, right.key))

  return {
    id: input.id,
    teamId: input.teamId,
    initiative: input.initiative,
    baseMovementBudget: input.baseMovementBudget,
    hp: input.hp,
    maxHp: input.maxHp,
    mp: input.mp,
    maxMp: input.maxMp,
    temporaryResources: resources,
  }
}

function createInitiativeOrder(combatants: readonly BattleCombatant[]): string[] {
  return [...combatants]
    .sort((left, right) => {
      if (left.initiative !== right.initiative) {
        return right.initiative - left.initiative
      }
      return compareStableString(left.id, right.id)
    })
    .map((combatant) => combatant.id)
}

function createFreshTurn(combatant: BattleCombatant, initiativeIndex: number): BattleTurnState {
  return {
    combatantId: combatant.id,
    initiativeIndex,
    movementMaximum: combatant.baseMovementBudget,
    movementRemaining: combatant.baseMovementBudget,
    movementSpent: 0,
    actionState: 'ready',
    finalFacing: null,
  }
}

function requireActiveTurn(state: BattleState): BattleTurnState {
  assertValidBattleState(state)

  if (state.lifecycle !== 'active' || state.currentTurn === null) {
    throw new Error('Battle command requires an active turn.')
  }

  return state.currentTurn
}

function withCurrentTurn(state: BattleState, currentTurn: BattleTurnState): BattleState {
  const nextState: BattleState = { ...state, currentTurn }
  assertValidBattleState(nextState)
  return nextState
}

function findFirstEligibleCombatant(
  state: BattleState,
): { combatant: BattleCombatant; initiativeIndex: number } | null {
  for (const [initiativeIndex, combatantId] of state.initiativeOrder.entries()) {
    const combatant = getCombatant(state, combatantId)
    if (combatant.hp > 0) {
      return { combatant, initiativeIndex }
    }
  }

  return null
}

function findNextEligibleCombatant(
  state: BattleState,
  currentInitiativeIndex: number,
): { combatant: BattleCombatant; initiativeIndex: number } | null {
  for (let offset = 1; offset <= state.initiativeOrder.length; offset += 1) {
    const initiativeIndex = (currentInitiativeIndex + offset) % state.initiativeOrder.length
    const combatant = getCombatant(state, state.initiativeOrder[initiativeIndex])
    if (combatant.hp > 0) {
      return { combatant, initiativeIndex }
    }
  }

  return null
}

function getCombatant(state: BattleState, combatantId: string): BattleCombatant {
  const combatant = state.combatants.find((candidate) => candidate.id === combatantId)
  if (!combatant) {
    throw new Error(`Battle state references unknown combatant ${combatantId}.`)
  }
  return combatant
}

function collectActiveTeams(state: BattleState): Set<string> {
  return new Set(
    state.combatants.filter((combatant) => combatant.hp > 0).map((combatant) => combatant.teamId),
  )
}

function collectCombatantIssues(
  issues: BattleInvariantIssue[],
  combatant: BattleCombatant,
  index: number,
): void {
  const prefix = `combatants.${index}`
  collectIdentityIssue(issues, combatant.id, `${prefix}.id`)
  collectIdentityIssue(issues, combatant.teamId, `${prefix}.teamId`)
  collectNonNegativeIntegerIssue(issues, combatant.initiative, `${prefix}.initiative`)
  collectNonNegativeIntegerIssue(
    issues,
    combatant.baseMovementBudget,
    `${prefix}.baseMovementBudget`,
  )
  collectBoundedResourceIssues(
    issues,
    combatant.hp,
    combatant.maxHp,
    `${prefix}.hp`,
    `${prefix}.maxHp`,
  )
  collectBoundedResourceIssues(
    issues,
    combatant.mp,
    combatant.maxMp,
    `${prefix}.mp`,
    `${prefix}.maxMp`,
  )

  const resourceKeys = new Set<string>()
  for (const [resourceIndex, resource] of combatant.temporaryResources.entries()) {
    const resourcePrefix = `${prefix}.temporaryResources.${resourceIndex}`
    collectIdentityIssue(issues, resource.key, `${resourcePrefix}.key`)
    collectBoundedResourceIssues(
      issues,
      resource.current,
      resource.maximum,
      `${resourcePrefix}.current`,
      `${resourcePrefix}.maximum`,
    )
    if (resourceKeys.has(resource.key)) {
      issues.push({
        field: `${resourcePrefix}.key`,
        message: 'Temporary resource keys must be unique per combatant.',
      })
    }
    resourceKeys.add(resource.key)
  }

  const expectedResourceKeys = [...combatant.temporaryResources]
    .map((resource) => resource.key)
    .sort(compareStableString)
  if (
    !arraysEqual(
      combatant.temporaryResources.map((resource) => resource.key),
      expectedResourceKeys,
    )
  ) {
    issues.push({
      field: `${prefix}.temporaryResources`,
      message: 'Temporary resources must use deterministic key ordering.',
    })
  }
}

function collectCurrentTurnIssues(issues: BattleInvariantIssue[], state: BattleState): void {
  const turn = state.currentTurn
  if (turn === null) {
    issues.push({ field: 'currentTurn', message: 'Active battles require a current turn.' })
    return
  }

  if (
    !Number.isSafeInteger(turn.initiativeIndex) ||
    turn.initiativeIndex < 0 ||
    turn.initiativeIndex >= state.initiativeOrder.length
  ) {
    issues.push({
      field: 'currentTurn.initiativeIndex',
      message: 'Current initiative index is outside the initiative order.',
    })
    return
  }

  if (state.initiativeOrder[turn.initiativeIndex] !== turn.combatantId) {
    issues.push({
      field: 'currentTurn.combatantId',
      message: 'Current combatant must match the current initiative slot.',
    })
  }

  const combatant = state.combatants.find((candidate) => candidate.id === turn.combatantId)
  if (!combatant) {
    issues.push({
      field: 'currentTurn.combatantId',
      message: 'Current turn references an unknown combatant.',
    })
    return
  }

  if (combatant.hp <= 0) {
    issues.push({
      field: 'currentTurn.combatantId',
      message: 'A defeated combatant cannot own the current turn.',
    })
  }

  if (turn.movementMaximum !== combatant.baseMovementBudget) {
    issues.push({
      field: 'currentTurn.movementMaximum',
      message: 'Turn Movement Budget must match the combatant baseline in P2.1.',
    })
  }

  collectNonNegativeIntegerIssue(issues, turn.movementMaximum, 'currentTurn.movementMaximum')
  collectNonNegativeIntegerIssue(issues, turn.movementRemaining, 'currentTurn.movementRemaining')
  collectNonNegativeIntegerIssue(issues, turn.movementSpent, 'currentTurn.movementSpent')

  if (turn.movementRemaining + turn.movementSpent !== turn.movementMaximum) {
    issues.push({
      field: 'currentTurn.movementRemaining',
      message: 'Remaining plus spent movement must equal the turn Movement Budget.',
    })
  }

  if (turn.actionState !== 'ready' && turn.actionState !== 'spent') {
    issues.push({ field: 'currentTurn.actionState', message: 'Unknown Action state.' })
  }

  if (turn.finalFacing !== null && !isFacing(turn.finalFacing)) {
    issues.push({ field: 'currentTurn.finalFacing', message: 'Unknown final facing.' })
  }
}

function collectBattleRngIssues(issues: BattleInvariantIssue[], rng: BattleRngState): void {
  if (rng.algorithm !== BATTLE_RNG_ALGORITHM) {
    issues.push({ field: 'rng.algorithm', message: 'Unsupported deterministic RNG algorithm.' })
  }
  if (!isUint32NonZero(rng.seed)) {
    issues.push({ field: 'rng.seed', message: 'RNG seed must be a non-zero uint32 integer.' })
  }
  if (!isUint32NonZero(rng.state)) {
    issues.push({ field: 'rng.state', message: 'RNG state must be a non-zero uint32 integer.' })
  }
  collectNonNegativeIntegerIssue(issues, rng.draws, 'rng.draws')
}

function collectBoundedResourceIssues(
  issues: BattleInvariantIssue[],
  current: number,
  maximum: number,
  currentField: string,
  maximumField: string,
): void {
  collectNonNegativeIntegerIssue(issues, current, currentField)
  collectNonNegativeIntegerIssue(issues, maximum, maximumField)

  if (Number.isSafeInteger(current) && Number.isSafeInteger(maximum) && current > maximum) {
    issues.push({ field: currentField, message: 'Current resource cannot exceed its maximum.' })
  }
}

function collectIdentityIssue(issues: BattleInvariantIssue[], value: string, field: string): void {
  if (typeof value !== 'string' || value.length === 0 || value.trim() !== value) {
    issues.push({ field, message: 'Identity must be a non-empty trimmed string.' })
  }
}

function collectPositiveIntegerIssue(
  issues: BattleInvariantIssue[],
  value: number,
  field: string,
): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    issues.push({ field, message: 'Value must be a positive safe integer.' })
  }
}

function collectNonNegativeIntegerIssue(
  issues: BattleInvariantIssue[],
  value: number,
  field: string,
): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    issues.push({ field, message: 'Value must be a non-negative safe integer.' })
  }
}

function assertValidBattleState(state: BattleState): void {
  const issues = validateBattleState(state)
  if (issues.length > 0) {
    throw new Error(`Invalid battle state: ${issues[0].field}: ${issues[0].message}`)
  }
}

function assertValidBattleRngState(rng: BattleRngState): void {
  const issues: BattleInvariantIssue[] = []
  collectBattleRngIssues(issues, rng)
  if (issues.length > 0) {
    throw new Error(`Invalid battle RNG state: ${issues[0].field}: ${issues[0].message}`)
  }
}

function assertPositiveSafeInteger(value: number, field: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new RangeError(`${field} must be a positive safe integer.`)
  }
}

function assertNonEmptyIdentity(value: string, field: string): void {
  if (typeof value !== 'string' || value.length === 0 || value.trim() !== value) {
    throw new TypeError(`${field} must be a non-empty trimmed string.`)
  }
}

function assertUint32NonZero(value: number, field: string): void {
  if (!isUint32NonZero(value)) {
    throw new RangeError(`${field} must be a non-zero uint32 integer.`)
  }
}

function assertFacing(facing: BattleFacing): void {
  if (!isFacing(facing)) {
    throw new TypeError('Facing must be north, east, south, or west.')
  }
}

function isLifecycle(value: string): value is BattleLifecycle {
  return (
    value === 'pending' || value === 'active' || value === 'completed' || value === 'abandoned'
  )
}

function isFacing(value: string): value is BattleFacing {
  return value === 'north' || value === 'east' || value === 'south' || value === 'west'
}

function isUint32NonZero(value: number): boolean {
  return Number.isInteger(value) && value > 0 && value <= MAX_UINT32
}

function arraysEqual<T>(left: readonly T[], right: readonly T[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index])
}

function compareStableString(left: string, right: string): number {
  if (left < right) {
    return -1
  }
  if (left > right) {
    return 1
  }
  return 0
}

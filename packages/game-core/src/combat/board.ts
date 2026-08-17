import {
  selectFinalFacing,
  spendMovement,
  validateBattleState,
  type BattleEvent,
  type BattleFacing,
  type BattleState,
} from './battle-state'

export const TACTICAL_BOARD_SCHEMA_VERSION = 1 as const

export interface GridPosition {
  x: number
  y: number
}

export interface CombatTerrainDefinition {
  id: string
  traversalCost: number | null
}

export interface CombatTile {
  position: GridPosition
  elevation: number
  terrainId: string
}

export interface CombatTerrainCostOverride {
  terrainId: string
  traversalCost: number | null
}

export interface CombatMovementProfile {
  id: string
  maxElevationStep: number
  terrainCostOverrides: readonly CombatTerrainCostOverride[]
}

export interface CombatPlacement {
  combatantId: string
  position: GridPosition
  facing: BattleFacing
  movementProfileId: string
}

export interface TacticalBattleState {
  schemaVersion: typeof TACTICAL_BOARD_SCHEMA_VERSION
  battle: BattleState
  width: number
  height: number
  terrains: readonly CombatTerrainDefinition[]
  tiles: readonly CombatTile[]
  movementProfiles: readonly CombatMovementProfile[]
  placements: readonly CombatPlacement[]
}

export interface CreateTacticalBattleStateInput {
  battle: BattleState
  width: number
  height: number
  terrains: readonly CombatTerrainDefinition[]
  tiles: readonly CombatTile[]
  movementProfiles: readonly CombatMovementProfile[]
  placements: readonly CombatPlacement[]
}

export type MovementPathIssueCode =
  | 'path-too-short'
  | 'start-mismatch'
  | 'out-of-bounds'
  | 'non-adjacent-step'
  | 'blocked-terrain'
  | 'occupied-tile'
  | 'elevation-step-too-high'
  | 'movement-budget-exceeded'

export interface MovementPathIssue {
  code: MovementPathIssueCode
  stepIndex: number | null
  message: string
}

export interface MovementPathPreview {
  legal: boolean
  combatantId: string
  path: readonly GridPosition[]
  cost: number
  destination: GridPosition
  movementRemainingBefore: number
  movementRemainingAfter: number
  issues: readonly MovementPathIssue[]
}

export type FacingRelation = 'front' | 'side' | 'rear'

export type TacticalBattleEvent =
  | BattleEvent
  | {
      event: 'combatant_moved'
      combatantId: string
      from: GridPosition
      to: GridPosition
      movementCost: number
    }
  | {
      event: 'combatant_facing_changed'
      combatantId: string
      facing: BattleFacing
    }

export interface TacticalBattleTransition {
  state: TacticalBattleState
  events: readonly TacticalBattleEvent[]
}

export interface TacticalBoardIssue {
  field: string
  message: string
}

export const P2_2_VERTICAL_SLICE_TERRAINS: readonly CombatTerrainDefinition[] = [
  { id: 'blocked', traversalCost: null },
  { id: 'open-ground', traversalCost: 1 },
  { id: 'rough-ground', traversalCost: 2 },
]

export const P2_2_ORDINARY_GROUND_PROFILE: CombatMovementProfile = {
  id: 'ordinary-ground',
  maxElevationStep: 1,
  terrainCostOverrides: [],
}

export function createTacticalBattleState(
  input: CreateTacticalBattleStateInput,
): TacticalBattleState {
  const state: TacticalBattleState = {
    schemaVersion: TACTICAL_BOARD_SCHEMA_VERSION,
    battle: input.battle,
    width: input.width,
    height: input.height,
    terrains: [...input.terrains]
      .map((terrain) => ({ ...terrain }))
      .sort((left, right) => compareStableString(left.id, right.id)),
    tiles: [...input.tiles]
      .map((tile) => ({ ...tile, position: { ...tile.position } }))
      .sort(compareTiles),
    movementProfiles: [...input.movementProfiles]
      .map(normalizeMovementProfile)
      .sort((left, right) => compareStableString(left.id, right.id)),
    placements: [...input.placements]
      .map((placement) => ({ ...placement, position: { ...placement.position } }))
      .sort((left, right) => compareStableString(left.combatantId, right.combatantId)),
  }

  assertValidTacticalBattleState(state)
  return state
}

export function evaluateCurrentMovementPath(
  state: TacticalBattleState,
  path: readonly GridPosition[],
): MovementPathPreview {
  assertValidTacticalBattleState(state)

  const turn = state.battle.currentTurn
  if (state.battle.lifecycle !== 'active' || turn === null) {
    throw new Error('Movement preview requires an active battle turn.')
  }

  const placement = getPlacement(state, turn.combatantId)
  const profile = getMovementProfile(state, placement.movementProfileId)
  const copiedPath = path.map((position) => ({ ...position }))
  const fallbackDestination = copiedPath.at(-1) ?? placement.position
  const issues: MovementPathIssue[] = []

  if (copiedPath.length < 2) {
    issues.push({
      code: 'path-too-short',
      stepIndex: null,
      message: 'A committed movement path must include the current tile and a destination.',
    })
  }

  if (copiedPath.length > 0 && !positionsEqual(copiedPath[0], placement.position)) {
    issues.push({
      code: 'start-mismatch',
      stepIndex: 0,
      message: 'Movement path must begin at the authoritative combatant position.',
    })
  }

  let cost = 0
  if (issues.length === 0) {
    for (let index = 1; index < copiedPath.length; index += 1) {
      const previous = copiedPath[index - 1]
      const current = copiedPath[index]

      if (!isWithinBoard(state, current)) {
        issues.push({
          code: 'out-of-bounds',
          stepIndex: index,
          message: 'Movement path leaves the battle board.',
        })
        break
      }

      if (!isOrthogonallyAdjacent(previous, current)) {
        issues.push({
          code: 'non-adjacent-step',
          stepIndex: index,
          message: 'Baseline P2.2 movement requires orthogonally adjacent steps.',
        })
        break
      }

      const previousTile = getTile(state, previous)
      const currentTile = getTile(state, current)
      const traversalCost = getTraversalCost(state, currentTile.terrainId, profile)

      if (traversalCost === null) {
        issues.push({
          code: 'blocked-terrain',
          stepIndex: index,
          message: 'The selected movement profile cannot enter this terrain.',
        })
        break
      }

      if (Math.abs(currentTile.elevation - previousTile.elevation) > profile.maxElevationStep) {
        issues.push({
          code: 'elevation-step-too-high',
          stepIndex: index,
          message: 'The elevation change exceeds the movement profile step limit.',
        })
        break
      }

      const occupyingCombatant = getOccupyingCombatant(state, current)
      if (occupyingCombatant !== null && occupyingCombatant !== turn.combatantId) {
        issues.push({
          code: 'occupied-tile',
          stepIndex: index,
          message: 'Another combatant occupies this tile.',
        })
        break
      }

      cost += traversalCost
      if (!Number.isSafeInteger(cost)) {
        throw new RangeError('Movement path cost exceeded the safe integer range.')
      }
    }
  }

  if (issues.length === 0 && cost > turn.movementRemaining) {
    issues.push({
      code: 'movement-budget-exceeded',
      stepIndex: copiedPath.length - 1,
      message: 'Movement path costs more than the remaining Movement Budget.',
    })
  }

  return {
    legal: issues.length === 0,
    combatantId: turn.combatantId,
    path: copiedPath,
    cost,
    destination: { ...fallbackDestination },
    movementRemainingBefore: turn.movementRemaining,
    movementRemainingAfter: Math.max(0, turn.movementRemaining - cost),
    issues,
  }
}

export function moveCurrentCombatant(
  state: TacticalBattleState,
  path: readonly GridPosition[],
): TacticalBattleTransition {
  const preview = evaluateCurrentMovementPath(state, path)
  if (!preview.legal) {
    const issue = preview.issues[0]
    if (!issue) {
      throw new Error('Illegal movement path without a validation reason.')
    }
    throw new Error(`Illegal movement path: ${issue.code}: ${issue.message}`)
  }

  const placement = getPlacement(state, preview.combatantId)
  const movement = spendMovement(state.battle, preview.cost)
  const placements = state.placements.map((candidate) =>
    candidate.combatantId === placement.combatantId
      ? { ...candidate, position: { ...preview.destination } }
      : candidate,
  )
  const nextState: TacticalBattleState = {
    ...state,
    battle: movement.state,
    placements,
  }

  assertValidTacticalBattleState(nextState)

  return {
    state: nextState,
    events: [
      ...movement.events,
      {
        event: 'combatant_moved',
        combatantId: placement.combatantId,
        from: { ...placement.position },
        to: { ...preview.destination },
        movementCost: preview.cost,
      },
    ],
  }
}

export function selectCurrentFinalFacing(
  state: TacticalBattleState,
  facing: BattleFacing,
): TacticalBattleTransition {
  assertValidTacticalBattleState(state)

  const turn = state.battle.currentTurn
  if (state.battle.lifecycle !== 'active' || turn === null) {
    throw new Error('Facing selection requires an active battle turn.')
  }

  const facingTransition = selectFinalFacing(state.battle, facing)
  const placements = state.placements.map((placement) =>
    placement.combatantId === turn.combatantId ? { ...placement, facing } : placement,
  )
  const nextState: TacticalBattleState = {
    ...state,
    battle: facingTransition.state,
    placements,
  }

  assertValidTacticalBattleState(nextState)

  return {
    state: nextState,
    events: [
      ...facingTransition.events,
      {
        event: 'combatant_facing_changed',
        combatantId: turn.combatantId,
        facing,
      },
    ],
  }
}

export function classifyFacingRelation(
  defenderPosition: GridPosition,
  defenderFacing: BattleFacing,
  sourcePosition: GridPosition,
): FacingRelation {
  assertGridPosition(defenderPosition, 'defenderPosition')
  assertGridPosition(sourcePosition, 'sourcePosition')

  if (positionsEqual(defenderPosition, sourcePosition)) {
    throw new Error('Facing relation requires two different board positions.')
  }

  if (defenderFacing === 'north') {
    if (sourcePosition.y < defenderPosition.y) return 'front'
    if (sourcePosition.y > defenderPosition.y) return 'rear'
    return 'side'
  }

  if (defenderFacing === 'south') {
    if (sourcePosition.y > defenderPosition.y) return 'front'
    if (sourcePosition.y < defenderPosition.y) return 'rear'
    return 'side'
  }

  if (defenderFacing === 'east') {
    if (sourcePosition.x > defenderPosition.x) return 'front'
    if (sourcePosition.x < defenderPosition.x) return 'rear'
    return 'side'
  }

  if (sourcePosition.x < defenderPosition.x) return 'front'
  if (sourcePosition.x > defenderPosition.x) return 'rear'
  return 'side'
}

export function validateTacticalBattleState(
  state: TacticalBattleState,
): readonly TacticalBoardIssue[] {
  const issues: TacticalBoardIssue[] = []

  if (state.schemaVersion !== TACTICAL_BOARD_SCHEMA_VERSION) {
    issues.push({ field: 'schemaVersion', message: 'Unsupported tactical-board schema version.' })
  }

  for (const battleIssue of validateBattleState(state.battle)) {
    issues.push({ field: `battle.${battleIssue.field}`, message: battleIssue.message })
  }

  collectPositiveIntegerIssue(issues, state.width, 'width')
  collectPositiveIntegerIssue(issues, state.height, 'height')

  const area = state.width * state.height
  if (!Number.isSafeInteger(area) || area <= 0) {
    issues.push({ field: 'width', message: 'Board area must remain a positive safe integer.' })
  }

  collectTerrainIssues(issues, state)
  collectTileIssues(issues, state, area)
  collectMovementProfileIssues(issues, state)
  collectPlacementIssues(issues, state)
  collectTurnFacingConsistencyIssue(issues, state)

  return issues
}

function normalizeMovementProfile(profile: CombatMovementProfile): CombatMovementProfile {
  return {
    ...profile,
    terrainCostOverrides: [...profile.terrainCostOverrides]
      .map((override) => ({ ...override }))
      .sort((left, right) => compareStableString(left.terrainId, right.terrainId)),
  }
}

function collectTerrainIssues(issues: TacticalBoardIssue[], state: TacticalBattleState): void {
  if (state.terrains.length === 0) {
    issues.push({ field: 'terrains', message: 'At least one terrain definition is required.' })
  }

  const ids = new Set<string>()
  for (const [index, terrain] of state.terrains.entries()) {
    const prefix = `terrains.${index}`
    collectIdentityIssue(issues, terrain.id, `${prefix}.id`)
    collectTraversalCostIssue(issues, terrain.traversalCost, `${prefix}.traversalCost`)
    if (ids.has(terrain.id)) {
      issues.push({ field: `${prefix}.id`, message: 'Terrain IDs must be unique.' })
    }
    ids.add(terrain.id)
  }

  const expected = [...state.terrains].map((terrain) => terrain.id).sort(compareStableString)
  if (
    !arraysEqual(
      state.terrains.map((terrain) => terrain.id),
      expected,
    )
  ) {
    issues.push({ field: 'terrains', message: 'Terrain definitions must use stable ID ordering.' })
  }
}

function collectTileIssues(
  issues: TacticalBoardIssue[],
  state: TacticalBattleState,
  area: number,
): void {
  if (Number.isSafeInteger(area) && area > 0 && state.tiles.length !== area) {
    issues.push({
      field: 'tiles',
      message: 'Tile count must exactly cover every coordinate in the rectangular board.',
    })
  }

  const seen = new Set<string>()
  for (const [index, tile] of state.tiles.entries()) {
    const prefix = `tiles.${index}`
    collectGridPositionIssues(issues, tile.position, `${prefix}.position`)
    collectNonNegativeIntegerIssue(issues, tile.elevation, `${prefix}.elevation`)
    if (!isWithinBoard(state, tile.position)) {
      issues.push({ field: `${prefix}.position`, message: 'Tile position is outside the board.' })
    }
    if (!state.terrains.some((terrain) => terrain.id === tile.terrainId)) {
      issues.push({ field: `${prefix}.terrainId`, message: 'Tile references unknown terrain.' })
    }

    const key = positionKey(tile.position)
    if (seen.has(key)) {
      issues.push({ field: `${prefix}.position`, message: 'Tile positions must be unique.' })
    }
    seen.add(key)
  }

  const expected = [...state.tiles].sort(compareTiles)
  if (!arraysEqual(state.tiles.map(tileKey), expected.map(tileKey))) {
    issues.push({ field: 'tiles', message: 'Tiles must use stable row-major ordering.' })
  }
}

function collectMovementProfileIssues(
  issues: TacticalBoardIssue[],
  state: TacticalBattleState,
): void {
  if (state.movementProfiles.length === 0) {
    issues.push({
      field: 'movementProfiles',
      message: 'At least one movement profile is required.',
    })
  }

  const ids = new Set<string>()
  for (const [index, profile] of state.movementProfiles.entries()) {
    const prefix = `movementProfiles.${index}`
    collectIdentityIssue(issues, profile.id, `${prefix}.id`)
    collectNonNegativeIntegerIssue(issues, profile.maxElevationStep, `${prefix}.maxElevationStep`)
    if (ids.has(profile.id)) {
      issues.push({ field: `${prefix}.id`, message: 'Movement profile IDs must be unique.' })
    }
    ids.add(profile.id)

    const terrainIds = new Set<string>()
    for (const [overrideIndex, override] of profile.terrainCostOverrides.entries()) {
      const overridePrefix = `${prefix}.terrainCostOverrides.${overrideIndex}`
      if (!state.terrains.some((terrain) => terrain.id === override.terrainId)) {
        issues.push({
          field: `${overridePrefix}.terrainId`,
          message: 'Movement profile override references unknown terrain.',
        })
      }
      collectTraversalCostIssue(issues, override.traversalCost, `${overridePrefix}.traversalCost`)
      if (terrainIds.has(override.terrainId)) {
        issues.push({
          field: `${overridePrefix}.terrainId`,
          message: 'Terrain overrides must be unique within a movement profile.',
        })
      }
      terrainIds.add(override.terrainId)
    }

    const expectedOverrides = [...profile.terrainCostOverrides]
      .map((override) => override.terrainId)
      .sort(compareStableString)
    if (
      !arraysEqual(
        profile.terrainCostOverrides.map((item) => item.terrainId),
        expectedOverrides,
      )
    ) {
      issues.push({
        field: `${prefix}.terrainCostOverrides`,
        message: 'Terrain overrides must use stable terrain ID ordering.',
      })
    }
  }

  const expected = [...state.movementProfiles]
    .map((profile) => profile.id)
    .sort(compareStableString)
  if (
    !arraysEqual(
      state.movementProfiles.map((profile) => profile.id),
      expected,
    )
  ) {
    issues.push({
      field: 'movementProfiles',
      message: 'Movement profiles must use stable ID ordering.',
    })
  }
}

function collectPlacementIssues(issues: TacticalBoardIssue[], state: TacticalBattleState): void {
  if (state.placements.length !== state.battle.combatants.length) {
    issues.push({
      field: 'placements',
      message: 'Every battle combatant must have exactly one tactical placement.',
    })
  }

  const combatantIds = new Set<string>()
  const positionKeys = new Set<string>()
  for (const [index, placement] of state.placements.entries()) {
    const prefix = `placements.${index}`
    collectIdentityIssue(issues, placement.combatantId, `${prefix}.combatantId`)
    collectGridPositionIssues(issues, placement.position, `${prefix}.position`)

    if (!state.battle.combatants.some((combatant) => combatant.id === placement.combatantId)) {
      issues.push({
        field: `${prefix}.combatantId`,
        message: 'Placement references an unknown battle combatant.',
      })
    }
    if (!state.movementProfiles.some((profile) => profile.id === placement.movementProfileId)) {
      issues.push({
        field: `${prefix}.movementProfileId`,
        message: 'Placement references an unknown movement profile.',
      })
    }
    if (!isFacing(placement.facing)) {
      issues.push({ field: `${prefix}.facing`, message: 'Placement uses an unknown facing.' })
    }
    if (!isWithinBoard(state, placement.position)) {
      issues.push({ field: `${prefix}.position`, message: 'Placement is outside the board.' })
    }

    if (combatantIds.has(placement.combatantId)) {
      issues.push({
        field: `${prefix}.combatantId`,
        message: 'Combatant placements must be unique.',
      })
    }
    combatantIds.add(placement.combatantId)

    const key = positionKey(placement.position)
    if (positionKeys.has(key)) {
      issues.push({ field: `${prefix}.position`, message: 'Two combatants cannot share a tile.' })
    }
    positionKeys.add(key)

    const tile = state.tiles.find((candidate) =>
      positionsEqual(candidate.position, placement.position),
    )
    const profile = state.movementProfiles.find(
      (candidate) => candidate.id === placement.movementProfileId,
    )
    if (tile && profile && getTraversalCost(state, tile.terrainId, profile) === null) {
      issues.push({
        field: `${prefix}.position`,
        message: 'Combatant cannot occupy terrain blocked for its movement profile.',
      })
    }
  }

  const expected = [...state.placements]
    .map((placement) => placement.combatantId)
    .sort(compareStableString)
  if (
    !arraysEqual(
      state.placements.map((placement) => placement.combatantId),
      expected,
    )
  ) {
    issues.push({
      field: 'placements',
      message: 'Placements must use stable combatant ID ordering.',
    })
  }
}

function collectTurnFacingConsistencyIssue(
  issues: TacticalBoardIssue[],
  state: TacticalBattleState,
): void {
  const turn = state.battle.currentTurn
  if (state.battle.lifecycle !== 'active' || turn?.finalFacing === null || !turn) {
    return
  }

  const placement = state.placements.find((candidate) => candidate.combatantId === turn.combatantId)
  if (placement && placement.facing !== turn.finalFacing) {
    issues.push({
      field: 'battle.currentTurn.finalFacing',
      message: 'Selected final facing must match the current tactical placement facing.',
    })
  }
}

function getTraversalCost(
  state: TacticalBattleState,
  terrainId: string,
  profile: CombatMovementProfile,
): number | null {
  const override = profile.terrainCostOverrides.find((item) => item.terrainId === terrainId)
  if (override) return override.traversalCost

  const terrain = state.terrains.find((item) => item.id === terrainId)
  if (!terrain) {
    throw new Error(`Unknown terrain ${terrainId}.`)
  }
  return terrain.traversalCost
}

function getPlacement(state: TacticalBattleState, combatantId: string): CombatPlacement {
  const placement = state.placements.find((candidate) => candidate.combatantId === combatantId)
  if (!placement) {
    throw new Error(`No tactical placement exists for combatant ${combatantId}.`)
  }
  return placement
}

function getMovementProfile(
  state: TacticalBattleState,
  movementProfileId: string,
): CombatMovementProfile {
  const profile = state.movementProfiles.find((candidate) => candidate.id === movementProfileId)
  if (!profile) {
    throw new Error(`Unknown movement profile ${movementProfileId}.`)
  }
  return profile
}

function getTile(state: TacticalBattleState, position: GridPosition): CombatTile {
  const tile = state.tiles.find((candidate) => positionsEqual(candidate.position, position))
  if (!tile) {
    throw new Error(`No board tile exists at ${positionKey(position)}.`)
  }
  return tile
}

function getOccupyingCombatant(state: TacticalBattleState, position: GridPosition): string | null {
  return (
    state.placements.find((placement) => positionsEqual(placement.position, position))
      ?.combatantId ?? null
  )
}

function isWithinBoard(state: TacticalBattleState, position: GridPosition): boolean {
  return position.x >= 0 && position.y >= 0 && position.x < state.width && position.y < state.height
}

function isOrthogonallyAdjacent(left: GridPosition, right: GridPosition): boolean {
  return Math.abs(left.x - right.x) + Math.abs(left.y - right.y) === 1
}

function positionsEqual(left: GridPosition, right: GridPosition): boolean {
  return left.x === right.x && left.y === right.y
}

function positionKey(position: GridPosition): string {
  return `${position.x},${position.y}`
}

function tileKey(tile: CombatTile): string {
  return `${tile.position.y}:${tile.position.x}:${tile.terrainId}:${tile.elevation}`
}

function compareTiles(left: CombatTile, right: CombatTile): number {
  if (left.position.y !== right.position.y) return left.position.y - right.position.y
  return left.position.x - right.position.x
}

function assertValidTacticalBattleState(state: TacticalBattleState): void {
  const issues = validateTacticalBattleState(state)
  if (issues.length > 0) {
    throw new Error(`Invalid tactical battle state: ${issues[0].field}: ${issues[0].message}`)
  }
}

function assertGridPosition(position: GridPosition, field: string): void {
  if (!Number.isSafeInteger(position.x) || !Number.isSafeInteger(position.y)) {
    throw new RangeError(`${field} must contain safe integer coordinates.`)
  }
}

function collectGridPositionIssues(
  issues: TacticalBoardIssue[],
  position: GridPosition,
  field: string,
): void {
  if (!Number.isSafeInteger(position.x) || !Number.isSafeInteger(position.y)) {
    issues.push({ field, message: 'Grid position must contain safe integer coordinates.' })
  }
}

function collectTraversalCostIssue(
  issues: TacticalBoardIssue[],
  value: number | null,
  field: string,
): void {
  if (value !== null && (!Number.isSafeInteger(value) || value <= 0)) {
    issues.push({ field, message: 'Traversal cost must be null or a positive safe integer.' })
  }
}

function collectIdentityIssue(issues: TacticalBoardIssue[], value: string, field: string): void {
  if (typeof value !== 'string' || value.length === 0 || value.trim() !== value) {
    issues.push({ field, message: 'Identity must be a non-empty trimmed string.' })
  }
}

function collectPositiveIntegerIssue(
  issues: TacticalBoardIssue[],
  value: number,
  field: string,
): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    issues.push({ field, message: 'Value must be a positive safe integer.' })
  }
}

function collectNonNegativeIntegerIssue(
  issues: TacticalBoardIssue[],
  value: number,
  field: string,
): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    issues.push({ field, message: 'Value must be a non-negative safe integer.' })
  }
}

function isFacing(value: string): value is BattleFacing {
  return value === 'north' || value === 'east' || value === 'south' || value === 'west'
}

function arraysEqual<T>(left: readonly T[], right: readonly T[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index])
}

function compareStableString(left: string, right: string): number {
  if (left < right) return -1
  if (left > right) return 1
  return 0
}

import type { BattleIntent } from '@aurevane/validation/combat/battle-session'
import type { BattleSkillForecastPresentation } from './battle-runtime'
import { manhattanDistance, positionsEqual } from './battle-geometry'
import {
  combatCardinalDirections,
  combatTargetCategories,
} from '@aurevane/game-core/combat/combat-targeting-shapes'
import type { CombatTargetSpec } from '@aurevane/game-core/combat/actions'
import type { AbilityBehavior } from '@aurevane/game-core/combat/combat-definition'
import type { BattleAbilityBehaviorReport } from '@/lib/battle/battle-basic-actions'

interface PreviewSelectionCombatant {
  combatantId: string
  teamIndex: number
  hp: number
  position: { x: number; y: number }
}

export interface BattleControlledActionAvailability {
  readonly phase: 'unprimed' | 'primed' | 'spent'
  readonly canPrime: boolean
  readonly canCancel: boolean
}

export type BattlePreviewSkill = Pick<
  BattleSkillForecastPresentation,
  | 'id'
  | 'targetKind'
  | 'targetTeamPolicy'
  | 'minimumRange'
  | 'maximumRange'
  | 'target'
  | 'definition'
  | 'groundIntentCapable'
> & {
  behaviorId?: string
  controlled?: BattleControlledActionAvailability
  unavailable?: boolean
  move?: { maximumTiles: number; conditional: boolean }
  costs?: AbilityBehavior['costs']
  movementPath?: readonly { x: number; y: number }[]
}
export interface BattleCapturedActionTarget {
  /** Absent only on older public snapshots. */
  ownerCombatantId?: string
  actionId: string
  behaviorId: string
  controlled?: BattleControlledActionAvailability
  target: CombatTargetSpec
  move?: { maximumTiles: number; conditional: boolean }
  costs?: AbilityBehavior['costs']
  cooldown?: AbilityBehavior['cooldown']
  report?: BattleAbilityBehaviorReport
}

/** Free commands contain captured references only; an ambiguous Manual group requires a choice. */
export function selectBattleControlledPrimeIntent(
  captures: readonly BattleCapturedActionTarget[],
  actionId: string,
  behaviorId?: string,
): Extract<BattleIntent, { kind: 'ability-prime' | 'ability-cancel-prime' }> | null {
  const choices = captures.filter((row) => row.actionId === actionId)
  const choice = behaviorId
    ? choices.find((row) => row.behaviorId === behaviorId)
    : choices.length === 1
      ? choices[0]
      : undefined
  return choice?.controlled?.canPrime
    ? { kind: 'ability-prime', actionId, behaviorId: choice.behaviorId }
    : null
}
/** Missing historical captures preserve their envelope; ambiguous canonical choices fail closed. */
export function resolveBattleCapturedSkill(
  skill: BattlePreviewSkill,
  captures: readonly BattleCapturedActionTarget[],
  behaviorId?: string,
): BattlePreviewSkill | null {
  const choices = captures.filter((capture) => capture.actionId === skill.id)
  if (!choices.length) return behaviorId ? null : skill
  const choice = behaviorId
    ? choices.find((capture) => capture.behaviorId === behaviorId)
    : choices.length === 1
      ? choices[0]
      : undefined
  if (!choice) return null
  return {
    ...skill,
    behaviorId: choice.behaviorId,
    controlled: choice.controlled,
    groundIntentCapable: false,
    target: choice.target,
    targetKind: choice.target.kind,
    targetTeamPolicy: choice.target.teamPolicy,
    minimumRange: choice.target.minimumRange,
    maximumRange: choice.target.maximumRange,
    move: choice.move,
    costs: choice.costs,
  }
}
export function battleSkillTargetSpec(skill: BattlePreviewSkill) {
  return skill.target ?? skill.definition?.target
}
export function battleSkillUsesAreaActivation(skill: BattlePreviewSkill) {
  const target = battleSkillTargetSpec(skill)
  return usesAreaGeometry(target)
}
function usesAreaGeometry(target: CombatTargetSpec | undefined): target is CombatTargetSpec & {
  geometryVersion: 2 | 3
  shape: { kind: 'line'; length: number } | { kind: 'circle'; radius: number } | { kind: 'all' }
} {
  return (
    (target?.geometryVersion === 2 || target?.geometryVersion === 3) &&
    target.shape.kind !== 'single'
  )
}
/** Captured geometry outranks the native presentation envelope for new behaviors. */
function capturedTargetSkill(skill: BattlePreviewSkill): BattlePreviewSkill {
  const target = battleSkillTargetSpec(skill)
  return target?.geometryVersion === 3
    ? {
        ...skill,
        target,
        targetKind: target.kind,
        targetTeamPolicy: target.teamPolicy,
        minimumRange: target.minimumRange,
        maximumRange: target.maximumRange,
      }
    : skill
}
function cardinalDirection(delta: { x: number; y: number }) {
  if (delta.x === 0 && delta.y !== 0) return delta.y < 0 ? ('north' as const) : ('south' as const)
  if (delta.y === 0 && delta.x !== 0) return delta.x < 0 ? ('west' as const) : ('east' as const)
  return null
}
type PreviewSelection = {
  actorId: string | null
  selectedCombatantId: string | null
  selectedTile: { x: number; y: number } | null
  combatants: readonly PreviewSelectionCombatant[]
  tiles?: readonly { x: number; y: number }[]
  selectedTarget?: ActionIntent['target'] | null
}
type ActionIntent = Extract<BattleIntent, { kind: 'action' }>

export interface BattleActionMovementDraft {
  readonly battleVersion: number
  readonly actorId: string
  readonly actionId: string
  readonly behaviorId?: string
  readonly path: readonly { x: number; y: number }[]
}
/** A route never follows another action, group, actor or battle version. */
export function bindBattleSkillMovement(
  skill: BattlePreviewSkill,
  draft: BattleActionMovementDraft | null,
  battleVersion: number,
  actorId: string | null,
): BattlePreviewSkill {
  if (!skill.move) return skill
  const matches =
    draft &&
    draft.battleVersion === battleVersion &&
    draft.actorId === actorId &&
    draft.actionId === skill.id &&
    draft.behaviorId === skill.behaviorId
  return { ...skill, movementPath: matches ? draft.path : undefined }
}

/** Informational future geometry; only the server decides whether walking really executes. */
function movedBattleSkillIntent(
  skill: BattlePreviewSkill,
  selection: PreviewSelection,
  choose: (skill: BattlePreviewSkill, context: PreviewSelection) => ActionIntent | null,
): ActionIntent | null {
  const path = skill.movementPath
  if (skill.move && (path === undefined || (path.length === 0 && !skill.move.conditional)))
    return null
  const destination = path?.at(-1)
  const projected = destination
    ? {
        ...selection,
        combatants: selection.combatants.map((row) =>
          row.combatantId === selection.actorId ? { ...row, position: { ...destination } } : row,
        ),
      }
    : selection
  const intent =
    choose(skill, projected) ?? (skill.move?.conditional ? choose(skill, selection) : null)
  return intent && path?.length
    ? { ...intent, movementPath: path.map((point) => ({ ...point })) }
    : intent
}
export function selectInitialBattleSkillPreviewIntent(
  skill: BattlePreviewSkill,
  selection: PreviewSelection,
): ActionIntent | null {
  return movedBattleSkillIntent(skill, selection, initialBattleSkillPreviewIntent)
}
/** Destination selection commits only when it also determines the sole recipient. */
export function selectBattleSkillMovementCommitIntent(
  skill: BattlePreviewSkill,
  selection: PreviewSelection,
): ActionIntent | null {
  const spec = battleSkillTargetSpec(skill)
  const categories = spec?.geometryVersion === 3 ? combatTargetCategories(spec) : undefined
  const exclusivelySelf = categories
    ? categories.length === 1 && categories[0] === 'self'
    : (spec?.kind ?? skill.targetKind) === 'self'
  if (
    !skill.move ||
    !exclusivelySelf ||
    (spec && (spec.shape.kind !== 'single' || spec.maximumSelections !== 1))
  )
    return null
  const intent = selectInitialBattleSkillPreviewIntent(skill, selection)
  return intent &&
    (intent.target.kind === 'self' ||
      (intent.target.kind === 'unit' && intent.target.combatantId === selection.actorId))
    ? intent
    : null
}
export function selectBattleSkillPreviewIntent(
  skill: BattlePreviewSkill,
  selection: PreviewSelection,
): ActionIntent | null {
  return movedBattleSkillIntent(skill, selection, battleSkillPreviewIntent)
}
export function selectDirectionalBattleSkillPreviewIntent(
  skill: BattlePreviewSkill,
  selection: PreviewSelection,
  delta: { x: number; y: number },
): ActionIntent | null {
  return movedBattleSkillIntent(skill, selection, (definition, context) =>
    directionalBattleSkillPreviewIntent(definition, context, delta),
  )
}
type OrdinarySelection = Extract<ActionIntent['target'], { kind: 'self' | 'unit' | 'tile' }>
/** Unit choices follow living placement identities; Ground choices keep their exact coordinate. */
export function battleTargetDraftIncludesTile(
  targets: readonly OrdinarySelection[],
  actorId: string | null,
  occupantId: string | null,
  position: { x: number; y: number },
): boolean {
  return targets.some((target) =>
    target.kind === 'tile'
      ? positionsEqual(target.position, position)
      : Boolean(
          occupantId && occupantId === (target.kind === 'self' ? actorId : target.combatantId),
        ),
  )
}

/** Local draft only: no cost, cooldown, authority or informational guess is committed here. */
export function toggleBattleSkillTargetSelection(
  current: ActionIntent | null,
  candidate: ActionIntent,
  maximumSelections: number,
  actorId: string,
): ActionIntent | null {
  if (!Number.isSafeInteger(maximumSelections) || maximumSelections < 1 || maximumSelections > 3)
    throw new RangeError('Ordinary selection count must be between one and three.')
  const target = candidate.target
  if (target.kind !== 'self' && target.kind !== 'unit' && target.kind !== 'tile')
    throw new TypeError('Only an ordinary target can be added to this selection.')
  const key = (item: OrdinarySelection) =>
    item.kind === 'tile'
      ? `tile:${item.position.x}:${item.position.y}`
      : `unit:${item.kind === 'self' ? actorId : item.combatantId}`
  const matches =
    current?.actionId === candidate.actionId && current.behaviorId === candidate.behaviorId
  const prior = matches && current.target.kind === 'selections' ? current.target.selections : []
  const repeated = prior.some((item) => key(item) === key(target))
  const selected = repeated
    ? prior.filter((item) => key(item) !== key(target))
    : prior.length < maximumSelections
      ? [...prior, target]
      : [...prior]
  return selected.length
    ? { ...candidate, target: { kind: 'selections', selections: selected } }
    : null
}

function selectedFireEnemy(selection: PreviewSelection, actor: PreviewSelectionCombatant) {
  return selection.combatants.find(
    (row) =>
      row.hp > 0 &&
      row.teamIndex !== actor.teamIndex &&
      (selection.selectedTile
        ? positionsEqual(row.position, selection.selectedTile)
        : row.combatantId === selection.selectedCombatantId),
  )
}
function fireGroundSelection(skill: BattlePreviewSkill, selection: PreviewSelection) {
  if (!skill.groundIntentCapable) return false
  const actor = selection.combatants.find((row) => row.combatantId === selection.actorId)
  if (!actor) return false
  if (selection.selectedTile) return !selectedFireEnemy(selection, actor)
  const target = selection.selectedTarget
  return (target?.kind === 'direction' || target?.kind === 'activate') && target.ground === true
}

interface PreviewContinuityState {
  battleSessionId: string
  battleVersion: number
  snapshot: {
    tactical: {
      battle: {
        lifecycle: string
        turnNumber: number
        currentTurn: { combatantId: string } | null
        combatants: readonly { id: string; hp: number }[]
      }
    }
  }
}
/** A reload may preserve an armed action's geometry, never its old command or forecast. */
export function canRetainBattleActionPreview(
  previous: PreviewContinuityState,
  next: PreviewContinuityState,
  actorId: string | null,
) {
  const before = previous.snapshot.tactical.battle
  const after = next.snapshot.tactical.battle
  return (
    previous.battleSessionId === next.battleSessionId &&
    next.battleVersion >= previous.battleVersion &&
    after.lifecycle === 'active' &&
    before.turnNumber === after.turnNumber &&
    before.currentTurn?.combatantId === actorId &&
    after.currentTurn?.combatantId === actorId &&
    after.combatants.some((unit) => unit.id === actorId && unit.hp > 0)
  )
}

/** Deterministic initial aim is informational; the server preview checks full legality. */
function initialBattleSkillPreviewIntent(
  skill: BattlePreviewSkill,
  selection: PreviewSelection,
): ActionIntent | null {
  if (skill.unavailable) return null
  skill = capturedTargetSkill(skill)
  const chosen = selectBattleSkillPreviewIntent(skill, selection)
  if (chosen?.kind === 'action') return chosen
  const actor = selection.combatants.find((row) => row.combatantId === selection.actorId)
  if (!actor || actor.hp <= 0) return null
  const spec = battleSkillTargetSpec(skill)
  if (usesAreaGeometry(spec) && spec.shape.kind === 'line') {
    // A deterministic informational forecast does not focus the potential glow set.
    const candidates = selection.combatants.filter(
      (row) => row.hp > 0 && row.combatantId !== actor.combatantId,
    )
    const direction =
      candidates
        .map((row) =>
          cardinalDirection({
            x: row.position.x - actor.position.x,
            y: row.position.y - actor.position.y,
          }),
        )
        .find(Boolean) ?? combatCardinalDirections[0]
    return {
      kind: 'action',
      actionId: skill.id,
      ...(skill.behaviorId ? { behaviorId: skill.behaviorId } : {}),
      target: {
        kind: 'direction',
        direction,
        ...(fireGroundSelection(skill, selection) ? { ground: true as const } : {}),
      },
    }
  }
  const ordered = [...selection.combatants].sort(
    (left, right) =>
      manhattanDistance(left.position, actor.position) -
        manhattanDistance(right.position, actor.position) ||
      left.position.y - right.position.y ||
      left.position.x - right.position.x ||
      left.combatantId.localeCompare(right.combatantId),
  )
  if (
    skill.targetKind === 'unit' ||
    skill.groundIntentCapable ||
    (spec?.geometryVersion === 3 &&
      combatTargetCategories(spec).some((category) => category !== 'ground'))
  ) {
    for (const row of ordered) {
      const intent = selectBattleSkillPreviewIntent(skill, {
        ...selection,
        selectedCombatantId: row.combatantId,
        selectedTile: null,
      })
      if (intent?.kind === 'action') return intent
    }
    if (
      !skill.groundIntentCapable &&
      !(spec?.geometryVersion === 3 && combatTargetCategories(spec).includes('ground'))
    )
      return null
  }
  if (
    skill.targetKind === 'ground-tile' ||
    skill.targetKind === 'empty-tile' ||
    skill.groundIntentCapable ||
    (spec?.geometryVersion === 3 && combatTargetCategories(spec).includes('ground'))
  ) {
    const preferred =
      skill.targetKind === 'ground-tile'
        ? ordered
            .filter(
              (row) =>
                row.hp > 0 &&
                (skill.targetTeamPolicy === 'enemy'
                  ? row.teamIndex !== actor.teamIndex
                  : skill.targetTeamPolicy === 'ally'
                    ? row.teamIndex === actor.teamIndex
                    : true),
            )
            .map((row) => row.position)
        : []
    const tiles = [...(selection.tiles ?? [])].sort(
      (left, right) =>
        manhattanDistance(left, actor.position) - manhattanDistance(right, actor.position) ||
        left.y - right.y ||
        left.x - right.x,
    )
    for (const position of [...preferred, ...tiles]) {
      if (!selection.tiles?.some((tile) => positionsEqual(tile, position))) continue
      const intent = selectBattleSkillPreviewIntent(skill, { ...selection, selectedTile: position })
      if (intent?.kind === 'action') return intent
    }
  }
  return null
}

/** A deliberate direction chooses a target; it never guesses across the opposite half-plane. */
function directionalBattleSkillPreviewIntent(
  skill: BattlePreviewSkill,
  selection: PreviewSelection,
  direction: { x: number; y: number },
): ActionIntent | null {
  if (skill.unavailable) return null
  skill = capturedTargetSkill(skill)
  const spec = battleSkillTargetSpec(skill)
  if (
    skill.targetKind === 'self' &&
    (spec?.geometryVersion !== 3 ||
      (spec.shape.kind === 'single' &&
        combatTargetCategories(spec).every((category) => category === 'self')))
  )
    return selectInitialBattleSkillPreviewIntent(skill, selection)
  const actor = selection.combatants.find((row) => row.combatantId === selection.actorId)
  if (!actor || actor.hp <= 0) return null
  if (usesAreaGeometry(spec) && spec.shape.kind === 'line') {
    const facing = cardinalDirection(direction)
    return facing
      ? {
          kind: 'action',
          actionId: skill.id,
          ...(skill.behaviorId ? { behaviorId: skill.behaviorId } : {}),
          target: {
            kind: 'direction',
            direction: facing,
            ...(fireGroundSelection(skill, selection) ? { ground: true as const } : {}),
          },
        }
      : null
  }
  if (usesAreaGeometry(spec) && (spec.shape.kind === 'circle' || spec.shape.kind === 'all'))
    return {
      kind: 'action',
      actionId: skill.id,
      ...(skill.behaviorId ? { behaviorId: skill.behaviorId } : {}),
      target: {
        kind: 'activate',
        ...(fireGroundSelection(skill, selection) ? { ground: true as const } : {}),
      },
    }
  const aimed = (position: { x: number; y: number }) =>
    (position.x - actor.position.x) * direction.x + (position.y - actor.position.y) * direction.y >
    0
  const chosen = selectBattleSkillPreviewIntent(skill, selection)
  if (chosen?.kind === 'action') {
    const position =
      chosen.target.kind === 'tile'
        ? chosen.target.position
        : chosen.target.kind === 'unit'
          ? selection.combatants.find((row) => row.combatantId === selection.selectedCombatantId)
              ?.position
          : null
    if (position && aimed(position)) return chosen
  }
  if (
    skill.targetKind === 'unit' ||
    skill.groundIntentCapable ||
    (spec?.geometryVersion === 3 &&
      combatTargetCategories(spec).some((category) => category !== 'ground'))
  ) {
    const candidates = selection.combatants
      .filter((row) => aimed(row.position))
      .sort(
        (left, right) =>
          manhattanDistance(left.position, actor.position) -
            manhattanDistance(right.position, actor.position) ||
          left.position.y - right.position.y ||
          left.position.x - right.position.x ||
          left.combatantId.localeCompare(right.combatantId),
      )
    for (const candidate of candidates) {
      const intent = selectBattleSkillPreviewIntent(skill, {
        ...selection,
        selectedCombatantId: candidate.combatantId,
        selectedTile: null,
      })
      if (intent?.kind === 'action') return intent
    }
    if (
      !skill.groundIntentCapable &&
      !(spec?.geometryVersion === 3 && combatTargetCategories(spec).includes('ground'))
    )
      return null
  }
  if (spec?.geometryVersion === 3 && combatTargetCategories(spec).includes('ground')) {
    const tiles = [...(selection.tiles ?? [])]
      .filter(aimed)
      .sort(
        (a, b) =>
          manhattanDistance(a, actor.position) - manhattanDistance(b, actor.position) ||
          a.y - b.y ||
          a.x - b.x,
      )
    for (const position of tiles) {
      const intent = selectBattleSkillPreviewIntent(skill, {
        ...selection,
        selectedCombatantId: null,
        selectedTile: position,
      })
      if (intent) return intent
    }
    return null
  }
  return selectInitialBattleSkillPreviewIntent(
    skill.groundIntentCapable
      ? { ...skill, targetKind: 'ground-tile', groundIntentCapable: false }
      : skill,
    {
      ...selection,
      selectedCombatantId: null,
      selectedTile: null,
      tiles: selection.tiles?.filter(aimed),
    },
  )
}

/** Chooses only the player's target (or an authored self target). The server still checks legality. */
function battleSkillPreviewIntent(
  skill: BattlePreviewSkill,
  selection: PreviewSelection,
): ActionIntent | null {
  if (skill.unavailable) return null
  skill = capturedTargetSkill(skill)
  const actor = selection.combatants.find((row) => row.combatantId === selection.actorId)
  if (!actor || actor.hp <= 0) return null
  const spec = battleSkillTargetSpec(skill)
  if (usesAreaGeometry(spec)) {
    if (spec.shape.kind !== 'line')
      return {
        kind: 'action',
        actionId: skill.id,
        ...(skill.behaviorId ? { behaviorId: skill.behaviorId } : {}),
        target: {
          kind: 'activate',
          ...(fireGroundSelection(skill, selection) ? { ground: true as const } : {}),
        },
      }
    const position =
      selection.selectedTile ??
      selection.combatants.find((row) => row.combatantId === selection.selectedCombatantId)
        ?.position
    if (!position) return null
    const direction = cardinalDirection({
      x: position.x - actor.position.x,
      y: position.y - actor.position.y,
    })
    return direction
      ? {
          kind: 'action',
          actionId: skill.id,
          ...(skill.behaviorId ? { behaviorId: skill.behaviorId } : {}),
          target: {
            kind: 'direction',
            direction,
            ...(fireGroundSelection(skill, selection) ? { ground: true as const } : {}),
          },
        }
      : null
  }
  const inRange = (position: { x: number; y: number }) => {
    const distance = manhattanDistance(position, actor.position)
    return distance >= skill.minimumRange && distance <= skill.maximumRange
  }
  const categories = spec?.geometryVersion === 3 ? combatTargetCategories(spec) : null
  const categoryFor = (unit: PreviewSelectionCombatant) =>
    unit.combatantId === actor.combatantId
      ? 'self'
      : unit.teamIndex === actor.teamIndex
        ? 'ally'
        : 'enemy'
  const selectedGroundUnit =
    categories && selection.selectedTile
      ? selection.combatants.find(
          (unit) => unit.hp > 0 && positionsEqual(unit.position, selection.selectedTile!),
        )
      : undefined
  if (
    categories?.includes('ground') &&
    selection.selectedTile &&
    (!selectedGroundUnit || !categories.includes(categoryFor(selectedGroundUnit)))
  ) {
    if (
      skill.targetKind === 'empty-tile' &&
      selection.combatants.some(
        (unit) => unit.hp !== 0 && positionsEqual(unit.position, selection.selectedTile!),
      )
    )
      return null
    return inRange(selection.selectedTile)
      ? {
          kind: 'action',
          actionId: skill.id,
          ...(skill.behaviorId ? { behaviorId: skill.behaviorId } : {}),
          target: { kind: 'tile', position: selection.selectedTile },
        }
      : null
  }
  if (categories) {
    const target =
      selectedGroundUnit ??
      (selection.selectedCombatantId
        ? selection.combatants.find((row) => row.combatantId === selection.selectedCombatantId)
        : categories.includes('self')
          ? actor
          : undefined)
    if (
      !target ||
      target.hp <= 0 ||
      !inRange(target.position) ||
      !categories.includes(categoryFor(target))
    )
      return null
    return {
      kind: 'action',
      actionId: skill.id,
      ...(skill.behaviorId ? { behaviorId: skill.behaviorId } : {}),
      target:
        target.combatantId === actor.combatantId && skill.targetKind === 'self'
          ? { kind: 'self' }
          : { kind: 'unit', combatantId: target.combatantId },
    }
  }
  if (skill.targetKind === 'self') {
    return {
      kind: 'action',
      actionId: skill.id,
      ...(skill.behaviorId ? { behaviorId: skill.behaviorId } : {}),
      target: { kind: 'self' },
    }
  }
  if (
    (skill.targetKind === 'ground-tile' && !skill.groundIntentCapable) ||
    skill.targetKind === 'empty-tile' ||
    fireGroundSelection(skill, selection)
  ) {
    if (
      skill.targetKind === 'empty-tile' &&
      selection.selectedTile &&
      selection.combatants.some(
        // Only recorded zero HP releases occupancy; malformed or unknown HP stays blocking.
        (row) => row.hp !== 0 && positionsEqual(row.position, selection.selectedTile!),
      )
    )
      return null
    return selection.selectedTile && inRange(selection.selectedTile)
      ? {
          kind: 'action',
          actionId: skill.id,
          ...(skill.behaviorId ? { behaviorId: skill.behaviorId } : {}),
          target: { kind: 'tile', position: selection.selectedTile },
        }
      : null
  }
  const target = skill.groundIntentCapable
    ? selectedFireEnemy(selection, actor)
    : selectedGroundUnit
      ? selectedGroundUnit
      : selection.selectedCombatantId
        ? selection.combatants.find((row) => row.combatantId === selection.selectedCombatantId)
        : actor
  if (!target || target.hp <= 0 || !inRange(target.position)) return null
  const sameTeam = target.teamIndex === actor.teamIndex
  if (
    (skill.targetTeamPolicy === 'self' && target.combatantId !== actor.combatantId) ||
    (skill.targetTeamPolicy === 'ally' && !sameTeam) ||
    (skill.targetTeamPolicy === 'enemy' && sameTeam)
  )
    return null
  return {
    kind: 'action',
    actionId: skill.id,
    ...(skill.behaviorId ? { behaviorId: skill.behaviorId } : {}),
    target: { kind: 'unit', combatantId: target.combatantId },
  }
}

export function isCurrentBattlePreview(
  ready: { intent: BattleIntent; version: number; sequence: number } | null,
  intent: BattleIntent | null,
  version: number,
  sequence: number,
): boolean {
  return Boolean(
    ready &&
    intent &&
    ready.version === version &&
    ready.sequence === sequence &&
    JSON.stringify(ready.intent) === JSON.stringify(intent),
  )
}

export function battleIntentTileKey(
  intent: BattleIntent | null,
  placements: readonly { combatantId: string; position: { x: number; y: number } }[],
  actorId: string | null,
): string | undefined {
  let position: { x: number; y: number } | undefined
  if (intent?.kind === 'move') position = intent.path.at(-1)
  else if (intent?.kind === 'action') {
    if (intent.target.kind === 'tile') position = intent.target.position
    else if (intent.target.kind === 'self' || intent.target.kind === 'unit') {
      const id = intent.target.kind === 'self' ? actorId : intent.target.combatantId
      position = placements.find((row) => row.combatantId === id)?.position
    }
  }
  return position ? `${position.x}:${position.y}` : undefined
}

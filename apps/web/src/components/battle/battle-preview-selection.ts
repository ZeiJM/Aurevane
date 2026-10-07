import type { BattleIntent } from '@aurevane/validation/combat/battle-session'
import type { BattleSkillForecastPresentation } from './battle-runtime'
import { manhattanDistance, positionsEqual } from './battle-geometry'
import { combatCardinalDirections } from '@aurevane/game-core/combat/combat-targeting-shapes'

interface PreviewSelectionCombatant {
  combatantId: string
  teamIndex: number
  hp: number
  position: { x: number; y: number }
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
>
export function battleSkillTargetSpec(skill: BattlePreviewSkill) {
  return skill.target ?? skill.definition?.target
}
export function battleSkillUsesAreaActivation(skill: BattlePreviewSkill) {
  const target = battleSkillTargetSpec(skill)
  return target?.geometryVersion === 2 && target.shape.kind !== 'single'
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
}
type ActionIntent = Extract<BattleIntent, { kind: 'action' }>

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
export function selectInitialBattleSkillPreviewIntent(
  skill: BattlePreviewSkill,
  selection: PreviewSelection,
): ActionIntent | null {
  const chosen = selectBattleSkillPreviewIntent(skill, selection)
  if (chosen?.kind === 'action') return chosen
  const actor = selection.combatants.find((row) => row.combatantId === selection.actorId)
  if (!actor || actor.hp <= 0) return null
  const spec = battleSkillTargetSpec(skill)
  if (spec?.geometryVersion === 2 && spec.shape.kind === 'line') {
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
    return { kind: 'action', actionId: skill.id, target: { kind: 'direction', direction } }
  }
  const ordered = [...selection.combatants].sort(
    (left, right) =>
      manhattanDistance(left.position, actor.position) -
        manhattanDistance(right.position, actor.position) ||
      left.position.y - right.position.y ||
      left.position.x - right.position.x ||
      left.combatantId.localeCompare(right.combatantId),
  )
  if (skill.targetKind === 'unit') {
    for (const row of ordered) {
      const intent = selectBattleSkillPreviewIntent(skill, {
        ...selection,
        selectedCombatantId: row.combatantId,
      })
      if (intent?.kind === 'action') return intent
    }
    return null
  }
  if (skill.targetKind === 'ground-tile' || skill.targetKind === 'empty-tile') {
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
export function selectDirectionalBattleSkillPreviewIntent(
  skill: BattlePreviewSkill,
  selection: PreviewSelection,
  direction: { x: number; y: number },
): ActionIntent | null {
  if (skill.targetKind === 'self') return selectInitialBattleSkillPreviewIntent(skill, selection)
  const actor = selection.combatants.find((row) => row.combatantId === selection.actorId)
  if (!actor || actor.hp <= 0) return null
  const spec = battleSkillTargetSpec(skill)
  if (spec?.geometryVersion === 2 && spec.shape.kind === 'line') {
    const facing = cardinalDirection(direction)
    return facing
      ? { kind: 'action', actionId: skill.id, target: { kind: 'direction', direction: facing } }
      : null
  }
  if (spec?.geometryVersion === 2 && (spec.shape.kind === 'circle' || spec.shape.kind === 'all'))
    return { kind: 'action', actionId: skill.id, target: { kind: 'activate' } }
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
  if (skill.targetKind === 'unit') {
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
    return null
  }
  return selectInitialBattleSkillPreviewIntent(skill, {
    ...selection,
    selectedCombatantId: null,
    selectedTile: null,
    tiles: selection.tiles?.filter(aimed),
  })
}

/** Chooses only the player's target (or an authored self target). The server still checks legality. */
export function selectBattleSkillPreviewIntent(
  skill: BattlePreviewSkill,
  selection: {
    actorId: string | null
    selectedCombatantId: string | null
    selectedTile: { x: number; y: number } | null
    combatants: readonly PreviewSelectionCombatant[]
  },
): ActionIntent | null {
  const actor = selection.combatants.find((row) => row.combatantId === selection.actorId)
  if (!actor || actor.hp <= 0) return null
  const spec = battleSkillTargetSpec(skill)
  if (spec?.geometryVersion === 2 && spec.shape.kind !== 'single') {
    if (spec.shape.kind !== 'line')
      return { kind: 'action', actionId: skill.id, target: { kind: 'activate' } }
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
      ? { kind: 'action', actionId: skill.id, target: { kind: 'direction', direction } }
      : null
  }
  const inRange = (position: { x: number; y: number }) => {
    const distance = manhattanDistance(position, actor.position)
    return distance >= skill.minimumRange && distance <= skill.maximumRange
  }
  if (skill.targetKind === 'self') {
    return { kind: 'action', actionId: skill.id, target: { kind: 'self' } }
  }
  if (skill.targetKind === 'ground-tile' || skill.targetKind === 'empty-tile') {
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
          target: { kind: 'tile', position: selection.selectedTile },
        }
      : null
  }
  const target = selection.selectedCombatantId
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

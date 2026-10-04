import type { BattleIntent } from '@aurevane/validation/combat/battle-session'
import type { BattleSkillForecastPresentation } from './battle-runtime'
import { manhattanDistance, positionsEqual } from './battle-geometry'

interface PreviewSelectionCombatant {
  combatantId: string
  teamIndex: number
  hp: number
  position: { x: number; y: number }
}

type PreviewSkill = Pick<
  BattleSkillForecastPresentation,
  'id' | 'targetKind' | 'targetTeamPolicy' | 'minimumRange' | 'maximumRange'
>
type PreviewSelection = {
  actorId: string | null
  selectedCombatantId: string | null
  selectedTile: { x: number; y: number } | null
  combatants: readonly PreviewSelectionCombatant[]
  tiles?: readonly { x: number; y: number }[]
}
type ActionIntent = Extract<BattleIntent, { kind: 'action' }>

/** Deterministic initial aim is informational; the server preview checks full legality. */
export function selectInitialBattleSkillPreviewIntent(
  skill: PreviewSkill,
  selection: PreviewSelection,
): ActionIntent | null {
  const chosen = selectBattleSkillPreviewIntent(skill, selection)
  if (chosen?.kind === 'action') return chosen
  const actor = selection.combatants.find((row) => row.combatantId === selection.actorId)
  if (!actor || actor.hp <= 0) return null
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
  skill: PreviewSkill,
  selection: PreviewSelection,
  direction: { x: number; y: number },
): ActionIntent | null {
  if (skill.targetKind === 'self') return selectInitialBattleSkillPreviewIntent(skill, selection)
  const actor = selection.combatants.find((row) => row.combatantId === selection.actorId)
  if (!actor || actor.hp <= 0) return null
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
  skill: Pick<
    BattleSkillForecastPresentation,
    'id' | 'targetKind' | 'targetTeamPolicy' | 'minimumRange' | 'maximumRange'
  >,
  selection: {
    actorId: string | null
    selectedCombatantId: string | null
    selectedTile: { x: number; y: number } | null
    combatants: readonly PreviewSelectionCombatant[]
  },
): BattleIntent | null {
  const actor = selection.combatants.find((row) => row.combatantId === selection.actorId)
  if (!actor || actor.hp <= 0) return null
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
    else {
      const id = intent.target.kind === 'self' ? actorId : intent.target.combatantId
      position = placements.find((row) => row.combatantId === id)?.position
    }
  }
  return position ? `${position.x}:${position.y}` : undefined
}

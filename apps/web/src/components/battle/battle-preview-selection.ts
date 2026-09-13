import type { BattleIntent } from '@aurevane/validation/combat/battle-session'
import type { BattleSkillForecastPresentation } from './battle-runtime'
import { manhattanDistance, positionsEqual } from './battle-geometry'

interface PreviewSelectionCombatant {
  combatantId: string
  teamIndex: number
  hp: number
  position: { x: number; y: number }
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
      selection.combatants.some((row) => positionsEqual(row.position, selection.selectedTile!))
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

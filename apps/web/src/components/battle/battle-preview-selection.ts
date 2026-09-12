import type { BattleIntent } from '@aurevane/validation/combat/battle-session'

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

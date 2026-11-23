import type { WorldView } from './types'

/** An atomic World encounter commit redirects without rebuilding World presentation. */
export interface WorldAttackReceipt {
  characterId: string
  battleSessionId: string
}

/** A committed encounter is an event, not a replacement movement snapshot. */
export function mergeWorldAttackReceipt(
  view: WorldView,
  receipt: WorldAttackReceipt,
  expectedCharacterId: string,
): WorldView {
  if (
    view.characterId !== expectedCharacterId ||
    receipt.characterId !== expectedCharacterId ||
    typeof receipt.battleSessionId !== 'string' ||
    !receipt.battleSessionId.trim()
  )
    throw new Error('The encounter could not be opened safely.')
  return { ...view, battleSessionId: receipt.battleSessionId }
}

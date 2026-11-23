import type { WorldPlayer } from './types'

/** Peer-only receipt; never replaces the owner's clock, movement or terrain. */
export interface WorldLivePlayers {
  characterId: string
  version: number
  serverNow: number
  sceneSectorIds: string[]
  players: WorldPlayer[]
  registered: boolean
}

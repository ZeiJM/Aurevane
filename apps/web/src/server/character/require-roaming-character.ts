import 'server-only'
import { isAurevaneError } from '@aurevane/game-core/errors'
import { redirect } from 'next/navigation'
import { getAuthenticatedActor } from '@/server/auth/actor'
import {
  getActiveBattleForUser,
  getActiveSpectatingForUser,
} from '@/server/account/active-game-session'
import { loadSelectedCharacter } from './selected-character'

/** New hub routes share the same active-session restrictions as the existing game pages. */
export async function requireRoamingCharacter() {
  let actor
  try {
    actor = await getAuthenticatedActor()
  } catch (error) {
    if (isAurevaneError(error) && error.code === 'UNAUTHENTICATED') redirect('/')
    throw error
  }
  const [battle, spectating, character] = await Promise.all([
    getActiveBattleForUser(actor.userId),
    getActiveSpectatingForUser(actor.userId),
    loadSelectedCharacter(actor),
  ])
  if (battle) redirect(`/game/battle/${battle.battleSessionId}`)
  if (spectating) redirect(`/game/battle/spectate/${spectating.battleKey}`)
  if (!character) redirect('/game')
  return { actor, character }
}

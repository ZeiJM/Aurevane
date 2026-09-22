import { isAurevaneError } from '@aurevane/game-core/errors'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

import { BattleHallShell } from '@/components/battle/battle-hall-shell'
import { AuthenticatedGameRecovery } from '@/components/shell/authenticated-game-shell'
import { getOptionalPublicSupabaseConfig } from '@/lib/supabase/config'
import { getCurrentAccountServicesReadiness } from '@/server/account/account-services-readiness'
import {
  getActiveBattleForUser,
  getActiveSpectatingForUser,
} from '@/server/account/active-game-session'
import { getAuthenticatedActor } from '@/server/auth/actor'
import { loadCharacterIdentityRailContext } from '@/server/character/character-identity-rail-context'
import { loadSelectedCharacter } from '@/server/character/selected-character'

export const dynamic = 'force-dynamic'

export default async function BattleLaunchPage({
  searchParams,
}: {
  searchParams: Promise<{ join?: string | string[] }>
}) {
  const publicConfig = getOptionalPublicSupabaseConfig()
  const requestHost = (await headers()).get('host')
  const readiness = getCurrentAccountServicesReadiness(publicConfig, requestHost)
  if (!readiness.available) redirect('/')

  let actor
  try {
    actor = await getAuthenticatedActor()
  } catch (error) {
    if (isAurevaneError(error) && error.code === 'UNAUTHENTICATED') redirect('/')
    throw error
  }

  const [activeBattle, activeSpectating, character] = await Promise.all([
    getActiveBattleForUser(actor.userId),
    getActiveSpectatingForUser(actor.userId),
    loadSelectedCharacter(actor),
  ])
  if (activeBattle) redirect(`/game/battle/${activeBattle.battleSessionId}`)
  if (activeSpectating) redirect(`/game/battle/spectate/${activeSpectating.battleKey}`)
  if (!character) redirect('/game')

  let identity
  try {
    identity = await loadCharacterIdentityRailContext(actor, character)
  } catch (error) {
    if (isAurevaneError(error) && error.code === 'PERSISTENCE_UNAVAILABLE') {
      return <AuthenticatedGameRecovery />
    }
    throw error
  }

  const params = await searchParams
  const initialJoinKey = typeof params.join === 'string' ? params.join : null

  return (
    <BattleHallShell
      identity={identity}
      characterId={character.id}
      characterName={character.name}
      initialJoinKey={initialJoinKey}
    />
  )
}

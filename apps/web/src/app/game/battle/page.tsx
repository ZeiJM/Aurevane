import { isAurevaneError } from '@aurevane/game-core/errors'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

import { BattleLaunch } from '@/components/battle/battle-launch'
import { AuthenticatedShellFrame } from '@/components/shell/authenticated-game-shell'
import { getOptionalPublicSupabaseConfig } from '@/lib/supabase/config'
import { getCurrentAccountServicesReadiness } from '@/server/account/account-services-readiness'
import { getAuthenticatedActor } from '@/server/auth/actor'
import { loadSelectedCharacter } from '@/server/character/selected-character'

export const dynamic = 'force-dynamic'

export default async function BattleLaunchPage() {
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

  const character = await loadSelectedCharacter(actor)
  if (!character) redirect('/game')

  return (
    <AuthenticatedShellFrame
      sessionLabel="Tactical Hall"
      footerLabel={`${character.name} · Tactical Hall`}
      backHref="/game/character"
      backLabel="Back to Character Profile"
    >
      <BattleLaunch characterId={character.id} characterName={character.name} />
    </AuthenticatedShellFrame>
  )
}

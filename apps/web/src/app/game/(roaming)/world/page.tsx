import { isAurevaneError } from '@aurevane/game-core/errors'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { CharacterIdentityCard } from '@/components/character/character-identity-card'
import { AuthenticatedGameRecoveryContent } from '@/components/shell/authenticated-game-shell'
import { WorldWorkspace } from '@/components/world/world-workspace'
import styles from '@/components/world/world.module.css'
import { getOptionalPublicSupabaseConfig } from '@/lib/supabase/config'
import { getCurrentAccountServicesReadiness } from '@/server/account/account-services-readiness'
import {
  getActiveBattleForUser,
  getActiveSpectatingForUser,
} from '@/server/account/active-game-session'
import { getAuthenticatedActor } from '@/server/auth/actor'
import { loadSelectedCharacter } from '@/server/character/selected-character'
import { loadCharacterIdentityRailContext } from '@/server/character/character-identity-rail-context'
import { readWorld } from '@/server/world/world-repository'
import { getStarterPortraitImageAssetId } from '@/media/character'
import { getImageAsset } from '@/media/registry'
export const dynamic = 'force-dynamic'
export default async function WorldMapPage() {
  const readiness = getCurrentAccountServicesReadiness(
    getOptionalPublicSupabaseConfig(),
    (await headers()).get('host'),
  )
  if (!readiness.available) redirect('/')
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
  let loaded
  try {
    loaded = await Promise.all([
      loadCharacterIdentityRailContext(actor, character),
      readWorld(actor.userId, character.id),
    ])
  } catch (error) {
    if (isAurevaneError(error) && error.code === 'PERSISTENCE_UNAVAILABLE')
      return <AuthenticatedGameRecoveryContent />
    throw error
  }
  const [identity, world] = loaded
  const portrait =
    identity.imageUrl ?? getImageAsset(getStarterPortraitImageAssetId(character.portraitRef)).src
  if (!portrait) throw new Error('The registered character portrait is unavailable.')
  return (
    <div className={styles.layout}>
      <CharacterIdentityCard {...identity} />
      <WorldWorkspace
        key={character.id}
        initialView={world.view}
        character={{ name: character.name, portrait }}
      />
    </div>
  )
}

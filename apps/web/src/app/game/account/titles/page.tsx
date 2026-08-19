import { getFoundationDiscipline } from '@aurevane/game-core/character/foundation-disciplines'
import { isAurevaneError } from '@aurevane/game-core/errors'
import { Kicker, Surface } from '@aurevane/ui'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

import { CharacterTitleSettings } from '@/components/account/character-title-settings'
import {
  AuthenticatedGameRecovery,
  AuthenticatedShellFrame,
} from '@/components/shell/authenticated-game-shell'
import { getOptionalPublicSupabaseConfig } from '@/lib/supabase/config'
import { getCurrentAccountServicesReadiness } from '@/server/account/account-services-readiness'
import { getAuthenticatedActor } from '@/server/auth/actor'
import { loadCharacterTitleState } from '@/server/character/character-title-service'
import { loadSelectedCharacter } from '@/server/character/selected-character'

export const dynamic = 'force-dynamic'

export default async function CharacterTitlesPage() {
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

  let character
  let titleState
  try {
    character = await loadSelectedCharacter(actor)
    if (!character) redirect('/game')
    titleState = await loadCharacterTitleState(actor.userId, character.id)
  } catch (error) {
    if (isAurevaneError(error) && error.code === 'PERSISTENCE_UNAVAILABLE') {
      return <AuthenticatedGameRecovery />
    }
    throw error
  }

  const discipline = getFoundationDiscipline(character.foundationDisciplineId)

  return (
    <AuthenticatedShellFrame
      sessionLabel="Titles & Profile"
      backHref="/game/character"
      backLabel="Back to Character Profile"
    >
      <Surface tone="elevated" style={{ padding: 'clamp(0.8rem, 1.8vw, 1.25rem)' }}>
        <Kicker marker="◇">Account · Current Character</Kicker>
        <h1
          style={{
            margin: '0.3rem 0 0.65rem',
            font: '500 clamp(1.8rem, 3.5vw, 2.8rem)/1 var(--av-font-display)',
          }}
        >
          Titles &amp; Profile Display
        </h1>
        <CharacterTitleSettings
          characterId={character.id}
          characterName={character.name}
          disciplineName={discipline?.name ?? 'Adventurer'}
          personalTitle={titleState.personalTitle}
          personalTitleSetAt={titleState.personalTitleSetAt}
        />
      </Surface>
    </AuthenticatedShellFrame>
  )
}

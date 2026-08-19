import { isAurevaneError } from '@aurevane/game-core/errors'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

import { CharacterSelectShell } from '@/components/character/character-select-shell'
import { getOptionalPublicSupabaseConfig } from '@/lib/supabase/config'
import { getCurrentAccountServicesReadiness } from '@/server/account/account-services-readiness'
import { getAuthenticatedActor } from '@/server/auth/actor'
import { loadCharacterProfileImageMap } from '@/server/character/character-profile-display-service'
import { loadCharacterSlots } from '@/server/character/character-slot-service'
import { loadSelectedCharacter } from '@/server/character/selected-character'

export const dynamic = 'force-dynamic'

export default async function CharacterSelectPage() {
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

  const [characters, selectedCharacter] = await Promise.all([
    loadCharacterSlots(actor.userId),
    loadSelectedCharacter(actor),
  ])
  let profileImageUrls: Record<string, string> = {}
  try {
    profileImageUrls = Object.fromEntries(
      await loadCharacterProfileImageMap(
        actor.userId,
        characters.map((character) => character.id),
      ),
    )
  } catch {
    // Cosmetic profile images must not make character selection unavailable.
  }

  return (
    <CharacterSelectShell
      characters={characters}
      selectedCharacter={selectedCharacter}
      profileImageUrls={profileImageUrls}
    />
  )
}

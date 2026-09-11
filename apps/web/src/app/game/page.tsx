import { isAurevaneError } from '@aurevane/game-core/errors'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

import { CharacterSelectShell } from '@/components/character/character-select-shell'
import { getOptionalPublicSupabaseConfig } from '@/lib/supabase/config'
import { getCurrentAccountServicesReadiness } from '@/server/account/account-services-readiness'
import { getAccountDeletionState } from '@/server/account/account-deletion-service'
import {
  getActiveBattleForUser,
  getActiveSpectatingForUser,
} from '@/server/account/active-game-session'
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

  const charactersPromise = loadCharacterSlots(actor.userId)
  const profileImageUrlsPromise = charactersPromise
    .then(async (characters) => {
      return Object.fromEntries(
        await loadCharacterProfileImageMap(
          actor.userId,
          characters.map((character) => character.id),
        ),
      )
    })
    .catch(() => {
      // Cosmetic profile images must not make character selection unavailable.
      return {} as Record<string, string>
    })

  const [
    activeBattleResult,
    activeSpectatingResult,
    charactersResult,
    selectedCharacterResult,
    accountDeletionResult,
    profileImageUrls,
  ] = await Promise.allSettled([
    getActiveBattleForUser(actor.userId),
    getActiveSpectatingForUser(actor.userId),
    charactersPromise,
    loadSelectedCharacter(actor),
    getAccountDeletionState(actor.userId),
    profileImageUrlsPromise,
  ])
  if (activeBattleResult.status === 'rejected') throw activeBattleResult.reason
  const activeBattle = activeBattleResult.value
  if (activeBattle) redirect(`/game/battle/${activeBattle.battleSessionId}`)
  if (activeSpectatingResult.status === 'rejected') throw activeSpectatingResult.reason
  const activeSpectating = activeSpectatingResult.value
  if (activeSpectating) redirect(`/game/battle/spectate/${activeSpectating.battleKey}`)

  if (charactersResult.status === 'rejected') throw charactersResult.reason
  if (selectedCharacterResult.status === 'rejected') throw selectedCharacterResult.reason
  if (accountDeletionResult.status === 'rejected') throw accountDeletionResult.reason
  if (profileImageUrls.status === 'rejected') throw profileImageUrls.reason

  const characters = charactersResult.value
  const selectedCharacter = selectedCharacterResult.value
  const accountDeletion = accountDeletionResult.value

  return (
    <CharacterSelectShell
      characters={characters}
      selectedCharacter={selectedCharacter}
      profileImageUrls={profileImageUrls.value}
      accountDeletion={accountDeletion}
    />
  )
}

import { isAurevaneError } from '@aurevane/game-core/errors'
import { SettingsScene } from '@/components/settings/settings-scene'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

import { CombatControlsSettings } from '@/components/settings/combat-controls-settings'
import { getOptionalPublicSupabaseConfig } from '@/lib/supabase/config'
import { getCurrentAccountServicesReadiness } from '@/server/account/account-services-readiness'
import { getAuthenticatedActor } from '@/server/auth/actor'
import { loadSelectedCharacter } from '@/server/character/selected-character'
import { loadPlayerCombatControls } from '@/server/player-profile/player-controls-service'
import { createSupabasePlayerProfileRepository } from '@/server/player-profile/supabase-player-profile-repository'

export const dynamic = 'force-dynamic'

export default async function ControlsSettingsPage() {
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

  const [characterResult, combatKeybindsResult] = await Promise.allSettled([
    loadSelectedCharacter(actor),
    loadPlayerCombatControls(actor, createSupabasePlayerProfileRepository()),
  ])
  if (characterResult.status === 'rejected') throw characterResult.reason
  const character = characterResult.value
  if (!character) redirect('/game')
  if (combatKeybindsResult.status === 'rejected') throw combatKeybindsResult.reason
  const combatKeybinds = combatKeybindsResult.value

  return (
    <SettingsScene title="Controls & Keybinds" description="Customize your experience.">
      <CombatControlsSettings initialBindings={combatKeybinds} />
    </SettingsScene>
  )
}

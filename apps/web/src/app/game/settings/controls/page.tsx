import { isAurevaneError } from '@aurevane/game-core/errors'
import { Kicker, Surface } from '@aurevane/ui'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

import { CombatControlsSettings } from '@/components/settings/combat-controls-settings'
import { AuthenticatedShellFrame } from '@/components/shell/authenticated-game-shell'
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

  const character = await loadSelectedCharacter(actor)
  if (!character) redirect('/game')

  const combatKeybinds = await loadPlayerCombatControls(
    actor,
    createSupabasePlayerProfileRepository(),
  )

  return (
    <AuthenticatedShellFrame
      sessionLabel="Controls"
      footerLabel={`${character.name} · Controls`}
      backHref="/game/character"
      backLabel="Back to Character Profile"
    >
      <Surface tone="elevated">
        <Kicker marker="◇">Settings</Kicker>
        <h1>Controls &amp; Keybinds</h1>
        <CombatControlsSettings initialBindings={combatKeybinds} />
      </Surface>
    </AuthenticatedShellFrame>
  )
}

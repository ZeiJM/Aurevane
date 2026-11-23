import { SettingsScene } from '@/components/settings/settings-scene'
import { AudioWorkspace } from '@/components/audio/audio-workspace'
import { requireRoamingCharacter } from '@/server/character/require-roaming-character'
export const dynamic = 'force-dynamic'
export default async function AudioPage() {
  await requireRoamingCharacter()
  return (
    <SettingsScene title="Audio" description="Adjust the sounds of your journey.">
      <AudioWorkspace />
    </SettingsScene>
  )
}

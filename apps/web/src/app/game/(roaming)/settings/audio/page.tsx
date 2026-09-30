import { SettingsScene } from '@/components/settings/settings-scene'
import { AudioSettingsMenu } from '@/components/audio/audio-settings-menu'
import { requireRoamingCharacter } from '@/server/character/require-roaming-character'
export const dynamic = 'force-dynamic'
export default async function AudioPage() {
  await requireRoamingCharacter()
  return (
    <SettingsScene title="Audio" description="Adjust the sounds of your journey.">
      <AudioSettingsMenu inline />
    </SettingsScene>
  )
}

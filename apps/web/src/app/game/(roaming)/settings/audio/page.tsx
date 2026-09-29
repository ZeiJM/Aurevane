import { AudioSettingsMenu } from '@/components/audio/audio-settings-menu'
import { requireRoamingCharacter } from '@/server/character/require-roaming-character'
export const dynamic = 'force-dynamic'
export default async function AudioPage() {
  await requireRoamingCharacter()
  return (
    <section className="av-settings-page">
      <header className="av-page-heading">
        <div>
          <span className="av-eyebrow">Settings</span>
          <h1>Sound & atmosphere</h1>
        </div>
        <p>Make the world sound like yours.</p>
      </header>
      <div className="av-stone-panel">
        <AudioSettingsMenu inline />
      </div>
    </section>
  )
}

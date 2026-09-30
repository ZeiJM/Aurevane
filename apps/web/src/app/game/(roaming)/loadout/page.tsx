import Link from 'next/link'
import { requireRoamingCharacter } from '@/server/character/require-roaming-character'
export const dynamic = 'force-dynamic'
export default async function LoadoutPage() {
  await requireRoamingCharacter()
  return (
    <section className="av-loadout">
      <header className="av-page-heading">
        <div>
          <span className="av-eyebrow">Prepare for the road ahead</span>
          <h1>Loadout</h1>
        </div>
        <p>Power has many forms. Make yours deliberate.</p>
      </header>
      <div className="av-loadout-choices">
        <Link href="/game/nexus" className="av-loadout-card" data-loadout="nexus">
          <span className="av-loadout-glyph" aria-hidden="true">
            ✦
          </span>
          <div>
            <span className="av-eyebrow">Your power, refined</span>
            <h2>Nexus</h2>
            <p>Manage Disciplines, select Techniques, and review your Essence or Resonance.</p>
            <strong>Open Nexus →</strong>
          </div>
        </Link>
        <Link href="/game/loadout/items" className="av-loadout-card" data-loadout="items">
          <span className="av-loadout-glyph" aria-hidden="true">
            ◇
          </span>
          <div>
            <span className="av-soon">Coming Soon</span>
            <h2>Items</h2>
            <p>A home for your equipment and the treasures of your journey.</p>
            <strong>View Items →</strong>
          </div>
        </Link>
      </div>
    </section>
  )
}

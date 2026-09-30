import Link from 'next/link'
import { requireRoamingCharacter } from '@/server/character/require-roaming-character'
export const dynamic = 'force-dynamic'
export default async function ItemsPage() {
  await requireRoamingCharacter()
  return (
    <section className="av-future-page av-stone-panel">
      <Link href="/game/loadout">← Loadout</Link>
      <span className="av-loadout-glyph" aria-hidden="true">
        ◇
      </span>
      <span className="av-soon">Coming Soon</span>
      <h1>Items</h1>
      <p>Your equipment, keepsakes, and discoveries will find their place here.</p>
      <Link className="av-action" href="/game/nexus">
        Prepare your powers in Nexus →
      </Link>
    </section>
  )
}

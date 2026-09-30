import Link from 'next/link'
import styles from '../page.module.css'
import { requireRoamingCharacter } from '@/server/character/require-roaming-character'
export const dynamic = 'force-dynamic'
export default async function ItemsPage() {
  await requireRoamingCharacter()
  return (
    <section className={styles.items} data-composition="correction">
      <Link href="/game/loadout">← Loadout</Link>
      <div className={styles.equipment} aria-label="Future equipment slots">
        {['Weapon', 'Head', 'Body', 'Hands', 'Legs', 'Feet', 'Accessory 1', 'Accessory 2'].map(
          (slot) => (
            <div key={slot}>
              <span aria-hidden="true">◇</span>
              <strong>{slot}</strong>
            </div>
          ),
        )}
      </div>
      <span className="av-soon">Coming Soon</span>
      <h1>Items</h1>
      <p>Your equipment, keepsakes, and discoveries will find their place here.</p>
      <Link className="av-action" href="/game/nexus">
        Prepare your powers in Nexus →
      </Link>
    </section>
  )
}

import { LoadoutHeader } from '@/components/character/loadout-header'
import { requireRoamingCharacter } from '@/server/character/require-roaming-character'

import styles from '../page.module.css'

export const dynamic = 'force-dynamic'

export default async function ItemsPage() {
  await requireRoamingCharacter()
  return (
    <section className={styles.itemsWorkspace} data-composition="correction">
      <LoadoutHeader active="items" />
      <div className={styles.items}>
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
        <div className={styles.comingSoon}>
          <span className="av-soon">Coming Soon</span>
          <h2>Your next adventure, equipped.</h2>
          <p>Your equipment, keepsakes, and discoveries will find their place here.</p>
        </div>
      </div>
    </section>
  )
}

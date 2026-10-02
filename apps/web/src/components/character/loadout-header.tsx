import { LoadoutTabs } from './loadout-tabs'
import styles from './loadout-header.module.css'

/** Both loadout routes place their section selector in the same heading position. */
export function LoadoutHeader({ active }: { active: 'nexus' | 'items' }) {
  return (
    <header className={styles.heading} data-loadout-header="true">
      <h1 className={styles.accessibleTitle}>{active === 'nexus' ? 'Nexus' : 'Items'}</h1>
      <div className={styles.identity}>
        <LoadoutTabs active={active} />
        {active === 'items' ? <p>Equipment, keepsakes, and discoveries.</p> : null}
      </div>
      <small>A sharper mind. A steadier hand. A kinder world.</small>
    </header>
  )
}

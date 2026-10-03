import { LoadoutTabs } from './loadout-tabs'
import styles from './loadout-header.module.css'

/** Both loadout routes share the Battle Hall heading hierarchy and a compact section rail. */
export function LoadoutHeader({ active }: { active: 'nexus' | 'items' }) {
  return (
    <header className={styles.heading} data-loadout-header="true">
      <div className={styles.headingCopy}>
        <span className={styles.pageIcon} aria-hidden="true">
          {active === 'nexus' ? '✦' : '◇'}
        </span>
        <div>
          <p className={styles.eyebrow}>A sharper mind. A steadier hand. A kinder world.</p>
          <h1>{active === 'nexus' ? 'Nexus' : 'Items'}</h1>
          <small>
            {active === 'nexus'
              ? 'Primary Discipline, Skills, and Attunement.'
              : 'Equipment, keepsakes, and discoveries.'}
          </small>
        </div>
      </div>
      <LoadoutTabs active={active} />
    </header>
  )
}

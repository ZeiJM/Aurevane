import { LoadoutTabs } from './loadout-tabs'
import styles from './loadout-header.module.css'

export function LoadoutHeader({ active }: { active: 'nexus' | 'items' }) {
  return (
    <header className={styles.heading} data-loadout-header="true">
      <LoadoutTabs active={active} />
    </header>
  )
}

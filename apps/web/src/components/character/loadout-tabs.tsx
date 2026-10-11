import Link from 'next/link'

import styles from './loadout-tabs.module.css'

export function LoadoutTabs({ active }: { active: 'nexus' | 'items' }) {
  return (
    <nav className={styles.tabs} aria-label="Loadout sections" data-loadout-tabs="true">
      <Link
        href="/game/nexus"
        data-loadout-section="nexus"
        aria-current={active === 'nexus' ? 'page' : undefined}
      >
        <span aria-hidden="true">✦</span>
        <strong>Nexus</strong>
      </Link>
      <Link
        href="/game/loadout/items"
        data-loadout-section="items"
        aria-current={active === 'items' ? 'page' : undefined}
      >
        <span aria-hidden="true">◇</span>
        <strong>Items</strong>
      </Link>
    </nav>
  )
}

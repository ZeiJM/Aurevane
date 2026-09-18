import Link from 'next/link'

import { requireMasterPanelPageAccess } from '@/server/master/master-panel-page-access'

import styles from './master.module.css'

export const dynamic = 'force-dynamic'

export default async function MasterPanelPage() {
  const { role } = await requireMasterPanelPageAccess()

  return (
    <main className={styles.page}>
      <div className={styles.frame}>
        <header className={styles.masthead}>
          <div className={styles.brand}>
            <strong>AUREVANE</strong>
            <span>Master Panel</span>
          </div>
          <span className={styles.operator}>{role}</span>
        </header>

        <section className={styles.overview}>
          <h1>Operational control</h1>
          <p>
            Protected tooling grows only where an authoritative game system already exists. Combat
            Content is the first active authoring module.
          </p>
          <nav className={styles.moduleGrid} aria-label="Master Panel modules">
            <Link className={styles.module} href="/master/combat-content">
              <strong>Combat Content</strong>
              <span>
                Author typed, versioned Skill targeting, costs, effects, validation, preview,
                publication, and rollback.
              </span>
            </Link>
          </nav>
        </section>
      </div>
    </main>
  )
}

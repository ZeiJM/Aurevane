import Link from 'next/link'

import { requireMasterPanelPageAccess } from '@/server/master/master-panel-page-access'
import { hasMasterPanelCapability, masterPanelRoleLabel } from '@/server/master/staff-access'

import styles from './master.module.css'

export const dynamic = 'force-dynamic'

export default async function MasterPanelPage() {
  const { access } = await requireMasterPanelPageAccess()
  const canAuthorCombat = hasMasterPanelCapability(access, 'content.combat.author')
  const roleSummary = access.roles.map(masterPanelRoleLabel).join(' · ')

  return (
    <main className={styles.page}>
      <div className={styles.frame}>
        <header className={styles.masthead}>
          <div className={styles.brand}>
            <strong>AUREVANE</strong>
            <span>Master Panel</span>
          </div>
          <span className={styles.operator}>{roleSummary}</span>
        </header>

        <section className={styles.overview}>
          <h1>Operational control</h1>
          <p>
            Protected tooling grows only where an authoritative game system already exists. Active
            modules are shown according to the account&apos;s current server-side staff authority.
          </p>
          <nav className={styles.moduleGrid} aria-label="Master Panel modules">
            {canAuthorCombat ? (
              <Link className={styles.module} href="/master/combat-content">
                <strong>Combat Content</strong>
                <span>
                  Author typed, versioned Skill targeting, costs, effects, validation, preview,
                  publication, and rollback.
                </span>
              </Link>
            ) : (
              <div className={styles.module}>
                <strong>Staff access active</strong>
                <span>
                  No operational module is enabled for this role in the current phase yet.
                </span>
              </div>
            )}
          </nav>
        </section>
      </div>
    </main>
  )
}

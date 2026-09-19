import Link from 'next/link'

import { requireMasterPanelPageAccess } from '@/server/master/master-panel-page-access'
import { hasMasterPanelCapability, masterPanelAuthorityLabel } from '@/server/master/staff-access'

import styles from './master.module.css'

export const dynamic = 'force-dynamic'

export default async function MasterPanelPage() {
  const { access } = await requireMasterPanelPageAccess()
  const canManageStaff = hasMasterPanelCapability(access, 'staff.manage')
  const canAuthorCombat = hasMasterPanelCapability(access, 'content.combat.author')
  const canAuthorEvents = hasMasterPanelCapability(access, 'events.author')
  const owner = access.roles.includes('game-owner')
  const hasOperationalModule = canManageStaff || canAuthorCombat || canAuthorEvents

  return (
    <main className={styles.page}>
      <div className={styles.frame}>
        <header className={styles.masthead}>
          <div className={styles.brand}>
            <strong>AUREVANE</strong>
            <span>Master Panel</span>
          </div>
          <span
            className={[styles.operator, owner ? styles.worldwright : ''].filter(Boolean).join(' ')}
          >
            {owner ? (
              <span className={styles.operatorIcon} aria-hidden="true">
                ✦
              </span>
            ) : null}
            {masterPanelAuthorityLabel(access.roles)}
          </span>
        </header>

        <section className={styles.overview}>
          <h1>Operational control</h1>
          <p>
            Protected tooling grows only where an authoritative game system already exists. Active
            modules are shown according to the account&apos;s current server-side staff authority.
          </p>
          <nav className={styles.moduleGrid} aria-label="Master Panel modules">
            {canManageStaff ? (
              <Link className={styles.module} href="/master/staff">
                <strong>Staff &amp; Authority</strong>
                <span>
                  Grant or revoke the four fixed staff roles and explicit special capabilities with
                  server-side audit and access-version invalidation.
                </span>
              </Link>
            ) : null}
            {canAuthorCombat ? (
              <Link className={styles.module} href="/master/combat-content">
                <strong>Combat Content</strong>
                <span>
                  Author typed, versioned Skill targeting, costs, effects, validation, preview,
                  publication, and rollback.
                </span>
              </Link>
            ) : null}
            {canAuthorEvents ? (
              <Link className={styles.module} href="/master/events">
                <strong>Event Builder</strong>
                <span>
                  Draft, validate, preview, publish and schedule typed persistent Events without
                  arbitrary scripts or SQL.
                </span>
              </Link>
            ) : null}
            {!hasOperationalModule ? (
              <div className={styles.module}>
                <strong>Staff access active</strong>
                <span>
                  No operational module is enabled for this role in the current phase yet.
                </span>
              </div>
            ) : null}
          </nav>
        </section>
      </div>
    </main>
  )
}

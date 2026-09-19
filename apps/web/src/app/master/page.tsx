import Link from 'next/link'

import { MasterPanelShell } from '@/components/master/master-panel-shell'
import { requireMasterPanelPageAccess } from '@/server/master/master-panel-page-access'
import { hasMasterPanelCapability, masterPanelAuthorityLabel } from '@/server/master/staff-access'

import styles from './master.module.css'

export const dynamic = 'force-dynamic'

export default async function MasterPanelPage() {
  const { access } = await requireMasterPanelPageAccess()
  const canManageStaff = hasMasterPanelCapability(access, 'staff.manage')
  const canAuthorCombat = hasMasterPanelCapability(access, 'content.combat.author')
  const canAuthorEvents = hasMasterPanelCapability(access, 'events.author')
  const canOperateEvents = hasMasterPanelCapability(access, 'events.operate')
  const hasOperationalModule =
    canManageStaff || canAuthorCombat || canAuthorEvents || canOperateEvents

  return (
    <MasterPanelShell
      access={access}
      activeSection="overview"
      title="Master Panel"
      description="Build, guide, run, and protect AUREVANE through the same server-authoritative systems used by the live game."
    >
      <div className={styles.overviewGrid}>
        <section className={styles.moduleStage}>
          <header className={styles.sectionIntro}>
            <div>
              <span>Operational modules</span>
              <h2>Choose what you need to manage.</h2>
            </div>
            <p>
              Every module uses the account&apos;s current staff authority. Hidden modules are not
              available to the current role.
            </p>
          </header>

          <nav className={styles.moduleGrid} aria-label="Master Panel modules">
            {canAuthorCombat ? (
              <Link className={styles.module} href="/master/combat-content">
                <span className={styles.moduleIcon} aria-hidden="true">
                  ⚔
                </span>
                <span className={styles.moduleCopy}>
                  <strong>Combat Content</strong>
                  <span>
                    Author typed, versioned Skills through validation, deterministic preview,
                    publication, rollback, and runtime pinning.
                  </span>
                  <small>Skills · validation · publication</small>
                </span>
                <span className={styles.moduleArrow} aria-hidden="true">
                  →
                </span>
              </Link>
            ) : null}

            {canManageStaff ? (
              <Link className={styles.module} href="/master/staff">
                <span className={styles.moduleIcon} aria-hidden="true">
                  ♜
                </span>
                <span className={styles.moduleCopy}>
                  <strong>Staff &amp; Authority</strong>
                  <span>
                    Manage the four fixed staff roles and explicit capabilities with protected
                    server-side audit.
                  </span>
                  <small>Roles · capabilities · audit</small>
                </span>
                <span className={styles.moduleArrow} aria-hidden="true">
                  →
                </span>
              </Link>
            ) : null}

            {canAuthorEvents ? (
              <Link className={styles.module} href="/master/events">
                <span className={styles.moduleIcon} aria-hidden="true">
                  ✧
                </span>
                <span className={styles.moduleCopy}>
                  <strong>Event Builder</strong>
                  <span>
                    Draft, validate, preview, publish, schedule, and unschedule typed persistent
                    Events.
                  </span>
                  <small>Draft · preview · schedule</small>
                </span>
                <span className={styles.moduleArrow} aria-hidden="true">
                  →
                </span>
              </Link>
            ) : null}

            {canOperateEvents ? (
              <Link className={styles.module} href="/master/events/live">
                <span className={styles.moduleIcon} aria-hidden="true">
                  ✦
                </span>
                <span className={styles.moduleCopy}>
                  <strong>Live Event Operations</strong>
                  <span>
                    Operate Event Runs, phases, cleanup, recovery, rewards, and Chronicle closure
                    from authoritative state.
                  </span>
                  <small>Runs · recovery · chronicle</small>
                </span>
                <span className={styles.moduleArrow} aria-hidden="true">
                  →
                </span>
              </Link>
            ) : null}

            {!hasOperationalModule ? (
              <div className={styles.module}>
                <span className={styles.moduleIcon} aria-hidden="true">
                  ◇
                </span>
                <span className={styles.moduleCopy}>
                  <strong>Staff access active</strong>
                  <span>No operational module is enabled for this role in the current phase.</span>
                </span>
              </div>
            ) : null}
          </nav>
        </section>

        <aside className={styles.sideStack} aria-label="Operational posture">
          <section className={styles.statusCard}>
            <span className={styles.cardKicker}>Current authority</span>
            <strong>{masterPanelAuthorityLabel(access.roles)}</strong>
            <p>
              Capabilities are derived on the server from the account&apos;s active staff roles.
            </p>
          </section>

          <section className={styles.statusCard}>
            <span className={styles.cardKicker}>Release safety</span>
            <ul className={styles.safetyList}>
              <li>
                <span aria-hidden="true">✓</span> Server-authoritative writes
              </li>
              <li>
                <span aria-hidden="true">✓</span> Explicit sensitive-action confirmation
              </li>
              <li>
                <span aria-hidden="true">✓</span> Immutable/versioned content history
              </li>
              <li>
                <span aria-hidden="true">✓</span> Durable staff and Event audit
              </li>
            </ul>
          </section>

          <section className={styles.statusCard}>
            <span className={styles.cardKicker}>Phase 4 operations</span>
            <strong>Production tooling</strong>
            <p>
              Combat Content, staff authority, Event Builder, and Live Event Operations share this
              protected shell.
            </p>
          </section>
        </aside>
      </div>
    </MasterPanelShell>
  )
}

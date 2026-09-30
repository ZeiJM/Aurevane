import Link from 'next/link'
import { AurevaneImage } from '@/components/media/aurevane-image'
import styles from '@/components/master/master-panel-shell.module.css'
import { MasterPanelShell, masterNavigation } from '@/components/master/master-panel-shell'
import { requireMasterPanelPageAccess } from '@/server/master/master-panel-page-access'
import { hasMasterPanelCapability } from '@/server/master/staff-access'
export const dynamic = 'force-dynamic'
export default async function MasterPanelPage() {
  const { access } = await requireMasterPanelPageAccess()
  return (
    <MasterPanelShell
      access={access}
      activeSection="overview"
      title="The worldwright’s desk"
      description="Build, review, and care for the world."
    >
      <div className="av-master-overview">
        {masterNavigation
          .filter((item) => !item.capability || hasMasterPanelCapability(access, item.capability))
          .map((item) => (
            <Link className="av-stone-panel" href={item.href} key={item.id}>
              <AurevaneImage
                assetId={
                  item.id === 'combat'
                    ? 'environment.battle-hall.courtyard'
                    : item.id === 'events' || item.id === 'live-events'
                      ? 'ui.foundation.vista'
                      : 'environment.archive.interior'
                }
                className={styles.overviewArt}
                sizes="(max-width: 760px) 100vw, 17vw"
              />
              <span className="av-eyebrow">{item.detail}</span>
              <h2>{item.label}</h2>
              <p>
                {item.id === 'combat'
                  ? 'Find a definition, refine its behavior, then review and publish.'
                  : item.id === 'events'
                    ? 'Compose phases and objectives. Preview before scheduling.'
                    : item.id === 'live-events'
                      ? 'Inspect live runs, participants, and operational recovery.'
                      : item.id === 'music'
                        ? 'Upload, audition, and assign music across Aurevane.'
                        : 'Manage roles and capabilities with an explicit review.'}
              </p>
              <strong>Open workspace →</strong>
            </Link>
          ))}
      </div>
    </MasterPanelShell>
  )
}

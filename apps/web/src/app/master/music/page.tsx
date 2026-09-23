import { MasterPanelShell } from '@/components/master/master-panel-shell'
import { SiteMusicManagement } from '@/components/master/music/site-music-management'
import { requireMasterPanelPageAccess } from '@/server/master/master-panel-page-access'
import { readSiteMusicConfig } from '@/server/music/site-music-store'

export const dynamic = 'force-dynamic'

export default async function MasterMusicPage() {
  const { access } = await requireMasterPanelPageAccess('staff.manage')
  const config = await readSiteMusicConfig({ strict: true })

  return (
    <MasterPanelShell
      access={access}
      activeSection="music"
      title="Site Music"
      description="Direct AUREVANE’s persistent soundtrack and page-specific musical identity."
    >
      <SiteMusicManagement initialConfig={config} />
    </MasterPanelShell>
  )
}

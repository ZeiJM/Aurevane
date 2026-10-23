import { BattlefieldElevationEditor } from '@/components/master/combat-content/battlefield-elevation-editor'
import { readBattlefieldElevationPolicy } from '@/server/master/battlefield-elevation-policy-store'
import { redirect } from 'next/navigation'
import { CombatEffectTimingEditor } from '@/components/master/combat-content/combat-effect-timing-editor'
import { MasterPanelShell } from '@/components/master/master-panel-shell'
import { requireMasterPanelPageAccess } from '@/server/master/master-panel-page-access'
import { readCombatTimingWorkspace } from '@/server/master/combat-effect-timing-policy-store'
export const dynamic = 'force-dynamic'
export default async function MasterCombatTimingPage() {
  const { access } = await requireMasterPanelPageAccess('staff.manage')
  if (!access.roles.includes('game-owner')) redirect('/master')
  const [timing, elevationPolicy] = await Promise.all([
    readCombatTimingWorkspace(),
    readBattlefieldElevationPolicy(),
  ])
  return (
    <MasterPanelShell
      access={access}
      activeSection="combat-timing"
      title="Combat Rules"
      description="Owner-controlled effect activation and elevation chances for new battles"
    >
      <CombatEffectTimingEditor
        initialPolicy={timing.policy}
        usedBy={timing.usedBy}
        tagPresentations={timing.tagPresentations}
      />
      <BattlefieldElevationEditor initialPolicy={elevationPolicy} />
    </MasterPanelShell>
  )
}

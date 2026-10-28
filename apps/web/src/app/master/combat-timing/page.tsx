import { hasMasterPanelCapability } from '@/lib/master-panel-access'
import { BattlefieldElevationEditor } from '@/components/master/combat-content/battlefield-elevation-editor'
import { readBattlefieldElevationPolicy } from '@/server/master/battlefield-elevation-policy-store'
import { CombatEffectTimingEditor } from '@/components/master/combat-content/combat-effect-timing-editor'
import { MasterPanelShell } from '@/components/master/master-panel-shell'
import { requireMasterPanelPageAccess } from '@/server/master/master-panel-page-access'
import { readCombatTimingWorkspace } from '@/server/master/combat-effect-timing-policy-store'
export const dynamic = 'force-dynamic'
export default async function MasterCombatTimingPage() {
  const { actor, access } = await requireMasterPanelPageAccess('combat.rules')
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
        key={actor.userId}
        recoveryScope={actor.userId}
        canEditWording={hasMasterPanelCapability(access, 'content.combat.author')}
        effectUsedBy={timing.effectUsedBy}
        initialPolicy={timing.policy}
        usedBy={timing.usedBy}
        tagPresentations={timing.tagPresentations}
      />
      <BattlefieldElevationEditor initialPolicy={elevationPolicy} />
    </MasterPanelShell>
  )
}

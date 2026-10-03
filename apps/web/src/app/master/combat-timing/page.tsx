import { redirect } from 'next/navigation'
import { CombatEffectTimingEditor } from '@/components/master/combat-content/combat-effect-timing-editor'
import { MasterPanelShell } from '@/components/master/master-panel-shell'
import { requireMasterPanelPageAccess } from '@/server/master/master-panel-page-access'
import { readCombatEffectTimingPolicy } from '@/server/master/combat-effect-timing-policy-store'
export const dynamic = 'force-dynamic'
export default async function MasterCombatTimingPage() {
  const { access } = await requireMasterPanelPageAccess('staff.manage')
  if (!access.roles.includes('game-owner')) redirect('/master')
  const policy = await readCombatEffectTimingPolicy()
  return (
    <MasterPanelShell
      access={access}
      activeSection="combat-timing"
      title="Combat Timing"
      description="Owner-controlled effect activation for new battles"
    >
      <CombatEffectTimingEditor initialPolicy={policy} />
    </MasterPanelShell>
  )
}

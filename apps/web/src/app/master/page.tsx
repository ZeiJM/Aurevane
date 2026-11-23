import { redirect } from 'next/navigation'
import { masterNavigationForAccess } from '@/components/master/master-panel-shell'
import { requireMasterPanelPageAccess } from '@/server/master/master-panel-page-access'
export const dynamic = 'force-dynamic'
export default async function MasterPanelPage() {
  const { access } = await requireMasterPanelPageAccess()
  const destination = masterNavigationForAccess(access)[0]
  if (destination) redirect(destination.href)
  return <p role="status">No Master workspace is assigned to this character.</p>
}

import 'server-only'
import { AurevaneError } from '@aurevane/game-core/errors'
import {
  isCompleteMasterPanelOrder,
  type MasterPanelNavigationSettings,
} from '@/lib/master-panel-pages'
import type { MasterPanelStaffAccessService } from './staff-access'

export function createMasterNavigationService(
  access: MasterPanelStaffAccessService,
  rpc: (name: string, args: Readonly<Record<string, unknown>>) => Promise<unknown>,
) {
  function parse(value: unknown): MasterPanelNavigationSettings {
    const data = value as Partial<MasterPanelNavigationSettings> | null
    if (
      !data ||
      !Number.isSafeInteger(data.revision) ||
      data.revision! < 1 ||
      !isCompleteMasterPanelOrder(data.order)
    )
      throw new AurevaneError(
        'PERSISTENCE_UNAVAILABLE',
        'Tab order is unavailable. Try refreshing.',
      )
    return { revision: data.revision!, order: data.order }
  }
  return {
    async read(actorUserId: string) {
      await access.requireCapability(actorUserId, 'master.access')
      return parse(await rpc('read_master_panel_navigation_v1', { p_actor_user_id: actorUserId }))
    },
    async save(actorUserId: string, input: { expectedRevision: unknown; order: unknown }) {
      await access.requireCapability(actorUserId, 'staff.manage')
      if (
        !Number.isSafeInteger(input.expectedRevision) ||
        (input.expectedRevision as number) < 1 ||
        !isCompleteMasterPanelOrder(input.order)
      )
        throw new AurevaneError('INVALID_REQUEST', 'Choose each Master Panel tab once.')
      return parse(
        await rpc('save_master_panel_navigation_v1', {
          p_actor_user_id: actorUserId,
          p_expected_revision: input.expectedRevision,
          p_order: input.order,
        }),
      )
    },
  }
}
export type MasterNavigationService = ReturnType<typeof createMasterNavigationService>

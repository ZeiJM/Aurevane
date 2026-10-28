import { expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
import { MASTER_PANEL_NAVIGATION } from '@/lib/master-panel-pages'
import { createMasterNavigationService } from './master-navigation-service'
const order = MASTER_PANEL_NAVIGATION.map((p) => p.id)
it('validates complete tab order, forbids delegated writes, and binds authenticated identity', async () => {
  let allowed = true
  const requireCapability = vi.fn(async () => {
    if (!allowed) throw Object.assign(new Error('Forbidden'), { code: 'FORBIDDEN' })
  })
  const calls: unknown[] = []
  const service = createMasterNavigationService(
    { requireCapability } as never,
    async (name, args) => {
      calls.push([name, args])
      return { revision: 2, order }
    },
  )
  expect(await service.save('verified', { expectedRevision: 1, order })).toEqual({
    revision: 2,
    order,
  })
  expect(calls).toEqual([
    [
      'save_master_panel_navigation_v1',
      { p_actor_user_id: 'verified', p_expected_revision: 1, p_order: order },
    ],
  ])
  for (const invalid of [
    [],
    [...order, 'staff'],
    [...order.slice(1), 'unknown'],
    [...order.slice(1), order[1]],
  ]) {
    await expect(
      service.save('verified', { expectedRevision: 1, order: invalid }),
    ).rejects.toMatchObject({ code: 'INVALID_REQUEST' })
  }
  allowed = false
  await expect(service.save('staff', { expectedRevision: 1, order })).rejects.toMatchObject({
    code: 'FORBIDDEN',
  })
  expect(calls).toHaveLength(1)
})
it('rejects malformed persistence and reads the same setting for any authorized Master reader', async () => {
  const service = createMasterNavigationService(
    { requireCapability: async () => ({}) } as never,
    async () => ({ revision: 3, order: order.toReversed() }),
  )
  expect((await service.read('staff')).order).toEqual(order.toReversed())
  const corrupt = createMasterNavigationService(
    { requireCapability: async () => ({}) } as never,
    async () => ({ revision: 3, order: ['staff'] }),
  )
  await expect(corrupt.read('owner')).rejects.toMatchObject({ code: 'PERSISTENCE_UNAVAILABLE' })
})

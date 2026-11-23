import { expect, it, vi } from 'vitest'
import { AurevaneError } from '@aurevane/game-core/errors'
const state = vi.hoisted(() => ({ read: vi.fn() }))
vi.mock('@/server/account/account-ban-status', () => ({ readSelfAccountBanStatus: state.read }))
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new Error(`redirect:${url}`)
  },
}))
import Page from './page'
it('uses the authenticated self status without redirecting an active ban back through gameplay', async () => {
  const status = {
    active: true,
    permanent: true,
    expiresAt: null,
    reason: 'Reviewed',
    serverTime: '2026-10-28T12:00:00Z',
  }
  state.read.mockResolvedValueOnce(status)
  expect((await Page()).props.initialStatus).toEqual(status)
  state.read.mockResolvedValueOnce({ ...status, active: false, permanent: false, reason: null })
  await expect(Page()).rejects.toThrow('redirect:/game')
  state.read.mockRejectedValueOnce(new AurevaneError('UNAUTHENTICATED', 'Sign in'))
  await expect(Page()).rejects.toThrow('redirect:/')
  state.read.mockRejectedValueOnce(new Error('private failure'))
  expect((await Page()).props.initialError).not.toContain('private failure')
})

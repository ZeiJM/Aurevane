import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
const dependencies = vi.hoisted(() => ({ access: vi.fn(), read: vi.fn() }))
vi.mock('server-only', () => ({}))
vi.mock('@/server/master/master-panel-page-access', () => ({
  requireMasterPanelPageAccess: dependencies.access,
}))
vi.mock('@/server/master/activity-log-server', () => ({
  createServerMasterActivityService: () => ({ read: dependencies.read }),
}))
vi.mock('next/navigation', () => ({
  redirect: (path: string) => {
    throw new Error(`redirect:${path}`)
  },
}))
vi.mock('@/components/master/master-panel-shell', () => ({
  MasterPanelShell: ({ children }: { children: import('react').ReactNode }) =>
    createElement('div', {}, children),
}))
import MasterActivityPage from './page'

it('loads the Owner page through existing access authority and refuses delegated access before the feed read', async () => {
  const feed = {
    entries: [],
    weekStartsAt: '2026-10-26T00:00:00Z',
    resetsAt: '2026-11-02T00:00:00Z',
    nextCursor: null,
  }
  dependencies.access.mockResolvedValue({
    actor: { userId: 'owner' },
    access: { roles: ['game-owner'] },
  })
  dependencies.read.mockResolvedValue(feed)
  expect(renderToStaticMarkup(await MasterActivityPage())).toContain(
    'No changes recorded this week.',
  )
  expect(dependencies.access).toHaveBeenCalledWith('staff.manage')
  expect(dependencies.read).toHaveBeenCalledWith('owner')
  dependencies.read.mockClear()
  dependencies.access.mockResolvedValue({
    actor: { userId: 'staff' },
    access: { roles: ['moderator'] },
  })
  await expect(MasterActivityPage()).rejects.toThrow('redirect:/master')
  expect(dependencies.read).not.toHaveBeenCalled()
})

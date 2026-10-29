import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { MasterPanelAccess } from '@/server/master/staff-access'
vi.mock('@/components/shell/authenticated-game-shell', () => ({
  AuthenticatedShellFrame: ({ children }: { children: React.ReactNode }) =>
    createElement('main', null, children),
}))
vi.mock('@/components/media/aurevane-image', () => ({
  AurevaneImage: ({ assetId }: { assetId: string }) =>
    createElement('img', { 'data-art': assetId, alt: '' }),
}))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
import { MasterPanelShell } from './master-panel-shell'
const access: MasterPanelAccess = {
  userId: 'staff-1',
  accessVersion: 1,
  roles: ['content-staff'],
  specialCapabilities: [],
  effectiveCapabilities: ['master.access', 'content.combat.author'],
}
describe('Master workspace composition', () => {
  it('exposes delegated pages only when the current access snapshot grants their tools', () => {
    const render = (roles: MasterPanelAccess['roles']) =>
      renderToStaticMarkup(
        <MasterPanelShell
          access={{
            ...access,
            roles,
            effectiveCapabilities: roles.includes('game-owner')
              ? ['master.access', 'staff.manage', 'combat.rules', 'world.manage']
              : ['master.access'],
          }}
          activeSection="combat"
          title="Combat"
          description="Review"
        >
          <p>Content</p>
        </MasterPanelShell>,
      )
    expect(render(['game-owner'])).toContain('href="/master/combat-timing"')
    expect(render(['content-staff'])).not.toContain('href="/master/combat-timing"')
    expect(render(['game-owner'])).toContain('href="/master/world-environment"')
    expect(render(['content-staff'])).not.toContain('href="/master/world-environment"')
  })
  it('does not grant navigation from an Owner label without supplied capabilities', () => {
    const markup = renderToStaticMarkup(
      <MasterPanelShell
        access={{ ...access, roles: ['game-owner'], effectiveCapabilities: [] }}
        activeSection="combat"
        title="Master"
        description="Review"
      >
        <p>Content</p>
      </MasterPanelShell>,
    )
    for (const href of [
      '/master/combat-content',
      '/master/combat-timing',
      '/master/world-environment',
      '/master/staff',
      '/master/music',
    ])
      expect(markup).not.toContain(`href="${href}"`)
  })
  it('keeps authorized workspaces reachable and guards staff and event navigation', () => {
    const markup = renderToStaticMarkup(
      <MasterPanelShell
        access={access}
        activeSection="combat"
        title="Combat Library"
        description="Review authored content."
      >
        <button>Publish reviewed version</button>
      </MasterPanelShell>,
    )
    expect(markup).toContain('data-master-composition="combat"')
    expect(markup).not.toContain('data-art=')
    expect(markup).not.toContain('Overview')
    expect(markup).toContain('Game Content')
    expect(markup).toMatch(/<a[^>]*aria-current="page"[^>]*href="\/master\/combat-content"/)
    expect(markup).toContain('Publish reviewed version')
    for (const href of ['/master/staff', '/master/events', '/master/music'])
      expect(markup).not.toContain(`href="${href}"`)
  })
})

it('uses the saved order after permission filtering and only offers ordering with Owner authority', () => {
  const render = (owner: boolean) =>
    renderToStaticMarkup(
      <MasterPanelShell
        access={{
          ...access,
          roles: owner ? ['game-owner'] : ['content-staff'],
          effectiveCapabilities: [
            'master.access',
            'content.combat.author',
            'activity.read',
            ...(owner ? ['staff.manage' as const] : []),
          ],
          navigation: {
            revision: 2,
            order: [
              'activity',
              'combat',
              'staff',
              'combat-timing',
              'events',
              'moderation',
              'players',
              'music',
              'world-environment',
            ],
          },
        }}
        activeSection="combat"
        title="Master"
        description="Review"
      >
        <p>Content</p>
      </MasterPanelShell>,
    )
  expect(render(true).indexOf('href="/master/activity"')).toBeLessThan(
    render(true).indexOf('href="/master/combat-content"'),
  )
  expect(render(true)).toContain('aria-label="Arrange Master Panel tabs"')
  expect(render(false)).not.toContain('aria-label="Arrange Master Panel tabs"')
  expect(render(false)).not.toContain('href="/master/staff"')
})

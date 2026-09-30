import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { MasterPanelAccess } from '@/server/master/staff-access'
vi.mock('server-only', () => ({}))
vi.mock('@/components/shell/authenticated-game-shell', () => ({
  AuthenticatedShellFrame: ({ children }: { children: React.ReactNode }) =>
    createElement('main', null, children),
}))
vi.mock('@/components/media/aurevane-image', () => ({
  AurevaneImage: ({ assetId }: { assetId: string }) =>
    createElement('img', { 'data-art': assetId, alt: '' }),
}))
import { MasterPanelShell } from './master-panel-shell'
const access: MasterPanelAccess = {
  userId: 'staff-1',
  accessVersion: 1,
  roles: ['content-staff'],
  specialCapabilities: [],
  effectiveCapabilities: ['master.access', 'content.combat.author'],
}
describe('Master workspace composition', () => {
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
    expect(markup).toContain('data-art="environment.archive.interior"')
    expect(markup).toMatch(/<a[^>]*aria-current="page"[^>]*href="\/master\/combat-content"/)
    expect(markup).toContain('Publish reviewed version')
    for (const href of ['/master/staff', '/master/events', '/master/music'])
      expect(markup).not.toContain(`href="${href}"`)
  })
})

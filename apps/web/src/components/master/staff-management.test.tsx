import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
import { StaffManagement } from './staff-management'

it('shows a compact character directory with live status/UTC expiry and focused assignment entry', () => {
  const html = renderToStaticMarkup(
    <StaffManagement
      roleOptions={[
        { id: 'content-staff', label: 'Content Staff', description: 'Content administration' },
      ]}
      capabilityOptions={[]}
      staff={[
        {
          userId: 'user',
          characterId: 'first',
          characterName: 'First',
          email: 'staff@example.test',
          roles: ['content-staff'],
          specialCapabilities: [],
          accessVersion: 2,
          status: 'expired',
          expiresAt: '2026-10-20T12:00:00.000Z',
        },
        {
          userId: 'legacy',
          characterId: null,
          characterName: null,
          email: 'legacy@example.test',
          roles: ['event-staff'],
          specialCapabilities: [],
          accessVersion: 1,
          status: 'needs-binding',
          expiresAt: null,
        },
      ]}
    />,
  )
  expect(html).toContain('First')
  expect(html).toContain('Expired')
  expect(html).toContain('2026-10-20 12:00 UTC')
  expect(html).toContain('Needs binding')
  expect(html).toContain('Character name or verified email')
  expect(html).toContain('Edit First')
  expect(html).toContain('Revoke First')
  expect(html).not.toContain('<textarea')
  expect(html).not.toContain('Notes</')
  expect(html).not.toContain('History</')
})

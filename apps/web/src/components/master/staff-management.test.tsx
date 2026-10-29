import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: () => undefined }) }))
import { StaffManagement } from './staff-management'
it('keeps empty, protected Owner and unbound legacy directory states concise and reason-free', () => {
  const props = {
    roleOptions: [
      { id: 'content-staff', label: 'Content Staff', description: 'Content authoring' },
    ],
    capabilityOptions: [],
  }
  const empty = renderToStaticMarkup(createElement(StaffManagement, { ...props, staff: [] }))
  expect(empty).toContain('No staff assignments yet')
  expect(empty).toContain('Character name or verified email')
  const directory = renderToStaticMarkup(
    createElement(StaffManagement, {
      ...props,
      staff: [
        {
          userId: 'owner',
          email: 'owner@example.test',
          characterId: null,
          characterName: null,
          roles: ['game-owner'],
          specialCapabilities: [],
          accessVersion: 1,
          status: 'owner',
          expiresAt: null,
        },
        {
          userId: 'legacy',
          email: 'long-verified-identity@example.test',
          characterId: null,
          characterName: null,
          roles: ['content-staff'],
          specialCapabilities: [],
          accessVersion: 1,
          status: 'needs-binding',
          expiresAt: null,
        },
      ],
    }),
  )
  expect(directory).toContain('Protected')
  expect(directory).toContain('Actions')
  expect(directory).toContain('Needs binding')
  expect(directory).toContain('Bind character')
  expect(directory).not.toContain('Reason')
  expect(directory).not.toContain('Policy version')
})
it('shows default configuration only when the Owner supplies the protected snapshot', () => {
  const props = {
    staff: [],
    roleOptions: [{ id: 'moderator', label: 'Moderator', description: 'Moderation' }],
    capabilityOptions: [],
  }
  const delegated = renderToStaticMarkup(createElement(StaffManagement, props))
  expect(delegated).not.toContain('Role page access')
  const owner = renderToStaticMarkup(
    createElement(StaffManagement, {
      ...props,
      roleDefaults: {
        revision: 1,
        roles: { moderator: ['moderation'], 'content-staff': [], 'event-staff': [] },
      },
    }),
  )
  expect(owner).toContain('Role page access')
  expect(owner).toContain('Save role defaults')
  expect(owner).not.toContain('aria-label="Staff management"')
})
it('uses one directory action that opens the selected character editor', () => {
  const markup = renderToStaticMarkup(
    createElement(StaffManagement, {
      staff: [
        {
          userId: 'staff',
          email: 'verified@example.test',
          characterId: 'selected',
          characterName: 'Chosen',
          accessVersion: 1,
          roles: ['moderator'],
          specialCapabilities: [],
          status: 'active',
          expiresAt: null,
        },
      ],
      roleOptions: [],
      capabilityOptions: [],
    }),
  )
  expect(markup).toContain('>Edit</button>')
  expect(markup).not.toContain('>Revoke</button>')
})

it('omits revoked characters and their count from the staff directory', () => {
  const html = renderToStaticMarkup(
    <StaffManagement
      staff={[
        {
          userId: 'revoked',
          email: 'revoked@example.test',
          characterId: 'old-character',
          characterName: 'Former Staff',
          accessVersion: 3,
          roles: ['moderator'],
          specialCapabilities: [],
          status: 'revoked',
          expiresAt: null,
        },
      ]}
      roleOptions={[]}
    />,
  )
  expect(html).not.toContain('Former Staff')
  expect(html).not.toContain('revoked@example.test')
  expect(html).toContain('0 staff')
})

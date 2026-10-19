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
  expect(directory).toContain('Global administration · protected Owner')
  expect(directory).toContain('Needs binding')
  expect(directory).toContain('Bind character')
  expect(directory).not.toContain('Reason')
  expect(directory).not.toContain('Policy version')
})

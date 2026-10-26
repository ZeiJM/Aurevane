// Real StaffManagement and MasterPanelShell. Session/HTTP persistence is a local fixture;
// selected-character SQL authority is proven separately by physical database tests.
import React from 'react'
import { createRoot } from 'react-dom/client'
import { MasterPanelShell } from '@/components/master/master-panel-shell'
import { StaffManagement } from '@/components/master/staff-management'
import './production-styles'
const defaultsKey = 'staff-fixture-defaults'
let defaults = JSON.parse(sessionStorage.getItem(defaultsKey) || 'null') || {
  revision: 1,
  roles: {
    moderator: ['master.access'],
    'content-staff': ['master.access', 'content.combat.author'],
    'event-staff': ['master.access', 'events.author', 'events.operate'],
  },
}
const roleOptions = [
  { id: 'moderator', label: 'Moderator', description: 'Master access for moderation.' },
  { id: 'content-staff', label: 'Content Staff', description: 'Game Content authoring.' },
  { id: 'event-staff', label: 'Event Staff', description: 'Event authoring and operations.' },
]
const capabilityOptions = [
  ['moderation.permanent_ban', 'Permanent ban'],
  ['content.story_copy', 'Story copy'],
  ['content.production_publish', 'Content production publish'],
  ['events.production_publish', 'Event production publish'],
  ['events.global_scope', 'Global event scope'],
  ['events.reward_titles', 'Event title rewards'],
  ['events.emergency_stop', 'Event emergency stop'],
  ['balance.edit_selected', 'Selected balance editing'],
  ['support.issue_compensation', 'Support compensation'],
].map(([id, label]) => ({ id, label, description: label }))
const staff = [
  {
    userId: 'owner',
    email: 'owner@example.test',
    characterId: null,
    characterName: null,
    accessVersion: 1,
    roles: ['game-owner'],
    specialCapabilities: [],
    status: 'owner',
    expiresAt: null,
  },
  ...Array.from({ length: 30 }, (_, index) => ({
    userId: 'staff-' + index,
    email: 'verified-long-staff-' + index + '@example.test',
    characterId: 'character-' + index,
    characterName: index === 0 ? 'Resolved Character With a Long Name' : 'Staff Character ' + index,
    accessVersion: 4,
    roles: [roleOptions[index % 3].id],
    specialCapabilities: [],
    status: index % 5 === 0 ? 'expired' : 'active',
    expiresAt: index % 2 ? null : '2026-10-27T05:00:00Z',
  })),
]
window.__staffRequests = []
const nativeFetch = fetch.bind(window)
window.fetch = async (url, options) => {
  if (url !== '/api/master/staff-access') return nativeFetch(url, options)
  const body = JSON.parse(options.body)
  window.__staffRequests.push(body)
  if (body.operation === 'read-role-defaults') return Response.json({ defaults })
  if (body.operation === 'save-role-defaults') {
    if (window.__staffRejectNextSave) {
      window.__staffRejectNextSave = false
      return Response.json(
        { error: { message: 'Refresh role defaults before editing again.' } },
        { status: 409 },
      )
    }
    if (body.expectedRevision !== defaults.revision)
      return Response.json(
        { error: { message: 'Refresh role defaults before editing again.' } },
        { status: 409 },
      )
    defaults = { revision: defaults.revision + 1, roles: body.roles }
    sessionStorage.setItem(defaultsKey, JSON.stringify(defaults))
    return Response.json({ defaults })
  }
  if (body.operation === 'resolve-account')
    return Response.json({
      account: {
        userId: 'staff-0',
        email: 'verified-long-staff-0@example.test',
        characters: [
          { characterId: 'character-0', name: staff[1].characterName, playable: true },
          { characterId: 'character-alternate', name: 'Alternate Character', playable: true },
        ],
      },
    })
  if (body.operation === 'set-character-access')
    return Response.json({ accessVersion: body.expectedVersion + 1 })
  throw new Error('Unexpected Staff fixture request')
}
const access = {
  userId: 'owner',
  accessVersion: 1,
  roles: ['game-owner'],
  specialCapabilities: [],
  effectiveCapabilities: [
    'master.access',
    'staff.manage',
    'content.combat.author',
    'events.author',
    'events.operate',
  ],
}
createRoot(document.getElementById('root')).render(
  <MasterPanelShell access={access} activeSection="staff" title="Staff & Access" description="">
    <StaffManagement
      staff={staff}
      roleOptions={roleOptions}
      capabilityOptions={capabilityOptions}
      roleDefaults={defaults}
    />
  </MasterPanelShell>,
)

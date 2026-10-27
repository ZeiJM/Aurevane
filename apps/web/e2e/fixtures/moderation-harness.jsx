// Production moderation components; only local session/HTTP transport is a fixture.
import React from 'react'
import { createRoot } from 'react-dom/client'
import { MasterPanelShell } from '@/components/master/master-panel-shell'
import { ModerationWorkspace } from '@/components/master/moderation-workspace'
import './production-styles'
const userId = '11111111-1111-4111-8111-111111111111'
let version = 1
let record = {
  userId,
  revision: version.toString().padStart(32, '0'),
  active: false,
  permanent: false,
  expiresAt: null,
  protected: false,
  history: [],
  nextCursor: null,
}
const nativeFetch = fetch.bind(window)
window.__moderationRequests = []
window.fetch = async (url, options) => {
  if (url !== '/api/master/moderation') return nativeFetch(url, options)
  const body = JSON.parse(options.body)
  window.__moderationRequests.push(body)
  if (body.operation === 'search')
    return Response.json({
      players: [{ userId, characterId: userId, name: 'Mira', protected: false }],
    })
  if (body.operation === 'read') return Response.json({ record })
  if (window.__rejectModeration) {
    window.__rejectModeration = false
    return Response.json(
      { error: { message: 'This ban changed. Refresh the player before trying again.' } },
      { status: 409 },
    )
  }
  if (
    body.operation !== 'write' ||
    body.confirmed !== true ||
    body.expectedRevision !== record.revision
  )
    return Response.json({ error: { message: 'Invalid change' } }, { status: 400 })
  version++
  record = {
    ...record,
    revision: version.toString().padStart(32, '0'),
    active: body.action !== 'lift',
    permanent: body.action !== 'lift' && body.permanent,
    expiresAt:
      body.action === 'lift' || body.permanent
        ? null
        : new Date(Date.now() + body.minutes * 60000).toISOString(),
    history: [
      {
        id: String(version),
        actor: 'Game Owner',
        action: body.action,
        reason: body.reason,
        occurredAt: new Date().toISOString(),
        until:
          body.action === 'lift'
            ? 'Lifted'
            : body.permanent
              ? 'Permanent'
              : new Date(Date.now() + body.minutes * 60000).toISOString(),
      },
      ...record.history,
    ],
  }
  return Response.json({ record })
}
const access = {
  userId: 'owner',
  accessVersion: 1,
  roles: ['game-owner'],
  specialCapabilities: [],
  effectiveCapabilities: ['master.access', 'staff.manage', 'moderation.manage'],
}
createRoot(document.getElementById('root')).render(
  <MasterPanelShell access={access} activeSection="moderation" title="Moderation" description="">
    <ModerationWorkspace />
  </MasterPanelShell>,
)

import type { CommitBattleIntentInput } from '@aurevane/db/battle-session'
import { expect, it } from 'vitest'
import { snapshotWithBattleWalks, type BattleWalkReceipt } from './battle-walk-receipts'

const origin = { x: 0, y: 0 }
const corner = { x: 1, y: 0 }
const destination = { x: 1, y: 1 }
const firstPath = [origin, corner, destination]
const walk = { event: 'combatant_moved', combatantId: 'actor', walkPath: firstPath }

function commit(
  options: {
    version?: number
    position?: typeof origin
    events?: readonly unknown[]
    journal?: CommitBattleIntentInput['privacyJournal']
    recentWalks?: readonly BattleWalkReceipt[]
  } = {},
) {
  const {
    version = 4,
    position = destination,
    events = [walk],
    journal = {
      schemaVersion: 1,
      commandVisibility: { kind: 'public' },
      eventVisibilityOverrides: [],
    },
    recentWalks,
  } = options
  return snapshotWithBattleWalks({
    userId: 'viewer',
    actorKey: 'viewer',
    idempotencyKey: 'command',
    requestFingerprint: 'fingerprint',
    battleSessionId: 'battle',
    expectedBattleVersion: version,
    events,
    privacyJournal: journal,
    nextSnapshot: {
      ...(recentWalks ? { recentWalks } : {}),
      tactical: { width: 4, height: 4, placements: [{ combatantId: 'actor', position }] },
    },
  })
}

it('stamps only exact public walks with the settled version and destination', () => {
  expect(commit()).toMatchObject({
    recentWalks: [{ version: 5, combatantId: 'actor', path: firstPath }],
  })
  expect(commit({ position: { x: 2, y: 1 } })).not.toHaveProperty('recentWalks')
  expect(commit({ events: [{ ...walk, walkPath: [origin, destination] }] })).not.toHaveProperty(
    'recentWalks',
  )
  expect(
    commit({
      journal: {
        schemaVersion: 1,
        commandVisibility: { kind: 'public' },
        eventVisibilityOverrides: [
          { eventIndex: 0, visibility: { kind: 'team-only', teamId: 'team-a' } },
        ],
      },
    }),
  ).not.toHaveProperty('recentWalks')
})

it('retains contiguous walks across batched updates and discards them after displacement', () => {
  const recentWalks = [{ version: 5, combatantId: 'actor', path: firstPath }]
  expect(commit({ version: 5, recentWalks, events: [] })).toMatchObject({ recentWalks })
  const path = [destination, { x: 2, y: 1 }]
  expect(
    commit({ version: 6, position: path[1], recentWalks, events: [{ ...walk, walkPath: path }] }),
  ).toMatchObject({
    recentWalks: [...recentWalks, { version: 7, combatantId: 'actor', path }],
  })
  expect(commit({ version: 5, position: origin, recentWalks, events: [] })).not.toHaveProperty(
    'recentWalks',
  )
  expect(commit({ version: 12, recentWalks, events: [] })).not.toHaveProperty('recentWalks')
})

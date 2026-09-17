import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import {
  battleViewerRelationship,
  createSpectatorBattleViewerEntitlement,
  deriveParticipantBattleViewerEntitlement,
} from './battle-viewer-entitlement'

const COMBATANTS = [
  { id: 'character:a', teamId: 'team:a' },
  { id: 'character:b', teamId: 'team:a' },
  { id: 'character:c', teamId: 'team:b' },
] as const

describe('battle viewer entitlement', () => {
  it('classifies controlled, allied, and opposing combatants from authoritative teams', () => {
    const viewer = deriveParticipantBattleViewerEntitlement(COMBATANTS, ['character:a'])

    expect(battleViewerRelationship(viewer, COMBATANTS[0])).toBe('self')
    expect(battleViewerRelationship(viewer, COMBATANTS[1])).toBe('ally')
    expect(battleViewerRelationship(viewer, COMBATANTS[2])).toBe('opponent')
  })

  it('keeps spectators unprivileged', () => {
    const viewer = createSpectatorBattleViewerEntitlement()

    expect(battleViewerRelationship(viewer, COMBATANTS[0])).toBe('spectator')
    expect(battleViewerRelationship(viewer, COMBATANTS[2])).toBe('spectator')
  })

  it('fails closed for missing, duplicate, or cross-team controlled combatants', () => {
    expect(() => deriveParticipantBattleViewerEntitlement(COMBATANTS, [])).toThrow(
      /controlled combatant/i,
    )
    expect(() =>
      deriveParticipantBattleViewerEntitlement(COMBATANTS, ['character:missing']),
    ).toThrow(/controlled combatant/i)
    expect(() =>
      deriveParticipantBattleViewerEntitlement(COMBATANTS, ['character:a', 'character:a']),
    ).toThrow(/controlled combatant/i)
    expect(() =>
      deriveParticipantBattleViewerEntitlement(COMBATANTS, ['character:a', 'character:c']),
    ).toThrow(/controlled combatant/i)
  })
})

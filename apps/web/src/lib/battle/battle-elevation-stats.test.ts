import { describe, expect, it } from 'vitest'
import { terrainAdjustedBattleProfile } from './battle-elevation-stats'

function terrainState(
  height: number,
  pinned = true,
): Parameters<typeof terrainAdjustedBattleProfile>[0] {
  return {
    ...(pinned ? { statBalancePolicyVersion: 1 } : {}),
    tactical: {
      placements: [
        {
          combatantId: 'unit',
          position: { x: 1, y: 0 },
          facing: 'east',
          movementProfileId: 'ground',
        },
      ],
      tiles: [{ position: { x: 1, y: 0 }, elevation: height, terrainId: 'open' }],
    },
  }
}

describe('terrain-adjusted display stats', () => {
  it('shows active Airborne Jump3 without changing the saved profile or revealing hidden Airborne', () => {
    const status = {
      statusId: 'airborne',
      statusVersion: 1,
      stacks: 1,
      remainingOwnerTurnStarts: 2,
      sourceCombatantId: 'unit',
    }
    const state = {
      ...terrainState(0),
      airborneJumpPolicyVersion: 1 as const,
      statusState: [{ combatantId: 'unit', statuses: [status] }],
    }
    const profile = { armor: 31, ward: 22, evasion: 400, jump: 1 }
    expect(terrainAdjustedBattleProfile(state, 'unit', profile)?.jump).toBe(3)
    expect(profile.jump).toBe(1)
    expect(terrainAdjustedBattleProfile(state, 'unit', profile, [])?.jump).toBe(1)
    expect(
      terrainAdjustedBattleProfile(
        { ...state, airborneJumpPolicyVersion: undefined },
        'unit',
        profile,
      )?.jump,
    ).toBe(1)
  })
  it.each([
    [1, 1900],
    [2, 2400],
    [3, 2900],
  ])('displays height %i using canonical position modifiers', (height, evasion) => {
    const profile = { armor: 31, ward: 22, evasion: 400, accuracy: 1000 }
    expect(terrainAdjustedBattleProfile(terrainState(height), 'unit', profile)).toEqual({
      ...profile,
      armor: 24,
      ward: 17,
      evasion,
    })
    expect(profile).toEqual({ armor: 31, ward: 22, evasion: 400, accuracy: 1000 })
  })
  it('keeps legacy, flat and absent-placement profiles unchanged', () => {
    const profile = { armor: 31, ward: 22, evasion: 400 }
    for (const [state, id] of [
      [terrainState(0), 'unit'],
      [terrainState(3, false), 'unit'],
      [terrainState(3), 'absent'],
    ] as const) {
      expect(terrainAdjustedBattleProfile(state, id, profile)).toEqual(profile)
    }
    expect(terrainAdjustedBattleProfile(terrainState(3), 'unit', null)).toBeNull()
  })
  it('does not disclose a viewer-concealed Evasion bonus through numeric inspect stats', () => {
    const profile = { armor: 31, ward: 22, evasion: 400 }
    expect(terrainAdjustedBattleProfile(terrainState(3), 'unit', profile, [])).toEqual({
      armor: 24,
      ward: 17,
      evasion: 400,
    })
  })
})

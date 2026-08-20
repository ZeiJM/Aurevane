import { describe, expect, it } from 'vitest'

import {
  parsePvpCreateLobbyRequest,
  parsePvpLobbySeatMoveRequest,
  parsePvpLobbySettingsRequest,
} from './pvp'

describe('PvP request validation', () => {
  it('defaults safe medium neutral battlefield settings', () => {
    const parsed = parsePvpCreateLobbyRequest({
      characterId: '5e996b20-04cb-4977-875a-b88550630aa0',
      mode: '1v1',
    })
    expect(parsed).toMatchObject({
      mapSize: 'medium',
      elevationBias: 'neutral',
      terrainBias: 'neutral',
    })
  })

  it('accepts the supported random battlefield settings only', () => {
    expect(
      parsePvpLobbySettingsRequest({
        mapSize: 'large',
        elevationBias: 'more',
        terrainBias: 'less',
      }),
    ).toEqual({ mapSize: 'large', elevationBias: 'more', terrainBias: 'less' })
    expect(
      parsePvpLobbySettingsRequest({
        mapSize: 'small',
        elevationBias: 'neutral',
        terrainBias: 'neutral',
      }),
    ).toBeNull()
  })

  it('accepts valid seat targets and rejects out-of-range moves', () => {
    expect(parsePvpLobbySeatMoveRequest({ targetTeamIndex: 2, targetSeatIndex: 0 })).toEqual({
      targetTeamIndex: 2,
      targetSeatIndex: 0,
    })
    expect(parsePvpLobbySeatMoveRequest({ targetTeamIndex: 3, targetSeatIndex: 0 })).toBeNull()
    expect(parsePvpLobbySeatMoveRequest({ targetTeamIndex: 0, targetSeatIndex: 3 })).toBeNull()
  })
})

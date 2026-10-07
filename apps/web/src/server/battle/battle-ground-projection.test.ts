import { describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
import { omitPendingBattlePayloads } from './battle-live-viewer-projection'
const area = {
  id: 'ground.area.1',
  tiles: [{ x: 1, y: 1 }],
  activationRound: 2,
  expiresAtRound: 5,
  visualPresetId: 'embers',
  sourceCombatantId: 'secret-source',
  sourceActionId: 'secret-action',
  sourceCommandVisibility: { kind: 'team-only', teamId: 'secret-team' },
  caster: { secret: 100 },
  content: { secret: 'data' },
  entryEffects: [{ secret: 'power' }],
}
describe('public Ground projection', () => {
  it('publishes the fixed footprint without source identity or frozen execution data', () => {
    const state = {
      groundAreas: [area],
      nextGroundAreaId: 2,
      tactical: { battle: { round: 1, lifecycle: 'active' } },
    }
    const projected = omitPendingBattlePayloads(state as never)
    expect(projected).toMatchObject({
      groundAreas: [
        {
          id: area.id,
          tiles: area.tiles,
          activationRound: 2,
          expiresAtRound: 5,
          visualPresetId: 'embers',
        },
      ],
    })
    expect(JSON.stringify(projected)).not.toContain('secret')
    expect(projected).not.toHaveProperty('nextGroundAreaId')
    expect(state.groundAreas[0]).toHaveProperty('caster')
  })
  it('removes expired and terminal ground markers', () => {
    for (const [round, lifecycle] of [
      [5, 'active'],
      [2, 'completed'],
    ])
      expect(
        omitPendingBattlePayloads({
          groundAreas: [area],
          tactical: { battle: { round, lifecycle } },
        } as never),
      ).toMatchObject({ groundAreas: [] })
  })
})

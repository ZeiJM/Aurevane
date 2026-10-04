import { describe, expect, it, vi } from 'vitest'
import type { BattleActionPreview } from '@/server/battle/battle-preview-service'
import { battleRangePreviewIntents, requestBattleRangePreviews } from './battle-range-previews'

const skill = {
  id: 'basic.attack.unarmed.basic',
  targetKind: 'unit' as const,
  targetTeamPolicy: 'enemy' as const,
  minimumRange: 1,
  maximumRange: 1,
}
const combatants = [
  { combatantId: 'actor', teamIndex: 0, hp: 100, position: { x: 1, y: 1 } },
  { combatantId: 'north', teamIndex: 1, hp: 100, position: { x: 1, y: 0 } },
  { combatantId: 'south', teamIndex: 1, hp: 100, position: { x: 1, y: 2 } },
  { combatantId: 'ally', teamIndex: 0, hp: 100, position: { x: 0, y: 1 } },
  { combatantId: 'far', teamIndex: 1, hp: 100, position: { x: 4, y: 1 } },
  { combatantId: 'defeated', teamIndex: 1, hp: 0, position: { x: 2, y: 1 } },
]
const projection = (id: string): BattleActionPreview => ({
  kind: 'action',
  legal: true,
  actionId: skill.id,
  actorId: 'actor',
  primaryCombatantId: id,
  affectedTiles: [],
  affectedCombatantIds: [id],
  projectedEffects: [{ effectType: 'damage', combatantId: id, before: 100, after: 83 }],
  projectedStatuses: [],
  projectedEvents: [],
  mpCost: 0,
  actionEconomyCost: 30,
  actionEconomyBefore: 100,
  actionEconomyAfter: 70,
  hitChanceBasisPoints: 6900,
  defenseKind: 'armor',
  defenseRating: 5,
  mitigatedBaseDamage: 17,
  issues: [],
  spendsAction: true,
})

describe('automatic canonical range forecasts', () => {
  it('requests both adjacent living enemies before any target selection', () => {
    const intents = battleRangePreviewIntents(skill, 'actor', combatants)
    expect(intents.map((intent) => intent.target)).toEqual([
      { kind: 'unit', combatantId: 'north' },
      { kind: 'unit', combatantId: 'south' },
    ])
    expect(battleRangePreviewIntents(skill, null, combatants)).toEqual([])
    expect(battleRangePreviewIntents(skill, 'defeated', combatants)).toEqual([])
    expect(
      battleRangePreviewIntents({ ...skill, targetKind: 'ground-tile' }, 'actor', combatants),
    ).toEqual([])
  })

  it('preserves ally policy, minimum range and independent target outcomes', async () => {
    expect(
      battleRangePreviewIntents({ ...skill, targetTeamPolicy: 'ally' }, 'actor', combatants).map(
        (intent) => intent.target,
      ),
    ).toEqual([{ kind: 'unit', combatantId: 'ally' }])
    expect(
      battleRangePreviewIntents(
        { ...skill, minimumRange: 2, maximumRange: 3 },
        'actor',
        combatants,
      ).map((intent) => intent.target),
    ).toEqual([{ kind: 'unit', combatantId: 'far' }])
    const fetchPreview = vi.fn<typeof fetch>(async (_url, options) => {
      const { expectedBattleVersion, intent } = JSON.parse(String(options?.body))
      expect(expectedBattleVersion).toBe(4)
      const preview = projection(intent.target.combatantId)
      if (preview.primaryCombatantId === 'south') preview.hitChanceBasisPoints = 4200
      return Response.json({
        battlePreview: { battleSessionId: 'battle', battleVersion: 4, preview },
      })
    })
    const forecasts = await requestBattleRangePreviews({
      battleSessionId: 'battle',
      battleVersion: 4,
      actorId: 'actor',
      intents: battleRangePreviewIntents(skill, 'actor', combatants),
      signal: new AbortController().signal,
      fetchPreview,
    })
    expect(
      forecasts.map((forecast) => [forecast.primaryCombatantId, forecast.hitChanceBasisPoints]),
    ).toEqual([
      ['north', 6900],
      ['south', 4200],
    ])
    expect(fetchPreview).toHaveBeenCalledTimes(2)
    expect(fetchPreview.mock.calls.every(([url]) => String(url).endsWith('/preview'))).toBe(true)
  })

  it.each(['illegal', 'stale', 'session', 'actor', 'action', 'target', 'http', 'failed'])(
    'omits %s responses instead of advertising a legal outcome',
    async (failure) => {
      const fetchPreview = vi.fn<typeof fetch>(async () => {
        if (failure === 'failed') throw new Error('Offline')
        const preview = projection('north')
        if (failure === 'illegal') preview.legal = false
        if (failure === 'actor') preview.actorId = 'another'
        if (failure === 'action') preview.actionId = 'another'
        if (failure === 'target') preview.primaryCombatantId = 'another'
        return Response.json(
          {
            battlePreview: {
              battleSessionId: failure === 'session' ? 'another' : 'battle',
              battleVersion: failure === 'stale' ? 3 : 4,
              preview,
            },
          },
          { status: failure === 'http' ? 409 : 200 },
        )
      })
      expect(
        await requestBattleRangePreviews({
          battleSessionId: 'battle',
          battleVersion: 4,
          actorId: 'actor',
          intents: battleRangePreviewIntents(skill, 'actor', combatants).slice(0, 1),
          signal: new AbortController().signal,
          fetchPreview,
        }),
      ).toEqual([])
    },
  )

  it('discards a response arriving after its selection/version request was aborted', async () => {
    const controller = new AbortController()
    const fetchPreview = vi.fn<typeof fetch>(async () => {
      controller.abort()
      return Response.json({
        battlePreview: {
          battleSessionId: 'battle',
          battleVersion: 4,
          preview: projection('north'),
        },
      })
    })
    expect(
      await requestBattleRangePreviews({
        battleSessionId: 'battle',
        battleVersion: 4,
        actorId: 'actor',
        intents: battleRangePreviewIntents(skill, 'actor', combatants).slice(0, 1),
        signal: controller.signal,
        fetchPreview,
      }),
    ).toEqual([])
  })
})

import { describe, expect, it, vi } from 'vitest'
import type { BattleActionPreview } from '@/server/battle/battle-preview-service'
import { createPv1fBasicAttackDefinition } from '@aurevane/game-core/combat/pv1f-action-economy'
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
  it.each([{ kind: 'line', length: 3 }, { kind: 'circle', radius: 3 }, { kind: 'all' }] as const)(
    'keeps exact normalized attachments in direct $kind factories and changes request identity with the set',
    (shape) => {
      const target = {
        ...createPv1fBasicAttackDefinition(1).target,
        geometryVersion: 3 as const,
        minimumRange: 0,
        maximumRange: 3,
        shape,
      }
      const intents = battleRangePreviewIntents(
        {
          ...skill,
          target,
          manualModifiers: [
            { sourceInstanceId: 'b', behaviorId: 'extra' },
            { sourceInstanceId: 'a', behaviorId: 'other' },
          ],
        },
        'actor',
        combatants,
      )
      for (const intent of intents)
        expect(intent.manualModifiers).toEqual([
          { sourceInstanceId: 'a', behaviorId: 'other' },
          { sourceInstanceId: 'b', behaviorId: 'extra' },
        ])
      expect(intents.length).toBeGreaterThan(0)
      expect(JSON.stringify(intents)).not.toBe(
        JSON.stringify(battleRangePreviewIntents({ ...skill, target }, 'actor', combatants)),
      )
    },
  )
  it('retains the chosen Move path in ordinary and area forecasts without requesting before path selection', () => {
    const path = [
      { x: 1, y: 1 },
      { x: 2, y: 1 },
      { x: 3, y: 1 },
    ]
    const moving = { ...skill, move: { maximumTiles: 2, conditional: false }, movementPath: path }
    expect(
      battleRangePreviewIntents({ ...moving, movementPath: undefined }, 'actor', combatants),
    ).toEqual([])
    expect(battleRangePreviewIntents(moving, 'actor', combatants)).toEqual([
      {
        kind: 'action',
        actionId: skill.id,
        movementPath: path,
        target: { kind: 'unit', combatantId: 'far' },
      },
    ])
    const area = {
      ...moving,
      target: {
        ...createPv1fBasicAttackDefinition(1).target,
        geometryVersion: 3 as const,
        shape: { kind: 'line' as const, length: 3 },
      },
    }
    expect(battleRangePreviewIntents(area, 'actor', combatants)).toHaveLength(4)
    for (const intent of battleRangePreviewIntents(area, 'actor', combatants))
      expect(intent.movementPath).toEqual(path)
  })
  it('forecasts canonical Self/Ally/Enemy categories independently of a legacy Self envelope', () => {
    const captured = {
      ...skill,
      targetKind: 'self' as const,
      targetTeamPolicy: 'self' as const,
      target: {
        ...createPv1fBasicAttackDefinition(1).target,
        geometryVersion: 3 as const,
        categories: ['ally' as const, 'enemy' as const],
        maximumSelections: 3,
        minimumRange: 0,
        maximumRange: 4,
      },
    }
    expect(
      battleRangePreviewIntents(captured, 'actor', combatants).map((intent) => intent.target),
    ).toEqual([
      { kind: 'unit', combatantId: 'north' },
      { kind: 'unit', combatantId: 'south' },
      { kind: 'unit', combatantId: 'ally' },
      { kind: 'unit', combatantId: 'far' },
    ])
  })
  it('carries an explicit captured behavior through geometry-three area requests', () => {
    const captured = {
      ...skill,
      behaviorId: 'strike',
      target: {
        ...createPv1fBasicAttackDefinition(1).target,
        geometryVersion: 3 as const,
        categories: ['enemy' as const],
        maximumSelections: 1,
        minimumRange: 0,
        maximumRange: 3,
        shape: { kind: 'line' as const, length: 3 },
      },
    }
    const intents = battleRangePreviewIntents(captured, 'actor', [combatants[0]!])
    expect(intents).toHaveLength(4)
    expect(intents.every((intent) => intent.behaviorId === 'strike')).toBe(true)
    expect(
      battleRangePreviewIntents({ ...captured, unavailable: true }, 'actor', combatants),
    ).toEqual([])
  })
  const target = {
    ...createPv1fBasicAttackDefinition(1).target,
    geometryVersion: 2 as const,
    minimumRange: 0,
    maximumRange: 3,
    shape: { kind: 'line' as const, length: 3 },
  }
  it('requests all four area directions even when no victim is in a lane', () => {
    expect(
      battleRangePreviewIntents({ ...skill, target }, 'actor', [combatants[0]!]).map(
        (i) => i.target,
      ),
    ).toEqual([
      { kind: 'direction', direction: 'north' },
      { kind: 'direction', direction: 'east' },
      { kind: 'direction', direction: 'south' },
      { kind: 'direction', direction: 'west' },
    ])
    expect(
      battleRangePreviewIntents(
        { ...skill, target: { ...target, shape: { kind: 'all' } } },
        'actor',
        combatants,
      ).map((i) => i.target),
    ).toEqual([{ kind: 'activate' }])
  })
  it('accepts every actual recipient in an area forecast without inventing a primary target', async () => {
    const area = {
      ...projection('north'),
      primaryCombatantId: null,
      affectedCombatantIds: ['north', 'south'],
    }
    const intents = battleRangePreviewIntents(
      { ...skill, target: { ...target, shape: { kind: 'circle', radius: 1 } } },
      'actor',
      combatants,
    )
    const fetchPreview = vi.fn<typeof fetch>(async () =>
      Response.json({
        battlePreview: { battleSessionId: 'area-battle', battleVersion: 4, preview: area },
      }),
    )
    expect(
      await requestBattleRangePreviews({
        battleSessionId: 'area-battle',
        battleVersion: 4,
        actorId: 'actor',
        intents,
        signal: new AbortController().signal,
        fetchPreview,
      }),
    ).toEqual([area])
  })
  it('shares an identical in-flight candidate forecast between readers', async () => {
    let finish!: (response: Response) => void
    const fetchPreview = vi.fn<typeof fetch>(
      () =>
        new Promise<Response>((resolve) => {
          finish = resolve
        }),
    )
    const request = {
      battleSessionId: 'battle',
      battleVersion: 4,
      actorId: 'actor',
      intents: battleRangePreviewIntents(skill, 'actor', combatants).slice(0, 1),
      fetchPreview,
    }
    const first = requestBattleRangePreviews({ ...request, signal: new AbortController().signal })
    const second = requestBattleRangePreviews({ ...request, signal: new AbortController().signal })
    expect(fetchPreview).toHaveBeenCalledTimes(1)
    finish(
      Response.json({
        battlePreview: {
          battleSessionId: 'battle',
          battleVersion: 4,
          preview: projection('north'),
        },
      }),
    )
    expect(await first).toEqual([projection('north')])
    expect(await second).toEqual([projection('north')])
  })

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

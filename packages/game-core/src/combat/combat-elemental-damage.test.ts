import { timeoutPvpTurn, createPvpQualityResources } from './pvp-quality'
import { describe, it, expect } from 'vitest'
import {
  evaluateCombatAction,
  executeCombatAction,
  validateCombatEncounterState,
  type CombatActionDefinition,
  type CombatEncounterState,
} from './actions'
import { percentageDotEncounter } from './combat-percentage-dots.test-utils'
import { PV1F_COMBAT_CONTENT, finishPv1fTurn } from './pv1f-action-economy'
import { setTerrainOverlay } from './terrain-overlays'
import { advanceBattleRng } from './battle-state'
import { createCombatGroundArea } from './combat-ground-areas'
import { defaultCombatEffectTimingPolicy } from './combat-effect-timing'
import { grantBarrier } from './combat-barrier'

const missed = (base: CombatEncounterState): CombatEncounterState => ({
  ...base,
  statBridge: {
    ...base.statBridge!,
    combatants: base.statBridge!.combatants.map((u) => ({ ...u, accuracy: 0 })),
  },
})
const encounter = (): CombatEncounterState => {
  const state = percentageDotEncounter()
  return {
    ...state,
    elementalDamagePolicyVersion: 1,
    tactical: {
      ...state.tactical,
      battle: { ...state.tactical.battle, effectStackingPolicyVersion: 1 },
    },
  }
}
const target = { kind: 'unit' as const, combatantId: 'enemy' }
function skill(
  element: 'fire' | 'ice' | 'water' | 'storm',
  amounts = [10],
): CombatActionDefinition {
  return {
    id: 'test.element',
    version: 1,
    sourceType: 'discipline-skill',
    tags: ['attack'],
    cost: { mp: 0, spendsAction: false },
    requirements: [],
    target: {
      kind: 'unit',
      teamPolicy: 'enemy',
      friendlyFire: 'enemies-only',
      shape: { kind: 'single' },
      minimumRange: 1,
      maximumRange: 4,
      requiresLineOfSight: false,
      maximumElevationDifference: null,
    },
    effects: amounts.map((amount) => ({
      type: 'damage',
      recipient: 'primary-unit',
      amount,
      element,
    })),
  }
}
const statuses = (s: CombatEncounterState, id = 'enemy') =>
  s.statusState.find((r) => r.combatantId === id)!.statuses
function status(
  s: CombatEncounterState,
  id: string,
  holder = 'enemy',
  potencyBasisPoints?: number,
): CombatEncounterState {
  return {
    ...s,
    statusState: s.statusState.map((r) =>
      r.combatantId === holder
        ? {
            ...r,
            statuses: [
              ...r.statuses,
              {
                statusId: id,
                statusVersion: 1,
                stacks: 1,
                remainingOwnerTurnStarts: 2,
                sourceCombatantId: 'actor',
                ...(potencyBasisPoints ? { potencyBasisPoints } : {}),
              },
            ].sort((a, b) => a.statusId.localeCompare(b.statusId)),
          }
        : r,
    ),
  }
}
describe('current elemental settlement', () => {
  it.each([
    ['ice', 'frozen'],
    ['water', 'wet'],
    ['storm', 'conductive'],
  ] as const)('%s applies its two-turn debuff on positive hostile HP damage', (element, id) => {
    const out = executeCombatAction(encounter(), skill(element), target, PV1F_COMBAT_CONTENT)
    expect(statuses(out.state)).toEqual([
      expect.objectContaining({ statusId: id, remainingOwnerTurnEnds: 2 }),
    ])
  })
  it('does not apply on fully absorbed hits, misses, allies or lethal damage', () => {
    const base = encounter()
    const absorbed = grantBarrier(base, 'actor', 'enemy', 'test.barrier', 100).state
    expect(
      statuses(executeCombatAction(absorbed, skill('water'), target, PV1F_COMBAT_CONTENT).state),
    ).toEqual([])
    expect(
      statuses(
        executeCombatAction(
          missed(base),
          { ...skill('water'), accuracyMode: 'per-target' },
          target,
          PV1F_COMBAT_CONTENT,
        ).state,
      ),
    ).toEqual([])
    const friendly = {
      ...skill('water'),
      target: {
        ...skill('water').target,
        teamPolicy: 'any' as const,
        friendlyFire: 'all-units' as const,
      },
    }
    expect(
      statuses(
        executeCombatAction(
          base,
          friendly,
          { kind: 'unit', combatantId: 'ally' },
          PV1F_COMBAT_CONTENT,
        ).state,
        'ally',
      ),
    ).toEqual([])
    const dying = {
      ...base,
      tactical: {
        ...base.tactical,
        battle: {
          ...base.tactical.battle,
          combatants: base.tactical.battle.combatants.map((u) =>
            u.id === 'enemy' ? { ...u, hp: 5 } : u,
          ),
        },
      },
    }
    expect(
      statuses(executeCombatAction(dying, skill('water'), target, PV1F_COMBAT_CONTENT).state),
    ).toEqual([])
  })
  it('consumes old Conductive once and reapplies one fresh charge across repeated Storm packets', () => {
    const base = status(status(encounter(), 'wet', 'enemy', 3000), 'conductive', 'enemy', 4000)
    const action = {
      ...skill('storm', [100, 100]),
      effects: [
        ...skill('storm', [100, 100]).effects,
        {
          type: 'apply-status' as const,
          recipient: 'primary-unit' as const,
          statusId: 'conductive',
          stacks: 1,
        },
      ],
    }
    const out = executeCombatAction(base, action, target, PV1F_COMBAT_CONTENT)
    expect(out.events.filter((e) => e.event === 'damage_applied').map((e) => e.amount)).toEqual([
      170, 130,
    ])
    expect(statuses(out.state).find((s) => s.statusId === 'conductive')?.stacks).toBe(1)
    expect(
      evaluateCombatAction(base, action, target, PV1F_COMBAT_CONTENT)
        .projectedEffects.filter((e) => e.effectType === 'damage')
        .map((e) => e.after),
    ).toEqual([830, 700])
  })
  it.each([undefined, 2] as const)(
    'legal empty Fire Ground casts preserve caster cleanse and ice life with geometry %s',
    (geometryVersion) => {
      let base = status(encounter(), 'frozen', 'actor')
      base = setTerrainOverlay(base, { x: 0, y: 1 }, 'frozen', 'enemy', 'freeze').state
      base = {
        ...base,
        terrainOverlays: base.terrainOverlays!.map((o) => ({ ...o, remainingRoundBoundaries: 1 })),
      }
      const selection = { kind: 'tile' as const, position: { x: 0, y: 1 } }
      const fire = { ...skill('fire'), target: { ...skill('fire').target, geometryVersion } }
      const forecast = evaluateCombatAction(base, fire, selection, PV1F_COMBAT_CONTENT)
      expect(forecast.legal).toBe(true)
      expect(statuses(base, 'actor')).toHaveLength(1)
      const out = executeCombatAction(base, fire, selection, PV1F_COMBAT_CONTENT)
      expect(statuses(out.state, 'actor')).toEqual([])
      expect(out.state.terrainOverlays).toEqual([
        expect.objectContaining({ kind: 'steam', remainingRoundBoundaries: 1 }),
      ])
      expect(() =>
        executeCombatAction(
          base,
          skill('fire'),
          { kind: 'tile', position: { x: 8, y: 8 } },
          PV1F_COMBAT_CONTENT,
        ),
      ).toThrow()
      expect(statuses(base, 'actor')).toHaveLength(1)
    },
  )
  it('a missed legal Fire cast cleanses caster Chilled', () => {
    const base = status(encounter(), 'frozen', 'actor')
    expect(
      statuses(
        executeCombatAction(
          missed(base),
          { ...skill('fire'), accuracyMode: 'per-target' },
          target,
          PV1F_COMBAT_CONTENT,
        ).state,
        'actor',
      ),
    ).toEqual([])
  })
  it('Chilled prevents a changed final facing but permits the existing direction', () => {
    const base = status(encounter(), 'frozen', 'actor')
    expect(() => finishPv1fTurn(base as ReturnType<typeof percentageDotEncounter>, 'east')).toThrow(
      /Chilled/,
    )
    expect(
      finishPv1fTurn(base as ReturnType<typeof percentageDotEncounter>, 'west').state.tactical
        .battle.currentTurn?.combatantId,
    ).toBe('enemy')
  })
  it('a Chilled PvP timeout ends in the existing direction without an illegal-facing deadlock', () => {
    const base = status(encounter(), 'frozen', 'actor') as ReturnType<typeof percentageDotEncounter>
    base.tactical.battle.combatants = base.tactical.battle.combatants.map((unit) => ({
      ...unit,
      temporaryResources: [...unit.temporaryResources, ...createPvpQualityResources()],
    }))
    const out = timeoutPvpTurn(base)
    expect(out.state.tactical.placements.find((row) => row.combatantId === 'actor')?.facing).toBe(
      'west',
    )
    expect(out.state.tactical.battle.currentTurn?.combatantId).toBe('enemy')
    expect(out.state.tactical.battle.turnNumber).toBe(2)
  })
  it('converts only affected persistent ice tiles and retains the full source schedule', () => {
    let base = { ...encounter(), groundEffectPolicyVersion: 1 as const }
    const ice = {
      ...skill('ice'),
      target: { ...skill('ice').target, kind: 'ground-tile' as const },
      effects: [
        {
          type: 'apply-status' as const,
          recipient: 'affected-units' as const,
          statusId: 'frozen',
          stacks: 1,
        },
      ],
      groundArea: {
        durationRounds: 4,
        visualPresetId: 'frost' as const,
        timing: 'instant' as const,
        entryEffectOrdinals: [0],
      },
    }
    base = createCombatGroundArea(
      base,
      'enemy',
      ice,
      [
        { x: 0, y: 1 },
        { x: 0, y: 2 },
      ],
      PV1F_COMBAT_CONTENT,
    ) as typeof base
    const out = executeCombatAction(
      base,
      skill('fire'),
      { kind: 'tile', position: { x: 0, y: 1 } },
      PV1F_COMBAT_CONTENT,
    )
    expect(out.state.terrainOverlays).toEqual([
      expect.objectContaining({ kind: 'steam', remainingRoundBoundaries: 4 }),
    ])
    expect(out.state.groundAreas![0]).toMatchObject({
      expiresAtRound: 5,
      steamTiles: [{ x: 0, y: 1 }],
    })
  })
  it('persistent ice with one boundary left does not restart Steam lifetime', () => {
    const base = { ...encounter(), groundEffectPolicyVersion: 1 as const }
    const ice = {
      ...skill('ice'),
      target: { ...skill('ice').target, kind: 'ground-tile' as const },
      effects: [
        {
          type: 'apply-status' as const,
          recipient: 'affected-units' as const,
          statusId: 'frozen',
          stacks: 1,
        },
      ],
      groundArea: {
        durationRounds: 1,
        visualPresetId: 'frost' as const,
        timing: 'instant' as const,
        entryEffectOrdinals: [0],
      },
    }
    const state = createCombatGroundArea(base, 'enemy', ice, [{ x: 0, y: 1 }], PV1F_COMBAT_CONTENT)
    const out = executeCombatAction(
      state,
      skill('fire'),
      { kind: 'tile', position: { x: 0, y: 1 } },
      PV1F_COMBAT_CONTENT,
    )
    expect(out.state.terrainOverlays![0].remainingRoundBoundaries).toBe(1)
  })
  it('captures authored duration and bonus and preserves explicit delayed status timing without duplicates', () => {
    const base = {
      ...encounter(),
      effectTimingPolicy: {
        ...defaultCombatEffectTimingPolicy(),
        modes: { wet: 'delayed' as const },
      },
    }
    const water = {
      ...skill('water'),
      effects: [
        {
          type: 'apply-status' as const,
          recipient: 'primary-unit' as const,
          statusId: 'wet',
          stacks: 1,
          durationTurns: 3,
          potencyBasisPoints: 3500,
        },
        ...skill('water').effects,
      ],
    }
    const out = executeCombatAction(base, water, target, PV1F_COMBAT_CONTENT)
    expect(statuses(out.state)).toEqual([])
    expect(out.state.pendingEffects).toHaveLength(1)
    expect(out.state.pendingEffects![0]).toMatchObject({
      activationRound: 3,
      effect: { statusId: 'wet', durationTurns: 3, potencyBasisPoints: 3500 },
    })
  })
  it('delayed Storm packets consume one old charge and reapply once at damage settlement', () => {
    const base = {
      ...status(status(encounter(), 'wet', 'enemy', 3000), 'conductive', 'enemy', 4000),
      effectTimingPolicy: {
        ...defaultCombatEffectTimingPolicy(),
        modes: { damage: 'delayed' as const },
      },
    }
    base.statusState = base.statusState.map((row) => ({
      ...row,
      statuses: row.statuses.map((status) => ({
        ...status,
        remainingOwnerTurnEnds: 4,
        remainingOwnerTurnStarts: 4,
      })),
    }))
    let state = executeCombatAction(
      base,
      skill('storm', [100, 100]),
      target,
      PV1F_COMBAT_CONTENT,
    ).state
    expect(statuses(state).find((s) => s.statusId === 'conductive')?.potencyBasisPoints).toBe(4000)
    const events: { event: string; amount?: number }[] = []
    for (let i = 0; i < 8; i++) {
      const out = finishPv1fTurn(state as ReturnType<typeof percentageDotEncounter>, 'west')
      state = out.state
      events.push(...(out.events as { event: string; amount?: number }[]))
    }
    expect(events.filter((e) => e.event === 'damage_applied').map((e) => e.amount)).toEqual([
      170, 130,
    ])
    expect(statuses(state).find((s) => s.statusId === 'conductive')).toMatchObject({
      stacks: 1,
      potencyBasisPoints: 2000,
    })
  })
  it('delayed Fire cleanses at commit and never cleanses again during queued damage activation', () => {
    const base = {
      ...status(encounter(), 'frozen', 'actor'),
      effectTimingPolicy: {
        ...defaultCombatEffectTimingPolicy(),
        modes: { damage: 'delayed' as const },
      },
    }
    let state = executeCombatAction(base, skill('fire'), target, PV1F_COMBAT_CONTENT).state
    expect(statuses(state, 'actor')).toEqual([])
    for (let i = 0; i < 7; i++)
      state = finishPv1fTurn(state as ReturnType<typeof percentageDotEncounter>, 'west').state
    state = status(state, 'frozen', 'actor')
    const out = finishPv1fTurn(state as ReturnType<typeof percentageDotEncounter>, 'west')
    expect(statuses(out.state, 'actor').some((s) => s.statusId === 'frozen')).toBe(true)
  })
  it('Copy Debuffs retains captured elemental bonuses, duration and source metadata', () => {
    let state = status(status(encounter(), 'wet', 'actor', 3500), 'conductive', 'actor', 4000)
    state = {
      ...state,
      statusState: state.statusState.map((row) => ({
        ...row,
        statuses: row.statuses.map((status) => ({
          ...status,
          remainingOwnerTurnEnds: 3,
          remainingOwnerTurnStarts: 3,
        })),
      })),
    }
    const copy = {
      ...skill('water'),
      effects: [
        {
          type: 'copy-statuses' as const,
          recipient: 'primary-unit' as const,
          mode: 'curse' as const,
        },
      ],
    }
    const out = executeCombatAction(state, copy, target, PV1F_COMBAT_CONTENT).state
    expect(
      statuses(out).map((s) => [
        s.statusId,
        s.applicationModifiers?.[0]?.potencyBasisPoints ?? s.potencyBasisPoints,
        s.remainingOwnerTurnEnds,
        s.sourceCombatantId,
      ]),
    ).toEqual([
      ['conductive', 4000, 3, 'actor'],
      ['wet', 3500, 3, 'actor'],
    ])
    const restored = JSON.parse(JSON.stringify(out))
    const storm = executeCombatAction(restored, skill('storm', [100]), target, PV1F_COMBAT_CONTENT)
    expect(storm.events.filter((e) => e.event === 'damage_applied').map((e) => e.amount)).toEqual([
      175,
    ])
  })
  it('legacy immediate damage duration zero does not hide an authored elemental duration', () => {
    const water = {
      ...skill('water'),
      effects: [
        { ...skill('water').effects[0]!, durationTurns: 0 },
        {
          type: 'apply-status' as const,
          recipient: 'primary-unit' as const,
          statusId: 'wet',
          stacks: 1,
          durationTurns: 3,
          potencyBasisPoints: 3500,
        },
      ],
    }
    expect(
      statuses(executeCombatAction(encounter(), water, target, PV1F_COMBAT_CONTENT).state)[0],
    ).toMatchObject({ remainingOwnerTurnEnds: 3, potencyBasisPoints: 3500 })
  })
  it('ordinary resistance rejects the implicit debuff while preserving direct damage', () => {
    let base = encounter()
    for (let seed = 1; seed < 1000; seed++) {
      const rng = { ...base.tactical.battle.rng, seed, state: seed, draws: 0 }
      if (advanceBattleRng(rng).value % 10000 < 1500) {
        base = { ...base, tactical: { ...base.tactical, battle: { ...base.tactical.battle, rng } } }
        break
      }
    }
    base = {
      ...base,
      statBalancePolicyVersion: 1,
      statBridge: {
        ...base.statBridge!,
        rulesVersion: 4,
        schemaVersion: 4,
        combatants: base.statBridge!.combatants.map((u) => ({
          ...u,
          statusResistance: 1500,
          criticalChance: 0,
          level: 1,
        })),
      },
    }
    const out = executeCombatAction(base, skill('water'), target, PV1F_COMBAT_CONTENT)
    expect(out.events.filter((e) => e.event === 'damage_applied').map((e) => e.amount)).toEqual([
      10,
    ])
    expect(out.events.filter((e) => e.event === 'combat_status_resistance_resolved')).toMatchObject(
      [{ resisted: true }],
    )
    expect(statuses(out.state)).toEqual([])
  })
  it('Fire Ground intent keeps enemy recipients and current Airborne immunity', () => {
    const base = { ...status(encounter(), 'airborne'), airbornePolicyVersion: 1 as const }
    const ground = executeCombatAction(
      base,
      skill('fire'),
      { kind: 'tile', position: { x: 2, y: 1 } },
      PV1F_COMBAT_CONTENT,
    )
    expect(ground.events.filter((e) => e.event === 'damage_applied')).toEqual([])
    expect(ground.events.filter((e) => e.event === 'combat_accuracy_resolved')).toMatchObject([
      { hit: false, hitChanceBasisPoints: 0 },
    ])
    expect(
      executeCombatAction(base, skill('fire'), target, PV1F_COMBAT_CONTENT).events.filter(
        (e) => e.event === 'damage_applied',
      ),
    ).toHaveLength(1)
  })
  it('rejects malformed captured delayed elemental metadata on restore', () => {
    const base = {
      ...encounter(),
      effectTimingPolicy: { version: 7, modes: { damage: 'delayed' as const } },
    }
    const water = {
      ...skill('water'),
      effects: [
        ...skill('water').effects,
        {
          type: 'apply-status' as const,
          recipient: 'primary-unit' as const,
          statusId: 'wet',
          stacks: 1,
          durationTurns: 3,
        },
      ],
    }
    const state = executeCombatAction(base, water, target, PV1F_COMBAT_CONTENT).state
    const wrongStatus = {
      ...state,
      pendingEffects: state.pendingEffects!.map((row) => ({
        ...row,
        elementalApplication: {
          effect: {
            type: 'apply-status' as const,
            recipient: 'primary-unit' as const,
            statusId: 'frozen',
            stacks: 1,
          },
        },
      })),
    }
    const wrongRecipients = {
      ...state,
      pendingEffects: state.pendingEffects!.map((row) => ({
        ...row,
        elementalResistedRecipientIds: ['ally'],
      })),
    }
    expect(
      validateCombatEncounterState(wrongStatus).some((issue) => issue.field === 'pendingEffects'),
    ).toBe(true)
    expect(
      validateCombatEncounterState(wrongRecipients).some(
        (issue) => issue.field === 'pendingEffects',
      ),
    ).toBe(true)
  })
  it('explicit area Fire Ground intent keeps canonical geometry and Airborne immunity', () => {
    const base = { ...status(encounter(), 'airborne'), airbornePolicyVersion: 1 as const }
    const fire = {
      ...skill('fire'),
      target: {
        ...skill('fire').target,
        geometryVersion: 2 as const,
        shape: { kind: 'line' as const, length: 3 },
        minimumRange: 0,
        maximumRange: 3,
      },
      effects: [
        {
          type: 'damage' as const,
          recipient: 'affected-units' as const,
          amount: 10,
          element: 'fire' as const,
        },
      ],
    }
    const enemy = { kind: 'direction' as const, direction: 'east' as const }
    const ground = { ...enemy, ground: true as const }
    // Enemy is on row1; move actor onto that row for the authored straight lane.
    const state = {
      ...base,
      tactical: {
        ...base.tactical,
        placements: base.tactical.placements.map((p) =>
          p.combatantId === 'actor' ? { ...p, position: { x: 0, y: 1 } } : p,
        ),
      },
    }
    expect(evaluateCombatAction(state, fire, ground, PV1F_COMBAT_CONTENT).affectedTiles).toEqual(
      evaluateCombatAction(state, fire, enemy, PV1F_COMBAT_CONTENT).affectedTiles,
    )
    expect(
      executeCombatAction(state, fire, ground, PV1F_COMBAT_CONTENT).events.filter(
        (e) => e.event === 'damage_applied' && e.targetCombatantId === 'enemy',
      ),
    ).toEqual([])
    expect(
      executeCombatAction(state, fire, enemy, PV1F_COMBAT_CONTENT).events.filter(
        (e) => e.event === 'damage_applied' && e.targetCombatantId === 'enemy',
      ),
    ).toHaveLength(1)
    expect(() =>
      executeCombatAction(
        state,
        { ...fire, effects: [{ ...fire.effects[0]!, element: 'water' }] },
        ground,
        PV1F_COMBAT_CONTENT,
      ),
    ).toThrow(/Ground intent/)
    const historical = { ...state, elementalDamagePolicyVersion: undefined }
    expect(() => executeCombatAction(historical, fire, ground, PV1F_COMBAT_CONTENT)).toThrow(
      /Ground intent/,
    )
    const delayed = {
      ...state,
      effectTimingPolicy: { version: 7, modes: { damage: 'delayed' as const } },
    }
    const queued = executeCombatAction(
      delayed,
      fire,
      JSON.parse(JSON.stringify(ground)),
      PV1F_COMBAT_CONTENT,
    ).state.pendingEffects!
    expect(queued).toHaveLength(1)
    expect(queued[0]).toMatchObject({ groundTargeted: true, recipientIds: ['other'] })
  })
  it('a later positive Fire packet clears earlier queued Chilled or Drenched in authored order', () => {
    const mixed = {
      ...skill('water'),
      effects: [...skill('ice').effects, ...skill('water').effects, ...skill('fire').effects],
    }
    expect(
      statuses(executeCombatAction(encounter(), mixed, target, PV1F_COMBAT_CONTENT).state),
    ).toEqual([])
    const reversed = { ...mixed, effects: [...skill('fire').effects, ...skill('ice').effects] }
    expect(
      statuses(executeCombatAction(encounter(), reversed, target, PV1F_COMBAT_CONTENT).state).map(
        (s) => s.statusId,
      ),
    ).toEqual(['frozen'])
  })
  it('Normal empty Ground Fire captures its tiles through restore and keeps the surviving ice expiry', () => {
    let base = {
      ...status(encounter(), 'frozen', 'actor'),
      effectTimingPolicy: { version: 7, modes: { damage: 'next-round' as const } },
    }
    base = setTerrainOverlay(base, { x: 0, y: 1 }, 'frozen', 'enemy', 'fixture.ice')
      .state as typeof base
    const fire = {
      ...skill('fire'),
      target: { ...skill('fire').target, geometryVersion: 2 as const },
    }
    const selection = { kind: 'tile' as const, position: { x: 0, y: 1 } }
    const forecast = evaluateCombatAction(base, fire, selection, PV1F_COMBAT_CONTENT)
    expect(forecast.legal).toBe(true)
    let state = executeCombatAction(base, fire, selection, PV1F_COMBAT_CONTENT).state
    expect(statuses(state, 'actor')).toEqual([])
    expect(state.pendingEffects).toMatchObject([
      { recipientIds: [], affectedTiles: [{ x: 0, y: 1 }], activationRound: 2 },
    ])
    const events: { event: string }[] = []
    for (let turn = 0; turn < 4; turn++) {
      const out = finishPv1fTurn(JSON.parse(JSON.stringify(state)), 'west')
      state = out.state
      events.push(...(out.events as { event: string }[]))
    }
    expect(events.filter((event) => event.event === 'damage_applied')).toEqual([])
    expect(state.terrainOverlays).toMatchObject([{ kind: 'steam', remainingRoundBoundaries: 1 }])
    for (let turn = 0; turn < 4; turn++)
      state = finishPv1fTurn(state as ReturnType<typeof percentageDotEncounter>, 'west').state
    expect(state.terrainOverlays).toEqual([])
  })
  it('Delayed empty Ground Fire converts surviving persistent ice and never repeats caster cleanse', () => {
    const base = {
      ...status(encounter(), 'frozen', 'actor'),
      groundEffectPolicyVersion: 1 as const,
      effectTimingPolicy: { version: 7, modes: { damage: 'delayed' as const } },
    }
    const ice = {
      ...skill('ice'),
      target: { ...skill('ice').target, kind: 'ground-tile' as const },
      effects: [
        {
          type: 'apply-status' as const,
          recipient: 'affected-units' as const,
          statusId: 'frozen',
          stacks: 1,
        },
      ],
      groundArea: {
        durationRounds: 4,
        visualPresetId: 'frost' as const,
        timing: 'instant' as const,
        entryEffectOrdinals: [0],
      },
    }
    const source = createCombatGroundArea(base, 'enemy', ice, [{ x: 0, y: 1 }], PV1F_COMBAT_CONTENT)
    let state = executeCombatAction(
      source,
      skill('fire'),
      { kind: 'tile', position: { x: 0, y: 1 } },
      PV1F_COMBAT_CONTENT,
    ).state
    expect(statuses(state, 'actor')).toEqual([])
    expect(state.pendingEffects).toMatchObject([
      { recipientIds: [], affectedTiles: [{ x: 0, y: 1 }], activationRound: 3 },
    ])
    const events: { event: string }[] = []
    for (let turn = 0; turn < 7; turn++) {
      const out = finishPv1fTurn(JSON.parse(JSON.stringify(state)), 'west')
      state = out.state
      events.push(...(out.events as { event: string }[]))
    }
    state = status(state, 'frozen', 'actor')
    const out = finishPv1fTurn(state as ReturnType<typeof percentageDotEncounter>, 'west')
    state = out.state
    events.push(...(out.events as { event: string }[]))
    expect(statuses(state, 'actor').some((status) => status.statusId === 'frozen')).toBe(true)
    expect(events.filter((event) => event.event === 'damage_applied')).toEqual([])
    expect(state.terrainOverlays).toMatchObject([{ kind: 'steam', remainingRoundBoundaries: 2 }])
    expect(state.groundAreas).toMatchObject([{ expiresAtRound: 5, steamTiles: [{ x: 0, y: 1 }] }])
    for (let turn = 0; turn < 8; turn++)
      state = finishPv1fTurn(state as ReturnType<typeof percentageDotEncounter>, 'west').state
    expect(state.terrainOverlays).toEqual([])
    expect(state.groundAreas).toEqual([])
  })
  it('Delayed empty Fire does not resurrect ice that expires before activation', () => {
    let state = {
      ...encounter(),
      effectTimingPolicy: { version: 7, modes: { damage: 'delayed' as const } },
    } as CombatEncounterState
    state = setTerrainOverlay(state, { x: 0, y: 1 }, 'frozen', 'enemy', 'fixture.ice').state
    state = executeCombatAction(
      state,
      skill('fire'),
      { kind: 'tile', position: { x: 0, y: 1 } },
      PV1F_COMBAT_CONTENT,
    ).state
    expect(state.pendingEffects).toHaveLength(1)
    for (let turn = 0; turn < 8; turn++)
      state = finishPv1fTurn(JSON.parse(JSON.stringify(state)), 'west').state
    expect(state.terrainOverlays).toEqual([])
    expect(state.pendingEffects).toEqual([])
  })
  it.each(['missed', 'airborne'] as const)(
    'Normal Ground Fire still converts ice when every recipient is %s',
    (cause) => {
      let state = {
        ...encounter(),
        airbornePolicyVersion: 1 as const,
        effectTimingPolicy: { version: 7, modes: { damage: 'next-round' as const } },
      } as CombatEncounterState
      state = cause === 'airborne' ? status(state, 'airborne') : missed(state)
      state = setTerrainOverlay(state, { x: 2, y: 1 }, 'frozen', 'enemy', 'fixture.ice').state
      const fire = { ...skill('fire'), accuracyMode: 'per-target' as const }
      state = executeCombatAction(
        state,
        fire,
        { kind: 'tile', position: { x: 2, y: 1 } },
        PV1F_COMBAT_CONTENT,
      ).state
      expect(state.pendingEffects).toMatchObject([
        { recipientIds: [], affectedTiles: [{ x: 2, y: 1 }] },
      ])
      const events: { event: string }[] = []
      for (let turn = 0; turn < 4; turn++) {
        const out = finishPv1fTurn(JSON.parse(JSON.stringify(state)), 'west')
        state = out.state
        events.push(...(out.events as { event: string }[]))
      }
      expect(events.filter((event) => event.event === 'damage_applied')).toEqual([])
      expect(state.terrainOverlays).toMatchObject([{ kind: 'steam', remainingRoundBoundaries: 1 }])
    },
  )
  it.each(['before', 'after', 'between'] as const)(
    'reconciles overlapping selector identities with explicit Conductive %s damage',
    (order) => {
      const storm = skill('storm', order === 'between' ? [100, 100] : [100])
      const hits = storm.effects.flatMap((effect) =>
        effect.type === 'damage'
          ? [
              {
                ...effect,
                recipient: 'affected-units' as const,
              },
            ]
          : [],
      )
      const charge = {
        type: 'apply-status' as const,
        recipient: 'primary-unit' as const,
        statusId: 'conductive',
        stacks: 1,
        durationTurns: 3,
        potencyBasisPoints: 3500,
      }
      const action = {
        ...storm,
        effects:
          order === 'before'
            ? [charge, ...hits]
            : order === 'after'
              ? [...hits, charge]
              : [hits[0]!, charge, hits[1]!],
      }
      const base = encounter()
      const preview = evaluateCombatAction(base, action, target, PV1F_COMBAT_CONTENT)
      const out = executeCombatAction(base, action, target, PV1F_COMBAT_CONTENT)
      expect(out.events.filter((e) => e.event === 'damage_applied').map((e) => e.amount)).toEqual(
        order === 'between' ? [100, 100] : [100],
      )
      expect(out.events.filter((e) => e.event === 'status_applied')).toHaveLength(1)
      expect(statuses(out.state)).toEqual([
        expect.objectContaining({
          statusId: 'conductive',
          stacks: 1,
          potencyBasisPoints: 3500,
          remainingOwnerTurnEnds: 3,
        }),
      ])
      expect(preview.projectedEffects.filter((e) => e.effectType === 'apply-status')).toHaveLength(
        1,
      )
      expect(
        preview.projectedEffects.filter((e) => e.effectType === 'damage').map((e) => e.after),
      ).toEqual(order === 'between' ? [900, 800] : [900])
      expect(statuses(base)).toEqual([])
    },
  )
  it.each(['before', 'after', 'between'] as const)(
    'captures identity-matched explicit tuning across delayed restore with status %s damage',
    (order) => {
      const hits = skill('storm', [100, 100]).effects.flatMap((effect) =>
        effect.type === 'damage'
          ? [
              {
                ...effect,
                recipient: 'affected-units' as const,
              },
            ]
          : [],
      )
      const charge = {
        type: 'apply-status' as const,
        recipient: 'primary-unit' as const,
        statusId: 'conductive',
        stacks: 1,
        durationTurns: 3,
        potencyBasisPoints: 3500,
      }
      const action = {
        ...skill('storm'),
        effects:
          order === 'before'
            ? [charge, ...hits]
            : order === 'after'
              ? [...hits, charge]
              : [hits[0]!, charge, hits[1]!],
      }
      const base = {
        ...encounter(),
        effectTimingPolicy: { version: 7, modes: { damage: 'delayed' as const } },
      }
      let state = executeCombatAction(base, action, target, PV1F_COMBAT_CONTENT).state
      expect(state.pendingEffects).toHaveLength(2)
      expect(validateCombatEncounterState(JSON.parse(JSON.stringify(state)))).toEqual([])
      const events: { event: string; amount?: number }[] = []
      for (let turn = 0; turn < 8; turn++) {
        const out = finishPv1fTurn(JSON.parse(JSON.stringify(state)), 'west')
        state = out.state
        events.push(...(out.events as typeof events))
      }
      expect(events.filter((e) => e.event === 'damage_applied').map((e) => e.amount)).toEqual([
        100, 100,
      ])
      expect(events.filter((e) => e.event === 'status_applied')).toHaveLength(1)
      expect(statuses(state)).toEqual([
        expect.objectContaining({
          statusId: 'conductive',
          stacks: 1,
          potencyBasisPoints: 3500,
          remainingOwnerTurnEnds: 3,
        }),
      ])
    },
  )
  it.each([false, true])(
    'preserves nonoverlapping explicit recipients and tuning, delayed=%s',
    (delayed) => {
      const action = {
        ...skill('storm'),
        target: { ...skill('storm').target, shape: { kind: 'circle' as const, radius: 1 } },
        effects: [
          {
            type: 'damage' as const,
            recipient: 'primary-unit' as const,
            element: 'storm' as const,
            amount: 100,
          },
          {
            type: 'apply-status' as const,
            recipient: 'affected-units' as const,
            statusId: 'conductive',
            stacks: 1,
            durationTurns: 3,
            potencyBasisPoints: 3500,
          },
        ],
      }
      let state = {
        ...encounter(),
        ...(delayed
          ? {
              effectTimingPolicy: {
                version: 7,
                modes: { damage: 'delayed' as const, conductive: 'next-round' as const },
              },
            }
          : {}),
      }
      const out = executeCombatAction(state, action, target, PV1F_COMBAT_CONTENT)
      state = out.state
      if (delayed) {
        expect(
          state
            .pendingEffects!.filter((row) => row.effect.type === 'apply-status')
            .map((row) => row.recipientIds),
        ).toEqual([['other']])
        const damage = state.pendingEffects!.find((row) => row.effect.type === 'damage')!
        expect(damage.elementalApplicationsByRecipient).toMatchObject({
          enemy: { effect: { potencyBasisPoints: 3500, durationTurns: 3 } },
        })
        for (let turn = 0; turn < 12; turn++)
          state = finishPv1fTurn(JSON.parse(JSON.stringify(state)), 'west').state
      }
      expect(statuses(state)).toEqual([
        expect.objectContaining({ statusId: 'conductive', stacks: 1, potencyBasisPoints: 3500 }),
      ])
      expect(statuses(state, 'other')).toEqual([
        expect.objectContaining({ statusId: 'conductive', stacks: 1, potencyBasisPoints: 3500 }),
      ])
    },
  )
  it.each([false, true])(
    'captures tuning only for the original matching recipient, delayed=%s',
    (delayed) => {
      const action = {
        ...skill('storm'),
        target: { ...skill('storm').target, shape: { kind: 'circle' as const, radius: 1 } },
        effects: [
          {
            type: 'damage' as const,
            recipient: 'affected-units' as const,
            element: 'storm' as const,
            amount: 100,
          },
          {
            type: 'apply-status' as const,
            recipient: 'primary-unit' as const,
            statusId: 'conductive',
            stacks: 1,
            durationTurns: 3,
            potencyBasisPoints: 3500,
          },
        ],
      }
      let state = {
        ...encounter(),
        ...(delayed
          ? { effectTimingPolicy: { version: 7, modes: { damage: 'delayed' as const } } }
          : {}),
      }
      state = executeCombatAction(state, action, target, PV1F_COMBAT_CONTENT).state
      if (delayed) {
        expect(Object.keys(state.pendingEffects![0]!.elementalApplicationsByRecipient!)).toEqual([
          'enemy',
        ])
        for (let turn = 0; turn < 8; turn++)
          state = finishPv1fTurn(JSON.parse(JSON.stringify(state)), 'west').state
      }
      expect(statuses(state)).toEqual([
        expect.objectContaining({
          statusId: 'conductive',
          stacks: 1,
          potencyBasisPoints: 3500,
          remainingOwnerTurnEnds: 3,
        }),
      ])
      expect(statuses(state, 'other')).toEqual([
        expect.objectContaining({
          statusId: 'conductive',
          stacks: 1,
          potencyBasisPoints: 2000,
          remainingOwnerTurnEnds: 2,
        }),
      ])
    },
  )
  it('validates captured recipient identity and preserves explicit timing and origin after restore', () => {
    const origin = { family: 'resonance' as const, contentId: 'fixture.charge', contentVersion: 4 }
    const action = {
      ...skill('storm'),
      effects: [
        {
          type: 'damage' as const,
          recipient: 'affected-units' as const,
          element: 'storm' as const,
          amount: 100,
        },
        {
          type: 'apply-status' as const,
          recipient: 'primary-unit' as const,
          statusId: 'conductive',
          stacks: 1,
          durationTurns: 3,
          potencyBasisPoints: 3500,
        },
      ],
      effectTimingTags: [undefined, 'wet'],
      effectOrigins: [undefined, origin],
    }
    const base = {
      ...encounter(),
      effectTimingPolicy: {
        version: 7,
        modes: { damage: 'delayed' as const, wet: 'next-round' as const },
      },
    }
    let state = executeCombatAction(base, action, target, PV1F_COMBAT_CONTENT).state
    const captured = state.pendingEffects![0]!.elementalApplicationsByRecipient!.enemy!
    expect(captured).toMatchObject({ timingTag: 'wet', effectOrigin: origin })
    for (const applications of [
      { ally: captured },
      { enemy: { ...captured, effect: { ...captured.effect, statusId: 'wet' } } },
      { enemy: { ...captured, effectOrigin: { ...origin, contentVersion: 0 } } },
    ]) {
      expect(
        validateCombatEncounterState(
          JSON.parse(
            JSON.stringify({
              ...state,
              pendingEffects: state.pendingEffects!.map((row) => ({
                ...row,
                elementalApplicationsByRecipient: applications,
              })),
            }),
          ),
        ).some((issue) => issue.field === 'pendingEffects'),
      ).toBe(true)
    }
    for (let turn = 0; turn < 8; turn++)
      state = finishPv1fTurn(JSON.parse(JSON.stringify(state)), 'west').state
    expect(statuses(state)).toEqual([])
    expect(state.pendingEffects).toMatchObject([
      {
        activationRound: 4,
        effect: { statusId: 'conductive', potencyBasisPoints: 3500, durationTurns: 3 },
        effectOrigin: origin,
        timingTag: 'wet',
        recipientIds: ['enemy'],
      },
    ])
    const events: { event: string; effectOrigin?: unknown }[] = []
    for (let turn = 0; turn < 4; turn++) {
      const out = finishPv1fTurn(JSON.parse(JSON.stringify(state)), 'west')
      state = out.state
      events.push(...(out.events as typeof events))
    }
    expect(events.find((event) => event.event === 'status_applied')).toMatchObject({
      effectOrigin: origin,
    })
    expect(statuses(state)).toEqual([
      expect.objectContaining({ potencyBasisPoints: 3500, remainingRoundBoundaries: 3 }),
    ])
  })
  it('absent policy retains historical Water status and Fire targeting semantics', () => {
    const base = percentageDotEncounter()
    expect(
      statuses(executeCombatAction(base, skill('water'), target, PV1F_COMBAT_CONTENT).state),
    ).toEqual([])
    expect(
      evaluateCombatAction(
        base,
        skill('fire'),
        { kind: 'tile', position: { x: 0, y: 1 } },
        PV1F_COMBAT_CONTENT,
      ).legal,
    ).toBe(false)
  })
})

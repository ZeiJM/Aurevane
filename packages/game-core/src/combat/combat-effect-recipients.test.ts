import { deriveSharedEffectAim } from './combat-effect-target-authoring'
import { describe, expect, it } from 'vitest'
import {
  evaluateCombatAction,
  executeCombatAction,
  endCombatTurn,
  validateCombatEncounterState,
  type CombatActionDefinition,
  type CombatEncounterState,
} from './actions'
import { selectCurrentFinalFacing } from './board'
import { setTerrainOverlay } from './terrain-overlays'
import { percentageDotEncounter } from './combat-percentage-dots.test-utils'
import { PV1F_COMBAT_CONTENT } from './pv1f-action-economy'
import { captureCombatAbilitySource } from './combat-behavior-capture'
import { source } from './combat-behavior.test-utils'
import {
  combatAbilityCommandContext,
  reconcileCombatAbilitySources,
} from './combat-behavior-runtime'
import { preparePv1fTurnEconomy } from './pv1f-action-economy'
import { prepareCombatAbilityCommand, commitCombatAbilityCommand } from './combat-ability-command'

function encounter() {
  const state = percentageDotEncounter()
  state.tactical.battle.combatants = state.tactical.battle.combatants.map((unit) => ({
    ...unit,
    hp: 900,
  }))
  return state
}
function action(effects: CombatActionDefinition['effects']): CombatActionDefinition {
  return {
    id: 'test.effect-targets',
    version: 1,
    sourceType: 'test',
    tags: [],
    requirements: [],
    cost: { mp: 2, spendsAction: false },
    target: {
      geometryVersion: 2,
      kind: 'unit',
      teamPolicy: 'enemy',
      friendlyFire: 'enemies-only',
      shape: { kind: 'circle', radius: 2 },
      minimumRange: 0,
      maximumRange: 2,
      requiresLineOfSight: false,
      maximumElevationDifference: null,
    },
    effects,
  }
}
const activate = { kind: 'activate' } as const
const targets = (result: ReturnType<typeof executeCombatAction>, event: string) =>
  result.events
    .filter((row) => row.event === event)
    .map((row) =>
      'targetCombatantId' in row
        ? row.targetCombatantId
        : 'combatantId' in row
          ? row.combatantId
          : null,
    )

describe('one shared footprint with independent effect targets', () => {
  it('global hostile misses cannot grant self healing when the shared aim has no local enemy', () => {
    const state = encounter()
    const cast: CombatActionDefinition = {
      ...action([
        { type: 'damage', recipient: 'affected-units', target: 'all', amount: 10 },
        { type: 'healing', recipient: 'actor', target: 'self', amount: 20 },
      ]),
      accuracyRule: { kind: 'fixed', chanceBasisPoints: 0 },
    }
    cast.target = {
      ...cast.target,
      kind: 'self',
      teamPolicy: 'self',
      shape: { kind: 'single' },
      maximumRange: 0,
    }
    const committed = executeCombatAction(state, cast, { kind: 'self' }, PV1F_COMBAT_CONTENT)
    expect(targets(committed, 'damage_applied')).toEqual([])
    expect(targets(committed, 'healing_applied')).toEqual([])
  })

  it('does not allow a global effect to be relabeled as a local Ground entry effect', () => {
    const cast = action([
      { type: 'damage', recipient: 'affected-units', target: 'all', amount: 10 },
    ])
    cast.target = { ...cast.target, kind: 'ground-tile', shape: { kind: 'single' } }
    cast.groundArea = { durationRounds: 2, visualPresetId: 'frost', entryEffectOrdinals: [0] }
    expect(() =>
      evaluateCombatAction(
        encounter(),
        cast,
        { kind: 'tile', position: { x: 2, y: 2 } },
        PV1F_COMBAT_CONTENT,
      ),
    ).toThrow(/Ground entry.*target/i)
  })
  it('All fire transforms frozen terrain outside the local footprint', () => {
    const frozen = setTerrainOverlay(
      encounter(),
      { x: 4, y: 4 },
      'frozen',
      'actor',
      'test.freeze',
    ).state
    const result = executeCombatAction(
      frozen,
      action([
        { type: 'damage', recipient: 'affected-units', target: 'all', amount: 10, element: 'fire' },
      ]),
      activate,
      PV1F_COMBAT_CONTENT,
    )
    expect(
      result.state.terrainOverlays?.find((row) => row.position.x === 4 && row.position.y === 4)
        ?.kind,
    ).toBe('steam')
  })

  it('Reveal does not treat an ally-only Covert packet as affecting the selected enemy', () => {
    const state = encounter()
    const content = PV1F_COMBAT_CONTENT
    const cast = action([
      {
        type: 'apply-status',
        recipient: 'affected-units',
        target: 'ally',
        statusId: 'covert',
        stacks: 1,
      },
      {
        type: 'sensory',
        recipient: 'primary-unit',
        target: 'enemy',
        revealedDurationOwnerTurnStarts: 2,
      },
    ])
    cast.target = { ...cast.target, shape: { kind: 'single' }, maximumRange: 4 }
    const result = executeCombatAction(state, cast, { kind: 'unit', combatantId: 'enemy' }, content)
    expect(
      result.events.some((row) => row.event === 'status_applied' && row.statusId === 'revealed'),
    ).toBe(false)
  })

  it('All recovery includes the caster once and friendly fire does not suppress support', () => {
    const result = executeCombatAction(
      encounter(),
      action([{ type: 'healing', recipient: 'affected-units', target: 'all', amount: 10 }]),
      activate,
      PV1F_COMBAT_CONTENT,
    )
    expect(targets(result, 'healing_applied')).toEqual(['actor', 'ally', 'enemy', 'other'])
  })

  it('Empty Tile rejects occupancy and Ground does not invent a primary unit', () => {
    const cast = action([
      {
        type: 'create-terrain',
        recipient: 'affected-tiles',
        target: 'empty-tile',
        terrain: 'frozen',
      },
    ])
    cast.target = { ...cast.target, kind: 'empty-tile', shape: { kind: 'single' } }
    expect(
      evaluateCombatAction(
        encounter(),
        cast,
        { kind: 'tile', position: { x: 2, y: 1 } },
        PV1F_COMBAT_CONTENT,
      ).legal,
    ).toBe(false)
    const empty = evaluateCombatAction(
      encounter(),
      cast,
      { kind: 'tile', position: { x: 2, y: 2 } },
      PV1F_COMBAT_CONTENT,
    )
    expect(empty.legal).toBe(true)
    expect(empty.primaryCombatantId).toBeNull()
  })
  it('keeps repeated packet eligibility aligned with the original effect ordinal', () => {
    const state = encounter()
    const current: CombatEncounterState = {
      ...state,
      skillPacketPolicyVersion: 1,
      statBalancePolicyVersion: 1,
      statBridge: {
        ...state.statBridge,
        schemaVersion: 4,
        rulesVersion: 4,
        combatants: state.statBridge.combatants.map((profile) => ({
          ...profile,
          level: 1,
          criticalChance: 0,
          statusResistance: 0,
        })),
      },
    }
    const cast: CombatActionDefinition = {
      ...action([
        { type: 'damage', recipient: 'affected-units', target: 'all', amount: 10 },
        { type: 'damage', recipient: 'affected-units', target: 'all', amount: 10 },
      ]),
      sourceType: 'discipline-skill',
      accuracyMode: 'per-target',
      effectEligibleRecipientIds: [['enemy'], ['other']],
    }
    const committed = executeCombatAction(current, cast, activate, PV1F_COMBAT_CONTENT)
    expect(targets(committed, 'combat_accuracy_resolved')).toEqual(['enemy', 'other'])
    expect(targets(committed, 'damage_applied')).toEqual(['enemy', 'other'])
  })
  it('rejects a cast with no eligible recipients without spending resources', () => {
    const state = encounter()
    const cast = action([
      { type: 'healing', recipient: 'affected-units', target: 'ally', amount: 10 },
    ])
    cast.target = { ...cast.target, shape: { kind: 'line', length: 2 } }
    const selection = { kind: 'direction', direction: 'east' } as const
    const quote = evaluateCombatAction(state, cast, selection, PV1F_COMBAT_CONTENT)
    expect(quote.issues).toContainEqual(expect.objectContaining({ code: 'effect-target-missing' }))
    expect(() => executeCombatAction(state, cast, selection, PV1F_COMBAT_CONTENT)).toThrow()
    expect(state.tactical.battle.combatants[0]!.mp).toBe(20)
  })

  it('keeps delayed global recipients frozen after save/reload and team changes', () => {
    const state = encounter()
    state.effectTimingPolicy = { version: 1, modes: { damage: 'next-round' } }
    const queued = executeCombatAction(
      state,
      action([{ type: 'damage', recipient: 'affected-units', target: 'all', amount: 10 }]),
      activate,
      PV1F_COMBAT_CONTENT,
    ).state
    let restored = JSON.parse(JSON.stringify(queued)) as CombatEncounterState
    expect(validateCombatEncounterState(restored)).toEqual([])
    expect(restored.pendingEffects?.[0]?.recipientIds).toEqual(['enemy', 'other'])
    restored.tactical.battle.combatants = restored.tactical.battle.combatants.map((unit) =>
      unit.id === 'ally' ? { ...unit, teamId: 'enemies' } : unit,
    )
    const resolved: string[] = []
    for (let turn = 0; turn < 4; turn++) {
      const result = endCombatTurn(
        { ...restored, tactical: selectCurrentFinalFacing(restored.tactical, 'east').state },
        PV1F_COMBAT_CONTENT,
      )
      resolved.push(
        ...targets(result, 'damage_applied').filter((id): id is string => typeof id === 'string'),
      )
      restored = result.state
    }
    expect(resolved).toEqual(['enemy', 'other'])
    expect(restored.pendingEffects).toEqual([])
  })

  it('uses global targets for critical and resistance forecasts and committed rolls', () => {
    const initial = encounter()
    const state: CombatEncounterState = {
      ...initial,
      statBalancePolicyVersion: 1,
      statBridge: {
        ...initial.statBridge,
        schemaVersion: 4,
        rulesVersion: 4,
        combatants: initial.statBridge.combatants.map((profile) => ({
          ...profile,
          level: 1,
          criticalChance: profile.combatantId === 'actor' ? 10000 : 0,
          statusResistance: 1500,
        })),
      },
    }
    state.tactical.placements = state.tactical.placements.map((row) =>
      row.combatantId === 'other' ? { ...row, position: { x: 4, y: 4 } } : row,
    )
    const cast = {
      ...action([
        { type: 'damage', recipient: 'affected-units', target: 'all', amount: 10 },
        {
          type: 'apply-status',
          recipient: 'affected-units',
          target: 'all',
          statusId: 'root',
          stacks: 1,
        },
      ]),
      accuracyMode: 'per-target' as const,
      sourceType: 'discipline-skill' as const,
    }
    const quote = evaluateCombatAction(state, cast, activate, PV1F_COMBAT_CONTENT)
    expect(quote.targetCriticalChances?.map((row) => row.targetCombatantId)).toEqual([
      'enemy',
      'other',
    ])
    expect(quote.targetStatusResistances?.map((row) => row.targetCombatantId)).toEqual([
      'enemy',
      'other',
    ])
    const committed = executeCombatAction(state, cast, activate, PV1F_COMBAT_CONTENT)
    expect(targets(committed, 'combat_critical_resolved')).toEqual(['enemy', 'other'])
    expect(targets(committed, 'combat_status_resistance_resolved')).toEqual(['enemy', 'other'])
  })
  it('forecasts and rolls accuracy for global recipients outside the aimed footprint', () => {
    const state = encounter()
    state.tactical.placements = state.tactical.placements.map((row) =>
      row.combatantId === 'other' ? { ...row, position: { x: 4, y: 4 } } : row,
    )
    const cast = {
      ...action([{ type: 'damage', recipient: 'affected-units', target: 'all', amount: 10 }]),
      accuracyMode: 'per-target' as const,
      sourceType: 'discipline-skill' as const,
    }
    const before = JSON.stringify(state)
    const quote = evaluateCombatAction(state, cast, activate, PV1F_COMBAT_CONTENT)
    expect(quote.targetHitChances?.map((row) => row.targetCombatantId)).toEqual(['enemy', 'other'])
    expect(JSON.stringify(state)).toBe(before)
    expect(
      targets(
        executeCombatAction(state, cast, activate, PV1F_COMBAT_CONTENT),
        'combat_accuracy_resolved',
      ),
    ).toEqual(['enemy', 'other'])
  })

  it('canonical preparation and commit retain source ordinals and pay combined costs once', () => {
    const captured = captureCombatAbilitySource(
      source({
        targeting: { ...action([]).target, maximumSelections: 1 },
        accuracy: { kind: 'fixed', chanceBasisPoints: 10000 },
        effects: [
          {
            id: 'hit',
            payload: { type: 'damage', recipient: 'affected-units', target: 'enemy', amount: 10 },
          },
          {
            id: 'heal',
            payload: { type: 'healing', recipient: 'affected-units', target: 'ally', amount: 20 },
          },
        ],
      }),
    )
    const state = reconcileCombatAbilitySources(preparePv1fTurnEconomy(encounter()), [captured])
    const input = {
      state,
      actorId: 'actor',
      root: { kind: 'canonical' as const, source: captured },
      selection: activate,
      content: PV1F_COMBAT_CONTENT,
      context: combatAbilityCommandContext(state, captured),
    }
    const quote = prepareCombatAbilityCommand(input)
    expect(quote.evaluation.legal).toBe(true)
    const result = commitCombatAbilityCommand(input)
    expect(targets(result, 'damage_applied')).toEqual(['enemy', 'other'])
    expect(targets(result, 'healing_applied')).toEqual(['ally'])
    const actor = result.state.tactical.battle.combatants.find((unit) => unit.id === 'actor')!
    expect(actor.hp).toBe(899)
    expect(actor.mp).toBe(18)
    expect(actor.temporaryResources.find((row) => row.key === 'pv1f.action-economy')!.current).toBe(
      89,
    )
  })
  it('damages enemies and heals allies without suppressing recovery through friendly fire', () => {
    const state = encounter()
    const cast = action([
      { type: 'damage', recipient: 'affected-units', target: 'enemy', amount: 10 },
      { type: 'healing', recipient: 'affected-units', target: 'ally', amount: 20 },
      { type: 'healing', recipient: 'actor', target: 'self', amount: 5 },
    ])
    const before = JSON.stringify(state)
    const preview = evaluateCombatAction(state, cast, activate, PV1F_COMBAT_CONTENT)
    expect(preview.legal).toBe(true)
    expect(
      preview.projectedEffects
        .filter((row) => row.effectType === 'healing')
        .map((row) => row.combatantId),
    ).toEqual(['ally', 'actor'])
    expect(JSON.stringify(state)).toBe(before)
    const committed = executeCombatAction(state, cast, activate, PV1F_COMBAT_CONTENT)
    expect(targets(committed, 'damage_applied')).toEqual(['enemy', 'other'])
    expect(targets(committed, 'healing_applied')).toEqual(['ally', 'actor'])
    expect(committed.state.tactical.battle.combatants.find((row) => row.id === 'actor')!.mp).toBe(
      18,
    )
  })

  it('All reaches remote legal enemies while a sibling keeps its local footprint', () => {
    const state = encounter()
    state.tactical.placements = state.tactical.placements.map((row) =>
      row.combatantId === 'other' ? { ...row, position: { x: 4, y: 4 } } : row,
    )
    const cast = action([
      { type: 'damage', recipient: 'affected-units', target: 'all', amount: 10 },
      { type: 'healing', recipient: 'affected-units', target: 'ally', amount: 20 },
    ])
    const committed = executeCombatAction(state, cast, activate, PV1F_COMBAT_CONTENT)
    expect(targets(committed, 'damage_applied')).toEqual(['enemy', 'other'])
    expect(targets(committed, 'healing_applied')).toEqual(['ally'])
  })

  it('friendly fire adds allied area damage without damaging the caster or changing ally recovery', () => {
    const cast = action([
      { type: 'damage', recipient: 'affected-units', target: 'enemy', amount: 10 },
      { type: 'healing', recipient: 'affected-units', target: 'ally', amount: 20 },
    ])
    cast.target = { ...cast.target, friendlyFire: 'all-except-actor' }
    const committed = executeCombatAction(encounter(), cast, activate, PV1F_COMBAT_CONTENT)
    expect(targets(committed, 'damage_applied')).toEqual(['ally', 'enemy', 'other'])
    expect(targets(committed, 'healing_applied')).toEqual(['ally'])
  })

  it('does not reinterpret omitted target policy in historical native effects', () => {
    const committed = executeCombatAction(
      encounter(),
      action([{ type: 'healing', recipient: 'affected-units', amount: 20 }]),
      activate,
      PV1F_COMBAT_CONTENT,
    )
    expect(targets(committed, 'healing_applied')).toEqual(['enemy', 'other'])
  })

  it('captures current effect targets and preserves historical omitted policies', () => {
    const captured = captureCombatAbilitySource(
      source({
        effects: [
          {
            id: 'hit',
            payload: { type: 'damage', recipient: 'affected-units', target: 'enemy', amount: 10 },
          },
          {
            id: 'heal',
            payload: { type: 'healing', recipient: 'actor', target: 'self', amount: 5 },
          },
        ],
      }),
    )
    expect(captured.definition.behaviors[0]!.effects[0]!.payload).toHaveProperty('target', 'enemy')
    expect(
      captureCombatAbilitySource(source()).definition.behaviors[0]!.effects[0]!.payload,
    ).not.toHaveProperty('target')
  })

  it('rejects malformed or mechanically incompatible target policies', () => {
    for (const payload of [
      { type: 'damage', recipient: 'affected-units', target: 'typo', amount: 10 },
      { type: 'damage', recipient: 'actor', target: 'enemy', amount: 10 },
      { type: 'return-to-turn-start', recipient: 'actor', target: 'all' },
    ]) {
      expect(() =>
        executeCombatAction(encounter(), action([payload as never]), activate, PV1F_COMBAT_CONTENT),
      ).toThrow(/target/i)
    }
  })
})

it('executes a derived one-aim global cast without a shape or target selection of its own', () => {
  const cast = action([{ type: 'damage', recipient: 'affected-units', target: 'all', amount: 10 }])
  cast.target = deriveSharedEffectAim(cast.target, cast.effects)
  const state = encounter()
  const before = JSON.stringify(state)
  const preview = evaluateCombatAction(state, cast, { kind: 'self' }, PV1F_COMBAT_CONTENT)
  expect(preview.legal).toBe(true)
  expect(JSON.stringify(state)).toBe(before)
  const out = executeCombatAction(state, cast, { kind: 'self' }, PV1F_COMBAT_CONTENT)
  expect(targets(out, 'damage_applied')).toEqual(['enemy', 'other'])
})

it('mixes Ground and unit packets in one paid cast without Ground immunity suppressing unit hits', () => {
  let state = { ...encounter(), airbornePolicyVersion: 1 as const }
  const air = PV1F_COMBAT_CONTENT.statuses.find((row) => row.id === 'airborne')!
  state = {
    ...state,
    statusState: state.statusState.map((row) =>
      row.combatantId === 'enemy'
        ? {
            ...row,
            statuses: [
              {
                statusId: 'airborne',
                statusVersion: air.version,
                stacks: 1,
                remainingOwnerTurnStarts: 3,
                sourceCombatantId: 'enemy',
              },
            ],
          }
        : row,
    ),
  }
  const cast = action([
    { type: 'damage', recipient: 'affected-units', target: 'ground', amount: 10 },
    { type: 'damage', recipient: 'affected-units', target: 'enemy', amount: 7 },
  ])
  cast.target = { ...cast.target, geometryVersion: 3, categories: ['enemy', 'ground'] }
  Object.assign(cast, { accuracyRule: { kind: 'fixed', chanceBasisPoints: 10000 } })
  cast.effectTimingModes = ['instant', 'instant']
  const before = JSON.stringify(state)
  expect(evaluateCombatAction(state, cast, activate, PV1F_COMBAT_CONTENT).legal).toBe(true)
  expect(JSON.stringify(state)).toBe(before)
  const result = executeCombatAction(state, cast, activate, PV1F_COMBAT_CONTENT)
  expect(result.state.tactical.battle.combatants.find((row) => row.id === 'enemy')!.hp).toBe(893)
  expect(result.state.tactical.battle.combatants.find((row) => row.id === 'actor')!.mp).toBe(
    state.tactical.battle.combatants.find((row) => row.id === 'actor')!.mp - 2,
  )
})

it('preserves independent delayed Ground and unit delivery after reload and later Airborne gain', () => {
  const state = {
    ...encounter(),
    airbornePolicyVersion: 1 as const,
    effectTimingPolicy: { version: 1, modes: { damage: 'next-round' as const } },
  }
  const cast = action([
    { type: 'damage', recipient: 'affected-units', target: 'ground', amount: 10 },
    { type: 'damage', recipient: 'affected-units', target: 'enemy', amount: 7 },
  ])
  cast.target = { ...cast.target, geometryVersion: 3, categories: ['enemy', 'ground'] }
  const queued = executeCombatAction(state, cast, activate, PV1F_COMBAT_CONTENT).state
  let restored = JSON.parse(JSON.stringify(queued)) as CombatEncounterState
  expect(validateCombatEncounterState(restored)).toEqual([])
  expect(restored.pendingEffects?.[0]?.groundTargetedRecipientIds).toContain('enemy')
  expect(restored.pendingEffects?.[1]?.groundTargetedRecipientIds).toBeUndefined()
  const air = PV1F_COMBAT_CONTENT.statuses.find((row) => row.id === 'airborne')!
  restored.statusState = restored.statusState.map((row) =>
    row.combatantId === 'enemy'
      ? {
          ...row,
          statuses: [
            {
              statusId: 'airborne',
              statusVersion: air.version,
              stacks: 1,
              remainingOwnerTurnStarts: 4,
              sourceCombatantId: 'enemy',
            },
          ],
        }
      : row,
  )
  for (let turn = 0; turn < 4; turn++)
    restored = endCombatTurn(
      { ...restored, tactical: selectCurrentFinalFacing(restored.tactical, 'east').state },
      PV1F_COMBAT_CONTENT,
    ).state
  expect(restored.tactical.battle.combatants.find((row) => row.id === 'enemy')!.hp).toBe(893)
  expect(restored.pendingEffects).toEqual([])
})
it('rolls repeated Ground and unit damage independently against Airborne using one payment', () => {
  const base = encounter()
  const state: CombatEncounterState = {
    ...base,
    airbornePolicyVersion: 1,
    skillPacketPolicyVersion: 1,
    statBalancePolicyVersion: 1,
    statBridge: {
      ...base.statBridge,
      schemaVersion: 4,
      rulesVersion: 4,
      combatants: base.statBridge.combatants.map((row) => ({
        ...row,
        level: 1,
        criticalChance: 0,
        statusResistance: 0,
      })),
    },
  }
  const air = PV1F_COMBAT_CONTENT.statuses.find((row) => row.id === 'airborne')!
  state.statusState = state.statusState.map((row) =>
    row.combatantId === 'enemy'
      ? {
          ...row,
          statuses: [
            {
              statusId: 'airborne',
              statusVersion: air.version,
              stacks: 1,
              remainingOwnerTurnStarts: 3,
              sourceCombatantId: 'enemy',
            },
          ],
        }
      : row,
  )
  const cast: CombatActionDefinition = {
    ...action([
      { type: 'damage', recipient: 'affected-units', target: 'ground', amount: 10 },
      { type: 'damage', recipient: 'affected-units', target: 'enemy', amount: 7 },
    ]),
    sourceType: 'discipline-skill',
    accuracyMode: 'per-target',
    effectTimingModes: ['instant', 'instant'],
  }
  cast.target = {
    ...cast.target,
    geometryVersion: 3,
    shape: { kind: 'single' },
    categories: ['enemy', 'ground'],
  }
  const selection = { kind: 'unit', combatantId: 'enemy' } as const
  const before = JSON.stringify(state)
  const preview = evaluateCombatAction(state, cast, selection, PV1F_COMBAT_CONTENT)
  expect(preview.legal).toBe(true)
  expect(JSON.stringify(state)).toBe(before)
  const result = executeCombatAction(state, cast, selection, PV1F_COMBAT_CONTENT)
  expect(
    result.events.filter((row) => row.event === 'combat_accuracy_resolved').map((row) => row.hit),
  ).toEqual([false, true])
  expect(result.state.tactical.battle.combatants.find((row) => row.id === 'enemy')!.hp).toBe(893)
  expect(result.state.tactical.battle.combatants.find((row) => row.id === 'actor')!.mp).toBe(18)
})

it('creates Ground terrain and applies a unit packet through the same selected-unit aim', () => {
  const cast = action([
    { type: 'create-terrain', recipient: 'affected-tiles', target: 'ground', terrain: 'frozen' },
    { type: 'damage', recipient: 'affected-units', target: 'enemy', amount: 7 },
  ])
  cast.target = {
    ...cast.target,
    geometryVersion: 3,
    categories: ['enemy', 'ground'],
    shape: { kind: 'single' },
    maximumRange: 4,
  }
  const result = executeCombatAction(
    encounter(),
    cast,
    { kind: 'unit', combatantId: 'enemy' },
    PV1F_COMBAT_CONTENT,
  )
  const position = result.state.tactical.placements.find(
    (row) => row.combatantId === 'enemy',
  )!.position
  expect(
    result.state.terrainOverlays?.some(
      (row) =>
        row.kind === 'frozen' && row.position.x === position.x && row.position.y === position.y,
    ),
  ).toBe(true)
  expect(result.state.tactical.battle.combatants.find((row) => row.id === 'enemy')!.hp).toBe(893)
})

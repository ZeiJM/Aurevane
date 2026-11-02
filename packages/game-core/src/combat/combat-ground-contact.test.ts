import { describe, expect, it } from 'vitest'
import {
  executeCombatAction,
  endCombatTurn,
  validateCombatEncounterState,
  type CombatActionDefinition,
  type CombatEncounterState,
  type CombatEffectDefinition,
} from './actions'
import { resolveCombatMovementStepEffects } from './actions-legacy'
import { percentageDotEncounter } from './combat-percentage-dots.test-utils'
import { PV1F_COMBAT_CONTENT } from './pv1f-combat-content'
import { selectCurrentFinalFacing } from './board'

function encounter(current = true): CombatEncounterState {
  return {
    ...percentageDotEncounter(),
    groundEffectPolicyVersion: 1,
    ...(current ? { groundContactPolicyVersion: 1 } : {}),
    effectTimingPolicy: {
      version: 1,
      modes: { 'ground-area': 'instant', 'create-terrain': 'instant' },
    },
  } as CombatEncounterState
}
function action(
  amount = 10,
  extra: readonly CombatEffectDefinition[] = [],
  timing: 'instant' | 'next-round' | 'delayed' = 'instant',
): CombatActionDefinition {
  const effects: readonly CombatEffectDefinition[] = [
    { type: 'damage', recipient: 'affected-units', target: 'ground', amount },
    ...extra,
  ]
  return {
    id: 'test.ground-contact',
    version: 1,
    sourceType: 'test',
    tags: [],
    cost: { spendsAction: false, mp: 0 },
    requirements: [],
    target: {
      kind: 'ground-tile',
      teamPolicy: 'enemy',
      friendlyFire: 'enemies-only',
      geometryVersion: 3,
      categories: ['ground'],
      maximumSelections: 1,
      shape: { kind: 'single' },
      minimumRange: 0,
      maximumRange: 4,
      requiresLineOfSight: false,
      maximumElevationDifference: null,
    },
    effects,
    groundArea: {
      timing,
      durationRounds: 3,
      visualPresetId: 'arcane-pulse',
      entryEffectOrdinals: effects.map((_, index) => index),
    },
  }
}
const slow: CombatEffectDefinition = {
  type: 'apply-status',
  recipient: 'affected-units',
  target: 'ground',
  statusId: 'slow',
  stacks: 1,
  durationTurns: 2,
  movementApAdjustment: 10,
}
const tile = { kind: 'tile', position: { x: 2, y: 1 } } as const
const hp = (state: CombatEncounterState, id = 'enemy') =>
  state.tactical.battle.combatants.find((row) => row.id === id)!.hp
const status = (state: CombatEncounterState, id: string, statusId: string) =>
  state.statusState
    .find((row) => row.combatantId === id)
    ?.statuses.find((row) => row.statusId === statusId)
const finish = (state: CombatEncounterState) =>
  endCombatTurn(
    { ...state, tactical: selectCurrentFinalFacing(state.tactical, 'west').state },
    PV1F_COMBAT_CONTENT,
  ).state
const cast = (state: CombatEncounterState, definition = action()) =>
  executeCombatAction(state, definition, tile, PV1F_COMBAT_CONTENT)

describe('current Ground contact policy', () => {
  it('applies active contact status immediately without an ordinary delayed copy', () => {
    const initial = encounter()
    const before = JSON.stringify(initial)
    const result = cast(initial, action(10, [slow]))
    expect(hp(result.state)).toBe(990)
    expect(status(result.state, 'enemy', 'slow')).toMatchObject({ timingState: 'active' })
    expect(result.state.pendingEffects ?? []).toEqual([])
    expect(result.state.groundAreas?.[0]).toMatchObject({
      contactPolicyVersion: 1,
      entryEffectSourceOrdinals: [0, 1],
    })
    expect(JSON.stringify(initial)).toBe(before)
  })
  it('shares Damage allowance across casts while allowing another logical status', () => {
    let state = cast(encounter(), action(10, [slow])).state
    state = cast(
      state,
      action(30, [
        {
          type: 'apply-status',
          recipient: 'affected-units',
          target: 'ground',
          statusId: 'root',
          stacks: 1,
          durationTurns: 2,
        },
      ]),
    ).state
    expect(hp(state)).toBe(990)
    expect(status(state, 'enemy', 'slow')).toBeDefined()
    expect(status(state, 'enemy', 'root')).toBeDefined()
    expect(hp(resolveCombatMovementStepEffects(state, 'enemy', PV1F_COMBAT_CONTENT).state)).toBe(
      990,
    )
  })
  it('waits for authored activation and contacts live occupants at that boundary', () => {
    let state = cast(encounter(), action(10, [slow], 'next-round')).state
    expect(hp(state)).toBe(1000)
    expect(status(state, 'enemy', 'slow')).toBeUndefined()
    expect(state.pendingEffects ?? []).toEqual([])
    expect(state.groundAreas?.[0]).toMatchObject({ activationRound: 2, contactPolicyVersion: 1 })
    state = JSON.parse(JSON.stringify(state)) as CombatEncounterState
    for (let i = 0; i < 4; i++) state = finish(state)
    expect(hp(state)).toBe(990)
    expect(status(state, 'enemy', 'slow')).toBeDefined()
    expect(validateCombatEncounterState(state)).toEqual([])
  })
  it('contacts a stationary occupant again at its next own turn and never twice that cycle', () => {
    let state = cast(encounter()).state
    state = finish(state)
    expect(state.tactical.battle.currentTurn?.combatantId).toBe('enemy')
    expect(hp(state)).toBe(980)
    expect(hp(resolveCombatMovementStepEffects(state, 'enemy', PV1F_COMBAT_CONTENT).state)).toBe(
      980,
    )
  })
  it('keeps legacy missing-policy casts independent', () => {
    const first = cast(encounter(false)).state
    const second = cast(first, action(30)).state
    expect(hp(second)).toBe(960)
    expect(second.groundAreas?.every((area) => !('contactPolicyVersion' in area))).toBe(true)
  })
  it('replaces retained Freeze AP with its existing Chilled Ground packet without changing source', () => {
    const definition: CombatActionDefinition = {
      ...action(),
      groundArea: undefined,
      effects: [
        {
          type: 'create-terrain',
          recipient: 'affected-tiles',
          target: 'ground',
          terrain: 'frozen',
          skillApSurcharge: 10,
        },
        {
          ...slow,
          statusId: 'frozen',
          movementApAdjustment: undefined,
          applicationOrigin: 'frozen-ground',
        },
      ],
    }
    const before = JSON.stringify(definition)
    const result = cast(encounter(), definition)
    expect(result.state.terrainOverlays?.some((row) => row.kind === 'frozen') ?? false).toBe(false)
    expect(result.state.groundAreas).toHaveLength(1)
    expect(status(result.state, 'enemy', 'frozen')?.stacks).toBe(1)
    expect(result.state.groundAreas?.[0]?.entryEffectSourceOrdinals).toEqual([1])
    expect(JSON.stringify(definition)).toBe(before)
  })
})

it('claims an eligible Damage attempt before accuracy and does not spend another draw on a second field', () => {
  const miss = { ...action(), accuracyRule: { kind: 'fixed' as const, chanceBasisPoints: 0 } }
  const first = cast(encounter(), miss)
  expect(hp(first.state)).toBe(1000)
  const rng = first.state.tactical.battle.rng
  const second = cast(first.state, {
    ...action(20),
    accuracyRule: { kind: 'fixed', chanceBasisPoints: 10000 },
  })
  expect(hp(second.state)).toBe(1000)
  expect(second.state.tactical.battle.rng).toEqual(rng)
})
it('keeps logical claims after a field expires and refreshes them on the affected own turn', () => {
  let state = cast(encounter()).state
  state = { ...state, groundAreas: [] }
  state = cast(state, action(40)).state
  expect(hp(state)).toBe(990)
  state = finish(state)
  expect(hp(state)).toBe(950)
})
it('uses live affected Requirements for future entrants instead of the cast recipient mask', () => {
  const definition: CombatActionDefinition = {
    ...action(),
    effectEligibleRecipientIds: [[]],
    effectRequirementCaptures: [
      {
        requirement: {
          kind: 'resource-state',
          subject: 'affected',
          resource: 'hp',
          comparison: 'at-most',
          amount: 900,
        },
        context: {},
        selectedSubjects: [],
      },
    ],
  }
  let state = cast(encounter(), definition).state
  expect(hp(state)).toBe(1000)
  const late = {
    ...state.tactical.battle.combatants.find((row) => row.id === 'enemy')!,
    id: 'late',
    hp: 800,
  }
  state = {
    ...state,
    tactical: {
      ...state.tactical,
      battle: {
        ...state.tactical.battle,
        combatants: [...state.tactical.battle.combatants, late],
        initiativeOrder: ['actor', 'enemy', 'late', 'other', 'ally'],
      },
      placements: [
        ...state.tactical.placements.map((row) =>
          row.combatantId === 'enemy' ? { ...row, position: { x: 4, y: 3 } } : row,
        ),
        {
          ...state.tactical.placements.find((row) => row.combatantId === 'enemy')!,
          combatantId: 'late',
        },
      ],
    },
    statusState: [...state.statusState, { combatantId: 'late', statuses: [] }],
    ...(state.statBridge
      ? {
          statBridge: {
            ...state.statBridge,
            combatants: [
              ...state.statBridge.combatants,
              {
                ...state.statBridge.combatants.find((row) => row.combatantId === 'enemy')!,
                combatantId: 'late',
              },
            ],
          },
        }
      : {}),
  }
  state = {
    ...state,
    tactical: {
      ...state.tactical,
      placements: [...state.tactical.placements].sort((a, b) =>
        a.combatantId.localeCompare(b.combatantId),
      ),
    },
    statusState: [...state.statusState].sort((a, b) => a.combatantId.localeCompare(b.combatantId)),
  }
  expect(validateCombatEncounterState({ ...state, groundAreas: undefined })).toEqual([])
  const touched = resolveCombatMovementStepEffects(state, 'late', PV1F_COMBAT_CONTENT)
  expect(hp(touched.state, 'late')).toBe(790)
})
it('honors native explicit eligibility masks without spending the blocked type allowance', () => {
  const blocked = cast(encounter(), { ...action(), effectEligibleRecipientIds: [[]] }).state
  expect(hp(blocked)).toBe(1000)
  expect(hp(cast(blocked).state)).toBe(990)
})
it('excludes unrelated caster packets from field payload and preserves their original source ordinal', () => {
  const definition = {
    ...action(),
    effects: [
      { type: 'healing', recipient: 'actor', target: 'self', amount: 5 },
      ...action().effects,
    ],
    groundArea: { ...action().groundArea!, entryEffectOrdinals: [1] },
  } as CombatActionDefinition
  const result = cast(encounter(), definition)
  expect(result.state.groundAreas?.[0]?.entryEffects).toHaveLength(1)
  expect(result.state.groundAreas?.[0]?.entryEffectSourceOrdinals).toEqual([1])
})
it('retires standalone Freeze AP into one default Chilled field', () => {
  const definition: CombatActionDefinition = {
    ...action(),
    groundArea: undefined,
    effects: [
      {
        type: 'create-terrain',
        recipient: 'affected-tiles',
        target: 'ground',
        terrain: 'frozen',
        skillApSurcharge: 10,
      },
    ],
  }
  const result = cast(encounter(), definition)
  expect(result.state.terrainOverlays ?? []).toEqual([])
  expect(result.state.groundAreas?.[0]?.entryEffects).toMatchObject([
    { type: 'apply-status', statusId: 'frozen', durationTurns: 2 },
  ])
  expect(status(result.state, 'enemy', 'frozen')).toBeDefined()
})
it('keeps Ground Reveal out of direct cast admission and applies it at contact', async () => {
  const { evaluateCombatAction } = await import('./actions')
  const covert: CombatActionDefinition = {
    ...action(),
    target: {
      ...action().target,
      kind: 'self',
      geometryVersion: undefined,
      categories: undefined,
      teamPolicy: 'self',
      maximumRange: 0,
      friendlyFire: 'all-units',
    },
    groundArea: undefined,
    effects: [
      {
        type: 'apply-status',
        recipient: 'actor',
        target: 'self',
        statusId: 'covert',
        stacks: 1,
        durationTurns: 2,
      },
    ],
  }
  let state = encounter()
  state = finish(state)
  state = executeCombatAction(
    state,
    { ...covert, effectTimingModes: ['instant'] },
    { kind: 'self' },
    PV1F_COMBAT_CONTENT,
  ).state
  for (let i = 0; i < 3; i++) state = finish(state)
  expect(status(state, 'enemy', 'covert')?.timingState).toBe('active')
  const definition: CombatActionDefinition = {
    ...action(),
    effects: [
      {
        type: 'sensory',
        recipient: 'affected-units',
        target: 'ground',
        revealedDurationOwnerTurnStarts: 2,
        increasedDamageTakenBasisPoints: 1000,
      },
    ],
  }
  const quote = evaluateCombatAction(state, definition, tile, PV1F_COMBAT_CONTENT)
  expect(quote.legal).toBe(true)
  expect(quote.projectedGroundAreas?.[0]?.effectVisualIds).toEqual(['reveal'])
  const result = cast(state, definition)
  expect(status(result.state, 'enemy', 'covert')).toBeUndefined()
  expect(status(result.state, 'enemy', 'revealed')).toBeDefined()
})
it('uses captured caster origin for Push, bounds recursive contacts and rechecks the live footprint', () => {
  const definition: CombatActionDefinition = {
    ...action(),
    effects: [
      {
        type: 'displace',
        recipient: 'affected-units',
        target: 'ground',
        direction: 'push',
        distance: 1,
      },
      slow,
    ],
    groundArea: { ...action().groundArea!, entryEffectOrdinals: [0, 1] },
  }
  let state = cast(encounter(), {
    ...definition,
    groundArea: { ...definition.groundArea!, timing: 'next-round' },
  }).state
  state = {
    ...state,
    tactical: {
      ...state.tactical,
      placements: state.tactical.placements
        .map((row) => (row.combatantId === 'actor' ? { ...row, position: { x: 2, y: 2 } } : row))
        .map((row) => (row.combatantId === 'other' ? { ...row, position: { x: 4, y: 4 } } : row)),
    },
  }
  for (let i = 0; i < 4; i++) state = finish(state)
  expect(state.tactical.placements.find((row) => row.combatantId === 'enemy')?.position).toEqual({
    x: 3,
    y: 1,
  })
  expect(status(state, 'enemy', 'slow')).toBeUndefined()
})
it('does not preserve Endure authority in a support field frozen caster after natural expiry', () => {
  const endure: CombatActionDefinition = {
    ...action(),
    groundArea: undefined,
    target: {
      ...action().target,
      kind: 'self',
      geometryVersion: undefined,
      categories: undefined,
      teamPolicy: 'self',
      maximumRange: 0,
      friendlyFire: 'all-units',
    },
    effects: [
      {
        type: 'endure',
        recipient: 'actor',
        target: 'self',
        durationTurns: 1,
        releaseBasisPoints: 15000,
        radiusTiles: 3,
        targetTeams: 'enemies',
      },
    ],
  }
  let state = executeCombatAction(encounter(), endure, { kind: 'self' }, PV1F_COMBAT_CONTENT).state
  state = cast(state, {
    ...action(),
    effects: [slow],
    groundArea: { ...action().groundArea!, timing: 'delayed' },
  }).state
  expect(state.groundAreas?.[0]?.caster.statuses.some((row) => row.statusId === 'endure')).toBe(
    false,
  )
  for (let i = 0; i < 8; i++) state = finish(state)
  expect(validateCombatEncounterState(state)).toEqual([])
  expect(status(state, 'enemy', 'slow')).toBeDefined()
})
it('keeps current Chilled and Slow fields intact when Fire hits the tile', () => {
  let state: CombatEncounterState = { ...encounter(), elementalDamagePolicyVersion: 2 }
  const chilled: CombatEffectDefinition = {
    type: 'apply-status',
    recipient: 'affected-units',
    target: 'ground',
    statusId: 'frozen',
    stacks: 1,
    durationTurns: 2,
    applicationOrigin: 'frozen-ground',
  }
  const mixed: CombatActionDefinition = {
    ...action(),
    effects: [chilled, slow],
    groundArea: { ...action().groundArea!, visualPresetId: 'frost', entryEffectOrdinals: [0, 1] },
  }
  state = cast(state, mixed).state
  const fire: CombatActionDefinition = {
    ...action(),
    groundArea: undefined,
    target: { ...action().target, kind: 'unit', geometryVersion: undefined, categories: undefined },
    effects: [{ type: 'damage', recipient: 'primary-unit', element: 'fire', amount: 1 }],
  }
  state = executeCombatAction(
    state,
    fire,
    { kind: 'unit', combatantId: 'enemy' },
    PV1F_COMBAT_CONTENT,
  ).state
  expect(
    state.groundAreas?.[0]?.entryEffects.map((effect) =>
      effect.type === 'apply-status' ? effect.statusId : effect.type,
    ),
  ).toEqual(['frozen', 'slow'])
  expect(state.groundAreas?.[0]?.steamTiles ?? []).toEqual([])
  expect(state.terrainOverlays?.some((row) => row.kind === 'steam') ?? false).toBe(false)
})
it('assigns distinct original-ordinal status lineage to each affected own-turn contact', () => {
  const definition: CombatActionDefinition = {
    ...action(),
    effects: [{ type: 'healing', recipient: 'actor', target: 'self', amount: 1 }, slow],
    groundArea: { ...action().groundArea!, entryEffectOrdinals: [1] },
  }
  let state = cast(encounter(), definition).state
  const before = status(state, 'enemy', 'slow')!.provenance!
  expect(before.effectOrdinal).toBe(1)
  state = finish(JSON.parse(JSON.stringify(state)))
  const after = status(state, 'enemy', 'slow')!.provenance!
  expect(after.effectOrdinal).toBe(1)
  expect(after.instanceId).not.toEqual(before.instanceId)
  expect(validateCombatEncounterState(state)).toEqual([])
})
it('never broadcasts an Anyone field payload beyond its actual entrant', () => {
  const definition: CombatActionDefinition = {
    ...action(),
    effects: [{ type: 'damage', recipient: 'affected-units', target: 'anyone', amount: 10 }],
  }
  const result = cast(encounter(), definition)
  expect(hp(result.state, 'enemy')).toBe(990)
  expect(hp(result.state, 'actor')).toBe(1000)
  expect(hp(result.state, 'ally')).toBe(1000)
  expect(hp(result.state, 'other')).toBe(1000)
})
it('retains inherited native field team admission when an old packet omitted its own target', () => {
  const definition: CombatActionDefinition = {
    ...action(),
    target: {
      ...action().target,
      geometryVersion: undefined,
      categories: undefined,
      shape: { kind: 'circle', radius: 1 },
    },
    effects: [{ type: 'damage', recipient: 'affected-units', amount: 10 }],
  }
  const result = cast(encounter(), definition)
  expect(hp(result.state, 'actor')).toBe(1000)
  expect(hp(result.state, 'ally')).toBe(1000)
  expect(hp(result.state, 'enemy')).toBe(990)
  expect(hp(result.state, 'other')).toBe(990)
})
it('rejects unsupported contact policies, malformed source ordinals and malformed captured Requirements after reload', () => {
  const state = cast(encounter()).state
  for (const patch of [
    { contactPolicyVersion: 2 },
    { entryEffectSourceOrdinals: [-1] },
    { entryEffectSourceOrdinals: [] },
    {
      entryEffectRequirementCaptures: [
        { requirement: { kind: 'arbitrary' }, context: {}, selectedSubjects: [] },
      ],
    },
  ]) {
    const forged = {
      ...state,
      groundAreas: [{ ...state.groundAreas![0]!, ...patch }],
    } as CombatEncounterState
    expect(
      validateCombatEncounterState(forged).some((issue) => issue.field === 'groundAreas'),
    ).toBe(true)
  }
  expect(
    validateCombatEncounterState({ ...state, groundContactPolicyVersion: 2 } as never).some(
      (issue) => issue.field === 'groundContactPolicyVersion',
    ),
  ).toBe(true)
})
it('captures canonical affected Requirements for actual contact without freezing the original recipient list', async () => {
  const { source } = await import('./combat-behavior.test-utils')
  const { captureCombatAbilitySource } = await import('./combat-behavior-capture')
  const { reconcileCombatAbilitySources, combatAbilityCommandContext } =
    await import('./combat-behavior-runtime')
  const { commitCombatAbilityCommand } = await import('./combat-ability-command')
  const { preparePv1fTurnEconomy } = await import('./pv1f-action-economy')
  const captured = captureCombatAbilitySource(
    source({
      targeting: { ...action().target, maximumSelections: 1 },
      effects: [
        {
          id: 'conditional-hit',
          timing: 'instant',
          requirements: {
            kind: 'resource-state',
            subject: 'affected',
            resource: 'hp',
            comparison: 'at-most',
            amount: 900,
          },
          payload: { type: 'damage', recipient: 'affected-units', target: 'ground', amount: 10 },
        },
      ],
      groundArea: {
        durationRounds: 3,
        visualPresetId: 'arcane-pulse',
        entryEffectIds: ['conditional-hit'],
        timing: 'instant',
      },
    }),
  )
  const sourceBefore = JSON.stringify(captured)
  let state = reconcileCombatAbilitySources(
    preparePv1fTurnEconomy(
      encounter() as import('./stat-driven-combat').StatDrivenCombatEncounterState,
    ),
    [captured],
  )
  state = commitCombatAbilityCommand({
    state,
    actorId: 'actor',
    root: { kind: 'canonical', source: captured },
    selection: tile,
    content: PV1F_COMBAT_CONTENT,
    context: combatAbilityCommandContext(state, captured),
  }).state
  expect(hp(state)).toBe(1000)
  expect(state.groundAreas?.[0]?.entryEffectRequirementCaptures?.[0]?.requirement).toMatchObject({
    subject: 'affected',
  })
  const hit: CombatActionDefinition = {
    ...action(200),
    groundArea: undefined,
    target: { ...action().target, kind: 'unit', geometryVersion: undefined, categories: undefined },
    effects: [{ type: 'damage', recipient: 'primary-unit', target: 'enemy', amount: 200 }],
  }
  state = executeCombatAction(
    state,
    hit,
    { kind: 'unit', combatantId: 'enemy' },
    PV1F_COMBAT_CONTENT,
  ).state
  expect(hp(state)).toBe(800)
  state = resolveCombatMovementStepEffects(
    JSON.parse(JSON.stringify(state)),
    'enemy',
    PV1F_COMBAT_CONTENT,
  ).state
  expect(hp(state)).toBe(790)
  expect(JSON.stringify(captured)).toBe(sourceBefore)
  expect(validateCombatEncounterState(state)).toEqual([])
})
it('preserves Enemy aim while deriving a delayed Ground status field from its independent packet target', () => {
  const definition: CombatActionDefinition = {
    ...action(),
    groundArea: undefined,
    target: { ...action().target, kind: 'unit', categories: ['enemy'] },
    effects: [{ type: 'damage', recipient: 'primary-unit', target: 'enemy', amount: 20 }, slow],
    effectTimingModes: ['instant', 'delayed'],
  }
  const before = JSON.stringify(definition)
  let state = executeCombatAction(
    encounter(),
    definition,
    { kind: 'unit', combatantId: 'enemy' },
    PV1F_COMBAT_CONTENT,
  ).state
  expect(hp(state)).toBe(980)
  expect(status(state, 'enemy', 'slow')).toBeUndefined()
  expect(state.pendingEffects ?? []).toEqual([])
  expect(state.groundAreas?.[0]).toMatchObject({
    target: { kind: 'ground-tile', categories: ['ground'] },
    activationRound: 3,
    entryEffectSourceOrdinals: [1],
  })
  state = JSON.parse(JSON.stringify(state))
  for (let i = 0; i < 8; i++) state = finish(state)
  expect(status(state, 'enemy', 'slow')).toBeDefined()
  expect(hp(state)).toBe(980)
  expect(JSON.stringify(definition)).toBe(before)
  expect(validateCombatEncounterState(state)).toEqual([])
})
it('settles lethal incoming own-turn contact through the native successor transition once', () => {
  const initial = encounter()
  let state: CombatEncounterState = {
    ...initial,
    tactical: {
      ...initial.tactical,
      battle: {
        ...initial.tactical.battle,
        combatants: initial.tactical.battle.combatants.map((row) =>
          row.id === 'enemy' ? { ...row, hp: 10 } : row,
        ),
      },
    },
  }
  state = cast(state, action(5)).state
  expect(hp(state)).toBe(5)
  const ended = endCombatTurn(
    { ...state, tactical: selectCurrentFinalFacing(state.tactical, 'west').state },
    PV1F_COMBAT_CONTENT,
  )
  expect(hp(ended.state)).toBe(0)
  expect(ended.state.tactical.battle.currentTurn?.combatantId).toBe('other')
  expect(
    ended.events.filter((event) => event.event === 'turn_started' && event.combatantId === 'other'),
  ).toHaveLength(1)
  expect(validateCombatEncounterState(ended.state)).toEqual([])
})
it('pins stat-scaled field damage once at cast while reusing it for later contacts', () => {
  const initial = encounter()
  let state: CombatEncounterState = {
    ...initial,
    statBridge: {
      ...initial.statBridge!,
      combatants: initial.statBridge!.combatants.map((row) =>
        row.combatantId === 'actor' ? { ...row, physicalPower: 100 } : row,
      ),
    },
  }
  const definition: CombatActionDefinition = {
    ...action(),
    effects: [
      {
        type: 'damage',
        recipient: 'affected-units',
        target: 'ground',
        amount: 10,
        scaling: { source: 'physical-power', coefficientBasisPoints: 5000 },
      },
    ],
  }
  state = cast(state, definition).state
  expect(hp(state)).toBe(940)
  expect(state.groundAreas?.[0]?.entryEffects[0]).toMatchObject({ type: 'damage', amount: 60 })
  state = {
    ...state,
    statBridge: {
      ...state.statBridge!,
      combatants: state.statBridge!.combatants.map((row) =>
        row.combatantId === 'actor' ? { ...row, physicalPower: 0 } : row,
      ),
    },
  }
  expect(hp(finish(state))).toBe(880)
})
it('preserves each inferred Ground packet placement timing and original ordinals on reload', () => {
  const definition: CombatActionDefinition = {
    ...action(),
    groundArea: undefined,
    effects: [...action().effects, slow],
    effectTimingModes: ['instant', 'delayed'],
  }
  let state = cast(encounter(), definition).state
  expect(
    state.groundAreas?.map((area) => ({
      round: area.activationRound,
      ordinals: area.entryEffectSourceOrdinals,
    })),
  ).toEqual([
    { round: 1, ordinals: [0] },
    { round: 3, ordinals: [1] },
  ])
  expect(hp(state)).toBe(990)
  expect(status(state, 'enemy', 'slow')).toBeUndefined()
  state = JSON.parse(JSON.stringify(state))
  for (let i = 0; i < 8; i++) state = finish(state)
  expect(status(state, 'enemy', 'slow')).toBeDefined()
  expect(validateCombatEncounterState(state)).toEqual([])
})
it.each(['instant', 'delayed'] as const)(
  'settles Reflect exactly once for %s field contact',
  (timing) => {
    const initial = encounter()
    const counter = PV1F_COMBAT_CONTENT.statuses.find((row) => row.id === 'counter')!
    let state: CombatEncounterState = {
      ...initial,
      statusState: initial.statusState.map((row) =>
        row.combatantId === 'enemy'
          ? {
              ...row,
              statuses: [
                {
                  statusId: 'counter',
                  statusVersion: counter.version,
                  stacks: 1,
                  sourceCombatantId: 'enemy',
                  remainingOwnerTurnStarts: 10,
                  timingState: 'active',
                  counter: { kind: 'full', basisPoints: 10000 },
                },
              ],
            }
          : row,
      ),
    }
    state = cast(state, {
      ...action(),
      tags: ['attack', 'physical'],
      groundArea: { ...action().groundArea!, timing },
    }).state
    if (timing === 'delayed') for (let i = 0; i < 8; i++) state = finish(state)
    expect(hp(state, 'actor')).toBeLessThan(1000)
    const reflected = 1000 - hp(state, 'actor')
    expect(reflected).toBe(1000 - hp(state, 'enemy'))
    expect(validateCombatEncounterState(state)).toEqual([])
  },
)
it('settles Absorb HP from the current contact command once', () => {
  const initial = encounter()
  const absorb = {
    id: 'test.ground-absorb',
    version: 1,
    maximumStacks: 1,
    durationOwnerTurnStarts: 3,
    damageTakenMultiplierBasisPoints: 10000,
    absorbHpBasisPoints: 5000,
    polarity: 'positive' as const,
    reactionClass: 'reactive' as const,
    effectCategories: ['Healing' as const],
  }
  const content = { statuses: [...PV1F_COMBAT_CONTENT.statuses, absorb] }
  const state: CombatEncounterState = {
    ...initial,
    statusState: initial.statusState.map((row) =>
      row.combatantId === 'enemy'
        ? {
            ...row,
            statuses: [
              {
                statusId: absorb.id,
                statusVersion: 1,
                stacks: 1,
                sourceCombatantId: 'enemy',
                remainingOwnerTurnStarts: 3,
                timingState: 'active',
              },
            ],
          }
        : row,
    ),
  }
  const result = executeCombatAction(state, action(20), tile, content)
  expect(hp(result.state)).toBe(990)
  expect(
    result.events.filter(
      (event) =>
        event.event === 'healing_applied' && event.actionId === 'status.absorb-hp.current.v1',
    ),
  ).toHaveLength(1)
})
it('preserves once-only miss claims after the actual summon source retires', async () => {
  const { createCurrentStatDrivenCombatEncounterState } = await import('./stat-driven-combat')
  const { spawnCombatSummon, removeCombatSummon } = await import('./combat-summons')
  const { resolveMatureSkillVersion } = await import('./mature-skills')
  const { createCombatGroundArea } = await import('./combat-ground-areas')
  const base = {
    ...percentageDotEncounter(),
    groundEffectPolicyVersion: 1 as const,
    groundContactPolicyVersion: 1 as const,
    effectTimingPolicy: encounter().effectTimingPolicy,
  }
  let state: import('./stat-driven-combat').StatDrivenCombatEncounterState =
    createCurrentStatDrivenCombatEncounterState(
      base,
      base.statBridge!.combatants.map((profile) => ({
        ...profile,
        level: 1,
        criticalChance: 0,
        physicalPower: 20,
        mysticPower: 20,
      })),
    )
  const spawned = spawnCombatSummon(state, {
    ownerCombatantId: 'actor',
    sourceSkillId: 'wildwarden.renewing-herbs',
    sourceSkillVersion: 5,
    profile: resolveMatureSkillVersion('wildwarden.renewing-herbs', 6)!.summonProfile!,
    position: { x: 0, y: 0 },
    facing: 'east',
  })
  state = spawned.state
  const summonId = state.effectState!.summons![0]!.combatantId
  state = createCombatGroundArea(
    state,
    summonId,
    action(),
    [{ x: 2, y: 1 }],
    PV1F_COMBAT_CONTENT,
  ) as typeof state
  const forgedLiveArchive = {
    ...state,
    effectState: {
      ...state.effectState!,
      summonDamageSources: [
        {
          combatantId: summonId,
          ownerCombatantId: 'actor',
          groundContactArchiveVersion: 1 as const,
        },
      ],
    },
  }
  expect(
    validateCombatEncounterState(forgedLiveArchive).some((issue) => issue.field === 'groundAreas'),
  ).toBe(true)
  state = removeCombatSummon(state, summonId, 'expired').state
  expect(
    state.effectState?.summonDamageSources?.find((source) => source.combatantId === summonId),
  ).toEqual({ combatantId: summonId, ownerCombatantId: 'actor', groundContactArchiveVersion: 1 })
  const { capSummonDamage, summonDamageSource } = await import('./combat-summon-potency')
  expect(summonDamageSource(state, summonId)).toBeUndefined()
  expect(capSummonDamage(state, summonId, 'enemy', 9999, PV1F_COMBAT_CONTENT).amount).toBe(9999)
  expect(
    state.tactical.movementProfiles.some(
      (profile) => profile.id === state.groundAreas![0]!.caster.placement.movementProfileId,
    ),
  ).toBe(true)
  const air = PV1F_COMBAT_CONTENT.statuses.find((status) => status.id === 'airborne')!
  state = {
    ...state,
    airbornePolicyVersion: 1,
    statusState: state.statusState.map((row) =>
      row.combatantId === 'enemy'
        ? {
            ...row,
            statuses: [
              {
                statusId: 'airborne',
                statusVersion: air.version,
                sourceCombatantId: 'enemy',
                stacks: 1,
                remainingOwnerTurnStarts: 3,
              },
            ],
          }
        : row,
    ),
  }
  expect(validateCombatEncounterState(state)).toEqual([])
  const first = resolveCombatMovementStepEffects(state, 'enemy', PV1F_COMBAT_CONTENT)
  const second = resolveCombatMovementStepEffects(
    JSON.parse(JSON.stringify(first.state)),
    'enemy',
    PV1F_COMBAT_CONTENT,
  )
  expect(first.events.filter((event) => event.event === 'combat_accuracy_resolved')).toHaveLength(1)
  expect(second.events.filter((event) => event.event === 'combat_accuracy_resolved')).toHaveLength(
    0,
  )
  expect(second.state.tactical.battle.rng).toEqual(first.state.tactical.battle.rng)
  expect(second.state.tactical.battle.combatants.some((row) => row.id === summonId)).toBe(false)
  expect(validateCombatEncounterState(second.state)).toEqual([])
  const { advanceCombatGroundAreas } = await import('./combat-ground-areas')
  const expired = advanceCombatGroundAreas({
    ...second.state,
    tactical: {
      ...second.state.tactical,
      battle: {
        ...second.state.tactical.battle,
        round: second.state.groundAreas![0]!.expiresAtRound,
      },
    },
  })
  expect(
    expired.effectState?.summonDamageSources?.some((source) => source.combatantId === summonId),
  ).toBe(false)
  expect(
    expired.tactical.movementProfiles.some(
      (profile) => profile.id === state.groundAreas![0]!.caster.placement.movementProfileId,
    ),
  ).toBe(false)
  const malformedArchive = {
    ...second.state,
    effectState: {
      ...second.state.effectState!,
      summonDamageSources: [{ ownerCombatantId: 'actor', groundContactArchiveVersion: 1 }],
    },
  } as unknown as CombatEncounterState
  expect(() => validateCombatEncounterState(malformedArchive)).not.toThrow()
  expect(
    validateCombatEncounterState(malformedArchive).some((issue) => issue.field === 'groundAreas'),
  ).toBe(true)
  for (const malformedAreas of [
    {},
    [null],
    [{ contactPolicyVersion: 1, sourceCombatantId: summonId }],
  ]) {
    const malformedState = {
      ...second.state,
      groundAreas: malformedAreas,
    } as unknown as CombatEncounterState
    expect(() => validateCombatEncounterState(malformedState)).not.toThrow()
    expect(
      validateCombatEncounterState(malformedState).some((issue) => issue.field === 'groundAreas'),
    ).toBe(true)
  }
})
it('rolls contact accuracy and critical from the captured caster without restoring live HP or ratings', async () => {
  const { createCurrentStatDrivenCombatEncounterState } = await import('./stat-driven-combat')
  const { createCombatGroundArea } = await import('./combat-ground-areas')
  const base = {
    ...percentageDotEncounter(),
    groundEffectPolicyVersion: 1 as const,
    groundContactPolicyVersion: 1 as const,
    effectTimingPolicy: encounter().effectTimingPolicy,
  }
  let state: import('./stat-driven-combat').StatDrivenCombatEncounterState =
    createCurrentStatDrivenCombatEncounterState(
      base,
      base.statBridge!.combatants.map((profile) => ({
        ...profile,
        level: 1,
        criticalChance: profile.combatantId === 'actor' ? 10000 : 0,
        physicalPower: 20,
        mysticPower: 20,
      })),
    )
  state = createCombatGroundArea(
    state,
    'actor',
    { ...action(), accuracyMode: 'per-target' },
    [{ x: 2, y: 1 }],
    PV1F_COMBAT_CONTENT,
  ) as typeof state
  state = {
    ...state,
    tactical: {
      ...state.tactical,
      battle: {
        ...state.tactical.battle,
        combatants: state.tactical.battle.combatants.map((row) =>
          row.id === 'actor' ? { ...row, hp: 500 } : row,
        ),
      },
    },
    statBridge: {
      ...state.statBridge,
      combatants: state.statBridge.combatants.map((row) =>
        row.combatantId === 'actor' ? { ...row, accuracy: 0, criticalChance: 0 } : row,
      ),
    },
  }
  const result = resolveCombatMovementStepEffects(state, 'enemy', PV1F_COMBAT_CONTENT)
  expect(result.events).toContainEqual(
    expect.objectContaining({
      event: 'combat_accuracy_resolved',
      hitChanceBasisPoints: 10000,
      hit: true,
    }),
  )
  expect(result.events).toContainEqual(
    expect.objectContaining({
      event: 'combat_critical_resolved',
      criticalChanceBasisPoints: 10000,
      critical: true,
    }),
  )
  expect(hp(result.state)).toBe(985)
  expect(hp(result.state, 'actor')).toBe(500)
  expect(
    result.state.statBridge!.combatants.find((row) => row.combatantId === 'actor'),
  ).toMatchObject({ accuracy: 0, criticalChance: 0 })
  expect(validateCombatEncounterState(result.state)).toEqual([])
})

it('rejects arena-wide All as a field entry before dispatch', async () => {
  const { evaluateCombatAction } = await import('./actions')
  const definition: CombatActionDefinition = {
    ...action(),
    effects: [{ type: 'damage', recipient: 'affected-units', target: 'all', amount: 10 }],
  }
  const state = encounter()
  const before = JSON.stringify(state)
  expect(() => evaluateCombatAction(state, definition, tile, PV1F_COMBAT_CONTENT)).toThrow(
    'Ground entry cannot use an arena-wide All target.',
  )
  expect(() => cast(state, definition)).toThrow('Ground entry cannot use an arena-wide All target.')
  expect(JSON.stringify(state)).toBe(before)
})

it('keeps independent Enemy delivery eligible on a mixed field for an Airborne entrant', () => {
  const initial = encounter()
  const air = PV1F_COMBAT_CONTENT.statuses.find((row) => row.id === 'airborne')!
  const state: CombatEncounterState = {
    ...initial,
    airbornePolicyVersion: 1,
    statusState: initial.statusState.map((row) =>
      row.combatantId === 'enemy'
        ? {
            ...row,
            statuses: [
              {
                statusId: 'airborne',
                statusVersion: air.version,
                sourceCombatantId: 'enemy',
                stacks: 1,
                remainingOwnerTurnStarts: 3,
              },
            ],
          }
        : row,
    ),
  }
  const definition: CombatActionDefinition = {
    ...action(),
    effects: [slow, { type: 'damage', recipient: 'affected-units', target: 'enemy', amount: 7 }],
    groundArea: { ...action().groundArea!, entryEffectOrdinals: [0, 1] },
  }
  const result = cast(state, definition)
  expect(hp(result.state)).toBe(993)
  expect(status(result.state, 'enemy', 'slow')).toBeUndefined()
})
it('reuses actual retained Chilling Mist v8 inherited Ground Chilled at its original ordinal across reload', async () => {
  const { readFileSync } = await import('node:fs')
  const { resolveMatureSkillVersion } = await import('./mature-skills')
  const proposals = JSON.parse(
    readFileSync(
      new URL(
        '../../../../docs/superpowers/specs/2026-10-10-roster-rebalance-proposals.json',
        import.meta.url,
      ),
      'utf8',
    ),
  ) as { records: { id: string; after: import('./mature-skills').MatureSkillDefinition }[] }
  const retained = proposals.records.find((row) => row.id === 'frostweaver.chilling-mist')!.after
  expect(retained.contentVersion).toBe(8)
  const nativeEffects = retained.effects.filter(
    (effect): effect is CombatEffectDefinition => effect.type !== 'summon',
  )
  expect(nativeEffects).toHaveLength(retained.effects.length)
  expect(nativeEffects[2]).toMatchObject({
    type: 'apply-status',
    statusId: 'frozen',
    durationTurns: 2,
  })
  expect(nativeEffects[2]!.target).toBeUndefined()
  const bytes = JSON.stringify(retained)
  const definition: CombatActionDefinition = {
    ...action(),
    id: retained.id,
    version: retained.contentVersion,
    target: retained.target,
    effects: nativeEffects,
    groundArea: { ...retained.groundArea!, timing: 'instant' },
  }
  const result = executeCombatAction(
    encounter(),
    definition,
    { kind: 'activate' },
    PV1F_COMBAT_CONTENT,
  )
  const captured = result.state.groundAreas![0]!
  expect(captured.entryEffectSourceOrdinals).toEqual([1, 2])
  expect(
    captured.entryEffects.filter(
      (effect) => effect.type === 'apply-status' && effect.statusId === 'frozen',
    ),
  ).toEqual([
    expect.objectContaining({
      target: 'ground',
      applicationOrigin: 'frozen-ground',
      durationTurns: 2,
    }),
  ])
  expect(status(result.state, 'enemy', 'frozen')?.stacks).toBe(1)
  expect(result.state.terrainOverlays ?? []).toEqual([])
  const restored = JSON.parse(JSON.stringify(result.state)) as CombatEncounterState
  expect(validateCombatEncounterState(restored)).toEqual([])
  expect(JSON.stringify(retained)).toBe(bytes)
  expect(resolveMatureSkillVersion('frostweaver.chilling-mist', 8)).toBeDefined()
})
it.each([undefined, 'enemy'] as const)(
  'keeps unit-delivery %s Chilled entry on its ordinary Ice damage gate',
  (target) => {
    const definition: CombatActionDefinition = {
      ...action(),
      target: { ...action().target, kind: 'unit', categories: ['enemy', 'ground'] },
      effects: [
        {
          type: 'damage',
          recipient: 'affected-units',
          target: 'ground',
          element: 'ice',
          amount: 0,
        },
        {
          type: 'apply-status',
          recipient: 'affected-units',
          target,
          statusId: 'frozen',
          stacks: 1,
          durationTurns: 4,
        },
      ],
      groundArea: { ...action().groundArea!, entryEffectOrdinals: [0, 1] },
    }
    const result = executeCombatAction(
      { ...encounter(), elementalDamagePolicyVersion: 2 },
      definition,
      { kind: 'unit', combatantId: 'enemy' },
      PV1F_COMBAT_CONTENT,
    )
    expect(result.state.groundAreas?.[0]?.entryEffects[1]?.target).toBe(target)
    expect(result.state.groundAreas?.[0]?.entryEffects[1]).toMatchObject({ durationTurns: 4 })
    expect(result.state.groundAreas?.[0]?.entryEffects[1]).not.toHaveProperty('applicationOrigin')
    expect(status(result.state, 'enemy', 'frozen')).toBeUndefined()
  },
)
it('materializes a standalone inherited Ground Chilled field without requiring covering Ice damage', () => {
  const definition: CombatActionDefinition = {
    ...action(),
    effects: [
      {
        type: 'apply-status',
        recipient: 'affected-units',
        statusId: 'frozen',
        stacks: 1,
        durationTurns: 4,
      },
    ],
  }
  const result = cast({ ...encounter(), elementalDamagePolicyVersion: 2 }, definition)
  expect(result.state.groundAreas?.[0]?.entryEffects).toEqual([
    expect.objectContaining({
      target: 'ground',
      applicationOrigin: 'frozen-ground',
      durationTurns: 4,
    }),
  ])
  expect(status(result.state, 'enemy', 'frozen')).toBeDefined()
})

it.each([{ categories: ['enemy'] }, { categories: ['ground', 'enemy'] }] as const)(
  'honors explicit geometry3 categories %j over legacy Ground kind for inherited Chilled',
  async ({ categories }) => {
    const { planCombatGroundContacts } = await import('./combat-ground-contact')
    const definition: CombatActionDefinition = {
      ...action(),
      target: { ...action().target, kind: 'ground-tile', geometryVersion: 3, categories },
      effects: [
        {
          type: 'apply-status',
          recipient: 'affected-units',
          statusId: 'frozen',
          stacks: 1,
          durationTurns: 7,
        },
      ],
    }
    const before = JSON.stringify(definition)
    const packet = planCombatGroundContacts(definition, 1).fields[0]!.action.effects[0]!
    expect(packet.target).toBeUndefined()
    expect(packet).not.toHaveProperty('applicationOrigin')
    expect(JSON.stringify(definition)).toBe(before)
  },
)
it('materializes inherited geometry3 Ground-only Chilled even when legacy kind says unit', async () => {
  const { planCombatGroundContacts } = await import('./combat-ground-contact')
  const definition: CombatActionDefinition = {
    ...action(),
    target: { ...action().target, kind: 'unit', geometryVersion: 3, categories: ['ground'] },
    effects: [
      {
        type: 'apply-status',
        recipient: 'affected-units',
        statusId: 'frozen',
        stacks: 1,
        durationTurns: 7,
      },
    ],
  }
  expect(planCombatGroundContacts(definition, 1).fields[0]!.action.effects[0]).toMatchObject({
    target: 'ground',
    applicationOrigin: 'frozen-ground',
    durationTurns: 7,
  })
})
it('keeps the captured canonical Chilling Mist v8 source bytes and SHA unchanged through field capture and reload', async () => {
  const { readFileSync } = await import('node:fs')
  const { createHash } = await import('node:crypto')
  const { capturedMatureSkillAbilitySource } = await import('./combat-action-source')
  const { reconcileCombatAbilitySources, combatAbilityCommandContext } =
    await import('./combat-behavior-runtime')
  const { commitCombatAbilityCommand } = await import('./combat-ability-command')
  const { preparePv1fTurnEconomy } = await import('./pv1f-action-economy')
  const proposals = JSON.parse(
    readFileSync(
      new URL(
        '../../../../docs/superpowers/specs/2026-10-10-roster-rebalance-proposals.json',
        import.meta.url,
      ),
      'utf8',
    ),
  ) as { records: { id: string; after: import('./mature-skills').MatureSkillDefinition }[] }
  const retained = proposals.records.find((row) => row.id === 'frostweaver.chilling-mist')!.after
  const initial = preparePv1fTurnEconomy(
    encounter() as import('./stat-driven-combat').StatDrivenCombatEncounterState,
  )
  const captured = capturedMatureSkillAbilitySource(initial, retained)!
  const bytes = JSON.stringify(captured)
  const sha = createHash('sha256').update(bytes).digest('hex')
  const state = reconcileCombatAbilitySources(initial, [captured])
  const result = commitCombatAbilityCommand({
    state,
    actorId: 'actor',
    root: { kind: 'canonical', source: captured, behaviorId: 'persistent-ground' },
    selection: { kind: 'activate' },
    content: PV1F_COMBAT_CONTENT,
    context: combatAbilityCommandContext(state, captured),
  })
  const restored = JSON.parse(JSON.stringify(result.state)) as CombatEncounterState
  expect(restored.groundAreas?.[0]?.entryEffectSourceOrdinals).toEqual([1, 2])
  expect(restored.groundAreas?.[0]?.entryEffectOrigins?.[1]).toMatchObject({
    effectId: 'entry-2',
    contentId: retained.id,
    contentVersion: 8,
  })
  expect(restored.groundAreas?.[0]?.entryEffects[1]).toMatchObject({
    type: 'apply-status',
    statusId: 'frozen',
    target: 'ground',
    applicationOrigin: 'frozen-ground',
    durationTurns: 2,
  })
  expect(
    restored.groundAreas?.[0]?.entryEffects.filter(
      (effect) => effect.type === 'apply-status' && effect.statusId === 'frozen',
    ),
  ).toHaveLength(1)
  const restoredSource = restored.capturedAbilitySources!.find(
    (source) => source.sourceInstanceId === captured.sourceInstanceId,
  )!
  expect(JSON.stringify(restoredSource)).toBe(bytes)
  expect(createHash('sha256').update(JSON.stringify(restoredSource)).digest('hex')).toBe(sha)
  expect(JSON.stringify(captured)).toBe(bytes)
  expect(validateCombatEncounterState(restored)).toEqual([])
})

describe('authored Ground placement timing and affected teams', () => {
  it.each(['instant', 'next-round', 'delayed'] as const)(
    'places the current field instantly while retaining its captured packet %s metadata',
    (timing) => {
      const initial = {
        ...encounter(),
        effectTimingPolicy: { version: 1, modes: { 'ground-area': 'next-round' as const } },
      }
      const original = action()
      const current = {
        ...original,
        effectTimingModes: [timing],
        groundArea: {
          ...original.groundArea!,
          timing: undefined,
          placementTimingVersion: 1 as const,
        },
      }
      const before = JSON.stringify(current)
      const result = cast(initial, current)
      expect(result.state.groundAreas?.[0]?.activationRound).toBe(1)
      expect(result.state.groundAreas?.[0]?.entryEffectTimingModes).toEqual([timing])
      expect(hp(result.state)).toBe(990)
      expect(result.state.pendingEffects ?? []).toEqual([])
      expect(JSON.stringify(current)).toBe(before)
      const historical = {
        ...current,
        groundArea: { ...current.groundArea, placementTimingVersion: undefined },
      }
      expect(cast(initial, historical).state.groundAreas?.[0]?.activationRound).toBe(2)
      const overridden = {
        ...current,
        groundArea: { ...current.groundArea, timing: 'delayed' as const },
      }
      expect(cast(initial, overridden).state.groundAreas?.[0]?.activationRound).toBe(3)
    },
  )
  it('keeps mixed packet timings together in one immediately active field after reload', () => {
    const original = action(10, [slow])
    const definition = {
      ...original,
      effectTimingModes: ['instant' as const, 'delayed' as const],
      groundArea: {
        ...original.groundArea!,
        timing: undefined,
        placementTimingVersion: 1 as const,
        targetTeams: 'enemies' as const,
      },
    }
    const result = cast(encounter(), definition)
    expect(
      result.state.groundAreas?.map((area) => ({
        round: area.activationRound,
        ordinals: area.entryEffectSourceOrdinals,
      })),
    ).toEqual([{ round: 1, ordinals: [0, 1] }])
    let restored = JSON.parse(JSON.stringify(result.state)) as CombatEncounterState
    expect(validateCombatEncounterState(restored)).toEqual([])
    expect(
      restored.groundAreas?.every(
        (area) => area.targetTeams === 'enemies' && area.placementTimingVersion === 1,
      ),
    ).toBe(true)
    expect(status(restored, 'enemy', 'slow')).toBeDefined()
    expect(restored.groundAreas?.[0]?.entryEffectTimingModes).toEqual(['instant', 'delayed'])
    for (let i = 0; i < 4; i++) restored = finish(restored)
    expect(status(restored, 'enemy', 'slow')).toBeDefined()
    expect(validateCombatEncounterState(restored)).toEqual([])
  })
  it('keeps the new field placement immediate independently of tag timing defaults', () => {
    const original = action(10, [slow])
    const initial = {
      ...encounter(),
      effectTimingPolicy: {
        version: 1,
        modes: { 'ground-area': 'next-round' as const, slow: 'delayed' as const },
      },
    }
    const result = cast(initial, {
      ...original,
      groundArea: { ...original.groundArea!, timing: undefined, placementTimingVersion: 1 },
    })
    expect(result.state.groundAreas?.map((area) => area.activationRound)).toEqual([1])
    expect(hp(result.state)).toBe(990)
  })
  it.each([
    ['all', ['actor', 'enemy', 'other', 'ally']],
    ['all-except-self', ['enemy', 'other', 'ally']],
    ['enemies', ['enemy', 'other']],
    ['allies', ['actor', 'ally']],
    ['self', ['actor']],
    ['allies-except-self', ['ally']],
  ] as const)(
    'uses source-relative %s field membership for Damage and status contact',
    (targetTeams, affected) => {
      for (const id of ['actor', 'enemy', 'other', 'ally']) {
        const initial = encounter()
        const original = action(10, [slow])
        const definition = {
          ...original,
          groundArea: { ...original.groundArea!, targetTeams, placementTimingVersion: 1 as const },
        }
        const position = initial.tactical.placements.find((row) => row.combatantId === id)!.position
        const result = executeCombatAction(
          initial,
          definition,
          { kind: 'tile', position },
          PV1F_COMBAT_CONTENT,
        )
        const eligible = (affected as readonly string[]).includes(id)
        expect(hp(result.state, id), `${targetTeams} ${id}`).toBe(eligible ? 990 : 1000)
        expect(Boolean(status(result.state, id, 'slow')), `${targetTeams} ${id}`).toBe(eligible)
        expect(result.state.groundAreas?.[0]?.target.teamPolicy).toBe('enemy')
        const restored = JSON.parse(JSON.stringify(result.state)) as CombatEncounterState
        expect(restored.groundAreas?.[0]?.targetTeams).toBe(targetTeams)
        expect(validateCombatEncounterState(restored)).toEqual([])
      }
    },
  )
})

it.each(['self', 'all'] as const)(
  'scoped %s caster Damage respects Barrier and one contact per own-turn cycle',
  async (targetTeams) => {
    const { grantBarrier, currentBarrierAmount } = await import('./combat-barrier')
    let state = grantBarrier(encounter(), 'actor', 'actor', 'test.barrier', 4).state
    const original = action()
    const definition = {
      ...original,
      groundArea: { ...original.groundArea!, targetTeams, placementTimingVersion: 1 as const },
    }
    const position = state.tactical.placements.find((row) => row.combatantId === 'actor')!.position
    state = executeCombatAction(
      state,
      definition,
      { kind: 'tile', position },
      PV1F_COMBAT_CONTENT,
    ).state
    expect(hp(state, 'actor')).toBe(994)
    expect(currentBarrierAmount(state, 'actor')).toBe(0)
    state = JSON.parse(JSON.stringify(state)) as CombatEncounterState
    state = resolveCombatMovementStepEffects(state, 'actor', PV1F_COMBAT_CONTENT).state
    expect(hp(state, 'actor')).toBe(994)
    state = executeCombatAction(
      state,
      definition,
      { kind: 'tile', position },
      PV1F_COMBAT_CONTENT,
    ).state
    expect(hp(state, 'actor')).toBe(994)
    for (let i = 0; i < 4; i++) state = finish(state)
    expect(state.tactical.battle.currentTurn?.combatantId).toBe('actor')
    expect(hp(state, 'actor')).toBe(984)
    expect(validateCombatEncounterState(state)).toEqual([])
  },
)
it('scoped Ground membership intersects Requirements and masks without spending a rejected contact allowance', () => {
  const original = action()
  const scoped = {
    ...original,
    groundArea: { ...original.groundArea!, targetTeams: 'all' as const },
  }
  let state = cast(encounter(), { ...scoped, effectEligibleRecipientIds: [[]] }).state
  expect(hp(state)).toBe(1000)
  state = cast(state, scoped).state
  expect(hp(state)).toBe(990)
  const capturedRequirement: NonNullable<
    CombatActionDefinition['effectRequirementCaptures']
  >[number] = {
    requirement: {
      kind: 'resource-state',
      subject: 'affected',
      resource: 'hp',
      comparison: 'at-most',
      amount: 900,
    },
    context: {},
    selectedSubjects: [],
  }
  let conditional = cast(encounter(), {
    ...scoped,
    effectRequirementCaptures: [capturedRequirement],
  }).state
  expect(hp(conditional)).toBe(1000)
  conditional = {
    ...conditional,
    tactical: {
      ...conditional.tactical,
      battle: {
        ...conditional.tactical.battle,
        combatants: conditional.tactical.battle.combatants.map((unit) =>
          unit.id === 'enemy' ? { ...unit, hp: 800 } : unit,
        ),
      },
    },
  }
  conditional = resolveCombatMovementStepEffects(conditional, 'enemy', PV1F_COMBAT_CONTENT).state
  expect(hp(conditional)).toBe(790)
  expect(validateCombatEncounterState(conditional)).toEqual([])
})
it('keeps scoped field footprint and independent caster effects unchanged', async () => {
  const { evaluateCombatAction } = await import('./actions')
  const original = action()
  const initial = encounter()
  const state = {
    ...initial,
    tactical: {
      ...initial.tactical,
      battle: {
        ...initial.tactical.battle,
        combatants: initial.tactical.battle.combatants.map((unit) =>
          unit.id === 'actor' ? { ...unit, hp: 900 } : unit,
        ),
      },
    },
  }
  const definition: CombatActionDefinition = {
    ...original,
    effects: [
      { type: 'healing', recipient: 'actor', target: 'self', amount: 5 },
      ...original.effects,
    ],
    groundArea: { ...original.groundArea!, entryEffectOrdinals: [1], targetTeams: 'allies' },
  }
  const result = cast(state, definition)
  expect(hp(result.state, 'actor')).toBe(905)
  expect(hp(result.state, 'enemy')).toBe(1000)
  expect(hp(result.state, 'ally')).toBe(1000)
  expect(result.state.groundAreas?.[0]?.tiles).toEqual([{ x: 2, y: 1 }])
  expect(result.state.groundAreas?.[0]?.entryEffectSourceOrdinals).toEqual([1])
  expect(
    evaluateCombatAction(
      state,
      definition,
      { kind: 'tile', position: { x: 4, y: 4 } },
      PV1F_COMBAT_CONTENT,
    ).legal,
  ).toBe(false)
  const historical = {
    ...definition,
    groundArea: { ...definition.groundArea!, targetTeams: undefined },
  }
  expect(hp(cast(state, historical).state, 'enemy')).toBe(990)
})

it('applies Self scope only when its source actually contacts the saved footprint', () => {
  const original = action()
  const definition = {
    ...original,
    groundArea: { ...original.groundArea!, targetTeams: 'self' as const },
  }
  let state = executeCombatAction(
    encounter(),
    definition,
    { kind: 'tile', position: { x: 2, y: 2 } },
    PV1F_COMBAT_CONTENT,
  ).state
  expect(hp(state, 'actor')).toBe(1000)
  state = {
    ...state,
    tactical: {
      ...state.tactical,
      placements: state.tactical.placements.map((row) =>
        row.combatantId === 'actor' ? { ...row, position: { x: 2, y: 2 } } : row,
      ),
    },
  }
  state = resolveCombatMovementStepEffects(state, 'actor', PV1F_COMBAT_CONTENT).state
  expect(hp(state, 'actor')).toBe(990)
  expect(hp(state, 'enemy')).toBe(1000)
  expect(validateCombatEncounterState(state)).toEqual([])
})
it('retains Ground Airborne immunity for explicitly scoped caster Damage', () => {
  const initial = encounter()
  const air = PV1F_COMBAT_CONTENT.statuses.find((row) => row.id === 'airborne')!
  const state: CombatEncounterState = {
    ...initial,
    airbornePolicyVersion: 1,
    statusState: initial.statusState.map((row) =>
      row.combatantId === 'actor'
        ? {
            ...row,
            statuses: [
              {
                statusId: 'airborne',
                statusVersion: air.version,
                sourceCombatantId: 'actor',
                stacks: 1,
                remainingOwnerTurnStarts: 3,
              },
            ],
          }
        : row,
    ),
  }
  const original = action()
  const definition = {
    ...original,
    groundArea: { ...original.groundArea!, targetTeams: 'self' as const },
  }
  const position = state.tactical.placements.find((row) => row.combatantId === 'actor')!.position
  const result = executeCombatAction(
    state,
    definition,
    { kind: 'tile', position },
    PV1F_COMBAT_CONTENT,
  )
  expect(hp(result.state, 'actor')).toBe(1000)
  expect(result.state.groundAreas?.[0]?.targetTeams).toBe('self')
  expect(validateCombatEncounterState(result.state)).toEqual([])
})
it('intersects explicit field membership with independently targeted entry packets', () => {
  const original = action()
  const definition = {
    ...original,
    effects: [{ ...slow, target: 'enemy' as const }],
    groundArea: { ...original.groundArea!, targetTeams: 'allies' as const },
  }
  const initial = encounter()
  const position = initial.tactical.placements.find((row) => row.combatantId === 'ally')!.position
  const result = executeCombatAction(
    initial,
    definition,
    { kind: 'tile', position },
    PV1F_COMBAT_CONTENT,
  )
  expect(status(result.state, 'ally', 'slow')).toBeUndefined()
  expect(status(result.state, 'enemy', 'slow')).toBeUndefined()
  expect(result.state.groundAreas?.[0]?.entryEffects[0]?.target).toBe('enemy')
})

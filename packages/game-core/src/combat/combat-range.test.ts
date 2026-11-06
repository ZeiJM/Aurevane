import { chooseBuildAwareRecruitAiDecision } from './recruit-ai-build'
import { reattachStatDrivenCombatBridge } from './stat-driven-combat'
import { expect, it } from 'vitest'
import { percentageDotEncounter } from './combat-percentage-dots.test-utils'
import { source } from './combat-behavior.test-utils'
import { combatRangeTarget } from './combat-range'
import { createAuthorableEffectPayload } from './combat-effect-authoring'
import { validateCombatTagPayload } from './combat-tag-registry'
import { combatEffectTimingMode } from './combat-effect-timing'
import { captureCombatAbilitySource } from './combat-behavior-capture'
import {
  combatAbilityCommandContext,
  reconcileCombatAbilitySources,
  materializeCombatAbilityAction,
} from './combat-behavior-runtime'
import { prepareCombatAbilityCommand, commitCombatAbilityCommand } from './combat-ability-command'
import {
  executeCombatAction,
  evaluateCombatAction,
  endCombatTurn,
  validateCombatEncounterState,
  type CombatActionDefinition,
  type CombatEncounterState,
} from './actions'
import { preparePv1fTurnEconomy, PV1F_COMBAT_CONTENT } from './pv1f-action-economy'
import { selectCurrentFinalFacing } from './board'
import { selectableCombatStatusIds } from './combat-status-selection'
import { applyCombatStatusCopies } from './combat-status-copy'

function state(): CombatEncounterState {
  return preparePv1fTurnEconomy({
    ...percentageDotEncounter(),
    rangeModifierPolicyVersion: 1,
    effectTimingPolicy: {
      version: 1,
      modes: { 'range-up': 'instant', 'range-down': 'instant', 'remove-status': 'instant' },
    },
  })
}
function action(effects: CombatActionDefinition['effects'] = []): CombatActionDefinition {
  return {
    id: 'test.range',
    version: 1,
    sourceType: 'discipline-skill',
    tags: [],
    target: {
      kind: 'unit',
      teamPolicy: 'any',
      friendlyFire: 'all-units',
      shape: { kind: 'single' },
      minimumRange: 1,
      maximumRange: 1,
      maximumSelections: 1,
      requiresLineOfSight: false,
      maximumElevationDifference: null,
    },
    cost: { mp: 0, spendsAction: false },
    requirements: [],
    effects,
  }
}
function apply(s: CombatEncounterState, statusId: string, rangeTiles: number, durationTurns = 2) {
  return executeCombatAction(
    s,
    {
      ...action([
        {
          type: 'apply-status',
          recipient: 'actor',
          statusId,
          stacks: 1,
          rangeTiles,
          durationTurns,
        },
      ]),
      target: {
        ...action().target,
        kind: 'self',
        teamPolicy: 'self',
        minimumRange: 0,
        maximumRange: 0,
      },
    },
    { kind: 'self' },
    PV1F_COMBAT_CONTENT,
  ).state
}
function command(
  s: CombatEncounterState,
  classification: 'attack' | 'utility' | 'recovery',
  sourceKind = 'discipline-skill',
) {
  const captured = captureCombatAbilitySource({
    ...source({
      classification,
      ...(classification === 'attack' ? {} : { attackFamily: undefined }),
      targeting: { ...action().target, maximumSelections: 1 },
    }),
    sourceKind: sourceKind as ReturnType<typeof source>['sourceKind'],
  })
  const ready = reconcileCombatAbilitySources(s, [captured])
  return {
    state: ready,
    actorId: 'actor',
    selection: { kind: 'unit' as const, combatantId: 'other' },
    root: { kind: 'canonical' as const, source: captured },
    content: PV1F_COMBAT_CONTENT,
    context: combatAbilityCommandContext(ready, captured),
  }
}
it.each(['range-up', 'range-down'])(
  'authors and validates %s tile strength and ordinary duration',
  (id) => {
    expect(createAuthorableEffectPayload(`status:${id}`)).toMatchObject({
      statusId: id,
      rangeTiles: 1,
      durationTurns: 2,
    })
    const payload = createAuthorableEffectPayload(`status:${id}`)!
    expect(validateCombatTagPayload({ ...payload, rangeTiles: 7, durationTurns: 99 })).toEqual([])
    for (const amount of [0, -1, 1.1, Infinity])
      expect(validateCombatTagPayload({ ...payload, rangeTiles: amount }).length).toBeGreaterThan(0)
    expect(combatEffectTimingMode({ version: 1, modes: {} }, id)).toBe('delayed')
    expect(combatEffectTimingMode({ version: 1, modes: { [id]: 'next-round' } }, id)).toBe(
      'next-round',
    )
    expect(combatEffectTimingMode({ version: 1, modes: { [id]: 'instant' } }, id)).toBe('instant')
  },
)
it.each(['attack', 'utility', 'recovery'] as const)(
  'shares %s range between canonical preview and commit',
  (classification) => {
    const historical = state()
    const before = JSON.stringify(historical)
    expect(prepareCombatAbilityCommand(command(historical, classification)).evaluation.legal).toBe(
      false,
    )
    const input = command(apply(historical, 'range-up', 1), classification)
    const prepared = prepareCombatAbilityCommand(input)
    expect(prepared.evaluation.legal).toBe(true)
    expect(
      commitCombatAbilityCommand(input).state.tactical.battle.combatants.find(
        (x) => x.id === 'other',
      )!.hp,
    ).toBeLessThan(1000)
    expect(JSON.stringify(historical)).toBe(before)
  },
)
it('increases native Basic Attack and Discipline reach without changing authored bodies', () => {
  const s = apply(state(), 'range-up', 2)
  for (const sourceType of ['basic-attack', 'discipline-skill'] as const) {
    const cast = {
      ...action([{ type: 'damage' as const, recipient: 'primary-unit' as const, amount: 10 }]),
      sourceType,
    }
    const target = { kind: 'unit' as const, combatantId: 'other' }
    expect(evaluateCombatAction(s, cast, target, PV1F_COMBAT_CONTENT).legal).toBe(true)
    expect(
      executeCombatAction(
        s,
        cast,
        target,
        PV1F_COMBAT_CONTENT,
      ).state.tactical.battle.combatants.find((x) => x.id === 'other')!.hp,
    ).toBe(990)
    expect(cast.target.maximumRange).toBe(1)
  }
})
it('nets applications with their own strengths and clamps Range Down at the unchanged minimum', () => {
  let s = apply(apply(apply(state(), 'range-up', 2), 'range-up', 3), 'range-down', 1)
  expect(combatRangeTarget(s, 'actor', action()).maximumRange).toBe(5)
  s = apply(s, 'range-down', 99)
  const cast = { ...action(), target: { ...action().target, minimumRange: 2, maximumRange: 4 } }
  expect(combatRangeTarget(s, 'actor', cast)).toMatchObject({ minimumRange: 2, maximumRange: 2 })
  expect(
    evaluateCombatAction(s, cast, { kind: 'unit', combatantId: 'enemy' }, PV1F_COMBAT_CONTENT)
      .issues,
  ).toContainEqual(expect.objectContaining({ code: 'target-out-of-range' }))
  expect(
    evaluateCombatAction(s, cast, { kind: 'unit', combatantId: 'other' }, PV1F_COMBAT_CONTENT)
      .legal,
  ).toBe(true)
  expect(validateCombatEncounterState(JSON.parse(JSON.stringify(s)))).toEqual([])
})
it('never extends All, self-only, movement, consumable or supernatural sources, and keeps area dimensions', () => {
  const s = apply(state(), 'range-up', 3)
  const base = action()
  const excluded = [
    { ...base, sourceType: 'basic-action' as const },
    { ...base, rangeModifierEligible: false },
    { ...base, target: { ...base.target, shape: { kind: 'all' as const } } },
    { ...base, target: { ...base.target, kind: 'self' as const, teamPolicy: 'self' as const } },
    ...['essence', 'resonance', 'severance', 'ascension'].map((tag) => ({ ...base, tags: [tag] })),
  ]
  for (const cast of excluded) expect(combatRangeTarget(s, 'actor', cast)).toEqual(cast.target)
  for (const shape of [
    { kind: 'line', length: 2 },
    { kind: 'circle', radius: 2 },
  ] as const)
    expect(
      combatRangeTarget(s, 'actor', { ...base, target: { ...base.target, shape } }),
    ).toMatchObject({ minimumRange: 1, maximumRange: 4, shape })
  for (const sourceKind of ['essence', 'resonance', 'soulmark'])
    expect(prepareCombatAbilityCommand(command(s, 'utility', sourceKind)).evaluation.legal).toBe(
      false,
    )
})
it('uses equipment attack and imbued support roles but excludes consumable use and Move', () => {
  const s = apply(state(), 'range-up', 2)
  const captured = source()
  for (const role of ['attack', 'support', 'use'] as const) {
    const withEquipment = {
      ...captured,
      equipment: {
        unit: { item: { id: 'test.weapon', itemClass: 'weapon' }, position: 'main-hand' } as never,
        roles: { [role]: 'strike' },
      },
    }
    expect(
      materializeCombatAbilityAction(withEquipment, captured.definition.behaviors[0]!)
        .rangeModifierEligible,
    ).toBe(role !== 'use')
  }
  const move = {
    ...captured.definition.behaviors[0]!,
    effects: [
      {
        id: 'walk',
        payload: { type: 'move' as const, recipient: 'actor' as const, maximumTiles: 2 },
      },
    ],
  }
  expect(materializeCombatAbilityAction(captured, move).rangeModifierEligible).toBe(false)
  expect(
    combatRangeTarget(s, 'actor', { ...action(), rangeModifierEligible: false }).maximumRange,
  ).toBe(1)
})
it('keeps historical absent-policy encounters literal on reload and rejects unknown policy versions', () => {
  const s = apply(state(), 'range-up', 4)
  delete s.rangeModifierPolicyVersion
  const restored = JSON.parse(JSON.stringify(s)) as CombatEncounterState
  expect(combatRangeTarget(restored, 'actor', action()).maximumRange).toBe(1)
  expect(
    validateCombatEncounterState({ ...s, rangeModifierPolicyVersion: 2 } as never),
  ).toContainEqual(expect.objectContaining({ field: 'rangeModifierPolicyVersion' }))
})
it('uses Delayed global boundaries without modifying range while pending, then expires normally', () => {
  let s = apply({ ...state(), effectTimingPolicy: { version: 1, modes: {} } }, 'range-up', 3, 1)
  expect(combatRangeTarget(s, 'actor', action()).maximumRange).toBe(1)
  const tickRound = () => {
    for (let i = 0; i < 4; i++)
      s = endCombatTurn(
        { ...s, tactical: selectCurrentFinalFacing(s.tactical, 'west').state },
        PV1F_COMBAT_CONTENT,
      ).state
  }
  tickRound()
  expect(combatRangeTarget(s, 'actor', action()).maximumRange).toBe(1)
  tickRound()
  expect(combatRangeTarget(s, 'actor', action()).maximumRange).toBe(4)
  tickRound()
  expect(combatRangeTarget(s, 'actor', action()).maximumRange).toBe(1)
})
it('uses ordinary positive/negative selection, removal and copy strength capture', () => {
  expect(selectableCombatStatusIds('buffs')).toContain('range-up')
  expect(createAuthorableEffectPayload('dispel')).toMatchObject({
    statusIds: expect.arrayContaining(['range-up']),
  })
  expect(selectableCombatStatusIds('debuffs')).toContain('range-down')
  expect(selectableCombatStatusIds('copy-buffs')).toContain('range-up')
  expect(selectableCombatStatusIds('copy-debuffs')).toContain('range-down')
  const s = apply(apply(state(), 'range-up', 3), 'range-down', 2)
  for (const [mode, id] of [
    ['specified', 'range-up'],
    ['all-debuffs', 'range-down'],
  ] as const) {
    const cleaned = executeCombatAction(
      s,
      {
        ...action([
          { type: 'remove-status', recipient: 'actor', removalMode: mode, statusIds: [id] },
        ]),
        target: { ...action().target, kind: 'self', teamPolicy: 'self', minimumRange: 0 },
      },
      { kind: 'self' },
      PV1F_COMBAT_CONTENT,
    ).state
    expect(
      cleaned.statusState.find((x) => x.combatantId === 'actor')!.statuses.map((x) => x.statusId),
    ).not.toContain(id)
  }
  const copied = applyCombatStatusCopies(
    s,
    'ally',
    'actor',
    'test.copy',
    { type: 'copy-statuses', mode: 'amplify', recipient: 'primary-unit', statusIds: ['range-up'] },
    PV1F_COMBAT_CONTENT,
  ).state
  expect(combatRangeTarget(copied, 'ally', action()).maximumRange).toBe(4)
})
it('AI selects a newly reachable attack and stops selecting it after Range Down', () => {
  const s = apply(state(), 'range-up', 4)
  s.tactical.placements = s.tactical.placements.map((row) =>
    row.combatantId === 'enemy'
      ? { ...row, position: { x: 4, y: 4 } }
      : row.combatantId === 'other'
        ? { ...row, position: { x: 4, y: 3 } }
        : row,
  )
  const input = command(s, 'attack')
  const original = input.root.source
  const src = captureCombatAbilitySource({
    ...original,
    definition: {
      ...original.definition,
      behaviors: [
        {
          ...original.definition.behaviors[0]!,
          costs: [{ resource: 'ap', amount: 1 }],
          effects: [
            { id: 'hit', payload: { type: 'damage', recipient: 'primary-unit', amount: 20 } },
          ],
        },
      ],
    },
  })
  const choose = (battle: CombatEncounterState) =>
    chooseBuildAwareRecruitAiDecision({
      state: reattachStatDrivenCombatBridge(battle, percentageDotEncounter().statBridge),
      tieBreakSeed: 17,
      skillOptions: { canonicalSources: [src] },
    })
  expect(choose(s).intent).toMatchObject({
    kind: 'action',
    target: { kind: 'unit', combatantId: 'other' },
  })
  expect(choose(apply(s, 'range-down', 4)).intent).not.toMatchObject({
    kind: 'action',
    target: { kind: 'unit', combatantId: 'other' },
  })
})

it('uses captured global tag timing over an authored Instant hint for a canonical Range tag', () => {
  const initial = {
    ...state(),
    effectTimingPolicy: { version: 1, tagAuthority: 'global' as const, modes: {} },
  }
  const captured = captureCombatAbilitySource(
    source({
      classification: 'utility',
      attackFamily: undefined,
      costs: [],
      targeting: {
        ...action().target,
        kind: 'self',
        teamPolicy: 'self',
        minimumRange: 0,
        maximumRange: 0,
        maximumSelections: 1,
      },
      effects: [
        {
          id: 'range',
          timing: 'instant',
          payload: {
            type: 'apply-status',
            recipient: 'actor',
            target: 'self',
            statusId: 'range-up',
            stacks: 1,
            rangeTiles: 3,
            durationTurns: 2,
          },
        },
      ],
    }),
  )
  const ready = reconcileCombatAbilitySources(initial, [captured])
  const committed = commitCombatAbilityCommand({
    state: ready,
    actorId: 'actor',
    selection: { kind: 'self' },
    root: { kind: 'canonical', source: captured },
    content: PV1F_COMBAT_CONTENT,
    context: combatAbilityCommandContext(ready, captured),
  }).state
  expect(combatRangeTarget(committed, 'actor', action()).maximumRange).toBe(1)
  expect(committed.pendingEffects).toContainEqual(
    expect.objectContaining({
      effect: expect.objectContaining({ statusId: 'range-up', rangeTiles: 3 }),
    }),
  )
})

it('keeps individually valid huge strengths usable and cancels opposing stacks exactly', () => {
  const huge = Number.MAX_SAFE_INTEGER
  let s = apply(apply(state(), 'range-up', huge), 'range-up', huge)
  expect(combatRangeTarget(s, 'actor', action()).maximumRange).toBe(huge)
  expect(
    evaluateCombatAction(s, action(), { kind: 'unit', combatantId: 'other' }, PV1F_COMBAT_CONTENT)
      .legal,
  ).toBe(true)
  s = apply(apply(s, 'range-down', huge), 'range-down', huge)
  expect(combatRangeTarget(s, 'actor', action()).maximumRange).toBe(1)
  expect(validateCombatEncounterState(JSON.parse(JSON.stringify(s)))).toEqual([])
})

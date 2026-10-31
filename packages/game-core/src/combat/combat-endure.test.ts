import { createAuthorableEffectPayload } from './combat-effect-authoring'
import { validateCombatTagPayload } from './combat-tag-registry'
import { pendingCombatStatusRows } from './combat-effect-timing'
import { projectedCombatEffectUtility } from './recruit-ai-build'
import { createCombatActionProvenance, createCombatTriggerGuard } from './combat-kernel-types'
import { describe, expect, it } from 'vitest'
import {
  executeCombatAction,
  evaluateCombatAction,
  endCombatTurn,
  validateCombatEncounterState,
  type CombatActionDefinition,
  type CombatEncounterState,
  type CombatEffectDefinition,
} from './actions'
import { percentageDotEncounter } from './combat-percentage-dots.test-utils'
import { PV1F_COMBAT_CONTENT } from './pv1f-action-economy'
import { selectCurrentFinalFacing } from './board'
import { projectPublicCombat } from './public-combat-presentation'

function action(effects: readonly CombatEffectDefinition[], self = true): CombatActionDefinition {
  return {
    id: 'test.endure',
    version: 1,
    sourceType: 'test',
    tags: [],
    cost: { mp: 0, spendsAction: false },
    requirements: [],
    target: {
      kind: self ? 'self' : 'unit',
      teamPolicy: self ? 'self' : 'any',
      shape: { kind: 'single' },
      minimumRange: self ? 0 : 1,
      maximumRange: self ? 0 : 20,
      requiresLineOfSight: false,
      maximumElevationDifference: null,
      friendlyFire: 'all-units',
    },
    effects,
  }
}
const endure = {
  type: 'endure',
  recipient: 'actor',
  durationTurns: 1,
  releaseBasisPoints: 15000,
  radiusTiles: 3,
  targetTeams: 'enemies',
} as const
const self = { kind: 'self' as const }
const hp = (state: CombatEncounterState, id: string) =>
  state.tactical.battle.combatants.find((row) => row.id === id)!.hp
const finish = (state: CombatEncounterState) =>
  endCombatTurn(
    { ...state, tactical: selectCurrentFinalFacing(state.tactical, 'west').state },
    PV1F_COMBAT_CONTENT,
  )
function cast(
  patch: Partial<Extract<CombatEffectDefinition, { type: 'endure' }>> = {},
  initial: CombatEncounterState = percentageDotEncounter(),
): CombatEncounterState {
  return executeCombatAction(initial, action([{ ...endure, ...patch }]), self, PV1F_COMBAT_CONTENT)
    .state
}
function incoming(state: CombatEncounterState, amount = 20) {
  while (state.tactical.battle.currentTurn!.combatantId !== 'enemy') state = finish(state).state
  return executeCombatAction(
    state,
    action([{ type: 'damage', recipient: 'primary-unit', amount }], false),
    { kind: 'unit', combatantId: 'actor' },
    PV1F_COMBAT_CONTENT,
  ).state
}
describe('Endure', () => {
  it('captures a private actual HP damage ledger and blocks damaging actions while leaving utility legal', () => {
    const state = cast()
    expect(state.statusState.find((row) => row.combatantId === 'actor')!.statuses[0]).toMatchObject(
      {
        statusId: 'endure',
        endure: { releaseBasisPoints: 15000, radiusTiles: 3, targetTeams: 'enemies' },
      },
    )
    const damage = action([{ type: 'damage', recipient: 'primary-unit', amount: 10 }], false)
    expect(
      evaluateCombatAction(
        state,
        damage,
        { kind: 'unit', combatantId: 'enemy' },
        PV1F_COMBAT_CONTENT,
      ).issues,
    ).toContainEqual(expect.objectContaining({ code: 'endure-active' }))
    expect(
      evaluateCombatAction(
        state,
        action([{ type: 'healing', recipient: 'actor', amount: 10 }]),
        self,
        PV1F_COMBAT_CONTENT,
      ).legal,
    ).toBe(true)
    expect(JSON.stringify(projectPublicCombat(incoming(state)))).not.toContain('receivedDamage')
  })
  it('releases the full saved fraction to each target on natural expiry exactly once', () => {
    let state = incoming(cast())
    while (state.tactical.battle.currentTurn!.combatantId !== 'actor') state = finish(state).state
    const ended = finish(state)
    expect(hp(ended.state, 'actor')).toBe(980)
    expect(hp(ended.state, 'enemy')).toBe(970)
    expect(hp(ended.state, 'other')).toBe(970)
    expect(hp(ended.state, 'ally')).toBe(1000)
    expect(validateCombatEncounterState(JSON.parse(JSON.stringify(ended.state)))).toEqual([])
    expect(
      ended.events.filter(
        (row) => row.event === 'damage_applied' && row.actionId === 'status.endure.release',
      ),
    ).toHaveLength(2)
  })
})

function release(state: CombatEncounterState) {
  while (state.tactical.battle.currentTurn!.combatantId !== 'actor') state = finish(state).state
  return finish(state)
}
const received = (state: CombatEncounterState) =>
  state.endureState?.applications.find((row) => row.combatantId === 'actor')?.receivedDamage

it('copies and validates the authored profile without permitting direct status forgery', () => {
  expect(createAuthorableEffectPayload('endure')).toMatchObject({
    type: 'endure',
    durationTurns: 2,
    releaseBasisPoints: 15000,
    radiusTiles: 3,
    targetTeams: 'enemies',
  })
  expect(validateCombatTagPayload({ ...endure, releaseBasisPoints: 25000 })).toEqual([])
  expect(validateCombatTagPayload({ ...endure, releaseBasisPoints: 0 })).not.toEqual([])
  expect(validateCombatTagPayload({ ...endure, radiusTiles: 0 })).not.toEqual([])
  expect(validateCombatTagPayload({ ...endure, durationTurns: 5 })).not.toEqual([])
  expect(validateCombatTagPayload({ ...endure, target: 'enemy' })).not.toEqual([])
  expect(validateCombatTagPayload({ ...endure, recipient: 'primary-unit' })).not.toEqual([])
  expect(
    validateCombatTagPayload({
      type: 'apply-status',
      recipient: 'actor',
      statusId: 'endure',
      stacks: 1,
    }),
  ).not.toEqual([])
})
it('keeps the cast turn and then counts the programmed complete bearer turns', () => {
  let state = cast({ durationTurns: 2 })
  state = finish(state).state
  expect(
    state.statusState
      .find((row) => row.combatantId === 'actor')!
      .statuses.find((row) => row.statusId === 'endure')?.remainingOwnerTurnEnds,
  ).toBe(2)
  state = release(state).state
  expect(
    state.statusState
      .find((row) => row.combatantId === 'actor')!
      .statuses.find((row) => row.statusId === 'endure')?.remainingOwnerTurnEnds,
  ).toBe(1)
  state = release(state).state
  expect(
    state.statusState
      .find((row) => row.combatantId === 'actor')!
      .statuses.some((row) => row.statusId === 'endure'),
  ).toBe(false)
})
it('tracks actual HP damage after Barrier without mitigating the release again', () => {
  let state = percentageDotEncounter()
  state = executeCombatAction(
    { ...state, modularSkillPolicyVersion: 1 },
    action([{ type: 'barrier-change', recipient: 'actor', amount: 10 }]),
    self,
    PV1F_COMBAT_CONTENT,
  ).state as typeof state
  let active = incoming(cast({}, state), 20)
  expect(received(active)).toBe(10)
  active = {
    ...active,
    statBridge: {
      ...active.statBridge!,
      combatants: active.statBridge!.combatants.map((row) =>
        row.combatantId === 'enemy' ? { ...row, armor: 1000, ward: 1000 } : row,
      ),
    },
  }
  const result = release(JSON.parse(JSON.stringify(active)))
  expect(hp(result.state, 'enemy')).toBe(985)
  expect(hp(result.state, 'other')).toBe(985)
})
it('applies each target’s Barrier separately to the full release', () => {
  let state = incoming(cast({}, { ...percentageDotEncounter(), modularSkillPolicyVersion: 1 }))
  state = executeCombatAction(
    state,
    action([{ type: 'barrier-change', recipient: 'actor', amount: 20 }]),
    self,
    PV1F_COMBAT_CONTENT,
  ).state
  const result = release(state)
  expect(hp(result.state, 'enemy')).toBe(990)
  expect(hp(result.state, 'other')).toBe(970)
})
it('does not subtract healing or count HP costs as received damage', () => {
  let state = cast()
  state = executeCombatAction(
    state,
    {
      ...action([{ type: 'healing', recipient: 'actor', amount: 0 }]),
      cost: { mp: 0, hp: 5, spendsAction: false },
    },
    self,
    PV1F_COMBAT_CONTENT,
  ).state
  expect(received(state)).toBe(0)
  state = incoming(state)
  while (state.tactical.battle.currentTurn!.combatantId !== 'actor') state = finish(state).state
  state = executeCombatAction(
    state,
    action([{ type: 'healing', recipient: 'actor', amount: 10 }]),
    self,
    PV1F_COMBAT_CONTENT,
  ).state
  expect(received(state)).toBe(20)
  const result = finish(state)
  expect(hp(result.state, 'actor')).toBe(985)
  expect(hp(result.state, 'enemy')).toBe(970)
})
it('counts scheduled DoT HP damage before expiry', () => {
  let state = cast()
  state = finish(state).state
  state = executeCombatAction(
    state,
    action(
      [
        { type: 'damage', recipient: 'primary-unit', amount: 20 },
        {
          type: 'bleed',
          recipient: 'primary-unit',
          ticks: 1,
          durationTurns: 1,
          damageProfile: { kind: 'attack-percentage', basisPoints: 2500 },
        },
      ],
      false,
    ),
    { kind: 'unit', combatantId: 'actor' },
    PV1F_COMBAT_CONTENT,
  ).state
  const result = release(state)
  expect(hp(result.state, 'actor')).toBe(975)
  expect(hp(result.state, 'enemy')).toBe(963)
})
it.each(['enemies', 'allies', 'all'] as const)(
  'releases onto the programmed %s team set including self where appropriate',
  (targetTeams) => {
    const result = release(incoming(cast({ targetTeams })))
    expect(hp(result.state, 'enemy')).toBe(targetTeams === 'allies' ? 1000 : 970)
    expect(hp(result.state, 'ally')).toBe(targetTeams === 'enemies' ? 1000 : 970)
    expect(hp(result.state, 'actor')).toBe(targetTeams === 'enemies' ? 980 : 950)
  },
)
it('uses the bearer’s current position and range at expiry', () => {
  let state = incoming(cast({ radiusTiles: 1 }))
  state = {
    ...state,
    tactical: {
      ...state.tactical,
      placements: state.tactical.placements.map((row) =>
        row.combatantId === 'actor' ? { ...row, position: { x: 4, y: 1 } } : row,
      ),
    },
  }
  const result = release(state)
  expect(hp(result.state, 'enemy')).toBe(1000)
  expect(hp(result.state, 'other')).toBe(970)
})
it('removing Endure clears the private window without releasing damage', () => {
  let state = incoming(cast())
  state = executeCombatAction(
    state,
    action(
      [
        {
          type: 'remove-status',
          recipient: 'primary-unit',
          statusIds: ['endure'],
          removalMode: 'specified',
        },
      ],
      false,
    ),
    { kind: 'unit', combatantId: 'actor' },
    PV1F_COMBAT_CONTENT,
  ).state
  expect(state.endureState?.applications).toEqual([])
  const result = release(state)
  expect(
    result.events.some(
      (row) => row.event === 'damage_applied' && row.actionId === 'status.endure.release',
    ),
  ).toBe(false)
  expect(hp(result.state, 'enemy')).toBe(1000)
})
it('a lethal hit clears Endure without a release or an overkill ledger', () => {
  const state = incoming(cast(), 2000)
  expect(hp(state, 'actor')).toBe(0)
  expect(state.endureState?.applications).toEqual([])
  expect(
    state.statusState
      .find((row) => row.combatantId === 'actor')!
      .statuses.some((row) => row.statusId === 'endure'),
  ).toBe(false)
  expect(validateCombatEncounterState(state)).toEqual([])
})
it('recasting replaces and resets the private window without an early burst', () => {
  let state = incoming(cast())
  while (state.tactical.battle.currentTurn!.combatantId !== 'actor') state = finish(state).state
  state = cast({ releaseBasisPoints: 25000 }, state)
  expect(received(state)).toBe(0)
  expect(hp(state, 'enemy')).toBe(1000)
  const active = state.statusState
    .find((row) => row.combatantId === 'actor')!
    .statuses.find((row) => row.statusId === 'endure')!
  expect(active.endure?.releaseBasisPoints).toBe(25000)
})
it('rejects corrupted private ledgers after restore', () => {
  const state = cast()
  expect(validateCombatEncounterState(JSON.parse(JSON.stringify(state)))).toEqual([])
  const broken = structuredClone(state)
  Object.assign(broken.endureState!.applications[0]!, { receivedDamage: -1 })
  expect(validateCombatEncounterState(broken)).not.toEqual([])
  expect(validateCombatEncounterState({ ...state, endureState: undefined })).not.toEqual([])
})
it('blocks Basic Attack, mixed damage, percentage DoTs and manual automatic-looking tags', () => {
  const state = cast()
  for (const effect of [
    { type: 'damage', recipient: 'primary-unit', amount: 1 },
    { type: 'poison', recipient: 'primary-unit' },
    {
      type: 'damage',
      recipient: 'primary-unit',
      amount: 0,
      vengeance: { conversionBasisPoints: 10000, maximumDamage: 20 },
    },
  ] as CombatEffectDefinition[]) {
    const castAction = {
      ...action([{ type: 'healing', recipient: 'actor', amount: 1 }, effect], false),
      tags: ['automatic'],
    }
    expect(
      evaluateCombatAction(
        state,
        castAction,
        { kind: 'unit', combatantId: 'enemy' },
        PV1F_COMBAT_CONTENT,
      ).issues,
    ).toContainEqual(expect.objectContaining({ code: 'endure-active' }))
  }
  expect(
    evaluateCombatAction(
      state,
      {
        ...action([{ type: 'damage', recipient: 'primary-unit', amount: 1 }], false),
        sourceType: 'basic-attack',
      },
      { kind: 'unit', combatantId: 'enemy' },
      PV1F_COMBAT_CONTENT,
    ).legal,
  ).toBe(false)
  expect(
    evaluateCombatAction(
      state,
      action(
        [{ type: 'resource-change', recipient: 'primary-unit', resource: 'mp', delta: -5 }],
        false,
      ),
      { kind: 'unit', combatantId: 'enemy' },
      PV1F_COMBAT_CONTENT,
    ).legal,
  ).toBe(true)
})
it('permits engine-owned automatic damage and captures Counter returns without recursion', () => {
  let state = cast()
  state = {
    ...state,
    statusState: state.statusState.map((row) =>
      row.combatantId === 'enemy'
        ? {
            ...row,
            statuses: [
              {
                statusId: 'counter',
                statusVersion: 1,
                stacks: 1,
                sourceCombatantId: 'enemy',
                remainingOwnerTurnStarts: 2,
                counter: { kind: 'full', basisPoints: 10000 },
              },
            ],
          }
        : row,
    ),
  }
  const attack = action([{ type: 'damage', recipient: 'primary-unit', amount: 20 }], false)
  const context = {
    provenance: createCombatActionProvenance({
      rulesetVersion: 2,
      sourceKind: 'resonance',
      actionDefinitionId: attack.id,
      actionVersion: 1,
      sourceCombatantId: 'actor',
      controllerCombatantId: 'actor',
      triggerChainId: 'endure.auto',
    }),
    triggerGuard: createCombatTriggerGuard({ triggerChainId: 'endure.auto' }),
    executionAuthority: { activation: 'automatic' as const, actorId: 'actor' },
  }
  const result = executeCombatAction(
    state,
    attack,
    { kind: 'unit', combatantId: 'enemy' },
    PV1F_COMBAT_CONTENT,
    context,
  )
  expect(received(result.state)).toBe(20)
  expect(hp(result.state, 'actor')).toBe(980)
  expect(result.events.filter((row) => row.event === 'damage_applied')).toHaveLength(2)
})
it('shows its captured pending profile and uses full global rounds after delayed activation', () => {
  const state = {
    ...percentageDotEncounter(),
    effectTimingPolicy: { version: 1, modes: { endure: 'next-round' as const } },
  }
  let pending = cast({ durationTurns: 2 }, state)
  expect(
    pending.statusState.some((row) => row.statuses.some((status) => status.statusId === 'endure')),
  ).toBe(false)
  expect(pendingCombatStatusRows(pending)[0]!.status.endure).toMatchObject({
    releaseBasisPoints: 15000,
    radiusTiles: 3,
    targetTeams: 'enemies',
  })
  for (let turns = 0; turns < 4; turns++) pending = finish(pending).state
  expect(
    pending.statusState
      .find((row) => row.combatantId === 'actor')!
      .statuses.find((row) => row.statusId === 'endure'),
  ).toMatchObject({ durationScope: 'rounds', remainingRoundBoundaries: 2 })
  expect(validateCombatEncounterState(JSON.parse(JSON.stringify(pending)))).toEqual([])
})
it('gives fresh Endure positive AI utility without repeatedly rewarding refreshes', () => {
  const initial = percentageDotEncounter()
  const castAction = action([endure])
  const evaluation = evaluateCombatAction(initial, castAction, self, PV1F_COMBAT_CONTENT)
  expect(projectedCombatEffectUtility(evaluation, initial, [endure])).toBeGreaterThan(0)
  const active = cast()
  expect(
    projectedCombatEffectUtility(
      evaluateCombatAction(active, castAction, self, PV1F_COMBAT_CONTENT),
      active as typeof initial,
      [endure],
    ),
  ).toBe(0)
})

it('releases after the programmed delayed global-round lifetime', () => {
  let state = cast(
    { durationTurns: 1 },
    {
      ...percentageDotEncounter(),
      effectTimingPolicy: { version: 1, modes: { endure: 'next-round' } },
    },
  )
  for (let turn = 0; turn < 4; turn++) state = finish(state).state
  expect(state.tactical.battle.round).toBe(2)
  state = incoming(state)
  let released: ReturnType<typeof finish> | undefined
  while (state.tactical.battle.round < 3) {
    released = finish(state)
    state = released.state
  }
  expect(hp(state, 'enemy')).toBe(970)
  expect(hp(state, 'other')).toBe(970)
  expect(state.endureState?.applications).toEqual([])
  expect(
    released!.events.filter(
      (row) => row.event === 'damage_applied' && row.actionId === 'status.endure.release',
    ),
  ).toHaveLength(2)
})
it('permits damage already pending before Endure while blocking new damaging commands', () => {
  let state: CombatEncounterState = {
    ...percentageDotEncounter(),
    effectTimingPolicy: { version: 1, modes: { damage: 'delayed', endure: 'instant' } },
  }
  state = executeCombatAction(
    state,
    action([{ type: 'damage', recipient: 'primary-unit', amount: 20 }], false),
    { kind: 'unit', combatantId: 'enemy' },
    PV1F_COMBAT_CONTENT,
  ).state
  state = cast({ durationTurns: 4 }, state)
  while (state.tactical.battle.round < 3) state = finish(state).state
  expect(hp(state, 'enemy')).toBe(980)
  expect(
    state.statusState
      .find((row) => row.combatantId === 'actor')!
      .statuses.some((row) => row.statusId === 'endure'),
  ).toBe(true)
  expect(
    evaluateCombatAction(
      state,
      action([{ type: 'damage', recipient: 'primary-unit', amount: 1 }], false),
      { kind: 'unit', combatantId: 'enemy' },
      PV1F_COMBAT_CONTENT,
    ).legal,
  ).toBe(false)
})
it('removes the old Endure before Counter returns and releases only once', () => {
  let state = incoming(cast())
  state = {
    ...state,
    statusState: state.statusState.map((row) =>
      row.combatantId === 'enemy'
        ? {
            ...row,
            statuses: [
              {
                statusId: 'counter',
                statusVersion: 1,
                stacks: 1,
                sourceCombatantId: 'enemy',
                remainingOwnerTurnStarts: 4,
                counter: { kind: 'full', basisPoints: 10000 },
              },
            ],
          }
        : row,
    ),
  }
  const result = release(state)
  expect(hp(result.state, 'actor')).toBe(950)
  expect(result.state.endureState?.applications).toEqual([])
  expect(result.events.filter((row) => row.event === 'damage_applied')).toHaveLength(3)
})
it('prepares a successor only once when expiry defeats the incoming actor', () => {
  let state = incoming(cast())
  while (state.tactical.battle.currentTurn!.combatantId !== 'actor') state = finish(state).state
  state = {
    ...state,
    tactical: {
      ...state.tactical,
      battle: {
        ...state.tactical.battle,
        combatants: state.tactical.battle.combatants.map((row) =>
          row.id === 'enemy' ? { ...row, hp: 20 } : row,
        ),
      },
    },
    statusState: state.statusState.map((row) =>
      row.combatantId === 'other'
        ? {
            ...row,
            statuses: [
              {
                statusId: 'test.successor',
                statusVersion: 1,
                stacks: 1,
                remainingOwnerTurnStarts: 2,
                sourceCombatantId: 'other',
              },
            ],
          }
        : row,
    ),
  }
  const content = {
    statuses: [
      ...PV1F_COMBAT_CONTENT.statuses,
      {
        id: 'test.successor',
        version: 1,
        maximumStacks: 1,
        durationOwnerTurnStarts: 2,
        damageTakenMultiplierBasisPoints: 10000,
      },
    ],
  }
  const result = endCombatTurn(
    { ...state, tactical: selectCurrentFinalFacing(state.tactical, 'west').state },
    content,
  )
  expect(result.state.tactical.battle.currentTurn!.combatantId).toBe('other')
  expect(
    result.state.statusState
      .find((row) => row.combatantId === 'other')!
      .statuses.find((row) => row.statusId === 'test.successor')?.remainingOwnerTurnStarts,
  ).toBe(1)
  expect(validateCombatEncounterState(result.state)).toEqual([])
})

it('rejects Endure clocks that could turn a bounded window into a permanent buff', () => {
  const state = cast()
  const permanent = {
    ...state,
    statusState: state.statusState.map((row) => ({
      ...row,
      statuses: row.statuses.map((status) =>
        status.statusId === 'endure' ? { ...status, durationScope: 'battle' as const } : status,
      ),
    })),
  }
  expect(validateCombatEncounterState(permanent)).not.toEqual([])
  const mismatched = {
    ...state,
    statusState: state.statusState.map((row) => ({
      ...row,
      statuses: row.statuses.map((status) =>
        status.statusId === 'endure' ? { ...status, remainingOwnerTurnEnds: 4 } : status,
      ),
    })),
  }
  expect(validateCombatEncounterState(mismatched)).not.toEqual([])
})

it.each(['discipline-skill', 'essence', 'resonance'] as const)(
  'captures the same Endure through a canonical %s source',
  async (sourceKind) => {
    const { captureCombatAbilitySource } = await import('./combat-behavior-capture')
    const { source } = await import('./combat-behavior.test-utils')
    const { activateCombatAbility, reconcileCombatAbilitySources, combatAbilityCommandContext } =
      await import('./combat-behavior-runtime')
    const { preparePv1fTurnEconomy } = await import('./pv1f-action-economy')
    const captured = captureCombatAbilitySource({
      ...source({
        classification: 'utility',
        attackFamily: undefined,
        costs: [],
        targeting: {
          ...source().definition.behaviors[0]!.targeting!,
          kind: 'self',
          teamPolicy: 'self',
          friendlyFire: 'allies-only',
          minimumRange: 0,
          maximumRange: 0,
        },
        effects: [
          {
            id: 'endure',
            timing: 'instant',
            payload: { ...endure, durationTurns: 2, releaseBasisPoints: 25000 },
          },
        ],
      }),
      sourceKind,
    })
    const initial = reconcileCombatAbilitySources(
      preparePv1fTurnEconomy(percentageDotEncounter()),
      [captured],
    )
    const result = activateCombatAbility({
      state: initial,
      actorId: 'actor',
      source: captured,
      selection: self,
      content: PV1F_COMBAT_CONTENT,
      context: combatAbilityCommandContext(initial, captured),
    })
    expect(
      result.state.statusState
        .find((row) => row.combatantId === 'actor')!
        .statuses.find((row) => row.statusId === 'endure')?.endure,
    ).toEqual({ releaseBasisPoints: 25000, radiusTiles: 3, targetTeams: 'enemies' })
    expect(received(result.state)).toBe(0)
    expect(validateCombatEncounterState(JSON.parse(JSON.stringify(result.state)))).toEqual([])
  },
)
it('canonical manual damage remains blocked before costs are paid', async () => {
  const { captureCombatAbilitySource } = await import('./combat-behavior-capture')
  const { source } = await import('./combat-behavior.test-utils')
  const { activateCombatAbility, reconcileCombatAbilitySources, combatAbilityCommandContext } =
    await import('./combat-behavior-runtime')
  const { preparePv1fTurnEconomy } = await import('./pv1f-action-economy')
  const captured = captureCombatAbilitySource(source())
  const initial = reconcileCombatAbilitySources(
    preparePv1fTurnEconomy(cast() as ReturnType<typeof percentageDotEncounter>),
    [captured],
  )
  const before = JSON.stringify(initial)
  expect(() =>
    activateCombatAbility({
      state: initial,
      actorId: 'actor',
      source: captured,
      selection: { kind: 'unit', combatantId: 'enemy' },
      content: PV1F_COMBAT_CONTENT,
      context: combatAbilityCommandContext(initial, captured),
    }),
  ).toThrow(/endure-active/)
  expect(JSON.stringify(initial)).toBe(before)
})

function roundEndingEndure() {
  let state: CombatEncounterState = percentageDotEncounter()
  state = finish(finish(state).state).state
  state = cast({ targetTeams: 'all' }, state)
  state = finish(state).state
  while (state.tactical.battle.currentTurn!.combatantId !== 'other') state = finish(state).state
  return {
    ...state,
    endureState: {
      ...state.endureState!,
      applications: state.endureState!.applications.map((row) => ({ ...row, receivedDamage: 20 })),
    },
    tactical: {
      ...state.tactical,
      battle: {
        ...state.tactical.battle,
        combatants: state.tactical.battle.combatants.map((row) =>
          row.id === 'ally' ? { ...row, hp: 20 } : row,
        ),
      },
    },
  }
}
it('settles a newly crossed round only once when expiry kills the last selected actor', () => {
  const initial = roundEndingEndure()
  const state = {
    ...initial,
    statusState: initial.statusState.map((row) =>
      row.combatantId === 'actor'
        ? {
            ...row,
            statuses: [
              {
                statusId: 'guarded',
                statusVersion: 1,
                stacks: 1,
                sourceCombatantId: 'actor',
                remainingOwnerTurnStarts: 2,
                remainingOwnerTurnEnds: 2,
                durationScope: 'rounds' as const,
                remainingRoundBoundaries: 2,
              },
            ],
          }
        : row,
    ),
  }
  const result = finish(state)
  expect(result.state.tactical.battle.round).toBe(3)
  expect(
    result.state.statusState
      .find((row) => row.combatantId === 'actor')!
      .statuses.find((row) => row.statusId === 'guarded')?.remainingRoundBoundaries,
  ).toBe(1)
})
it('does not feed already settled nested Endure receipts into Counter again', () => {
  const initial = roundEndingEndure()
  const state: CombatEncounterState = {
    ...initial,
    endureState: {
      nextApplicationId: 3,
      applications: [
        { applicationId: 1, combatantId: 'other', receivedDamage: 20 },
        { applicationId: 2, combatantId: 'actor', receivedDamage: 10 },
      ],
    },
    statusState: initial.statusState.map((row) =>
      row.combatantId === 'actor'
        ? {
            ...row,
            statuses: [
              {
                statusId: 'endure',
                statusVersion: 1,
                stacks: 1,
                sourceCombatantId: 'actor',
                timingState: 'active',
                endure: { releaseBasisPoints: 15000, radiusTiles: 3, targetTeams: 'enemies' },
                remainingOwnerTurnStarts: 1,
                remainingOwnerTurnEnds: 1,
                durationScope: 'rounds',
                remainingRoundBoundaries: 1,
              },
            ],
          }
        : row.combatantId === 'enemy'
          ? {
              ...row,
              statuses: [
                {
                  statusId: 'counter',
                  statusVersion: 1,
                  stacks: 1,
                  sourceCombatantId: 'enemy',
                  remainingOwnerTurnStarts: 4,
                  counter: { kind: 'full', basisPoints: 10000 },
                },
              ],
            }
          : row,
    ),
  }
  const result = finish(state)
  expect(
    result.events.filter(
      (row) =>
        row.event === 'damage_applied' &&
        row.actionId === 'status.reflect.current.v1' &&
        row.targetCombatantId === 'actor',
    ),
  ).toHaveLength(1)
})
it('blocks damaging legacy status application in preview and commit', () => {
  const state = cast()
  const poison = action(
    [{ type: 'apply-status', recipient: 'primary-unit', statusId: 'poison', stacks: 1 }],
    false,
  )
  expect(
    evaluateCombatAction(state, poison, { kind: 'unit', combatantId: 'enemy' }, PV1F_COMBAT_CONTENT)
      .issues,
  ).toContainEqual(expect.objectContaining({ code: 'endure-active' }))
  expect(() =>
    executeCombatAction(state, poison, { kind: 'unit', combatantId: 'enemy' }, PV1F_COMBAT_CONTENT),
  ).toThrow(/endure-active/)
})
it('reports a draw when the complete all-team pulse defeats everybody', () => {
  let state = cast({ targetTeams: 'all' })
  state = finish(state).state
  while (state.tactical.battle.currentTurn!.combatantId !== 'actor') state = finish(state).state
  state = {
    ...state,
    endureState: {
      ...state.endureState!,
      applications: state.endureState!.applications.map((row) => ({ ...row, receivedDamage: 20 })),
    },
    tactical: {
      ...state.tactical,
      battle: {
        ...state.tactical.battle,
        combatants: state.tactical.battle.combatants.map((row) => ({ ...row, hp: 20 })),
      },
    },
  }
  const result = finish(state)
  expect(result.state.tactical.battle.combatants.every((row) => row.hp === 0)).toBe(true)
  expect(result.events.filter((row) => row.event === 'battle_completed')).toEqual([
    { event: 'battle_completed', winningTeamId: null },
  ])
})

it('blocks eligible damaging Debuff copies but allows selected non-damaging copies', async () => {
  const { normalizeCombatEffectState } = await import('./combat-effect-state')
  let state = cast()
  state = executeCombatAction(
    state,
    action([{ type: 'apply-status', recipient: 'actor', statusId: 'hexed', stacks: 1 }]),
    self,
    PV1F_COMBAT_CONTENT,
  ).state
  state = {
    ...state,
    effectState: {
      ...normalizeCombatEffectState(state.effectState),
      bleed: [
        {
          targetCombatantId: 'actor',
          sourceCombatantId: 'enemy',
          sourceActionId: 'test.legacy-bleed',
          damagePerTick: 3,
          remainingTicks: 2,
          applicationOrder: 1,
          curseCopyable: true,
        },
      ],
    },
  }
  const copy = (statusIds: readonly string[]) =>
    action([{ type: 'copy-statuses', recipient: 'primary-unit', mode: 'curse', statusIds }], false)
  expect(
    evaluateCombatAction(
      state,
      copy(['bleed']),
      { kind: 'unit', combatantId: 'enemy' },
      PV1F_COMBAT_CONTENT,
    ).issues,
  ).toContainEqual(expect.objectContaining({ code: 'endure-active' }))
  expect(
    evaluateCombatAction(
      state,
      copy(['hexed']),
      { kind: 'unit', combatantId: 'enemy' },
      PV1F_COMBAT_CONTENT,
    ).legal,
  ).toBe(true)
})
it('allows an earned lethal Counter return before the final terminal verdict', () => {
  const initial = percentageDotEncounter()
  const keep = (id: string) => id === 'actor' || id === 'enemy'
  let state: CombatEncounterState = {
    ...initial,
    tactical: {
      ...initial.tactical,
      battle: {
        ...initial.tactical.battle,
        combatants: initial.tactical.battle.combatants.filter((row) => keep(row.id)),
        initiativeOrder: initial.tactical.battle.initiativeOrder.filter(keep),
        initiativeTieOrder: initial.tactical.battle.initiativeTieOrder?.filter(keep),
      },
      placements: initial.tactical.placements.filter((row) => keep(row.combatantId)),
    },
    statBridge: {
      ...initial.statBridge,
      combatants: initial.statBridge.combatants.filter((row) => keep(row.combatantId)),
    },
    statusState: initial.statusState.filter((row) => keep(row.combatantId)),
  }
  state = cast({}, state)
  state = finish(state).state
  while (state.tactical.battle.currentTurn!.combatantId !== 'actor') state = finish(state).state
  state = {
    ...state,
    endureState: {
      ...state.endureState!,
      applications: state.endureState!.applications.map((row) => ({ ...row, receivedDamage: 20 })),
    },
    tactical: {
      ...state.tactical,
      battle: {
        ...state.tactical.battle,
        combatants: state.tactical.battle.combatants.map((row) => ({ ...row, hp: 20 })),
      },
    },
    statusState: state.statusState.map((row) =>
      row.combatantId === 'enemy'
        ? {
            ...row,
            statuses: [
              {
                statusId: 'counter',
                statusVersion: 1,
                stacks: 1,
                sourceCombatantId: 'enemy',
                remainingOwnerTurnStarts: 4,
                counter: { kind: 'full', basisPoints: 10000 },
              },
            ],
          }
        : row,
    ),
  }
  const result = finish(state)
  expect(result.state.tactical.battle.combatants.every((row) => row.hp === 0)).toBe(true)
  expect(
    result.events.filter(
      (row) => row.event === 'damage_applied' && row.actionId === 'status.reflect.current.v1',
    ),
  ).toHaveLength(1)
  expect(result.events.filter((row) => row.event === 'battle_completed')).toEqual([
    { event: 'battle_completed', winningTeamId: null },
  ])
})

import { cancelCombatControlledAbility } from './combat-behavior-runtime'
import {
  combatControlledAbilityAvailability,
  primeCombatControlledAbility,
} from './combat-behavior-runtime'
import { resolveMatureSkillVersion } from './mature-skills'
import { evaluatePv1fMatureSkill, executePv1fMatureSkill } from './pv1f-action-economy'
import { endCombatTurn } from './actions'
import { selectCurrentFinalFacing } from './board'
import { applyCombatStatusCopies } from './combat-status-copy'
import { expect, it } from 'vitest'
import { source } from './combat-behavior.test-utils'
import { percentageDotEncounter } from './combat-percentage-dots.test-utils'
import {
  executeCombatAction,
  evaluateCombatAction,
  validateCombatEncounterState,
  type CombatActionDefinition,
  type CombatEncounterState,
} from './actions'
import { preparePv1fTurnEconomy, PV1F_COMBAT_CONTENT } from './pv1f-action-economy'
import { createAuthorableEffectPayload } from './combat-effect-authoring'
import { validateCombatTagPayload } from './combat-tag-registry'
import { captureCombatAbilitySource } from './combat-behavior-capture'
import {
  combatAbilityCommandContext,
  reconcileCombatAbilitySources,
} from './combat-behavior-runtime'
import { prepareCombatAbilityCommand, commitCombatAbilityCommand } from './combat-ability-command'

const categories = ['attack', 'recovery', 'utility'] as const
const selections = Array.from({ length: 7 }, (_, i) =>
  categories.filter((_, n) => (i + 1) & (1 << n)),
)
const self = { kind: 'self' as const }
const target = { kind: 'unit' as const, combatantId: 'enemy' }
function cast(effects: CombatActionDefinition['effects']): CombatActionDefinition {
  return {
    id: 'test.seal',
    version: 1,
    sourceType: 'scenario',
    tags: [],
    target: {
      kind: 'self',
      teamPolicy: 'self',
      shape: { kind: 'single' },
      minimumRange: 0,
      maximumRange: 0,
      requiresLineOfSight: false,
      maximumElevationDifference: null,
      friendlyFire: 'all-units',
    },
    cost: { mp: 0, spendsAction: false },
    requirements: [],
    effects,
  }
}
function sealed(selected: readonly string[] = categories) {
  const state = preparePv1fTurnEconomy({
    ...percentageDotEncounter(),
    effectTimingPolicy: {
      version: 1 as const,
      modes: { seal: 'instant' as const, 'remove-status': 'instant' as const },
    },
  })
  return executeCombatAction(
    state,
    cast([
      {
        type: 'apply-status',
        recipient: 'actor',
        statusId: 'seal',
        stacks: 1,
        durationTurns: 2,
        sealedCategories: selected,
      } as never,
    ]),
    self,
    PV1F_COMBAT_CONTENT,
  ).state
}
function command(
  state: CombatEncounterState,
  classification: (typeof categories)[number],
  sourceKind: ReturnType<typeof source>['sourceKind'] = 'discipline-skill',
) {
  const captured = captureCombatAbilitySource({
    ...source({
      classification,
      ...(classification === 'attack' ? {} : { attackFamily: undefined }),
    }),
    sourceKind,
  })
  const ready = reconcileCombatAbilitySources(state, [captured])
  return {
    state: ready,
    actorId: 'actor',
    selection: target,
    content: PV1F_COMBAT_CONTENT,
    root: { kind: 'canonical' as const, source: captured },
    context: combatAbilityCommandContext(ready, captured),
  }
}
it('authors a typed Seal with all categories and the ordinary two-turn default', () => {
  expect(createAuthorableEffectPayload('status:seal')).toMatchObject({
    statusId: 'seal',
    sealedCategories: categories,
    durationTurns: 2,
  })
})
it.each(selections.map((selected) => [selected]))(
  'blocks exactly the authored category selection %j',
  (selected) => {
    const state = sealed(selected)
    for (const classification of categories) {
      const input = command(state, classification)
      expect(
        prepareCombatAbilityCommand(input).evaluation.issues.some((x) => x.code === 'skill-sealed'),
      ).toBe(selected.includes(classification))
    }
  },
)
it.each([
  'basic',
  'essence',
  'resonance',
  'equipment',
  'soulmark',
  'mantle',
  'status-granted',
  'tactical-entity',
] as const)('leaves %s sources usable', (kind) => {
  const prepared = prepareCombatAbilityCommand(command(sealed(), 'attack', kind))
  expect(prepared.evaluation.legal).toBe(true)
})
it('rejects a sealed commit without spending resources or mutating status/history', () => {
  const input = command(sealed(), 'attack')
  const before = JSON.stringify(input.state)
  expect(() => commitCombatAbilityCommand(input)).toThrow(/seal/i)
  expect(JSON.stringify(input.state)).toBe(before)
})
it.each([undefined, [], ['attack', 'attack'], ['all'], ['Attack'], ['attack', 'resonance'], [1]])(
  'rejects invalid Seal category selection %j',
  (selected) => {
    expect(
      validateCombatTagPayload({
        type: 'apply-status',
        recipient: 'primary-unit',
        statusId: 'seal',
        stacks: 1,
        sealedCategories: selected,
      } as never),
    ).not.toHaveLength(0)
  },
)
it('rejects category metadata on other statuses', () => {
  expect(
    validateCombatTagPayload({
      type: 'apply-status',
      recipient: 'actor',
      statusId: 'blind',
      stacks: 1,
      sealedCategories: ['attack'],
    } as never),
  ).not.toHaveLength(0)
})
it('preserves categories across serialization, validates restored selections and Cleanse removes Seal', () => {
  const state = JSON.parse(JSON.stringify(sealed(['attack', 'utility']))) as CombatEncounterState
  expect(validateCombatEncounterState(state)).toEqual([])
  expect(prepareCombatAbilityCommand(command(state, 'attack')).evaluation.legal).toBe(false)
  const cleansed = executeCombatAction(
    state,
    cast([
      {
        type: 'remove-status',
        recipient: 'actor',
        statusIds: ['seal'],
        removalMode: 'all-debuffs',
      },
    ]),
    self,
    PV1F_COMBAT_CONTENT,
  ).state
  expect(prepareCombatAbilityCommand(command(cleansed, 'attack')).evaluation.legal).toBe(true)
  const row = state.statusState.find((x) => x.combatantId === 'actor')!
  row.statuses = row.statuses.map((status) => ({ ...status, sealedCategories: [] }))
  expect(validateCombatEncounterState(state)).not.toHaveLength(0)
})
it('does not block a pending Seal', () => {
  const state = sealed(['attack'])
  const row = state.statusState.find((x) => x.combatantId === 'actor')!
  row.statuses = row.statuses.map((s) => ({
    ...s,
    timingState: 'pending',
    activationRound: state.tactical.battle.round + 1,
  }))
  expect(prepareCombatAbilityCommand(command(state, 'attack')).evaluation.legal).toBe(true)
})
it('blocks legacy discipline actions while keeping legacy Essence and Basic Attack usable', () => {
  const state = sealed(['attack'])
  const action: CombatActionDefinition = {
    ...cast([{ type: 'damage', recipient: 'primary-unit', amount: 1 }]),
    sourceType: 'discipline-skill',
    tags: ['attack'],
    target: {
      kind: 'unit',
      teamPolicy: 'enemy',
      shape: { kind: 'single' },
      friendlyFire: 'enemies-only',
      minimumRange: 1,
      maximumRange: 4,
      requiresLineOfSight: false,
      maximumElevationDifference: null,
    },
  }
  expect(evaluateCombatAction(state, action, target, PV1F_COMBAT_CONTENT).issues).toContainEqual(
    expect.objectContaining({ code: 'skill-sealed' }),
  )
  for (const allowed of [
    { ...action, tags: ['attack', 'essence'] },
    { ...action, sourceType: 'basic-attack' as const },
  ])
    expect(evaluateCombatAction(state, allowed, target, PV1F_COMBAT_CONTENT).legal).toBe(true)
})

it('suppresses a newly triggered automatic discipline modifier without blocking the exempt root', () => {
  const input = command(sealed(['attack']), 'attack', 'basic')
  const modifier = captureCombatAbilitySource(
    source(
      {
        id: 'bonus',
        mode: 'modifier',
        activation: 'automatic',
        targeting: null,
        costs: [{ resource: 'ap', amount: 7 }],
        requirements: { kind: 'action', classification: 'attack' },
        activationLimits: ['once-per-action'],
      },
      'seal-modifier',
    ),
  )
  const state = reconcileCombatAbilitySources(input.state, [input.root.source, modifier])
  const prepared = prepareCombatAbilityCommand({ ...input, state })
  expect(prepared.evaluation.legal).toBe(true)
  expect(prepared.participants).toHaveLength(1)
  expect(prepared.modifierSuppressions).toContainEqual(
    expect.objectContaining({ reason: 'skill-sealed' }),
  )
})

it('retains the union of repeated and copied Seal applications across reload', () => {
  let state = sealed(['attack'])
  state = executeCombatAction(
    state,
    cast([
      {
        type: 'apply-status',
        recipient: 'actor',
        statusId: 'seal',
        stacks: 1,
        durationTurns: 2,
        sealedCategories: ['utility'],
      },
    ]),
    self,
    PV1F_COMBAT_CONTENT,
  ).state
  expect(prepareCombatAbilityCommand(command(state, 'attack')).evaluation.legal).toBe(false)
  expect(prepareCombatAbilityCommand(command(state, 'utility')).evaluation.legal).toBe(false)
  expect(prepareCombatAbilityCommand(command(state, 'recovery')).evaluation.legal).toBe(true)
  state = applyCombatStatusCopies(
    state,
    'actor',
    'enemy',
    'copy',
    {
      type: 'copy-statuses',
      recipient: 'primary-unit',
      mode: 'curse',
      statusIds: ['seal'],
      durationPolicyVersion: 1,
    },
    PV1F_COMBAT_CONTENT,
  ).state
  state = JSON.parse(JSON.stringify(state))
  expect(validateCombatEncounterState(state)).toEqual([])
  const copied = state.statusState
    .find((row) => row.combatantId === 'enemy')!
    .statuses.find((s) => s.statusId === 'seal')!
  expect(copied.applicationModifiers?.map((row) => row.sealedCategories)).toEqual([
    ['attack'],
    ['utility'],
  ])
})
it('expires Seal through the normal owner-turn lifecycle', () => {
  let state = sealed(['attack'])
  for (let i = 0; i < 12; i++)
    state = endCombatTurn(
      { ...state, tactical: selectCurrentFinalFacing(state.tactical, 'west').state },
      PV1F_COMBAT_CONTENT,
    ).state
  expect(
    state.statusState
      .find((row) => row.combatantId === 'actor')!
      .statuses.some((status) => status.statusId === 'seal'),
  ).toBe(false)
  expect(prepareCombatAbilityCommand(command(state, 'attack')).evaluation.legal).toBe(true)
})
it('does not infer a canonical category from damage effects', () => {
  const state = sealed(['attack'])
  // The fixture contains damage even when explicitly classified Recovery or Utility.
  for (const category of ['recovery', 'utility'] as const)
    expect(prepareCombatAbilityCommand(command(state, category)).evaluation.legal).toBe(true)
})
it('rejects an explicitly selected sealed manual modifier without spending the exempt root costs', () => {
  const input = command(sealed(['attack']), 'attack', 'basic')
  const modifier = captureCombatAbilitySource(
    source(
      { id: 'bonus', mode: 'modifier', targeting: null, costs: [{ resource: 'ap', amount: 7 }] },
      'seal-modifier',
    ),
  )
  const state = reconcileCombatAbilitySources(input.state, [input.root.source, modifier])
  const modified = {
    ...input,
    state,
    manualModifiers: [{ sourceInstanceId: modifier.sourceInstanceId, behaviorId: 'bonus' }],
  }
  expect(prepareCombatAbilityCommand(modified).evaluation.legal).toBe(false)
  const before = JSON.stringify(state)
  expect(() => commitCombatAbilityCommand(modified)).toThrow(/seal/i)
  expect(JSON.stringify(state)).toBe(before)
})

it('blocks retained native discipline actions that carry effect-origin metadata', () => {
  const state = sealed(['attack'])
  const action: CombatActionDefinition = {
    ...cast([{ type: 'damage', recipient: 'primary-unit', amount: 1 }]),
    sourceType: 'discipline-skill',
    tags: ['attack'],
    target: {
      kind: 'unit',
      teamPolicy: 'enemy',
      shape: { kind: 'single' },
      minimumRange: 1,
      maximumRange: 4,
      requiresLineOfSight: false,
      maximumElevationDifference: null,
      friendlyFire: 'enemies-only',
    },
    effectOrigins: [{ family: 'skill', contentId: 'test.seal', contentVersion: 1 }],
  }
  expect(evaluateCombatAction(state, action, target, PV1F_COMBAT_CONTENT).issues).toContainEqual(
    expect.objectContaining({ code: 'skill-sealed' }),
  )
  const recovery = { ...action, tags: ['support', 'recovery'] }
  expect(
    evaluateCombatAction(sealed(['recovery']), recovery, target, PV1F_COMBAT_CONTENT).issues,
  ).toContainEqual(expect.objectContaining({ code: 'skill-sealed' }))
})

it.each([
  ['vanguard.forceful-strike', 'attack'],
  ['lifebinder.mend', 'recovery'],
] as const)('rejects real retained %s through its authoritative native entry', (id, category) => {
  const state = sealed([category]) as ReturnType<typeof preparePv1fTurnEconomy>
  const definition = resolveMatureSkillVersion(id)!
  const selection = id === 'lifebinder.mend' ? self : target
  expect(evaluatePv1fMatureSkill(state, definition, selection).evaluation.issues).toContainEqual(
    expect.objectContaining({ code: 'skill-sealed' }),
  )
  const before = JSON.stringify(state)
  expect(() => executePv1fMatureSkill(state, definition, selection)).toThrow(/seal/i)
  expect(JSON.stringify(state)).toBe(before)
})

it('rejects new Controlled preparation under Seal without using its preparation allowance', () => {
  const captured = captureCombatAbilitySource(
    source({
      effects: [
        {
          id: 'hit',
          timing: 'controlled',
          payload: { type: 'damage', recipient: 'primary-unit', amount: 10 },
        },
      ],
    }),
  )
  const state = reconcileCombatAbilitySources(sealed(['attack']), [captured])
  const input = {
    state,
    actorId: 'actor',
    sourceInstanceId: captured.sourceInstanceId,
    behaviorId: 'strike',
    content: PV1F_COMBAT_CONTENT,
  }
  expect(combatControlledAbilityAvailability(input)!.canPrime).toBe(false)
  const before = JSON.stringify(state)
  expect(() => primeCombatControlledAbility(input)).toThrow(/Seal/i)
  expect(JSON.stringify(state)).toBe(before)
})

it('allows cancellation of an existing Controlled preparation after Seal is applied', () => {
  const captured = captureCombatAbilitySource(
    source({
      effects: [
        {
          id: 'hit',
          timing: 'controlled',
          payload: { type: 'damage', recipient: 'primary-unit', amount: 10 },
        },
      ],
    }),
  )
  const initial = reconcileCombatAbilitySources(preparePv1fTurnEconomy(percentageDotEncounter()), [
    captured,
  ])
  const input = {
    actorId: 'actor',
    sourceInstanceId: captured.sourceInstanceId,
    behaviorId: 'strike',
    content: PV1F_COMBAT_CONTENT,
  }
  const primed = primeCombatControlledAbility({ ...input, state: initial }).state
  const state = executeCombatAction(
    primed,
    cast([
      {
        type: 'apply-status',
        recipient: 'actor',
        statusId: 'seal',
        stacks: 1,
        durationTurns: 2,
        sealedCategories: ['attack'],
      },
    ]),
    self,
    PV1F_COMBAT_CONTENT,
  ).state
  expect(combatControlledAbilityAvailability({ ...input, state })!.canCancel).toBe(true)
  expect(() => cancelCombatControlledAbility({ ...input, state })).not.toThrow()
})
it('preserves already committed delayed damage after the caster is sealed', () => {
  const captured = captureCombatAbilitySource(
    source({
      effects: [
        {
          id: 'hit',
          timing: 'next-round',
          payload: { type: 'damage', recipient: 'primary-unit', amount: 10 },
        },
      ],
    }),
  )
  const initial = reconcileCombatAbilitySources(
    preparePv1fTurnEconomy({
      ...percentageDotEncounter(),
      effectTimingPolicy: { version: 1, modes: { seal: 'instant' } },
    }),
    [captured],
  )
  let state = commitCombatAbilityCommand({
    state: initial,
    actorId: 'actor',
    selection: target,
    content: PV1F_COMBAT_CONTENT,
    root: { kind: 'canonical', source: captured },
    context: combatAbilityCommandContext(initial, captured),
  }).state
  expect(state.pendingEffects).toHaveLength(1)
  const enemyHp = state.tactical.battle.combatants.find((unit) => unit.id === 'enemy')!.hp
  state = executeCombatAction(
    state,
    cast([
      {
        type: 'apply-status',
        recipient: 'actor',
        statusId: 'seal',
        stacks: 1,
        durationTurns: 2,
        sealedCategories: ['attack'],
      },
    ]),
    self,
    PV1F_COMBAT_CONTENT,
  ).state
  for (let i = 0; i < 4; i++)
    state = endCombatTurn(
      { ...state, tactical: selectCurrentFinalFacing(state.tactical, 'west').state },
      PV1F_COMBAT_CONTENT,
    ).state
  expect(state.tactical.battle.combatants.find((unit) => unit.id === 'enemy')!.hp).toBeLessThan(
    enemyHp,
  )
  expect(state.pendingEffects).toHaveLength(0)
})

import { captureCombatAbilitySource } from './combat-behavior-capture'
import { source } from './combat-behavior.test-utils'
import {
  activateCombatAbility,
  evaluateCombatAbility,
  reconcileCombatAbilitySources,
  combatAbilityCommandContext,
} from './combat-behavior-runtime'
import { normalizeCombatRuntimeEncounterState } from './combat-runtime-state'
import { describe, expect, it } from 'vitest'
import { PV1F_COMBAT_CONTENT } from './pv1f-combat-content'
import {
  createCombatEncounterState,
  evaluateCombatAction,
  executeCombatAction,
  type CombatActionDefinition,
  type CombatContentCatalog,
  type CombatEncounterState,
  type CombatEffectDefinition,
  type CombatResolutionContext,
  type CombatStatusDefinition,
  type CombatStatusInstance,
} from './actions'
import { createPendingBattle, startBattle } from './battle-state'
import { createTacticalBattleState } from './board'
import { validateCombatActionDefinition } from './combat-authoring-validation'
import {
  createCombatActionProvenance,
  createCombatEffectInstanceProvenance,
  createCombatTriggerGuard,
} from './combat-kernel-types'
import { createStatDrivenCombatEncounterState } from './stat-driven-combat'

const POSITIVE: CombatStatusDefinition = {
  id: 'test.compose.guard',
  version: 1,
  maximumStacks: 2,
  durationOwnerTurnStarts: 4,
  damageTakenMultiplierBasisPoints: 9_000,
  polarity: 'positive',
  amplifyCopyable: true,
  reactionClass: 'ordinary',
}

const NEGATIVE: CombatStatusDefinition = {
  id: 'test.compose.blind',
  version: 1,
  maximumStacks: 1,
  durationOwnerTurnStarts: 4,
  damageTakenMultiplierBasisPoints: 10_000,
  polarity: 'negative',
  curseCopyable: true,
  reactionClass: 'ordinary',
  blindAccuracyPenaltyBasisPoints: 1_500,
}

const CONTENT: CombatContentCatalog = { statuses: [POSITIVE, NEGATIVE] }
const TARGET = { kind: 'unit' as const, combatantId: 'target' }

type CopyMode = 'amplify' | 'curse'

type CopyEffectDraft = {
  type: 'copy-statuses'
  recipient: 'primary-unit'
  mode: CopyMode
  allowNoEligibleEffects?: unknown
}

function status(
  definition: CombatStatusDefinition,
  sourceCombatantId = 'other',
  patch: Partial<CombatStatusInstance> = {},
): CombatStatusInstance {
  return {
    statusId: definition.id,
    statusVersion: definition.version,
    stacks: 1,
    remainingOwnerTurnStarts: 2,
    sourceCombatantId,
    ...patch,
  }
}

function world(
  rows: readonly { combatantId: string; statuses: readonly CombatStatusInstance[] }[] = [],
  actorAccuracy = 10_000,
  targetEvasion = 0,
): CombatEncounterState {
  const ids = ['actor', 'target', 'other']
  const battle = startBattle(
    createPendingBattle({
      battleId: 'battle:status-copy-composition',
      rulesVersion: 2,
      contentVersion: 2,
      rngSeed: 307,
      combatants: ids.map((id, index) => ({
        id,
        teamId: id === 'target' ? 'enemies' : 'players',
        initiative: 30 - index * 10,
        baseMovementBudget: 3,
        hp: 60,
        maxHp: 60,
        mp: 20,
        maxMp: 30,
      })),
    }),
  ).state

  return createStatDrivenCombatEncounterState(
    createCombatEncounterState(
      createTacticalBattleState({
        battle,
        width: 3,
        height: 1,
        terrains: [{ id: 'open', traversalCost: 1 }],
        tiles: ids.map((_, x) => ({ position: { x, y: 0 }, elevation: 0, terrainId: 'open' })),
        movementProfiles: [{ id: 'ground', maxElevationStep: 0, terrainCostOverrides: [] }],
        placements: ids.map((combatantId, x) => ({
          combatantId,
          position: { x, y: 0 },
          facing: 'east',
          movementProfileId: 'ground',
        })),
      }),
      rows,
    ),
    ids.map((combatantId) => ({
      combatantId,
      provenance: {
        kind: 'scenario' as const,
        sourceId: `scenario:${combatantId}`,
        sourceRulesVersion: 2,
      },
      accuracy: combatantId === 'actor' ? actorAccuracy : 10_000,
      evasion: combatantId === 'target' ? targetEvasion : 0,
      armor: 0,
      ward: 0,
      jump: 0,
      physicalPower: 20,
      mysticPower: 20,
    })),
  )
}

function copyEffect(mode: CopyMode, allowNoEligibleEffects?: unknown): CombatEffectDefinition {
  const draft: CopyEffectDraft = {
    type: 'copy-statuses',
    recipient: 'primary-unit',
    mode,
    ...(arguments.length >= 2 ? { allowNoEligibleEffects } : {}),
  }
  return draft as unknown as CombatEffectDefinition
}

function action(
  mode: CopyMode,
  effects: readonly CombatEffectDefinition[],
  patch: Partial<CombatActionDefinition> = {},
): CombatActionDefinition {
  return {
    id: `test.compose.${mode}`,
    version: 1,
    sourceType: 'test',
    tags: [],
    target: {
      kind: 'unit',
      teamPolicy: 'enemy',
      shape: { kind: 'single' },
      minimumRange: 0,
      maximumRange: 3,
      requiresLineOfSight: false,
      maximumElevationDifference: null,
      friendlyFire: 'enemies-only',
    },
    cost: { spendsAction: false, mp: 0 },
    requirements: [],
    ...patch,
    effects,
  } as CombatActionDefinition
}

function composed(
  mode: CopyMode,
  allowNoEligibleEffects?: unknown,
  trailing: readonly CombatEffectDefinition[] = [
    { type: 'damage', recipient: 'primary-unit', amount: 7 },
  ],
): CombatActionDefinition {
  const clone = arguments.length >= 2 ? copyEffect(mode, allowNoEligibleEffects) : copyEffect(mode)
  return action(mode, [clone, ...trailing])
}

function statuses(state: CombatEncounterState, combatantId: string) {
  return state.statusState.find((row) => row.combatantId === combatantId)?.statuses ?? []
}

function combatant(state: CombatEncounterState, combatantId: string) {
  const found = state.tactical.battle.combatants.find((row) => row.id === combatantId)
  if (!found) throw new Error(`Missing combatant ${combatantId}`)
  return found
}

function context(mode: CopyMode, chainId = `chain:compose:${mode}`): CombatResolutionContext {
  const actionId = `test.compose.${mode}`
  return {
    provenance: createCombatActionProvenance({
      rulesetVersion: 2,
      sourceKind: 'test',
      actionDefinitionId: actionId,
      actionVersion: 1,
      sourceCombatantId: 'actor',
      controllerCombatantId: 'actor',
      triggerChainId: chainId,
    }),
    triggerGuard: createCombatTriggerGuard({ triggerChainId: chainId }),
  }
}

const malformedNoopPolicies = [0, 1, 'true', null, {}, []]

describe('Amplify/Curse composed-command authoring boundary', () => {
  it.each(['amplify', 'curse'] as const)('accepts copy-first %s composition', (mode) => {
    expect(() => validateCombatActionDefinition(composed(mode))).not.toThrow()
  })

  it('keeps pure copy commands valid without no-op opt-in', () => {
    expect(() =>
      validateCombatActionDefinition(action('amplify', [copyEffect('amplify')])),
    ).not.toThrow()
  })

  it('rejects a copy block that is not the first authored effect in this bounded slice', () => {
    const definition = action('amplify', [
      { type: 'damage', recipient: 'primary-unit', amount: 7 },
      copyEffect('amplify'),
    ])
    expect(() => validateCombatActionDefinition(definition)).toThrow(/first/i)
  })

  it('rejects multiple copy blocks in one command', () => {
    const definition = action('amplify', [copyEffect('amplify'), copyEffect('amplify')])
    expect(() => validateCombatActionDefinition(definition)).toThrow(/one copy/i)
  })

  it.each(malformedNoopPolicies)('rejects malformed no-eligible policy %j', (value) => {
    expect(() => validateCombatActionDefinition(composed('amplify', value))).toThrow(
      /allowNoEligibleEffects/i,
    )
  })

  it('rejects no-op opt-in on a pure copy command', () => {
    const definition = action('amplify', [copyEffect('amplify', true)])
    expect(() => validateCombatActionDefinition(definition)).toThrow(/composed/i)
  })
})

describe('Amplify/Curse composed-command legality and execution', () => {
  it('keeps a composed clone command illegal when no effect is eligible and no opt-in exists', () => {
    const state = world()
    const preview = evaluateCombatAction(state, composed('amplify'), TARGET, CONTENT)
    expect(preview.legal).toBe(false)
    expect(preview.issues).toContainEqual(
      expect.objectContaining({ message: expect.stringMatching(/eligible active statuses/i) }),
    )
  })

  it('allows an explicitly opted-in composed clone block to no-op while later damage resolves', () => {
    const state = world()
    const definition = composed('amplify', true)
    const preview = evaluateCombatAction(state, definition, TARGET, CONTENT)
    expect(preview.legal).toBe(true)
    expect(preview.projectedEffects).toEqual([
      expect.objectContaining({
        effectType: 'damage',
        combatantId: 'target',
        before: 60,
        after: 53,
      }),
    ])
    const result = executeCombatAction(state, definition, TARGET, CONTENT)
    expect(combatant(result.state, 'target').hp).toBe(53)
    expect(statuses(result.state, 'actor')).toEqual([])
  })

  it('Amplify copies eligible state first and then resolves later authored damage', () => {
    const state = world([
      { combatantId: 'target', statuses: [status(POSITIVE, 'other', { stacks: 2 })] },
    ])
    const definition = composed('amplify')
    const result = executeCombatAction(state, definition, TARGET, CONTENT)
    expect(statuses(result.state, 'actor')).toEqual([status(POSITIVE, 'actor', { stacks: 2 })])
    expect(statuses(result.state, 'target')).toEqual(statuses(state, 'target'))
    expect(combatant(result.state, 'target').hp).toBe(55)
  })

  it('Curse copies eligible actor state and then resolves later authored damage', () => {
    const state = world([{ combatantId: 'actor', statuses: [status(NEGATIVE, 'other')] }])
    const definition = composed('curse')
    const result = executeCombatAction(state, definition, TARGET, CONTENT)
    expect(statuses(result.state, 'target')).toEqual([status(NEGATIVE, 'actor')])
    expect(statuses(result.state, 'actor')).toEqual(statuses(state, 'actor'))
    expect(combatant(result.state, 'target').hp).toBe(53)
  })

  it('a hostile miss gates copy and target damage together but preserves a later actor effect', () => {
    const state = world([{ combatantId: 'target', statuses: [status(POSITIVE)] }], 0, 10_000)
    const definition = composed('amplify', undefined, [
      { type: 'damage', recipient: 'primary-unit', amount: 7 },
      { type: 'resource-change', recipient: 'actor', resource: 'mp', delta: 3 },
    ])
    const rolled = { ...definition, accuracyMode: 'per-target' as const }
    const result = executeCombatAction(state, rolled, TARGET, CONTENT)
    expect(result.events).toContainEqual(
      expect.objectContaining({ event: 'combat_accuracy_resolved', hit: false }),
    )
    expect(statuses(result.state, 'actor')).toEqual([])
    expect(combatant(result.state, 'target').hp).toBe(60)
    expect(combatant(result.state, 'actor').mp).toBe(23)
  })
})

describe('Amplify/Curse composed-command K3 provenance', () => {
  it('retains copy ordinal identity at authored effect 0 and later persistent effect ordinal 1', () => {
    const state = world([{ combatantId: 'target', statuses: [status(POSITIVE)] }])
    const definition = composed('amplify', undefined, [
      { type: 'apply-status', recipient: 'primary-unit', statusId: NEGATIVE.id, stacks: 1 },
    ])
    const result = executeCombatAction(state, definition, TARGET, CONTENT, context('amplify'))
    const cloned = statuses(result.state, 'actor').find((row) => row.statusId === POSITIVE.id)
    const applied = statuses(result.state, 'target').find((row) => row.statusId === NEGATIVE.id)
    expect(cloned?.provenance).toMatchObject({ effectOrdinal: 0, copyOrdinal: 0 })
    expect(applied?.provenance).toMatchObject({ effectOrdinal: 1 })
  })

  it('still attaches later K3 provenance when an opted-in copy block has no eligible donor', () => {
    const state = world()
    const definition = composed('amplify', true, [
      { type: 'apply-status', recipient: 'primary-unit', statusId: NEGATIVE.id, stacks: 1 },
    ])
    const result = executeCombatAction(state, definition, TARGET, CONTENT, context('amplify'))
    expect(statuses(result.state, 'actor')).toEqual([])
    const applied = statuses(result.state, 'target').find((row) => row.statusId === NEGATIVE.id)
    expect(applied?.provenance).toMatchObject({ effectOrdinal: 1 })
  })
})

it('preserves global-round duration when copying a current status', () => {
  const state = world([
    {
      combatantId: 'target',
      statuses: [
        status(POSITIVE, 'other', {
          durationScope: 'rounds',
          remainingRoundBoundaries: 2,
          remainingOwnerTurnEnds: 2,
          timingState: 'active',
        }),
      ],
    },
  ])
  const result = executeCombatAction(
    state,
    action('amplify', [copyEffect('amplify')]),
    TARGET,
    CONTENT,
  )
  expect(statuses(result.state, 'actor')[0]).toMatchObject({
    durationScope: 'rounds',
    remainingRoundBoundaries: 2,
    remainingOwnerTurnEnds: 2,
  })
})

describe('Copy Buffs concealed donors', () => {
  const content = PV1F_COMBAT_CONTENT
  function donorState() {
    return world([
      {
        combatantId: 'target',
        statuses: ['invisible', 'covert', 'inspired'].map((id, effectOrdinal) =>
          status(
            content.statuses.find((entry) => entry.id === id)!,
            'target',
            {
              remainingOwnerTurnStarts: 2,
              remainingOwnerTurnEnds: 2,
              provenance: createCombatEffectInstanceProvenance({
                action: createCombatActionProvenance({
                  rulesetVersion: 2,
                  sourceKind: 'test',
                  actionDefinitionId: 'donor-buff',
                  actionVersion: 1,
                  sourceCombatantId: 'target',
                  controllerCombatantId: 'target',
                  triggerChainId: 'donor-buff-chain',
                }),
                targetCombatantId: 'target',
                effectOrdinal,
                createdRound: 1,
                createdTurn: 1,
              }),
              timingState: 'active',
              sourceCommandVisibility: { kind: 'team-only', teamId: 'enemies' },
            },
          ),
        ),
      },
    ])
  }
  function copy(ids = ['invisible', 'covert']): CombatEffectDefinition {
    return {
      type: 'copy-statuses',
      recipient: 'primary-unit',
      mode: 'amplify',
      invisibleDonorPolicyVersion: 1,
      statusIds: ids,
    }
  }
  it('selects an Invisible donor and copies only chosen buffs without consuming donor statuses', () => {
    const state = donorState()
    const definition = action('amplify', [copy()])
    const preview = evaluateCombatAction(state, definition, TARGET, content)
    expect(preview.issues).toEqual([])
    expect(preview.projectedEffects.map((effect) => effect.after)).toEqual([
      'covert:1:2',
      'invisible:1:2',
    ])
    const next = executeCombatAction(state, definition, TARGET, content, context('amplify')).state
    expect(statuses(next, 'target')).toEqual(statuses(state, 'target'))
    expect(statuses(next, 'actor').map((row) => row.statusId)).toEqual(['covert', 'invisible'])
    for (const row of statuses(next, 'actor')) {
      expect(row.provenance?.copiedFromInstanceId).toBe(
        statuses(state, 'target').find((donor) => donor.statusId === row.statusId)!.provenance!
          .instanceId,
      )
      expect(row).toMatchObject({
        sourceCombatantId: 'actor',
        remainingOwnerTurnEnds: 2,
        timingState: 'active',
        sourceCommandVisibility: { kind: 'team-only', teamId: 'players' },
        provenance: { effectOrdinal: 0, copyOrdinal: expect.any(Number) },
      })
    }
    expect(JSON.parse(JSON.stringify(next)).statusState).toEqual(next.statusState)
  })
  it.each([undefined, 'enemy'] as const)(
    'blocks Damage, Poison and negative status packets after Copy (%s targets)',
    (target) => {
      const state = donorState()
      const definition = action('amplify', [
        copy(['invisible']),
        { type: 'damage', recipient: 'primary-unit', amount: 7, ...(target ? { target } : {}) },
        {
          type: 'apply-status',
          recipient: 'primary-unit',
          statusId: 'exposed',
          stacks: 1,
          ...(target ? { target } : {}),
        },
        {
          type: 'poison',
          recipient: 'primary-unit',
          ...(target ? { target } : {}),
        },
      ])
      const preview = evaluateCombatAction(state, definition, TARGET, content)
      expect(preview.issues).toEqual([])
      expect(
        preview.projectedEffects.every((effect) => effect.effectType === 'copy-statuses'),
      ).toBe(true)
      const next = executeCombatAction(state, definition, TARGET, content).state
      expect(combatant(next, 'target').hp).toBe(combatant(state, 'target').hp)
      expect(statuses(next, 'target')).toEqual(statuses(state, 'target'))
      expect(next.effectState?.poison ?? []).toEqual([])
    },
  )
  it('allows later direct damage when a real Reveal packet grants targeting authority', () => {
    const state = donorState()
    const definition = action('amplify', [
      copy(['invisible']),
      {
        type: 'sensory',
        recipient: 'primary-unit',
        revealedDurationOwnerTurnStarts: 2,
        increasedDamageTakenBasisPoints: 1500,
      },
      { type: 'damage', recipient: 'primary-unit', amount: 7 },
    ])
    expect(evaluateCombatAction(state, definition, TARGET, content).issues).toEqual([])
    const next = executeCombatAction(state, definition, TARGET, content).state
    expect(combatant(next, 'target').hp).toBeLessThan(combatant(state, 'target').hp)
    expect(statuses(next, 'target').some((row) => row.statusId === 'revealed')).toBe(true)
  })
  it('keeps Revealed blocking a copied Covert application', () => {
    const state = donorState()
    state.statusState = state.statusState.map((row) =>
      row.combatantId === 'actor'
        ? {
            ...row,
            statuses: [
              status(
                content.statuses.find((definition) => definition.id === 'revealed')!,
                'target',
              ),
            ],
          }
        : row,
    )
    const next = executeCombatAction(
      state,
      action('amplify', [copy(['covert'])]),
      TARGET,
      content,
    ).state
    expect(statuses(next, 'actor').some((row) => row.statusId === 'covert')).toBe(false)
    expect(statuses(next, 'target')).toEqual(statuses(state, 'target'))
  })
  it('keeps an ordinary direct attack blocked against the same donor', () => {
    const definition = action('amplify', [{ type: 'damage', recipient: 'primary-unit', amount: 7 }])
    expect(evaluateCombatAction(donorState(), definition, TARGET, content).issues).toContainEqual(
      expect.objectContaining({ code: 'target-invisible' }),
    )
  })
})

it.each(['discipline-skill', 'essence', 'resonance'] as const)(
  'copies Invisible and Covert through a saved/restored canonical %s capture',
  (sourceKind) => {
    const content = PV1F_COMBAT_CONTENT
    const concealed = ['invisible', 'covert'].map((id) =>
      status(
        content.statuses.find((row) => row.id === id)!,
        'target',
      ),
    )
    const captured = captureCombatAbilitySource({
      ...source({
        classification: 'utility',
        attackFamily: undefined,
        costs: [],
        effects: [
          {
            id: 'clone',
            payload: {
              type: 'copy-statuses',
              recipient: 'primary-unit',
              mode: 'amplify',
              invisibleDonorPolicyVersion: 1,
              statusIds: ['invisible', 'covert'],
              target: 'enemy',
            },
          },
        ],
      }),
      sourceKind,
    })
    const runtime = normalizeCombatRuntimeEncounterState(
      JSON.parse(
        JSON.stringify(
          reconcileCombatAbilitySources(world([{ combatantId: 'target', statuses: concealed }]), [
            captured,
          ]),
        ),
      ),
    )
    const state: CombatEncounterState = {
      ...runtime,
      statBridge: runtime.statBridge ?? undefined,
      turnOrigin: runtime.turnOrigin ?? undefined,
    }
    const restored = captureCombatAbilitySource(
      JSON.parse(JSON.stringify(state.capturedAbilitySources![0])),
    )
    const input = {
      state,
      actorId: 'actor',
      source: restored,
      selection: TARGET,
      content,
      context: combatAbilityCommandContext(state, restored),
    }
    expect(evaluateCombatAbility(input).issues).toEqual([])
    const next = activateCombatAbility(input).state
    expect(statuses(next, 'actor').map((row) => row.statusId)).toEqual(['covert', 'invisible'])
    expect(statuses(next, 'target')).toEqual(statuses(state, 'target'))
  },
)

it('preserves old Copy Buffs concealed-donor targeting when the captured policy is absent', () => {
  const content = PV1F_COMBAT_CONTENT
  const state = world([
    {
      combatantId: 'target',
      statuses: [
        status(
          content.statuses.find((row) => row.id === 'invisible')!,
          'target',
        ),
      ],
    },
  ])
  const historical = action('amplify', [
    { type: 'copy-statuses', recipient: 'primary-unit', mode: 'amplify' },
  ])
  expect(evaluateCombatAction(state, historical, TARGET, content).issues).toContainEqual(
    expect.objectContaining({ code: 'target-invisible' }),
  )
})
it.each([0, 2, true, '1', null])(
  'rejects unknown captured Invisible donor policy %s',
  (invisibleDonorPolicyVersion) => {
    const definition = action('amplify', [
      {
        type: 'copy-statuses',
        recipient: 'primary-unit',
        mode: 'amplify',
        invisibleDonorPolicyVersion,
      } as never,
    ])
    expect(() => validateCombatActionDefinition(definition)).toThrow(/Invisible donor policy/)
  },
)

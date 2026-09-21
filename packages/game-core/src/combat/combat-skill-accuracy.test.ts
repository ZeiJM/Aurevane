import { describe, expect, it } from 'vitest'
import {
  createCombatEncounterState,
  evaluateCombatAction,
  executeCombatAction,
  type CombatActionDefinition,
  type CombatContentCatalog,
  type CombatEffectDefinition,
  type CombatEncounterState,
  type CombatResolutionContext,
} from './actions'
import { advanceBattleRng, createPendingBattle, startBattle } from './battle-state'
import { createTacticalBattleState } from './board'
import { validateCombatActionDefinition } from './combat-authoring-validation'
import { createCombatActionProvenance, createCombatTriggerGuard } from './combat-kernel-types'
import { normalizeCombatEffectState } from './combat-effect-state'
import { applyCurrentBurnState, CURRENT_BURN_BACKLASH_DAMAGE } from './combat-dots'
import { createStatDrivenCombatEncounterState } from './stat-driven-combat'
import {
  createPv1fTemporaryResources,
  evaluatePv1fMatureSkill,
  executePv1fMatureSkill,
} from './pv1f-action-economy'
import {
  P33_REPRESENTATIVE_DISCIPLINE_SKILLS,
  toCombatActionDefinition,
  validateMatureSkillDefinition,
  type MatureSkillDefinition,
} from './mature-skills'

const SELECT = { kind: 'unit' as const, combatantId: 'target' }
const CONTENT: CombatContentCatalog = {
  statuses: [
    {
      id: 'test.debuff',
      version: 1,
      maximumStacks: 1,
      durationOwnerTurnStarts: 2,
      damageTakenMultiplierBasisPoints: 10_000,
      polarity: 'negative',
      reactionClass: 'ordinary',
    },
    {
      id: 'displaced',
      version: 1,
      maximumStacks: 1,
      durationOwnerTurnStarts: 1,
      damageTakenMultiplierBasisPoints: 10_000,
    },
  ],
}
function world(accuracy = 6_000, evasion = 1_000, seed = 53) {
  const ids = ['actor', 'ally', 'target', 'z-target']
  const battle = startBattle(
    createPendingBattle({
      battleId: 'battle:skill-accuracy',
      rulesVersion: 2,
      contentVersion: 2,
      rngSeed: seed,
      combatants: ids.map((id, index) => ({
        id,
        teamId: index < 2 ? 'players' : 'enemies',
        initiative: 40 - index * 10,
        baseMovementBudget: 3,
        hp: index < 2 ? 60 : 100,
        maxHp: 100,
        mp: 20,
        maxMp: 30,
        temporaryResources: createPv1fTemporaryResources(16),
      })),
    }),
  ).state
  const base = createCombatEncounterState(
    createTacticalBattleState({
      battle,
      width: 4,
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
  )
  return createStatDrivenCombatEncounterState(
    base,
    ids.map((combatantId) => ({
      combatantId,
      provenance: { kind: 'scenario', sourceId: `scenario:${combatantId}`, sourceRulesVersion: 2 },
      accuracy: combatantId === 'actor' ? accuracy : 5_000,
      evasion: combatantId === 'target' ? evasion : 0,
      armor: 0,
      ward: 0,
      jump: 0,
      physicalPower: 30,
      mysticPower: 30,
    })),
  )
}
function action(
  effects: readonly CombatEffectDefinition[] = [
    { type: 'damage', recipient: 'primary-unit', amount: 20 },
    { type: 'apply-status', recipient: 'primary-unit', statusId: 'test.debuff', stacks: 1 },
  ],
): CombatActionDefinition {
  return {
    id: 'test.skill-accuracy',
    version: 1,
    sourceType: 'test',
    tags: ['attack'],
    target: {
      kind: 'unit',
      teamPolicy: 'enemy',
      shape: { kind: 'single' },
      minimumRange: 1,
      maximumRange: 3,
      requiresLineOfSight: false,
      maximumElevationDifference: 0,
      friendlyFire: 'enemies-only',
    },
    cost: { spendsAction: true, mp: 3 },
    requirements: [],
    accuracyMode: 'per-target',
    effects,
  }
}
function unit(state: CombatEncounterState, id = 'target') {
  const found = state.tactical.battle.combatants.find((candidate) => candidate.id === id)
  if (!found) throw new Error('Missing fixture combatant')
  return found
}
function rolls(events: readonly unknown[]) {
  return events.filter(
    (event): event is Record<string, unknown> =>
      typeof event === 'object' &&
      event !== null &&
      'event' in event &&
      event.event === 'combat_accuracy_resolved',
  )
}
function cast(
  state: CombatEncounterState = world(),
  command = action(),
  context?: CombatResolutionContext,
) {
  return executeCombatAction(state, command, SELECT, CONTENT, context)
}
function existingDebuff(state: CombatEncounterState): CombatEncounterState {
  return {
    ...state,
    statusState: state.statusState.map((row) =>
      row.combatantId === 'target'
        ? {
            ...row,
            statuses: [
              {
                statusId: 'test.debuff',
                statusVersion: 1,
                stacks: 1,
                remainingOwnerTurnStarts: 1,
                sourceCombatantId: 'ally',
              },
            ],
          }
        : row,
    ),
  }
}
function context(): CombatResolutionContext {
  const provenance = createCombatActionProvenance({
    rulesetVersion: 2,
    sourceKind: 'discipline-skill',
    actionDefinitionId: 'test.skill-accuracy',
    actionVersion: 1,
    sourceCombatantId: 'actor',
    controllerCombatantId: 'actor',
    triggerChainId: 'chain:skill-accuracy',
  })
  return {
    provenance,
    triggerGuard: createCombatTriggerGuard({ triggerChainId: 'chain:skill-accuracy' }),
  }
}
describe('Skill accuracy kernel', () => {
  it('forecasts a probability and conditional projections without reading future rolls', () => {
    const initial = world()
    const before = JSON.stringify(initial)
    const preview = evaluateCombatAction(initial, action(), SELECT, CONTENT)
    expect(preview).toMatchObject({
      legal: true,
      projectionsAssumeHits: true,
      targetHitChances: [{ targetCombatantId: 'target', hitChanceBasisPoints: 5_000 }],
    })
    expect(rolls(preview.projectedEvents)).toEqual([])
    expect(JSON.stringify(initial)).toBe(before)
    expect(evaluateCombatAction(world(6_000, 1_000, 77), action(), SELECT, CONTENT)).toEqual(
      preview,
    )
  })
  it.each([
    { modifier: 1_500, expected: 6_500 },
    { modifier: -1_500, expected: 3_500 },
    { modifier: 3_000, expected: 8_000 },
    { modifier: -3_000, expected: 2_000 },
  ])('uses signed percentage-point modifier %j', ({ modifier, expected }) => {
    expect(
      evaluateCombatAction(
        world(),
        { ...action(), accuracyModifierBasisPoints: modifier },
        SELECT,
        CONTENT,
      ),
    ).toMatchObject({
      targetHitChances: [{ targetCombatantId: 'target', hitChanceBasisPoints: expected }],
    })
  })
  it('clamps probability at zero and one hundred percent', () => {
    expect(
      rolls(cast(world(0, 10_000), { ...action(), accuracyModifierBasisPoints: -3_000 }).events)[0],
    ).toMatchObject({ hitChanceBasisPoints: 0, hit: false })
    expect(
      rolls(cast(world(10_000, 0), { ...action(), accuracyModifierBasisPoints: 3_000 }).events)[0],
    ).toMatchObject({ hitChanceBasisPoints: 10_000, hit: true })
  })
  it('spends action and MP on a miss while gating damage and its debuff together', () => {
    const initial = world(0)
    const result = cast(initial)
    expect(unit(result.state).hp).toBe(100)
    expect(result.state.statusState.find((row) => row.combatantId === 'target')?.statuses).toEqual(
      [],
    )
    expect(unit(result.state, 'actor').mp).toBe(17)
    expect(result.state.tactical.battle.currentTurn?.actionState).toBe('spent')
    expect(result.events).toContainEqual({
      event: 'combat_action_used',
      actionId: action().id,
      actorId: 'actor',
    })
    expect(rolls(result.events)).toHaveLength(1)
    expect(result.state.tactical.battle.rng).toEqual(
      advanceBattleRng(initial.tactical.battle.rng).state,
    )
  })
  it('resolves every ordinary packet after a successful target roll', () => {
    const result = cast(world(10_000, 0))
    expect(unit(result.state).hp).toBe(80)
    expect(result.events).toContainEqual(
      expect.objectContaining({ event: 'status_applied', targetCombatantId: 'target' }),
    )
    expect(rolls(result.events)).toHaveLength(1)
  })
  it('uses one roll for repeated packets to the same target', () => {
    const initial = world(10_000, 0)
    const result = cast(
      initial,
      action([
        { type: 'damage', recipient: 'primary-unit', amount: 10 },
        { type: 'damage', recipient: 'affected-units', amount: 7 },
        { type: 'apply-status', recipient: 'primary-unit', statusId: 'test.debuff', stacks: 1 },
      ]),
    )
    expect(unit(result.state).hp).toBe(83)
    expect(rolls(result.events)).toHaveLength(1)
    expect(result.state.tactical.battle.rng).toEqual(
      advanceBattleRng(initial.tactical.battle.rng).state,
    )
  })
  it('rolls area enemies independently in stable ID order, never allies', () => {
    const initial = world(10_000, 10_000)
    const command = action([
      { type: 'healing', recipient: 'affected-units', amount: 5 },
      { type: 'damage', recipient: 'affected-units', amount: 20 },
    ])
    command.target = {
      ...command.target,
      shape: { kind: 'circle', radius: 1 },
      friendlyFire: 'all-units',
    }
    const result = cast(initial, command)
    expect(rolls(result.events).map((event) => [event.targetCombatantId, event.hit])).toEqual([
      ['target', false],
      ['z-target', true],
    ])
    expect(unit(result.state).hp).toBe(100)
    expect(unit(result.state, 'z-target').hp).toBe(80)
    expect(unit(result.state, 'ally').hp).toBe(45)
    const first = advanceBattleRng(initial.tactical.battle.rng)
    expect(result.state.tactical.battle.rng).toEqual(advanceBattleRng(first.state).state)
  })
  it('does not roll geometrically affected enemies without a unit effect', () => {
    const initial = world(0)
    const command = action([{ type: 'healing', recipient: 'actor', amount: 5 }])
    command.target = { ...command.target, shape: { kind: 'circle', radius: 1 } }
    const result = cast(initial, command)
    expect(rolls(result.events)).toEqual([])
    expect(result.state.tactical.battle.rng).toEqual(initial.tactical.battle.rng)
    expect(unit(result.state, 'actor').hp).toBe(65)
  })
  it('preserves caster healing and restoration when every enemy misses', () => {
    const result = cast(
      world(0),
      action([
        { type: 'damage', recipient: 'primary-unit', amount: 20 },
        { type: 'healing', recipient: 'actor', amount: 9 },
        { type: 'resource-change', recipient: 'actor', resource: 'mp', delta: 2 },
      ]),
    )
    expect(unit(result.state).hp).toBe(100)
    expect(unit(result.state, 'actor')).toMatchObject({ hp: 69, mp: 19 })
  })
  it.each(['automatic', undefined] as const)(
    'preserves historical automatic behavior for mode %s',
    (accuracyMode) => {
      const initial: CombatEncounterState = world(0)
      delete initial.statBridge
      const result = cast(initial, { ...action(), accuracyMode })
      expect(unit(result.state).hp).toBe(80)
      expect(rolls(result.events)).toEqual([])
      expect(result.state.tactical.battle.rng).toEqual(initial.tactical.battle.rng)
    },
  )
  it('does not roll or expose probabilities for an illegal target', () => {
    const initial = world()
    const before = JSON.stringify(initial)
    const preview = evaluateCombatAction(
      initial,
      action(),
      { kind: 'unit', combatantId: 'ally' },
      CONTENT,
    )
    expect(preview.legal).toBe(false)
    expect(preview).not.toHaveProperty('targetHitChances')
    expect(() =>
      executeCombatAction(initial, action(), { kind: 'unit', combatantId: 'ally' }, CONTENT),
    ).toThrow(/Illegal combat action/)
    expect(JSON.stringify(initial)).toBe(before)
  })
  it('fails legality before spending RNG or MP when unaffordable', () => {
    const initial = world()
    const before = JSON.stringify(initial)
    const command = { ...action(), cost: { spendsAction: true, mp: 21 } }
    expect(evaluateCombatAction(initial, command, SELECT, CONTENT).legal).toBe(false)
    expect(() => cast(initial, command)).toThrow(/insufficient-mp/)
    expect(JSON.stringify(initial)).toBe(before)
  })
  it('does not consume Barrier, create history or trigger reactions on a miss', () => {
    const initial: CombatEncounterState = world(0)
    initial.effectState = {
      ...normalizeCombatEffectState(undefined),
      barriers: [
        {
          targetCombatantId: 'target',
          sourceCombatantId: 'target',
          sourceActionId: 'test.barrier',
          amount: 8,
        },
      ],
    }
    const result = cast(initial)
    expect(result.state.effectState).toEqual(initial.effectState)
    expect(
      result.events.filter(
        (event) => event.event === 'damage_applied' || event.event === 'barrier_absorbed',
      ),
    ).toEqual([])
  })
  it('preserves Burn attack backlash on an otherwise missed damage command', () => {
    const initial = applyCurrentBurnState(world(0), 'target', 'actor', 'test.burn')
    const result = cast(initial)
    expect(unit(result.state).hp).toBe(100)
    expect(unit(result.state, 'actor').hp).toBe(60 - CURRENT_BURN_BACKLASH_DAMAGE)
  })
  it('never replaces existing effect provenance for a missed target', () => {
    const initial = existingDebuff(world(0))
    const before = initial.statusState.find((row) => row.combatantId === 'target')
    const ctx = context()
    const result = cast(initial, action(), ctx)
    expect(result.state.statusState.find((row) => row.combatantId === 'target')).toEqual(before)
    expect(result.resolution).toMatchObject(ctx)
  })
  it('attaches K3 provenance normally for a successful target', () => {
    const result = cast(world(10_000, 0), action(), context())
    expect(
      result.state.statusState.find((row) => row.combatantId === 'target')?.statuses[0]?.provenance,
    ).toMatchObject({ targetCombatantId: 'target', effectOrdinal: 1 })
    expect(rolls(result.events)).toHaveLength(1)
  })
})
const blockedEffects: CombatEffectDefinition[] = [
  { type: 'damage', recipient: 'primary-unit', amount: 20 },
  { type: 'healing', recipient: 'primary-unit', amount: 5, ticks: 2 },
  { type: 'resource-change', recipient: 'primary-unit', resource: 'mp', delta: -4 },
  { type: 'resource-change', recipient: 'primary-unit', resource: 'mp', delta: 3, ticks: 2 },
  { type: 'barrier-change', recipient: 'primary-unit', amount: 5 },
  { type: 'apply-status', recipient: 'primary-unit', statusId: 'test.debuff', stacks: 1 },
  { type: 'remove-status', recipient: 'primary-unit', statusIds: ['test.debuff'] },
  { type: 'poison', recipient: 'primary-unit' },
  { type: 'burn', recipient: 'primary-unit' },
  { type: 'bleed', recipient: 'primary-unit', damagePerTick: 3, ticks: 2 },
  { type: 'displace', recipient: 'primary-unit', direction: 'pull', distance: 1 },
]
it.each(blockedEffects.map((effect) => ({ effect })))(
  'miss blocks the whole hostile unit operation %j',
  ({ effect }) => {
    const initial = existingDebuff(world(0))
    const result = cast(initial, action([effect]))
    expect(unit(result.state)).toEqual(unit(initial))
    expect(result.state.statusState).toEqual(initial.statusState)
    expect(result.state.effectState).toEqual(initial.effectState)
    expect(result.state.tactical.placements).toEqual(initial.tactical.placements)
    expect(rolls(result.events)).toHaveLength(1)
  },
)
describe('Skill accuracy validation at execution', () => {
  it.each(['sometimes', null, 7])('rejects unknown runtime mode %s', (mode) => {
    const command = { ...action(), accuracyMode: mode } as unknown as CombatActionDefinition
    expect(() => cast(world(), command)).toThrow(/accuracy/i)
  })
  it.each([-3_001, 3_001, 0.5, NaN, Infinity])(
    'rejects invalid runtime modifier %s',
    (accuracyModifierBasisPoints) => {
      expect(() => cast(world(), { ...action(), accuracyModifierBasisPoints })).toThrow(/accuracy/i)
    },
  )
  it('requires committed stat profiles for rolled Skills', () => {
    const initial: CombatEncounterState = world()
    delete initial.statBridge
    expect(() => evaluateCombatAction(initial, action(), SELECT, CONTENT)).toThrow(/accuracy/i)
    expect(() => cast(initial)).toThrow(/accuracy/i)
  })
  it('does not let Basic Attack accidentally acquire a second roll engine', () => {
    expect(() =>
      validateCombatActionDefinition({ ...action(), sourceType: 'basic-attack' }),
    ).toThrow(/accuracy/i)
  })
})
type AccuracySkill = MatureSkillDefinition &
  Pick<CombatActionDefinition, 'accuracyMode' | 'accuracyModifierBasisPoints'>
function mature(): AccuracySkill {
  return {
    ...P33_REPRESENTATIVE_DISCIPLINE_SKILLS[0]!,
    id: 'test.skill-accuracy',
    enabled: true,
    apCost: 10,
    mpCost: 1,
    target: action().target,
    requirements: [],
    tags: ['attack'],
    effects: [{ type: 'damage', recipient: 'primary-unit', amount: 20 }],
    overrides: {},
    accuracyMode: 'per-target',
    accuracyModifierBasisPoints: 0,
  }
}
describe('Mature Skill accuracy forwarding', () => {
  it('retains authored accuracy through the ordinary definition adapter', () => {
    const skill: AccuracySkill = { ...mature(), accuracyModifierBasisPoints: 1_500 }
    expect(toCombatActionDefinition(skill, 'pve')).toMatchObject({
      accuracyMode: 'per-target',
      accuracyModifierBasisPoints: 1_500,
    })
  })
  it('validates accuracy before adapting a mature definition', () => {
    const invalid = { ...mature(), accuracyModifierBasisPoints: 3_001 }
    expect(validateMatureSkillDefinition(invalid).length).toBeGreaterThan(0)
    expect(() => toCombatActionDefinition(invalid, 'pve')).toThrow()
  })
  it('commits missed Skills at unchanged AP and MP costs and records repeat use', () => {
    const skill = mature()
    const initial = world(0)
    const first = executePv1fMatureSkill(initial, skill, SELECT)
    expect(unit(first.state).hp).toBe(100)
    expect(unit(first.state, 'actor').mp).toBe(19)
    expect(first.events).toContainEqual(
      expect.objectContaining({ event: 'action_economy_spent', amount: 10 }),
    )
    expect(rolls(first.events)).toHaveLength(1)
    const repeat = evaluatePv1fMatureSkill(first.state, skill, SELECT)
    expect(repeat.repeatPenaltyApplied).toBe(true)
    expect(repeat.evaluation).toMatchObject({
      targetHitChances: [{ targetCombatantId: 'target', hitChanceBasisPoints: 0 }],
    })
  })
  it('does not halve accuracy when repeated damage potency is halved', () => {
    const skill = mature()
    const first = executePv1fMatureSkill(world(10_000, 0), skill, SELECT)
    const second = executePv1fMatureSkill(first.state, skill, SELECT)
    expect(unit(second.state).hp).toBe(60)
    expect(rolls(second.events)[0]).toMatchObject({ hit: true, hitChanceBasisPoints: 10_000 })
  })
})

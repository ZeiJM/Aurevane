import { expect, it } from 'vitest'
import { source } from './combat-behavior.test-utils'
import { captureCombatAbilitySource } from './combat-behavior-capture'
import {
  reconcileCombatAbilitySources,
  combatAbilityCommandContext,
} from './combat-behavior-runtime'
import { prepareCombatAbilityCommand, commitCombatAbilityCommand } from './combat-ability-command'
import { preparePv1fTurnEconomy, PV1F_COMBAT_CONTENT } from './pv1f-action-economy'
import { percentageDotEncounter } from './combat-percentage-dots.test-utils'
import { endCombatTurn, validateCombatEncounterState, type CombatEncounterState } from './actions'
import { selectCurrentFinalFacing } from './board'

function captured(id: string, sourceKind: 'discipline-skill' | 'essence' = 'discipline-skill') {
  const template = source(
    {
      id: 'main',
      costs: [{ resource: 'ap', amount: 1 }],
      cooldown: { key: 'main', ownerTurns: 2 },
    },
    id,
  )
  return captureCombatAbilitySource({ ...template, abilityId: id, sourceKind })
}
function fixture(current = true) {
  const first = captured('custom.first')
  const group = first.definition.behaviors[0]!
  const shared = captureCombatAbilitySource({
    ...first,
    definition: {
      ...first.definition,
      behaviors: [
        group,
        { ...group, id: 'shared' },
        { ...group, id: 'separate', cooldown: { key: 'separate', ownerTurns: 2 } },
      ],
    },
  })
  const second = captured('custom.second'),
    essence = captured('custom.essence', 'essence')
  const state = reconcileCombatAbilitySources(
    {
      ...preparePv1fTurnEconomy(percentageDotEncounter()),
      ...(current ? { abilityCooldownScopeVersion: 1 as const } : {}),
    },
    [shared, second, essence],
  )
  return { first: shared, second, essence, state }
}
function input(
  state: CombatEncounterState,
  root: ReturnType<typeof captured>,
  behaviorId = 'main',
  actorId = 'actor',
) {
  return {
    state,
    actorId,
    root: { kind: 'canonical' as const, source: root, behaviorId },
    selection: { kind: 'unit' as const, combatantId: actorId === 'actor' ? 'enemy' : 'actor' },
    content: PV1F_COMBAT_CONTENT,
    context: combatAbilityCommandContext(state, root),
  }
}
it('isolates two Skills and an Essence sharing authored main after real use and reload while preserving same-ability groups', () => {
  const { first, second, essence, state } = fixture()
  const before = JSON.stringify([first, second, essence])
  const result = commitCombatAbilityCommand(input(state, first))
  const restored = JSON.parse(JSON.stringify(result.state)) as CombatEncounterState
  expect(validateCombatEncounterState(restored)).toEqual([])
  expect(prepareCombatAbilityCommand(input(restored, first)).evaluation.issues).toContainEqual(
    expect.objectContaining({ code: 'cooldown-active' }),
  )
  expect(
    prepareCombatAbilityCommand(input(restored, first, 'shared')).evaluation.issues,
  ).toContainEqual(expect.objectContaining({ code: 'cooldown-active' }))
  expect(prepareCombatAbilityCommand(input(restored, first, 'separate')).evaluation.legal).toBe(
    true,
  )
  expect(prepareCombatAbilityCommand(input(restored, second)).evaluation.legal).toBe(true)
  expect(prepareCombatAbilityCommand(input(restored, essence)).evaluation.legal).toBe(true)
  const beforeBlocked = JSON.stringify(restored)
  expect(() => commitCombatAbilityCommand(input(restored, first))).toThrow('cooldown-active')
  expect(JSON.stringify(restored)).toBe(beforeBlocked)
  expect(JSON.stringify([first, second, essence])).toBe(before)
})
it('preserves literal raw-key sharing in historical captures without the scope policy', () => {
  const { first, second, essence, state } = fixture(false)
  const result = commitCombatAbilityCommand(input(state, first))
  for (const row of [first, second, essence])
    expect(prepareCombatAbilityCommand(input(result.state, row)).evaluation.issues).toContainEqual(
      expect.objectContaining({ code: 'cooldown-active' }),
    )
  expect(
    result.state.tactical.battle.combatants.find((unit) => unit.id === 'actor')?.temporaryResources,
  ).toContainEqual({ key: 'p3.skill-cooldown.main', current: 3, maximum: 3 })
})
it('keeps cooldown ownership distinct while the normal owner-start countdown remains unchanged', () => {
  const { first, state } = fixture()
  const other = captureCombatAbilitySource({
    ...first,
    ownerCombatantId: 'enemy',
    sourceInstanceId: 'other-owner',
  })
  const initial = reconcileCombatAbilitySources(state, [...state.capturedAbilitySources!, other])
  let next = commitCombatAbilityCommand(input(initial, first)).state
  next = preparePv1fTurnEconomy(
    endCombatTurn(
      { ...next, tactical: selectCurrentFinalFacing(next.tactical, 'west').state },
      PV1F_COMBAT_CONTENT,
    ).state as never,
  )
  expect(prepareCombatAbilityCommand(input(next, other, 'main', 'enemy')).evaluation.legal).toBe(
    true,
  )
  expect(
    next.tactical.battle.combatants
      .find((unit) => unit.id === 'enemy')!
      .temporaryResources.filter((row) => row.key.startsWith('p3.skill-cooldown.')),
  ).toEqual([])
})
it('keeps the same ability clock across captured content versions and separates source kinds', () => {
  const { first, state } = fixture()
  const result = commitCombatAbilityCommand(input(state, first))
  const upgraded = captureCombatAbilitySource({
    ...first,
    contentVersion: 2,
    sourceInstanceId: 'upgraded',
  })
  const sameIdEssence = captureCombatAbilitySource({
    ...first,
    sourceKind: 'essence',
    sourceInstanceId: 'essence-same-id',
  })
  const next = reconcileCombatAbilitySources(result.state, [upgraded, sameIdEssence])
  expect(prepareCombatAbilityCommand(input(next, upgraded)).evaluation.issues).toContainEqual(
    expect.objectContaining({ code: 'cooldown-active' }),
  )
  expect(prepareCombatAbilityCommand(input(next, sameIdEssence)).evaluation.legal).toBe(true)
})
it('rejects unsupported scope policy versions without changing historical snapshots', () => {
  const { state } = fixture(false)
  expect(validateCombatEncounterState(state)).toEqual([])
  expect(
    validateCombatEncounterState({ ...state, abilityCooldownScopeVersion: 2 } as never),
  ).toContainEqual(expect.objectContaining({ field: 'abilityCooldownScopeVersion' }))
})

it('uses injective legal clock keys for long, Unicode and separator-bearing identities, preserving native Basic sharing', async () => {
  const { combatAbilityCooldown, validateSkillCooldownDefinition } =
    await import('./skill-cooldowns')
  const clock = { key: 'main', ownerTurns: 2 }
  const keys = ['a.b', 'a-b', 'a_b', 'A', 'a', 'é', 'e\u0301', '😀', 'x'.repeat(1000)].map(
    (abilityId) =>
      combatAbilityCooldown(
        { abilityCooldownScopeVersion: 1 },
        { abilityId, sourceKind: 'discipline-skill' },
        clock,
      )!,
  )
  expect(new Set(keys.map((row) => row.key)).size).toBe(keys.length)
  for (const key of keys) expect(validateSkillCooldownDefinition(key)).toEqual([])
  expect(
    combatAbilityCooldown(
      { abilityCooldownScopeVersion: 1 },
      { abilityId: 'basic.recover', sourceKind: 'basic' },
      { ...clock, key: 'basic.recovery' },
    ),
  ).toEqual({ ...clock, key: 'basic.recovery' })
  expect(
    combatAbilityCooldown(
      undefined,
      { abilityId: 'custom.first', sourceKind: 'discipline-skill' },
      clock,
    ),
  ).toBe(clock)
})

it('advances a scoped clock through every owner-turn tick without locking its counterparty', async () => {
  const { combatAbilityCooldown, advanceSkillCooldownsAtOwnerTurnStart, readSkillCooldown } =
    await import('./skill-cooldowns')
  const { state, first, second } = fixture()
  let next = commitCombatAbilityCommand(input(state, first)).state
  const clock = combatAbilityCooldown(next, first, first.definition.behaviors[0]!.cooldown)!
  const observed: number[] = []
  for (let tick = 0; tick <= 3; tick++) {
    const owner = next.tactical.battle.combatants.find((unit) => unit.id === 'actor')!
    observed.push(readSkillCooldown(owner, clock).ticksRemaining)
    expect(prepareCombatAbilityCommand(input(next, second)).evaluation.legal).toBe(true)
    expect(prepareCombatAbilityCommand(input(next, first)).evaluation.legal).toBe(tick === 3)
    next = {
      ...next,
      tactical: {
        ...next.tactical,
        battle: {
          ...next.tactical.battle,
          combatants: next.tactical.battle.combatants.map((unit) =>
            unit.id === 'actor' ? advanceSkillCooldownsAtOwnerTurnStart(unit).combatant : unit,
          ),
        },
      },
    }
  }
  expect(observed).toEqual([3, 2, 1, 0])
})

it('uses scoped clocks in Controlled preparation while retaining free cancellation', async () => {
  const { primeCombatControlledAbility, cancelCombatControlledAbility } =
    await import('./combat-behavior-runtime')
  const { first, second, state } = fixture()
  const controlled = captureCombatAbilitySource({
    ...second,
    sourceInstanceId: 'controlled-second',
    definition: {
      ...second.definition,
      behaviors: second.definition.behaviors.map((behavior) => ({
        ...behavior,
        classification: 'recovery' as const,
        attackFamily: undefined,
        effects: [
          {
            id: 'heal',
            timing: 'controlled' as const,
            payload: { type: 'healing' as const, recipient: 'actor' as const, amount: 5 },
          },
        ],
      })),
    },
  })
  const base = reconcileCombatAbilitySources(
    {
      ...state,
      effectTimingPolicy: {
        version: 8,
        tagAuthority: 'global' as const,
        modes: { damage: 'instant' as const, healing: 'controlled' as const },
      },
    },
    [first, controlled],
  )
  const used = commitCombatAbilityCommand(input(base, first)).state
  const params = {
    actorId: 'actor',
    sourceInstanceId: controlled.sourceInstanceId,
    behaviorId: 'main',
  }
  const primed = primeCombatControlledAbility({ ...params, state: used }).state
  const released = commitCombatAbilityCommand(input(primed, controlled)).state
  expect(() => primeCombatControlledAbility({ ...params, state: released })).toThrow(
    'controlled-cooldown-active',
  )
  expect(() => cancelCombatControlledAbility({ ...params, state: primed })).not.toThrow()
})

it('pays distinct modifier clocks once and reads their effective keys in availability', async () => {
  const { combatManualModifierAvailability } = await import('./combat-behavior-runtime')
  const { first, state } = fixture()
  const modifiers = ['one', 'two', 'unused'].map((id) =>
    captureCombatAbilitySource({
      ...source(
        {
          id: 'main',
          mode: 'modifier',
          targeting: null,
          costs: [],
          cooldown: { key: 'main', ownerTurns: 2 },
        },
        id,
      ),
      abilityId: `modifier.${id}`,
    }),
  )
  const base = reconcileCombatAbilitySources(state, [first, ...modifiers])
  const used = commitCombatAbilityCommand({
    ...input(base, first),
    manualModifiers: modifiers
      .slice(0, 2)
      .map((modifier) => ({ sourceInstanceId: modifier.sourceInstanceId, behaviorId: 'main' })),
  })
  expect(used.events.filter((event) => event.event === 'skill_cooldown_started')).toHaveLength(3)
  const availability = combatManualModifierAvailability(used.state, 'actor')
  expect(availability.map((row) => [row.ownerEligible, row.cooldown?.ticksRemaining])).toEqual([
    [false, 3],
    [false, 3],
    [true, 0],
  ])
  expect(new Set(availability.map((row) => row.cooldown!.key)).size).toBe(3)
})

it('keeps two automatic sources with the same authored group independently payable', async () => {
  const {
    createCombatAbilityEventSession,
    captureCombatAbilityMutation,
    processCombatAbilityEvent,
  } = await import('./combat-ability-events')
  const captures = ['one', 'two'].map((id) =>
    captureCombatAbilitySource({
      ...source(
        {
          id: 'main',
          activation: 'automatic',
          activationLimits: ['once-per-battle'],
          classification: 'recovery',
          attackFamily: undefined,
          costs: [],
          cooldown: { key: 'main', ownerTurns: 2 },
          requirements: { kind: 'event', eventType: 'damage_applied', phase: 'after' },
          targeting: {
            kind: 'unit',
            teamPolicy: 'ally',
            friendlyFire: 'allies-only',
            geometryVersion: 3,
            categories: ['self'],
            shape: { kind: 'all' },
            minimumRange: 0,
            maximumRange: 0,
            requiresLineOfSight: false,
            maximumElevationDifference: null,
            maximumSelections: 1,
          },
          effects: [{ id: 'heal', payload: { type: 'healing', recipient: 'actor', amount: 5 } }],
        },
        id,
      ),
      abilityId: `automatic.${id}`,
    }),
  )
  const base = preparePv1fTurnEconomy(percentageDotEncounter())
  const state = reconcileCombatAbilitySources(
    {
      ...base,
      abilityCooldownScopeVersion: 1,
      tactical: {
        ...base.tactical,
        battle: {
          ...base.tactical.battle,
          combatants: base.tactical.battle.combatants.map((unit) =>
            unit.id === 'actor' ? { ...unit, hp: 500 } : unit,
          ),
        },
      },
    },
    captures,
  )
  const context = combatAbilityCommandContext(state, captures[0]!)
  const session = createCombatAbilityEventSession(context.triggerGuard)
  const mutation = captureCombatAbilityMutation(state, state, 'test-heal', session, {
    events: [{ type: 'damage_applied', phase: 'after' }],
    affectedCombatantIds: ['actor'],
    resourceMutations: [],
  })
  const result = processCombatAbilityEvent(
    mutation.state,
    mutation.frame,
    PV1F_COMBAT_CONTENT,
    context,
    session,
    0,
    commitCombatAbilityCommand,
  )
  expect(result.events.filter((event) => event.event === 'skill_cooldown_started')).toHaveLength(2)
  expect(result.state.tactical.battle.combatants.find((unit) => unit.id === 'actor')!.hp).toBe(510)
})

it('pins scope only at the current factory while historical bridge factories stay literal', async () => {
  const {
    createStatBalancedCombatEncounterState,
    createCurrentStatDrivenCombatEncounterState,
    createStatDrivenCombatEncounterState,
  } = await import('./stat-driven-combat')
  const base = percentageDotEncounter()
  const profiles = base.statBridge.combatants.map((row) => ({
    ...row,
    physicalPower: row.physicalPower ?? 20,
    mysticPower: row.mysticPower ?? 20,
    level: row.level ?? 1,
    criticalChance: row.criticalChance ?? 0,
  }))
  expect(createStatBalancedCombatEncounterState(base, profiles).abilityCooldownScopeVersion).toBe(1)
  expect(
    createCurrentStatDrivenCombatEncounterState(base, profiles).abilityCooldownScopeVersion,
  ).toBeUndefined()
  expect(
    createStatDrivenCombatEncounterState(base, profiles).abilityCooldownScopeVersion,
  ).toBeUndefined()
})

it('starts only the selected scoped cooldown when its effects remain pending', () => {
  const { first, second } = fixture()
  const delayed = captureCombatAbilitySource({
    ...first,
    sourceInstanceId: 'delayed-first',
    definition: {
      ...first.definition,
      behaviors: first.definition.behaviors.map((behavior) => ({
        ...behavior,
        effects: behavior.effects.map((effect) => ({ ...effect, timing: 'next-round' as const })),
      })),
    },
  })
  const base = reconcileCombatAbilitySources(
    { ...preparePv1fTurnEconomy(percentageDotEncounter()), abilityCooldownScopeVersion: 1 },
    [delayed, second],
  )
  const used = commitCombatAbilityCommand(input(base, delayed))
  expect(used.state.pendingEffects).toHaveLength(1)
  expect(prepareCombatAbilityCommand(input(used.state, delayed)).evaluation.issues).toContainEqual(
    expect.objectContaining({ code: 'cooldown-active' }),
  )
  expect(prepareCombatAbilityCommand(input(used.state, second)).evaluation.legal).toBe(true)
})

it('isolates edited Basic main clocks from each other and a Skill while retaining native Recovery sharing', async () => {
  const { captureBasicSkillSources } = await import('./combat-basic-actions')
  const { historicalBasicSkills: defaultBasicSkills } =
    await import('./combat-basic-history.test-utils')
  const basics = (edited: boolean) =>
    defaultBasicSkills().map((row) =>
      row.id === 'basic.move' || row.id === 'unarmed.basic'
        ? row
        : {
            ...row,
            ability: {
              ...row.ability,
              behaviors: row.ability.behaviors.map((behavior) => ({
                ...behavior,
                requirements: null,
                costs: [{ resource: 'ap' as const, amount: 1 }],
                ...(edited && behavior.cooldown
                  ? { cooldown: { ...behavior.cooldown, key: 'main' } }
                  : {}),
              })),
            },
          },
    )
  const captures = (edited: boolean) =>
    (['basic.guard', 'basic.recover', 'basic.recover.mp'] as const).map(
      (supportActionId) =>
        captureBasicSkillSources({
          ownerCombatantId: 'actor',
          supportActionId,
          definitions: basics(edited),
        })[2]!,
    )
  const { first } = fixture()
  const command = (state: CombatEncounterState, root: ReturnType<typeof captured>) => ({
    ...input(state, root, root.definition.behaviors[0]!.id),
    selection: { kind: 'self' as const },
  })
  const edited = captures(true)
  const base = reconcileCombatAbilitySources(
    { ...preparePv1fTurnEconomy(percentageDotEncounter()), abilityCooldownScopeVersion: 1 },
    [...edited, first],
  )
  const usedSkill = commitCombatAbilityCommand(input(base, first)).state
  const usedBasic = commitCombatAbilityCommand(command(usedSkill, edited[0]!)).state
  expect(prepareCombatAbilityCommand(command(usedBasic, edited[1]!)).evaluation.legal).toBe(true)
  expect(
    prepareCombatAbilityCommand(command(usedBasic, edited[0]!)).evaluation.issues,
  ).toContainEqual(expect.objectContaining({ code: 'cooldown-active' }))
  const native = captures(false)
  const nativeBase = reconcileCombatAbilitySources(
    { ...preparePv1fTurnEconomy(percentageDotEncounter()), abilityCooldownScopeVersion: 1 },
    native,
  )
  const usedRecovery = commitCombatAbilityCommand(command(nativeBase, native[1]!)).state
  expect(
    prepareCombatAbilityCommand(command(usedRecovery, native[2]!)).evaluation.issues,
  ).toContainEqual(expect.objectContaining({ code: 'cooldown-active' }))
  expect(
    usedRecovery.tactical.battle.combatants.find((unit) => unit.id === 'actor')!.temporaryResources,
  ).toContainEqual({ key: 'p3.skill-cooldown.basic.recovery', current: 3, maximum: 3 })
})

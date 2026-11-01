import { describe, expect, it } from 'vitest'
import {
  executeCombatAction,
  evaluateCombatAction,
  validateCombatEncounterState,
  type CombatActionDefinition,
  type CombatEffectDefinition,
  type CombatEncounterState,
} from './actions'
import { createCombatGroundArea } from './combat-ground-areas'
import { resolveCombatMovementStepEffects } from './actions-legacy'
import { resolveMatureSkillVersion } from './mature-skills'
import { spawnCombatSummon } from './combat-summons'
import type { StatDrivenCombatEncounterState } from './stat-driven-combat'
import { percentageDotEncounter } from './combat-percentage-dots.test-utils'
import { createCurrentStatDrivenCombatEncounterState } from './stat-driven-combat'
import {
  PV1F_COMBAT_CONTENT,
  preparePv1fTurnEconomy,
  finishPv1fTurn,
  executePv1fSummonAbility,
} from './pv1f-action-economy'
import { source } from './combat-behavior.test-utils'
import { captureCombatAbilitySource } from './combat-behavior-capture'
import {
  reconcileCombatAbilitySources,
  combatAbilityCommandContext,
} from './combat-behavior-runtime'
import { commitCombatAbilityCommand } from './combat-ability-command'

const selection = { kind: 'unit', combatantId: 'enemy' } as const
function encounter(current = true, chance = 10000): StatDrivenCombatEncounterState {
  const base = percentageDotEncounter()
  const state = createCurrentStatDrivenCombatEncounterState(
    base,
    base.statBridge.combatants.map((row) => ({
      ...row,
      physicalPower: 0,
      mysticPower: 0,
      armor: 0,
      ward: 0,
      level: 1,
      accuracy: 10000,
      evasion: 0,
      criticalChance: chance,
    })),
  )
  return { ...state, ...(current ? { pierceCriticalPolicyVersion: 1 as const } : {}) }
}
const weak = {
  type: 'weak-point',
  recipient: 'actor',
  debuffThreshold: 0,
} as unknown as CombatEffectDefinition
const spike = { type: 'spike', recipient: 'actor' } as unknown as CombatEffectDefinition
function action(effects: readonly CombatEffectDefinition[]): CombatActionDefinition {
  return {
    id: 'test.pierce-critical',
    version: 1,
    sourceType: 'test',
    tags: ['attack', 'physical'],
    cost: { spendsAction: false, mp: 0 },
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
    accuracyMode: 'automatic',
    effectTimingModes: effects.map(() => 'instant'),
    effects,
  }
}
const damage = { type: 'damage', recipient: 'primary-unit', amount: 20 } as const
function hits(events: readonly unknown[]) {
  return events.filter(
    (event) =>
      typeof event === 'object' &&
      event !== null &&
      'event' in event &&
      event.event === 'damage_applied',
  ) as { amount: number; damageKind?: 'piercing' }[]
}
function withDebuff(state: StatDrivenCombatEncounterState) {
  return {
    ...state,
    statusState: state.statusState.map((row) =>
      row.combatantId === 'enemy'
        ? {
            ...row,
            statuses: [
              {
                statusId: 'root',
                statusVersion: 1,
                sourceCombatantId: 'actor',
                stacks: 1,
                remainingOwnerTurnStarts: 2,
              },
            ],
          }
        : row,
    ),
  }
}
describe('current Pierce critical exclusion', () => {
  it.each(['piercing', 'shattersBarrier'] as const)(
    'excludes native %s from forced criticals and Spike without changing historical captures',
    (flag) => {
      const definition = action([{ ...damage, [flag]: true }, spike])
      for (const current of [false, true]) {
        const state = encounter(current)
        const result = executeCombatAction(state, definition, selection, PV1F_COMBAT_CONTENT)
        expect(hits(result.events)).toMatchObject([
          { amount: current ? 20 : 60, damageKind: 'piercing' },
        ])
        expect(
          result.events.some(
            (event) => event.event === 'combat_critical_resolved' && event.critical,
          ),
        ).toBe(!current)
      }
    },
  )
  it('gives Pierce-only forecasts zero chance without critical RNG even when Weak Point guarantees a hit', () => {
    const state = withDebuff(encounter(true, 5000))
    const definition = action([{ ...damage, piercing: true }, weak, spike])
    const before = JSON.stringify(state)
    const forecast = evaluateCombatAction(state, definition, selection, PV1F_COMBAT_CONTENT)
    expect(forecast.targetCriticalChances).toEqual([
      { targetCombatantId: 'enemy', criticalChanceBasisPoints: 0 },
    ])
    expect(JSON.stringify(state)).toBe(before)
    const result = executeCombatAction(state, definition, selection, PV1F_COMBAT_CONTENT)
    expect(hits(result.events)).toMatchObject([{ amount: 20 }])
    expect(result.events.some((event) => event.event === 'combat_critical_resolved')).toBe(false)
    expect(result.state.tactical.battle.rng).toEqual(state.tactical.battle.rng)
  })
  it('retains a guaranteed critical and Spike on ordinary Damage siblings only', () => {
    const state = withDebuff(encounter(true, 0))
    const definition = action([damage, { ...damage, shattersBarrier: true }, weak, spike])
    expect(
      evaluateCombatAction(state, definition, selection, PV1F_COMBAT_CONTENT).targetCriticalChances,
    ).toEqual([{ targetCombatantId: 'enemy', criticalChanceBasisPoints: 10000 }])
    const result = executeCombatAction(state, definition, selection, PV1F_COMBAT_CONTENT)
    expect(hits(result.events)).toMatchObject([
      { amount: 60 },
      { amount: 20, damageKind: 'piercing' },
    ])
    expect(
      result.events.filter((event) => event.event === 'combat_critical_resolved' && event.critical),
    ).toHaveLength(1)
  })
  it.each(['instant', 'next-round'] as const)(
    'excludes canonical Pierce from Weak Point and Spike with %s capture and reload',
    (timing) => {
      const captured = captureCombatAbilitySource(
        source({
          costs: [],
          effects: [
            { id: 'ordinary', timing, payload: damage },
            {
              id: 'pierce',
              timing,
              payload: {
                type: 'pierce',
                recipient: 'primary-unit',
                amount: 20,
                armorIgnoredBasisPoints: 10000,
              },
            },
            {
              id: 'weak',
              timing: 'instant',
              payload: { type: 'weak-point', recipient: 'actor', debuffThreshold: 0 },
            },
            { id: 'spike', timing: 'instant', payload: { type: 'spike', recipient: 'actor' } },
          ],
        }),
      )
      const base = preparePv1fTurnEconomy(withDebuff(encounter(true, 0)))
      const state = reconcileCombatAbilitySources(base, [captured])
      const result = commitCombatAbilityCommand({
        state,
        actorId: 'actor',
        root: { kind: 'canonical', source: captured },
        selection,
        content: PV1F_COMBAT_CONTENT,
        context: combatAbilityCommandContext(state, captured),
      })
      let next = JSON.parse(JSON.stringify(result.state)) as CombatEncounterState
      expect(validateCombatEncounterState(next)).toEqual([])
      const events: unknown[] = [...result.events]
      if (timing === 'next-round') {
        expect(
          next.pendingEffects
            ?.filter((row) => row.effect.type === 'damage')
            .map((row) => row.criticalRecipientIds),
        ).toEqual([['enemy'], []])
        const invalid = {
          ...next,
          pendingEffects: next.pendingEffects!.map((row) =>
            row.effect.type === 'damage' && row.effect.shattersBarrier
              ? { ...row, criticalRecipientIds: ['enemy'] }
              : row,
          ),
        }
        expect(validateCombatEncounterState(invalid)).toContainEqual(
          expect.objectContaining({ field: 'pendingEffects' }),
        )
        expect(
          validateCombatEncounterState({ ...invalid, pierceCriticalPolicyVersion: undefined }),
        ).toEqual([])
        const round = next.tactical.battle.round
        for (let n = 0; n < 8 && next.tactical.battle.round === round; n++) {
          const ended = finishPv1fTurn(next as never, 'east')
          next = ended.state
          events.push(...ended.events)
        }
      }
      expect(hits(events)).toMatchObject([{ amount: 60 }, { amount: 20, damageKind: 'piercing' }])
      expect(validateCombatEncounterState(next)).toEqual([])
    },
  )
  it('forecasts ordinary and Pierce recipients independently in a mixed area action', () => {
    const state = encounter()
    const definition: CombatActionDefinition = {
      ...action([]),
      target: {
        ...action([]).target,
        geometryVersion: 2,
        minimumRange: 0,
        maximumRange: 0,
        shape: { kind: 'all' },
      },
      effects: [
        { ...damage, recipient: 'affected-units' },
        { ...damage, recipient: 'affected-units', shattersBarrier: true },
      ],
      effectEligibleRecipientIds: [['enemy'], ['other']],
      effectTimingModes: ['instant', 'instant'],
    }
    expect(
      evaluateCombatAction(state, definition, { kind: 'activate' }, PV1F_COMBAT_CONTENT)
        .targetCriticalChances,
    ).toEqual([
      { targetCombatantId: 'enemy', criticalChanceBasisPoints: 10000 },
      { targetCombatantId: 'other', criticalChanceBasisPoints: 0 },
    ])
    const out = executeCombatAction(state, definition, { kind: 'activate' }, PV1F_COMBAT_CONTENT)
    expect(hits(out.events)).toMatchObject([{ amount: 30 }, { amount: 20, damageKind: 'piercing' }])
  })
  it('rejects unsupported critical policy on reload', () => {
    expect(
      validateCombatEncounterState({ ...encounter(), pierceCriticalPolicyVersion: 2 } as never),
    ).toContainEqual(expect.objectContaining({ field: 'pierceCriticalPolicyVersion' }))
  })
  it.each([
    { current: false, piercing: false },
    { current: false, piercing: true },
    { current: true, piercing: false },
    { current: true, piercing: true },
  ])(
    'keeps Ground Weak Point criticals confined to eligible packets (current: $current, Pierce: $piercing)',
    ({ current, piercing }) => {
      const initial = withDebuff(encounter(current, 0))
      const state = {
        ...initial,
        groundEffectPolicyVersion: 1 as const,
        groundContactPolicyVersion: 1 as const,
        statusState: initial.statusState.map((row) =>
          row.combatantId === 'other'
            ? {
                ...row,
                statuses: initial.statusState.find((r) => r.combatantId === 'enemy')!.statuses,
              }
            : row,
        ),
      }
      const definition: CombatActionDefinition = {
        ...action([]),
        target: {
          ...action([]).target,
          kind: 'ground-tile',
          geometryVersion: 3,
          categories: ['ground'],
          minimumRange: 0,
        },
        effects: [
          {
            ...damage,
            recipient: 'affected-units',
            target: 'ground',
            ...(piercing ? { shattersBarrier: true as const } : {}),
          },
          weak,
          spike,
        ],
        effectTimingModes: ['instant', 'instant', 'instant'],
        groundArea: {
          timing: 'instant',
          durationRounds: 2,
          visualPresetId: 'embers',
          entryEffectOrdinals: [0],
        },
      }
      const cast = {
        state: createCombatGroundArea(
          state,
          'actor',
          definition,
          [{ x: 4, y: 1 }],
          PV1F_COMBAT_CONTENT,
        ),
      }
      const placed = {
        ...cast.state,
        tactical: {
          ...cast.state.tactical,
          placements: cast.state.tactical.placements.map((row) =>
            row.combatantId === 'other' ? { ...row, position: { x: 4, y: 1 } } : row,
          ),
        },
      }
      const entered = resolveCombatMovementStepEffects(placed, 'other', PV1F_COMBAT_CONTENT)
      expect(hits(entered.events)).toMatchObject([
        { amount: current && piercing ? 20 : 60, ...(piercing ? { damageKind: 'piercing' } : {}) },
      ])
      expect(
        entered.events.some(
          (event) => event.event === 'combat_critical_resolved' && event.critical,
        ),
      ).toBe(!(current && piercing))
    },
  )
  it('does not critically hit through an automatic canonical Pierce packet', () => {
    const support = captureCombatAbilitySource(
      source(
        {
          id: 'heal',
          classification: 'utility',
          attackFamily: undefined,
          costs: [],
          targeting: {
            kind: 'self',
            teamPolicy: 'self',
            friendlyFire: 'allies-only',
            shape: { kind: 'single' },
            minimumRange: 0,
            maximumRange: 0,
            maximumSelections: 1,
            requiresLineOfSight: false,
            maximumElevationDifference: null,
          },
          effects: [
            {
              id: 'heal',
              timing: 'instant',
              payload: { type: 'healing', recipient: 'actor', amount: 20 },
            },
          ],
        },
        'support',
      ),
    )
    const reactive = captureCombatAbilitySource({
      ...source(
        {
          activation: 'automatic',
          automaticTarget: { subject: 'triggering' },
          costs: [],
          requirements: { kind: 'event', eventType: 'healing_applied', phase: 'after' },
          effects: [
            { id: 'ordinary', timing: 'instant', payload: damage },
            {
              id: 'pierce',
              timing: 'instant',
              payload: {
                type: 'pierce',
                recipient: 'primary-unit',
                amount: 20,
                armorIgnoredBasisPoints: 10000,
              },
            },
            { id: 'spike', timing: 'instant', payload: { type: 'spike', recipient: 'actor' } },
          ],
        },
        'reaction',
      ),
      ownerCombatantId: 'enemy',
      abilityId: 'test.automatic-pierce',
    })
    const initial = encounter()
    const base = preparePv1fTurnEconomy({
      ...initial,
      tactical: {
        ...initial.tactical,
        battle: {
          ...initial.tactical.battle,
          combatants: initial.tactical.battle.combatants.map((row) =>
            row.id === 'actor' ? { ...row, hp: 900 } : row,
          ),
        },
      },
    })
    const state = reconcileCombatAbilitySources(base, [support, reactive])
    const out = commitCombatAbilityCommand({
      state,
      actorId: 'actor',
      root: { kind: 'canonical', source: support },
      selection: { kind: 'self' },
      content: PV1F_COMBAT_CONTENT,
      context: combatAbilityCommandContext(state, support),
    })
    expect(hits(out.events)).toMatchObject([{ amount: 60 }, { amount: 20, damageKind: 'piercing' }])
    expect(
      out.events.filter((event) => event.event === 'combat_critical_resolved' && event.critical),
    ).toHaveLength(1)
    expect(validateCombatEncounterState(out.state)).toEqual([])
  })
  it('excludes real native Summon Pierce while its ordinary sibling still critically hits', () => {
    const base = preparePv1fTurnEconomy(encounter()) as StatDrivenCombatEncounterState
    const original = resolveMatureSkillVersion('wildwarden.renewing-herbs')!.summonProfile!
    const ability = {
      ...original.abilities[0]!,
      id: 'test.summon-pierce',
      apCost: 10,
      mpCost: 0,
      cooldownOwnerTurns: 0,
      tags: ['attack', 'physical'],
      target: action([]).target,
      requirements: [],
      effects: [damage, { ...damage, shattersBarrier: true as const }, spike],
      accuracyMode: 'automatic' as const,
    }
    const spawned = spawnCombatSummon(base, {
      ownerCombatantId: 'actor',
      sourceSkillId: 'test.summon',
      sourceSkillVersion: 1,
      profile: {
        ...original,
        potencyBasisPoints: undefined,
        lifetimeTurns: 5,
        stats: { ...original.stats, physicalPower: 0, mysticPower: 0, criticalChance: 10000 },
        abilities: [ability],
      },
      position: { x: 2, y: 0 },
      facing: 'south',
    })
    const summon = spawned.state.effectState!.summons![0]!
    let ready = spawned.state
    for (
      let n = 0;
      n < 12 && ready.tactical.battle.currentTurn?.combatantId !== summon.combatantId;
      n++
    )
      ready = finishPv1fTurn(ready, 'east').state
    const out = executePv1fSummonAbility(ready, summon, ability.id, selection)
    expect(hits(out.events)).toMatchObject([{ amount: 60 }, { amount: 20, damageKind: 'piercing' }])
    expect(
      out.events.filter(
        (event) =>
          typeof event === 'object' &&
          event !== null &&
          'event' in event &&
          event.event === 'combat_critical_resolved' &&
          'critical' in event &&
          event.critical,
      ),
    ).toHaveLength(1)
  })
})

import { interceptCombatReversal } from './combat-reversal-interception'
import { createCombatTriggerGuard } from './combat-kernel-types'
import { spawnCombatSummon } from './combat-summons'
import { resolveMatureSkillVersion } from './mature-skills'
import {
  createCurrentStatDrivenCombatEncounterState,
  reattachStatDrivenCombatBridge,
  type StatDrivenCombatEncounterState,
} from './stat-driven-combat'
import { chooseSummonAiDecision } from './summon-ai'
import {
  chooseBuildAwareRecruitAiDecision,
  executeBuildAwareRecruitAiAction,
} from './recruit-ai-build'
import { getRecruitAiProfile } from './recruit-ai'
import { describe, expect, it } from 'vitest'
import { validateAbilityDefinition, applyAbilityTimingDefaults } from './combat-definition'
import { source } from './combat-behavior.test-utils'
import { percentageDotEncounter } from './combat-percentage-dots.test-utils'
import { captureCombatAbilitySource } from './combat-behavior-capture'
import {
  reconcileCombatAbilitySources,
  primeCombatControlledAbility,
  cancelCombatControlledAbility,
  combatAbilityCommandContext,
} from './combat-behavior-runtime'
import { prepareCombatAbilityCommand, commitCombatAbilityCommand } from './combat-ability-command'
import {
  PV1F_COMBAT_CONTENT,
  preparePv1fTurnEconomy,
  readPv1fActionEconomy,
  finishPv1fTurn,
  executePv1fSummonAbility,
  evaluatePv1fSummonAbility,
  evaluatePv1fAction,
  executePv1fAction,
} from './pv1f-action-economy'
import {
  executeCombatAction,
  validateCombatEncounterState,
  evaluateCombatAction,
  type CombatActionDefinition,
  type CombatEncounterState,
} from './actions'
import { normalBasicAttackDamageAgainst } from './actions-legacy'
import { captureBasicSkillSources, defaultBasicSkills } from './combat-basic-actions'
import { grantBarrier, currentBarrierAmount } from './combat-barrier'
import {
  hasArmedCombatReversal,
  hasCombatReversalStrain,
  endCombatReversal,
} from './combat-reversal'
import { combatControlledAbilityAvailability } from './combat-controlled'
import { readSkillCooldown } from './skill-cooldowns'
const payload = {
  type: 'reversal',
  recipient: 'actor',
  version: 1,
  family: 'physical',
  reflectionBasisPoints: 10000,
  attackerMaxHpCapBasisPoints: 2000,
  defenderMaxHpCapBasisPoints: 2500,
} as const
function reversalSource(family: 'physical' | 'mystic' = 'physical') {
  return captureCombatAbilitySource(
    source({
      id: 'prepare',
      classification: 'utility',
      attackFamily: undefined,
      costs: [
        { resource: 'ap', amount: 50 },
        { resource: 'mp', amount: 5 },
      ],
      cooldown: { key: 'test.reversal', ownerTurns: 3 },
      targeting: {
        kind: 'self',
        teamPolicy: 'self',
        friendlyFire: 'allies-only',
        shape: { kind: 'single' },
        minimumRange: 0,
        maximumRange: 0,
        requiresLineOfSight: false,
        maximumElevationDifference: null,
        maximumSelections: 1,
      },
      effects: [{ id: 'reversal', timing: 'controlled', payload: { ...payload, family } }],
    }),
  )
}
function encounter(family: 'physical' | 'mystic' = 'physical') {
  const captured = reversalSource(family)
  const base = preparePv1fTurnEconomy(percentageDotEncounter())
  const state = reconcileCombatAbilitySources(
    {
      ...base,
      effectTimingPolicy: { version: 1, modes: {}, tagAuthority: 'global' as const },
    },
    [captured],
  )
  return { state: reattachStatDrivenCombatBridge(state, base.statBridge), captured }
}
function prime(state: CombatEncounterState, captured = reversalSource()) {
  return primeCombatControlledAbility({
    state,
    actorId: 'actor',
    sourceInstanceId: captured.sourceInstanceId,
    behaviorId: 'prepare',
    content: PV1F_COMBAT_CONTENT,
  })
}
function attack(family: 'physical' | 'mystic' = 'physical', amount = 40): CombatActionDefinition {
  return {
    id: 'test.incoming',
    version: 1,
    sourceType: 'test',
    tags: ['attack', family],
    cost: { spendsAction: false, mp: 0 },
    requirements: [],
    target: {
      kind: 'unit',
      teamPolicy: 'any',
      friendlyFire: 'all-units',
      shape: { kind: 'single' },
      minimumRange: 1,
      maximumRange: 20,
      requiresLineOfSight: false,
      maximumElevationDifference: null,
    },
    effects: [{ type: 'damage', recipient: 'primary-unit', amount }],
    effectTimingModes: ['instant'],
  }
}
function atEnemyTurn(state: CombatEncounterState): CombatEncounterState {
  let next = state
  for (let n = 0; n < 8 && next.tactical.battle.currentTurn?.combatantId !== 'enemy'; n++)
    next = finishPv1fTurn(next as never, 'east').state
  return next
}
const hp = (state: CombatEncounterState, id: string) =>
  state.tactical.battle.combatants.find((u) => u.id === id)!.hp

describe('Reversal v1', () => {
  it('strictly accepts one Physical or Mystic family and rejects invalid configuration', () => {
    expect(validateAbilityDefinition(reversalSource().definition)).toEqual([])
    expect(validateAbilityDefinition(reversalSource('mystic').definition)).toEqual([])
    for (const invalid of [
      { ...payload, family: 'both' },
      { ...payload, family: undefined },
      { ...payload, version: 2 },
      { ...payload, reflectionBasisPoints: -1 },
      { ...payload, maximumTriggers: 2 },
      { ...payload, durationTurns: 99 },
      { ...payload, target: 'enemy' },
    ]) {
      const valid = structuredClone(reversalSource().definition)
      Object.assign(valid.behaviors[0]!.effects[0]!, { payload: invalid })
      expect(validateAbilityDefinition(valid).length).toBeGreaterThan(0)
    }
  })
  it('pays preparation once, starts its cooldown, captures a genuine prime and records a Skill use', () => {
    const { state, captured } = encounter()
    const before = JSON.stringify(state)
    const armed = prime(state, captured)
    expect(readPv1fActionEconomy(armed.state as never, 'actor')?.current).toBe(50)
    expect(armed.state.tactical.battle.combatants.find((u) => u.id === 'actor')!.mp).toBe(
      state.tactical.battle.combatants.find((u) => u.id === 'actor')!.mp - 5,
    )
    expect(
      readSkillCooldown(
        armed.state.tactical.battle.combatants.find((u) => u.id === 'actor')!,
        { key: 'test.reversal', ownerTurns: 3 },
      ).active,
    ).toBe(true)
    expect(armed.state.abilityRuntime?.controlled?.primes).toHaveLength(1)
    expect(armed.events).toContainEqual(
      expect.objectContaining({ event: 'combat_action_used', actionId: captured.abilityId }),
    )
    expect(armed.events).toContainEqual(
      expect.objectContaining({ event: 'reversal_prepared', family: 'physical' }),
    )
    expect(() => prime(armed.state, captured)).toThrow()
    expect(JSON.stringify(state)).toBe(before)
  })
  it('intercepts before HP and returns exactly the would-be damage without an ordinary returned damage packet', () => {
    const { state, captured } = encounter()
    const armed = atEnemyTurn(prime(state, captured).state)
    const beforeActor = hp(armed, 'actor'),
      beforeEnemy = hp(armed, 'enemy')
    const out = executeCombatAction(
      armed,
      attack(),
      { kind: 'unit', combatantId: 'actor' },
      PV1F_COMBAT_CONTENT,
    )
    expect(hp(out.state, 'actor')).toBe(beforeActor)
    expect(hp(out.state, 'enemy')).toBe(beforeEnemy - 40)
    expect(out.events).toContainEqual(
      expect.objectContaining({
        event: 'reversal_triggered',
        preventedDamage: 40,
        returnedDamage: 40,
      }),
    )
    expect(out.events.filter((e) => e.event === 'damage_applied')).toHaveLength(0)
  })
  it.each([
    ['physical', 'physical', true],
    ['physical', 'mystic', false],
    ['mystic', 'mystic', true],
    ['mystic', 'physical', false],
  ] as const)('matches %s only against %s', (prepared, incoming, counters) => {
    const { state, captured } = encounter(prepared)
    const armed = atEnemyTurn(prime(state, captured).state)
    const out = executeCombatAction(
      armed,
      attack(incoming),
      { kind: 'unit', combatantId: 'actor' },
      PV1F_COMBAT_CONTENT,
    )
    expect(hp(out.state, 'actor')).toBe(hp(armed, 'actor') - (counters ? 0 : 40))
    expect(hasArmedCombatReversal(out.state, 'actor')).toBe(!counters)
  })
  it.each(['front', 'side', 'rear'] as const)(
    'uses authoritative %s facing without rotating defender',
    (arc) => {
      const { state, captured } = encounter()
      const armed = atEnemyTurn(prime(state, captured).state)
      const placement = armed.tactical.placements.find((row) => row.combatantId === 'actor')!
      const position =
        arc === 'front'
          ? { x: placement.position.x + 1, y: placement.position.y }
          : arc === 'rear'
            ? { x: placement.position.x - 1, y: placement.position.y }
            : { x: placement.position.x, y: placement.position.y - 1 }
      const placed = {
        ...armed,
        tactical: {
          ...armed.tactical,
          placements: armed.tactical.placements.map((row) =>
            row.combatantId === 'enemy' ? { ...row, position } : row,
          ),
        },
      }
      const out = executeCombatAction(
        placed,
        attack(),
        { kind: 'unit', combatantId: 'actor' },
        PV1F_COMBAT_CONTENT,
      )
      expect(hasArmedCombatReversal(out.state, 'actor')).toBe(arc === 'rear')
      expect(out.state.tactical.placements.find((row) => row.combatantId === 'actor')!.facing).toBe(
        'east',
      )
    },
  )
  it('probes defender Barrier without consuming it; fully absorbed hits do not consume the counter', () => {
    const { state, captured } = encounter()
    const armed = atEnemyTurn(prime(state, captured).state)
    const partial = grantBarrier(armed, 'actor', 'actor', 'test.barrier', 10).state
    const countered = executeCombatAction(
      partial,
      attack(),
      { kind: 'unit', combatantId: 'actor' },
      PV1F_COMBAT_CONTENT,
    )
    expect(currentBarrierAmount(countered.state, 'actor')).toBe(10)
    expect(countered.events).toContainEqual(
      expect.objectContaining({
        event: 'reversal_triggered',
        preventedDamage: 30,
        returnedDamage: 30,
      }),
    )
    const full = grantBarrier(armed, 'actor', 'actor', 'test.barrier', 100).state
    const normal = executeCombatAction(
      full,
      attack(),
      { kind: 'unit', combatantId: 'actor' },
      PV1F_COMBAT_CONTENT,
    )
    expect(hasArmedCombatReversal(normal.state, 'actor')).toBe(true)
    expect(currentBarrierAmount(normal.state, 'actor')).toBe(60)
  })
  it('survives round transition, expires at next actual owner start, and strains precisely that complete turn', () => {
    const { state, captured } = encounter()
    let next = prime(state, captured).state
    const round = next.tactical.battle.round,
      turn = next.tactical.battle.turnNumber
    while (
      next.tactical.battle.turnNumber === turn ||
      next.tactical.battle.currentTurn?.combatantId !== 'actor'
    ) {
      next = finishPv1fTurn(next as never, 'east').state
      if (next.tactical.battle.currentTurn?.combatantId !== 'actor')
        expect(hasArmedCombatReversal(next, 'actor')).toBe(true)
    }
    expect(next.tactical.battle.round).toBeGreaterThan(round)
    expect(hasArmedCombatReversal(next, 'actor')).toBe(false)
    expect(hasCombatReversalStrain(next, 'actor')).toBe(true)
    expect(
      evaluateCombatAction(
        next,
        attack(),
        { kind: 'unit', combatantId: 'enemy' },
        PV1F_COMBAT_CONTENT,
      ).legal,
    ).toBe(false)
    next = finishPv1fTurn(next as never, 'east').state
    expect(hasCombatReversalStrain(next, 'actor')).toBe(false)
  })
  it('cancellation never refunds, does not strain the incomplete preparation turn, and blocks re-prime', () => {
    const { state, captured } = encounter()
    const armed = prime(state, captured).state
    const cancelled = cancelCombatControlledAbility({
      state: armed,
      actorId: 'actor',
      sourceInstanceId: captured.sourceInstanceId,
      behaviorId: 'prepare',
    })
    expect(readPv1fActionEconomy(cancelled.state as never, 'actor')?.current).toBe(50)
    expect(hasCombatReversalStrain(cancelled.state, 'actor')).toBe(true)
    expect(() => prime(cancelled.state, captured)).toThrow()
    let next = finishPv1fTurn(cancelled.state as never, 'east').state
    expect(hasCombatReversalStrain(next, 'actor')).toBe(true)
    for (let n = 0; n < 8 && next.tactical.battle.currentTurn?.combatantId !== 'actor'; n++)
      next = finishPv1fTurn(next as never, 'east').state
    expect(hasCombatReversalStrain(next, 'actor')).toBe(true)
    expect(hasCombatReversalStrain(finishPv1fTurn(next as never, 'east').state, 'actor')).toBe(
      false,
    )
  })
  it('rejects preparation after an offensive attack and all offense while armed', () => {
    const { state, captured } = encounter()
    const struck = executeCombatAction(
      state,
      attack(),
      { kind: 'unit', combatantId: 'enemy' },
      PV1F_COMBAT_CONTENT,
    )
    expect(() => prime(struck.state, captured)).toThrow(/after an offensive/)
    const armed = prime(state, captured).state
    expect(
      evaluateCombatAction(
        armed,
        attack(),
        { kind: 'unit', combatantId: 'enemy' },
        PV1F_COMBAT_CONTENT,
      ).legal,
    ).toBe(false)
  })
  it('quotes paid affordability through Controlled availability and always permits cancellation during cooldown', () => {
    const { state, captured } = encounter()
    const input = {
      state,
      actorId: 'actor',
      sourceInstanceId: captured.sourceInstanceId,
      behaviorId: 'prepare',
      content: PV1F_COMBAT_CONTENT,
    }
    expect(combatControlledAbilityAvailability(input)?.canPrime).toBe(true)
    const armed = prime(state, captured).state
    expect(combatControlledAbilityAvailability({ ...input, state: armed })).toMatchObject({
      phase: 'primed',
      canPrime: false,
      canCancel: true,
    })
    const poor = {
      ...state,
      tactical: {
        ...state.tactical,
        battle: {
          ...state.tactical.battle,
          combatants: state.tactical.battle.combatants.map((unit) =>
            unit.id === 'actor' ? { ...unit, mp: 0 } : unit,
          ),
        },
      },
    }
    expect(combatControlledAbilityAvailability({ ...input, state: poor })?.canPrime).toBe(false)
  })
  it('Reveal without concealment disarms only when its effect resolves and applies current Revealed', () => {
    const { state, captured } = encounter()
    const armed = atEnemyTurn(prime(state, captured).state)
    const reveal = {
      ...attack(),
      tags: ['utility'],
      effects: [
        {
          type: 'sensory' as const,
          recipient: 'primary-unit' as const,
          revealedDurationOwnerTurnStarts: 2,
          increasedDamageTakenBasisPoints: 2500,
        },
      ],
    }
    const out = executeCombatAction(
      armed,
      reveal,
      { kind: 'unit', combatantId: 'actor' },
      PV1F_COMBAT_CONTENT,
    )
    expect(hasArmedCombatReversal(out.state, 'actor')).toBe(false)
    expect(hasCombatReversalStrain(out.state, 'actor')).toBe(true)
    expect(
      out.state.statusState.find((row) => row.combatantId === 'actor')!.statuses,
    ).toContainEqual(
      expect.objectContaining({ statusId: 'revealed', increasedDamageTakenBasisPoints: 2500 }),
    )
  })
  it('intercepts only the first packet and its dependent debuff while preserving later damage and DoT', () => {
    const { state, captured } = encounter()
    const armed = atEnemyTurn(prime(state, captured).state)
    const multi = {
      ...attack(),
      effectTimingModes: ['instant', 'instant', 'instant', 'instant'] as const,
      effects: [
        { type: 'damage' as const, recipient: 'primary-unit' as const, amount: 40 },
        {
          type: 'apply-status' as const,
          recipient: 'primary-unit' as const,
          statusId: 'root',
          stacks: 1,
        },
        { type: 'damage' as const, recipient: 'primary-unit' as const, amount: 20 },
        { type: 'poison' as const, recipient: 'primary-unit' as const, power: 2, durationTurns: 2 },
      ],
    }
    const out = executeCombatAction(
      armed,
      multi,
      { kind: 'unit', combatantId: 'actor' },
      PV1F_COMBAT_CONTENT,
    )
    expect(hp(out.state, 'actor')).toBe(hp(armed, 'actor') - 20)
    expect(
      out.state.statusState
        .find((row) => row.combatantId === 'actor')!
        .statuses.some((s) => s.statusId === 'root'),
    ).toBe(false)
    expect(out.state.effectState?.poison.some((row) => row.targetCombatantId === 'actor')).toBe(
      true,
    )
    expect(out.events.filter((e) => e.event === 'reversal_triggered')).toHaveLength(1)
  })
  it('honors reflection/caps, consumes exactly once and never counters returned damage recursively', () => {
    const { state, captured } = encounter()
    const armed = atEnemyTurn(prime(state, captured).state)
    const out = executeCombatAction(
      armed,
      attack('physical', 900),
      { kind: 'unit', combatantId: 'actor' },
      PV1F_COMBAT_CONTENT,
    )
    expect(out.events).toContainEqual(
      expect.objectContaining({
        event: 'reversal_triggered',
        preventedDamage: 900,
        returnedDamage: 200,
      }),
    )
    const later = executeCombatAction(
      out.state,
      attack('physical', 1),
      { kind: 'unit', combatantId: 'actor' },
      PV1F_COMBAT_CONTENT,
    )
    expect(hp(later.state, 'actor')).toBe(hp(armed, 'actor') - 1)
    expect(later.events.some((e) => e.event === 'reversal_triggered')).toBe(false)
  })
  it('disarms Reveal before same-action Damage even when Damage appears first', () => {
    const { state, captured } = encounter()
    const armed = atEnemyTurn(prime(state, captured).state)
    const reveal = {
      ...attack(),
      effectTimingModes: ['instant', 'instant'] as const,
      effects: [
        ...attack().effects,
        {
          type: 'sensory' as const,
          recipient: 'primary-unit' as const,
          revealedDurationOwnerTurnStarts: 2,
          increasedDamageTakenBasisPoints: 2500,
        },
      ],
    }
    const out = executeCombatAction(
      armed,
      reveal,
      { kind: 'unit', combatantId: 'actor' },
      PV1F_COMBAT_CONTENT,
    )
    expect(out.events.some((e) => e.event === 'reversal_triggered')).toBe(false)
    expect(hp(out.state, 'actor')).toBeLessThan(hp(armed, 'actor'))
    expect(hasCombatReversalStrain(out.state, 'actor')).toBe(true)
  })
  it('does not disarm for a Delayed Reveal until its real effect resolves', () => {
    const { state, captured } = encounter()
    let armed = atEnemyTurn(prime(state, captured).state)
    const reveal = {
      ...attack(),
      tags: ['utility'],
      effectTimingModes: ['delayed'] as const,
      effects: [
        {
          type: 'sensory' as const,
          recipient: 'primary-unit' as const,
          revealedDurationOwnerTurnStarts: 2,
          increasedDamageTakenBasisPoints: 2500,
        },
      ],
    }
    const queued = executeCombatAction(
      armed,
      reveal,
      { kind: 'unit', combatantId: 'actor' },
      PV1F_COMBAT_CONTENT,
    )
    expect(hasArmedCombatReversal(queued.state, 'actor')).toBe(true)
    expect(queued.events.some((e) => e.event === 'reversal_ended')).toBe(false)
    expect(
      queued.state.pendingEffects?.some(
        (effect) => effect.effect.type === 'apply-status' && effect.effect.statusId === 'revealed',
      ),
    ).toBe(true)
    armed = queued.state
    for (let n = 0; n < 12 && armed.tactical.battle.round < 3; n++)
      armed = finishPv1fTurn(armed as never, 'east').state
    expect(
      armed.statusState
        .find((row) => row.combatantId === 'actor')!
        .statuses.some((s) => s.statusId === 'revealed'),
    ).toBe(true)
  })
  it('active Revealed blocks preparation while a pending presentation does not', () => {
    const { state, captured } = encounter()
    const active = {
      ...state,
      statusState: state.statusState.map((row) =>
        row.combatantId === 'actor'
          ? {
              ...row,
              statuses: [
                {
                  statusId: 'revealed',
                  statusVersion: 1,
                  stacks: 1,
                  remainingOwnerTurnStarts: 3,
                  sourceCombatantId: 'enemy',
                  increasedDamageTakenBasisPoints: 2500,
                },
              ],
            }
          : row,
      ),
    }
    expect(() => prime(active, captured)).toThrow(/Revealed/)
    const pending = {
      ...active,
      statusState: active.statusState.map((row) => ({
        ...row,
        statuses: row.statuses.map((s) => ({
          ...s,
          timingState: 'pending' as const,
          activationRound: 2,
        })),
      })),
    }
    expect(hasArmedCombatReversal(prime(pending, captured).state, 'actor')).toBe(true)
  })
  it('keeps ordinary inherent Basic Attack and utility legal during Strain, while a Skill remains blocked', () => {
    const { state, captured } = encounter()
    const armed = prime(state, captured).state
    const strained = cancelCombatControlledAbility({
      state: armed,
      actorId: 'actor',
      sourceInstanceId: captured.sourceInstanceId,
      behaviorId: 'prepare',
    }).state
    expect(
      evaluatePv1fAction(strained as never, 'basic.attack.unarmed.basic', {
        kind: 'unit',
        combatantId: 'enemy',
      }).evaluation.legal,
    ).toBe(true)
    const utility = {
      ...attack(),
      tags: ['utility'],
      effects: [{ type: 'healing' as const, recipient: 'actor' as const, amount: 1 }],
    }
    expect(
      evaluateCombatAction(
        strained,
        utility,
        { kind: 'unit', combatantId: 'enemy' },
        PV1F_COMBAT_CONTENT,
      ).legal,
    ).toBe(true)
    expect(
      evaluateCombatAction(
        strained,
        attack(),
        { kind: 'unit', combatantId: 'enemy' },
        PV1F_COMBAT_CONTENT,
      ).legal,
    ).toBe(false)
  })
  it('cannot manually release, forge native preparation, mix offense or author both families', () => {
    const { state, captured } = encounter()
    const armed = prime(state, captured).state
    const command = {
      state: armed,
      actorId: 'actor',
      root: { kind: 'canonical' as const, source: captured, behaviorId: 'prepare' },
      selection: { kind: 'self' as const },
      content: PV1F_COMBAT_CONTENT,
      context: combatAbilityCommandContext(armed, captured),
    }
    expect(prepareCombatAbilityCommand(command).evaluation.legal).toBe(false)
    expect(() => commitCombatAbilityCommand(command)).toThrow()
    const raw = {
      ...attack(),
      tags: ['utility'],
      target: captured.definition.behaviors[0]!.targeting!,
      effects: [payload],
    }
    expect(() => evaluateCombatAction(state, raw, { kind: 'self' }, PV1F_COMBAT_CONTENT)).toThrow()
    const mixed = structuredClone(captured.definition)
    Object.assign(mixed.behaviors[0]!, {
      effects: [
        ...mixed.behaviors[0]!.effects,
        { id: 'hit', payload: { type: 'damage', recipient: 'primary-unit', amount: 1 } },
      ],
    })
    expect(validateAbilityDefinition(mixed).length).toBeGreaterThan(0)
  })
  it('round-trips the pinned armed source and rejects forged private authority', () => {
    const { state, captured } = encounter()
    const armed = prime(state, captured).state
    const restored = JSON.parse(JSON.stringify(armed)) as CombatEncounterState
    expect(validateCombatEncounterState(restored)).toEqual([])
    const tampered = JSON.parse(JSON.stringify(restored))
    tampered.reversalState.armed[0].contentVersion = 999
    expect(validateCombatEncounterState(tampered)).toContainEqual(
      expect.objectContaining({ field: 'reversalState' }),
    )
    const first = executeCombatAction(
      atEnemyTurn(restored),
      attack(),
      { kind: 'unit', combatantId: 'actor' },
      PV1F_COMBAT_CONTENT,
    )
    const replay = executeCombatAction(
      atEnemyTurn(JSON.parse(JSON.stringify(armed))),
      attack(),
      { kind: 'unit', combatantId: 'actor' },
      PV1F_COMBAT_CONTENT,
    )
    expect(replay).toEqual(first)
    expect(hp(armed, 'actor')).toBe(hp(state, 'actor'))
  })
  it('lets AI prepare through the same paid authority using only visible threats', () => {
    const { state, captured } = encounter()
    const spaced = {
      ...state,
      tactical: {
        ...state.tactical,
        placements: state.tactical.placements.map((row) =>
          row.combatantId === 'enemy' ? { ...row, position: { x: 4, y: 1 } } : row,
        ),
      },
    }
    const decision = chooseBuildAwareRecruitAiDecision({
      state: spaced as StatDrivenCombatEncounterState,
      profile: getRecruitAiProfile('high'),
      tieBreakSeed: 42,
      skillOptions: { canonicalSources: [captured], committedSkills: [] },
    })
    expect(decision.intent).toMatchObject({ kind: 'ability-prime', actionId: captured.abilityId })
    if (decision.intent.kind !== 'ability-prime') throw new Error('Expected AI paid preparation.')
    const executed = executeBuildAwareRecruitAiAction(
      spaced as StatDrivenCombatEncounterState,
      decision.intent.actionId,
      { kind: 'self' },
      { canonicalSources: [captured], committedSkills: [] },
      { controlledOperation: 'prime', behaviorId: 'prepare' },
    )
    expect(readPv1fActionEconomy(executed.state, 'actor')?.current).toBe(50)
    expect(hasArmedCombatReversal(executed.state, 'actor')).toBe(true)
  })
  it('prepares an authored Summon Reversal through genuine paid capture and respects its cooldown', () => {
    const base = percentageDotEncounter()
    const state = createCurrentStatDrivenCombatEncounterState(
      base,
      base.statBridge.combatants.map((row) => ({
        ...row,
        physicalPower: row.physicalPower ?? 20,
        mysticPower: row.mysticPower ?? 20,
        level: 1,
        criticalChance: 0,
      })),
    )
    const profile = resolveMatureSkillVersion('wildwarden.renewing-herbs')!.summonProfile!
    const ability = {
      ...profile.abilities[0]!,
      id: 'test.summon-reversal',
      apCost: 50,
      mpCost: 5,
      hpCost: 2,
      cooldownOwnerTurns: 3,
      tags: ['utility'],
      target: reversalSource().definition.behaviors[0]!.targeting!,
      requirements: [],
      effects: [payload],
    }
    const spawned = spawnCombatSummon(state, {
      ownerCombatantId: 'actor',
      sourceSkillId: 'test.summon',
      sourceSkillVersion: 1,
      profile: { ...profile, abilities: [ability] },
      position: { x: 2, y: 0 },
      facing: 'east',
    })
    const summon = spawned.state.effectState!.summons![0]!
    let turn = spawned.state
    for (
      let n = 0;
      n < 12 && turn.tactical.battle.currentTurn?.combatantId !== summon.combatantId;
      n++
    )
      turn = finishPv1fTurn(turn, 'east').state
    const attacked = executePv1fAction(turn, 'basic.attack.unarmed.basic', {
      kind: 'unit',
      combatantId: 'enemy',
    })
    expect(
      evaluatePv1fSummonAbility(attacked.state, summon, ability.id, { kind: 'self' }).evaluation
        .legal,
    ).toBe(false)
    const quote = evaluatePv1fSummonAbility(turn, summon, ability.id, { kind: 'self' })
    expect(quote.evaluation.legal).toBe(true)
    expect(chooseSummonAiDecision({ state: turn, summon, tieBreakSeed: 7 }).intent).toMatchObject({
      kind: 'action',
      actionId: ability.id,
    })
    const hpBefore = hp(turn, summon.combatantId)
    const prepared = executePv1fSummonAbility(turn, summon, ability.id, { kind: 'self' })
    expect(readPv1fActionEconomy(prepared.state, summon.combatantId)?.current).toBe(50)
    expect(hp(prepared.state, summon.combatantId)).toBe(hpBefore - 2)
    expect(hasArmedCombatReversal(prepared.state, summon.combatantId)).toBe(true)
    expect(
      readSkillCooldown(
        prepared.state.tactical.battle.combatants.find((u) => u.id === summon.combatantId)!,
        { key: ability.id, ownerTurns: 3 },
      ).active,
    ).toBe(true)
    expect(
      evaluatePv1fSummonAbility(prepared.state, summon, ability.id, { kind: 'self' }).evaluation
        .legal,
    ).toBe(false)
    let expired = prepared.state
    for (
      let n = 0;
      n < 40 && expired.effectState?.summons?.some((row) => row.combatantId === summon.combatantId);
      n++
    )
      expired = finishPv1fTurn(expired, 'east').state
    expect(
      expired.effectState?.summons?.some((row) => row.combatantId === summon.combatantId),
    ).toBe(false)
    expect(validateCombatEncounterState(expired)).toEqual([])
  })

  it('stops later packets when the returned damage defeats the attacking actor', () => {
    const { state, captured } = encounter()
    const armed = atEnemyTurn(prime(state, captured).state)
    const weak = {
      ...armed,
      tactical: {
        ...armed.tactical,
        battle: {
          ...armed.tactical.battle,
          combatants: armed.tactical.battle.combatants.map((unit) =>
            unit.id === 'enemy' ? { ...unit, hp: 1 } : unit,
          ),
        },
      },
    }
    const multi = {
      ...attack(),
      effectTimingModes: ['instant', 'instant'] as const,
      effects: [...attack().effects, ...attack().effects],
    }
    const out = executeCombatAction(
      weak,
      multi,
      { kind: 'unit', combatantId: 'actor' },
      PV1F_COMBAT_CONTENT,
    )
    expect(hp(out.state, 'enemy')).toBe(0)
    expect(hp(out.state, 'actor')).toBe(hp(weak, 'actor'))
    expect(out.state.tactical.battle.currentTurn?.combatantId).not.toBe('enemy')
  })
  it.each([
    ['unit', false],
    ['ground', false],
    ['unit', true],
    ['ground', true],
  ] as const)(
    'stops the remaining next-round %s packets when Reversal defeats their source (packet policy: %s)',
    (delivery, currentPacketPolicy) => {
      const { state, captured } = encounter()
      const armed = atEnemyTurn(prime(state, captured).state)
      const weak = {
        ...armed,
        tactical: {
          ...armed.tactical,
          battle: {
            ...armed.tactical.battle,
            combatants: armed.tactical.battle.combatants.map((unit) =>
              unit.id === 'enemy' ? { ...unit, hp: 1 } : unit,
            ),
          },
        },
      }
      const damage = {
        type: 'damage' as const,
        recipient: delivery === 'ground' ? ('affected-units' as const) : ('primary-unit' as const),
        amount: 40,
      }
      const multi: CombatActionDefinition = {
        ...attack(),
        target: {
          ...attack().target,
          kind: delivery === 'ground' ? 'ground-tile' : 'unit',
          shape: delivery === 'ground' ? { kind: 'circle', radius: 0 } : { kind: 'single' },
        },
        effectTimingModes: ['next-round', 'next-round'],
        effects: [damage, damage],
      }
      const queued = executeCombatAction(
        currentPacketPolicy
          ? {
              ...createCurrentStatDrivenCombatEncounterState(
                weak,
                state.statBridge.combatants.map((row) => ({
                  ...row,
                  physicalPower: row.physicalPower ?? 20,
                  mysticPower: row.mysticPower ?? 20,
                  level: 1,
                  criticalChance: 0,
                })),
              ),
              skillPacketPolicyVersion: 1,
            }
          : weak,
        multi,
        delivery === 'ground'
          ? { kind: 'tile', position: { x: 1, y: 1 } }
          : { kind: 'unit', combatantId: 'actor' },
        PV1F_COMBAT_CONTENT,
      )
      expect(queued.state.pendingEffects).toHaveLength(2)
      expect(queued.state.pendingEffects?.[0]?.skillPacketCommandId !== undefined).toBe(
        currentPacketPolicy,
      )
      expect(queued.state.pendingEffects?.[0]?.reversalAttackCommandId !== undefined).toBe(
        !currentPacketPolicy,
      )
      let next = JSON.parse(JSON.stringify(queued.state)) as CombatEncounterState
      expect(validateCombatEncounterState(next)).toEqual([])
      const receipts: unknown[] = []
      for (let n = 0; n < 8 && next.tactical.battle.round === 1; n++) {
        const out = finishPv1fTurn(next as never, 'east')
        next = out.state
        receipts.push(...out.events)
      }
      expect(hp(next, 'enemy')).toBe(0)
      expect(hp(next, 'actor')).toBe(hp(weak, 'actor'))
      expect(
        receipts.filter(
          (event) =>
            event &&
            typeof event === 'object' &&
            'event' in event &&
            event.event === 'reversal_triggered',
        ),
      ).toHaveLength(1)
      expect(
        receipts.filter(
          (event) =>
            event &&
            typeof event === 'object' &&
            'event' in event &&
            event.event === 'damage_applied',
        ),
      ).toHaveLength(0)
      expect(validateCombatEncounterState(next)).toEqual([])
    },
  )
  it('captures a delayed attack identity before the defender prepares Reversal', () => {
    const { state, captured } = encounter()
    const enemyTurn = atEnemyTurn(state)
    const weak = {
      ...enemyTurn,
      tactical: {
        ...enemyTurn.tactical,
        battle: {
          ...enemyTurn.tactical.battle,
          combatants: enemyTurn.tactical.battle.combatants.map((unit) =>
            unit.id === 'enemy' ? { ...unit, hp: 1 } : unit,
          ),
        },
      },
    }
    let next = executeCombatAction(
      weak,
      {
        ...attack(),
        effectTimingModes: ['delayed', 'delayed'],
        effects: [...attack().effects, ...attack().effects],
      },
      { kind: 'unit', combatantId: 'actor' },
      PV1F_COMBAT_CONTENT,
    ).state
    expect(hasArmedCombatReversal(next, 'actor')).toBe(false)
    expect(next.pendingEffects?.[0]?.reversalAttackCommandId).toBeDefined()
    expect(validateCombatEncounterState({ ...next, nextReversalAttackCommandId: 0 })).not.toEqual(
      [],
    )
    expect(
      validateCombatEncounterState({
        ...next,
        pendingEffects: next.pendingEffects?.map((pending) => ({
          ...pending,
          reversalAttackCommandId: -1,
        })),
      }),
    ).not.toEqual([])
    for (let n = 0; n < 8 && next.tactical.battle.currentTurn?.combatantId !== 'actor'; n++)
      next = finishPv1fTurn(next as never, 'east').state
    expect(next.tactical.battle.round).toBe(2)
    next = prime(next, captured).state
    for (let n = 0; n < 8 && next.tactical.battle.round === 2; n++)
      next = finishPv1fTurn(next as never, 'east').state
    expect(hp(next, 'enemy')).toBe(0)
    expect(hp(next, 'actor')).toBe(hp(weak, 'actor'))
    expect(validateCombatEncounterState(next)).toEqual([])
  })
  it('stops only the defeated source’s original canonical cast, including its later activation rounds', () => {
    const { state, captured } = encounter()
    const armed = atEnemyTurn(prime(state, captured).state)
    const delayed = captureCombatAbilitySource({
      ...source(
        {
          costs: [],
          effects: [
            {
              id: 'first',
              timing: 'next-round',
              payload: { type: 'damage', recipient: 'primary-unit', amount: 10 },
            },
            {
              id: 'second',
              timing: 'next-round',
              payload: { type: 'damage', recipient: 'primary-unit', amount: 10 },
            },
            {
              id: 'later',
              timing: 'delayed',
              payload: { type: 'damage', recipient: 'primary-unit', amount: 10 },
            },
          ],
        },
        'delayed-reversal-source',
      ),
      ownerCombatantId: 'enemy',
      abilityId: 'test.delayed-reversal-attack',
    })
    let next = reconcileCombatAbilitySources(
      {
        ...armed,
        effectTimingPolicy: { version: 1, modes: {} },
        tactical: {
          ...armed.tactical,
          battle: {
            ...armed.tactical.battle,
            combatants: armed.tactical.battle.combatants.map((unit) =>
              unit.id === 'enemy' ? { ...unit, hp: 1 } : unit,
            ),
          },
        },
      },
      [captured, delayed],
    )
    for (let cast = 0; cast < 2; cast++)
      next = commitCombatAbilityCommand({
        state: next,
        actorId: 'enemy',
        root: { kind: 'canonical', source: delayed },
        selection: { kind: 'unit', combatantId: 'actor' },
        content: PV1F_COMBAT_CONTENT,
        context: combatAbilityCommandContext(next, delayed),
      }).state
    const firstCommand = next.pendingEffects![0]!.reversalAttackCommandId
    const secondCommand = next.pendingEffects![3]!.reversalAttackCommandId
    expect(firstCommand).toBeDefined()
    expect(secondCommand).not.toBe(firstCommand)
    const receipts: unknown[] = []
    for (let n = 0; n < 8 && next.tactical.battle.round === 1; n++) {
      const out = finishPv1fTurn(next as never, 'east')
      next = out.state
      receipts.push(...out.events)
    }
    expect(hp(next, 'enemy')).toBe(0)
    // A different cast retains the existing contract for already committed delayed effects,
    // even with the same dead source, Skill ID, target and activation round.
    expect(
      receipts.filter(
        (event) =>
          event &&
          typeof event === 'object' &&
          'event' in event &&
          event.event === 'reversal_triggered',
      ),
    ).toHaveLength(1)
    expect(
      receipts.filter(
        (event) =>
          event &&
          typeof event === 'object' &&
          'event' in event &&
          event.event === 'damage_applied',
      ),
    ).toHaveLength(2)
    expect(
      next.pendingEffects?.some((pending) => pending.reversalAttackCommandId === firstCommand),
    ).toBe(false)
    expect(
      next.pendingEffects?.some((pending) => pending.reversalAttackCommandId === secondCommand),
    ).toBe(true)
    const hpAfterNextRound = hp(next, 'actor')
    receipts.length = 0
    for (let n = 0; n < 8 && next.tactical.battle.round === 2; n++) {
      const out = finishPv1fTurn(next as never, 'east')
      next = out.state
      receipts.push(...out.events)
    }
    expect(
      receipts.filter(
        (event) =>
          event &&
          typeof event === 'object' &&
          'event' in event &&
          event.event === 'damage_applied',
      ),
    ).toHaveLength(1)
    expect(hp(next, 'actor')).toBeLessThan(hpAfterNextRound)
    expect(validateCombatEncounterState(next)).toEqual([])
  })
  it.each([
    ['next-round', false],
    ['delayed', false],
    ['next-round', true],
    ['delayed', true],
  ] as const)(
    'suppresses intercepted hit add-ons across %s activation with packet policy %s',
    (addonTiming, currentPacketPolicy) => {
      const { state, captured } = encounter()
      const armed = atEnemyTurn(prime(state, captured).state)
      const ready = currentPacketPolicy
        ? {
            ...createCurrentStatDrivenCombatEncounterState(
              armed,
              state.statBridge.combatants.map((row) => ({
                ...row,
                physicalPower: row.physicalPower ?? 20,
                mysticPower: row.mysticPower ?? 20,
                level: 1,
                criticalChance: 0,
              })),
            ),
            skillPacketPolicyVersion: 1 as const,
          }
        : armed
      let next = executeCombatAction(
        ready,
        {
          ...attack(),
          effectTimingModes: ['next-round', addonTiming, 'next-round', addonTiming],
          effects: [
            ...attack().effects,
            {
              type: 'apply-status',
              recipient: 'primary-unit',
              statusId: 'slow',
              stacks: 1,
              durationTurns: 2,
            },
            ...attack().effects,
            {
              type: 'apply-status',
              recipient: 'primary-unit',
              statusId: 'root',
              stacks: 1,
              durationTurns: 2,
            },
          ],
        },
        { kind: 'unit', combatantId: 'actor' },
        PV1F_COMBAT_CONTENT,
      ).state
      // A separate cast with the same source, Skill ID and recipient stays independent.
      next = executeCombatAction(
        next,
        {
          ...attack(),
          effectTimingModes: [addonTiming],
          effects: [
            {
              type: 'apply-status',
              recipient: 'primary-unit',
              statusId: 'slow',
              stacks: 1,
              durationTurns: 2,
            },
          ],
        },
        { kind: 'unit', combatantId: 'actor' },
        PV1F_COMBAT_CONTENT,
      ).state
      const receipts: unknown[] = []
      for (let n = 0; n < 8 && next.tactical.battle.round === 1; n++) {
        const out = finishPv1fTurn(next as never, 'east')
        next = out.state
        receipts.push(...out.events)
      }
      expect(hp(next, 'enemy')).toBe(960)
      expect(hp(next, 'actor')).toBe(960)
      // Replay the retained later-round queue to prove suppression does not depend
      // on an in-memory map, and that the second Damage restored its own add-on.
      next = JSON.parse(JSON.stringify(next)) as CombatEncounterState
      for (let n = 0; n < 8 && next.tactical.battle.round === 2; n++) {
        const out = finishPv1fTurn(next as never, 'east')
        next = out.state
        receipts.push(...out.events)
      }
      const statuses = receipts.flatMap((event) =>
        event &&
        typeof event === 'object' &&
        'event' in event &&
        event.event === 'status_applied' &&
        'statusId' in event
          ? [event.statusId]
          : [],
      )
      expect(statuses.filter((id) => id === 'slow')).toHaveLength(1)
      expect(statuses.filter((id) => id === 'root')).toHaveLength(1)
      expect(validateCombatEncounterState(next)).toEqual([])
    },
  )
  it('returns a zero Basic reference when conditional Damage fails but its annotation qualifies', () => {
    const { state } = encounter()
    const definitions = defaultBasicSkills().map((skill) =>
      skill.id !== 'unarmed.basic'
        ? skill
        : {
            ...skill,
            ability: {
              ...skill.ability,
              behaviors: skill.ability.behaviors.map((behavior) => ({
                ...behavior,
                effects: [
                  ...behavior.effects.map((effect) => ({
                    ...effect,
                    requirements: {
                      kind: 'resource-state' as const,
                      subject: 'selected' as const,
                      resource: 'hp' as const,
                      comparison: 'at-least' as const,
                      amount: 2000,
                    },
                  })),
                  {
                    id: 'ruin',
                    payload: {
                      type: 'ruin' as const,
                      recipient: 'actor' as const,
                      bonusPerDebuffBasisPoints: 10000,
                    },
                  },
                ],
              })),
            },
          },
    )
    const captured = {
      ...state,
      capturedAbilitySources: captureBasicSkillSources({
        ownerCombatantId: 'actor',
        supportActionId: 'basic.guard',
        definitions,
      }),
    }
    const before = JSON.stringify(captured)
    expect(normalBasicAttackDamageAgainst(captured, 'actor', 'enemy', PV1F_COMBAT_CONTENT)).toBe(0)
    expect(JSON.stringify(captured)).toBe(before)
  })
  it('protects only its area recipient and leaves unrelated recipient damage intact', () => {
    const { state, captured } = encounter()
    const armed = atEnemyTurn(prime(state, captured).state)
    const area = {
      ...attack(),
      target: {
        ...attack().target,
        geometryVersion: 2 as const,
        kind: 'unit' as const,
        minimumRange: 0,
        maximumRange: 0,
        teamPolicy: 'enemy' as const,
        friendlyFire: 'enemies-only' as const,
        shape: { kind: 'all' as const },
      },
      effects: [{ type: 'damage' as const, recipient: 'affected-units' as const, amount: 40 }],
    }
    const out = executeCombatAction(armed, area, { kind: 'activate' }, PV1F_COMBAT_CONTENT)
    expect(hp(out.state, 'actor')).toBe(hp(armed, 'actor'))
    expect(hp(out.state, 'ally')).toBe(hp(armed, 'ally') - 40)
    expect(hp(out.state, 'enemy')).toBe(hp(armed, 'enemy') - 40)
  })
  it('preserves a negative effect before any Damage as independent under the version-1 binding policy', () => {
    const { state, captured } = encounter()
    const armed = atEnemyTurn(prime(state, captured).state)
    const independent = {
      ...attack(),
      effectTimingModes: ['instant', 'instant'] as const,
      effects: [
        {
          type: 'apply-status' as const,
          recipient: 'primary-unit' as const,
          statusId: 'exposed',
          stacks: 1,
        },
        ...attack().effects,
      ],
    }
    const out = executeCombatAction(
      armed,
      independent,
      { kind: 'unit', combatantId: 'actor' },
      PV1F_COMBAT_CONTENT,
    )
    expect(out.events.some((event) => event.event === 'reversal_triggered')).toBe(true)
    expect(
      out.state.statusState
        .find((row) => row.combatantId === 'actor')!
        .statuses.some((status) => status.statusId === 'exposed'),
    ).toBe(true)
  })
  it('does not consume an armed counter on a missed or family-unknown attack', () => {
    const { state, captured } = encounter()
    const armed = atEnemyTurn(prime(state, captured).state)
    const missed = executeCombatAction(
      armed,
      {
        ...attack(),
        sourceType: 'discipline-skill',
        accuracyRule: { kind: 'fixed', chanceBasisPoints: 0 },
      },
      { kind: 'unit', combatantId: 'actor' },
      PV1F_COMBAT_CONTENT,
    )
    expect(hp(missed.state, 'actor')).toBe(hp(armed, 'actor'))
    expect(hasArmedCombatReversal(missed.state, 'actor')).toBe(true)
    const unknown = executeCombatAction(
      armed,
      { ...attack(), tags: ['attack'] },
      { kind: 'unit', combatantId: 'actor' },
      PV1F_COMBAT_CONTENT,
    )
    expect(hasArmedCombatReversal(unknown.state, 'actor')).toBe(true)
    expect(hp(unknown.state, 'actor')).toBeLessThan(hp(armed, 'actor'))
  })
  it('shares the existing reaction budget instead of creating a free recursive reaction allowance', () => {
    const { state, captured } = encounter()
    const armed = atEnemyTurn(prime(state, captured).state)
    const context = combatAbilityCommandContext(armed, { ...captured, ownerCombatantId: 'enemy' })
    const out = executeCombatAction(
      armed,
      attack(),
      { kind: 'unit', combatantId: 'actor' },
      PV1F_COMBAT_CONTENT,
      {
        ...context,
        triggerGuard: createCombatTriggerGuard({
          triggerChainId: 'test.reversal-budget',
          reactionBudget: 0,
        }),
      },
    )
    expect(hasArmedCombatReversal(out.state, 'actor')).toBe(true)
    expect(out.events.some((event) => event.event === 'reversal_triggered')).toBe(false)
  })
  it('blocks offensive automatic commands while armed and during Strain', () => {
    const { state, captured } = encounter()
    const auto = captureCombatAbilitySource({
      ...source(
        {
          id: 'retaliate',
          activation: 'automatic',
          costs: [],
          requirements: { kind: 'event', eventType: 'damage_applied', phase: 'after' },
          automaticTarget: { subject: 'triggering' },
        },
        'auto-reversal-restriction',
      ),
      abilityId: 'test.automatic',
    })
    const ready = reconcileCombatAbilitySources(state, [captured, auto])
    const armed = prime(ready, captured).state
    const command = {
      state: armed,
      actorId: 'actor',
      root: { kind: 'canonical' as const, source: auto, behaviorId: 'retaliate' },
      selection: { kind: 'unit' as const, combatantId: 'enemy' },
      content: PV1F_COMBAT_CONTENT,
      context: combatAbilityCommandContext(armed, auto),
      trigger: {
        id: 'test-trigger',
        type: 'damage_applied',
        phase: 'after' as const,
        depth: 1,
        triggeringCombatantId: 'enemy',
      },
    }
    expect(prepareCombatAbilityCommand(command).evaluation.legal).toBe(false)
    const cancelled = cancelCombatControlledAbility({
      state: armed,
      actorId: 'actor',
      sourceInstanceId: captured.sourceInstanceId,
      behaviorId: 'prepare',
    }).state
    expect(prepareCombatAbilityCommand({ ...command, state: cancelled }).evaluation.legal).toBe(
      false,
    )
  })

  it('counts the complete incoming owner turn when a boundary packet triggers before that actual turn begins', () => {
    const { state, captured } = encounter()
    const armed = atEnemyTurn(prime(state, captured).state)
    const queued = executeCombatAction(
      armed,
      { ...attack(), effectTimingModes: ['next-round'] },
      { kind: 'unit', combatantId: 'actor' },
      PV1F_COMBAT_CONTENT,
    )
    expect(hasArmedCombatReversal(queued.state, 'actor')).toBe(true)
    let next = queued.state
    const receipts: unknown[] = []
    for (let n = 0; n < 8 && next.tactical.battle.currentTurn?.combatantId !== 'actor'; n++) {
      const out = finishPv1fTurn(next as never, 'east')
      next = out.state
      receipts.push(...out.events)
    }
    expect(
      receipts.some(
        (event) =>
          event &&
          typeof event === 'object' &&
          'event' in event &&
          event.event === 'reversal_triggered',
      ),
    ).toBe(true)
    expect(hasCombatReversalStrain(next, 'actor')).toBe(true)
    expect(hasCombatReversalStrain(finishPv1fTurn(next as never, 'east').state, 'actor')).toBe(
      false,
    )
  })

  it('preserves defensive concealment preparation and uses ordinary concealment breaking only on positive returned HP loss', () => {
    const { state, captured } = encounter()
    const concealed = {
      ...state,
      statusState: state.statusState.map((row) =>
        row.combatantId === 'actor'
          ? {
              ...row,
              statuses: ['covert', 'invisible'].map((statusId) => ({
                statusId,
                statusVersion: 1,
                stacks: 1,
                remainingOwnerTurnStarts: 3,
                sourceCombatantId: 'actor',
              })),
            }
          : row,
      ),
    }
    const prepared = prime(concealed, captured)
    const statuses = (current: CombatEncounterState) =>
      current.statusState
        .find((row) => row.combatantId === 'actor')!
        .statuses.map((status) => status.statusId)
    expect(statuses(prepared.state)).toEqual(expect.arrayContaining(['covert', 'invisible']))
    const armed = atEnemyTurn(prepared.state)
    const positive = interceptCombatReversal(armed, {
      actorId: 'enemy',
      recipientId: 'actor',
      actionId: 'test.incoming',
      family: 'physical',
      wouldHpDamage: 40,
      content: PV1F_COMBAT_CONTENT,
    })!
    expect(positive.events).toContainEqual(
      expect.objectContaining({ event: 'reversal_triggered', returnedDamage: 40 }),
    )
    expect(statuses(positive.state)).not.toContain('invisible')
    expect(statuses(positive.state)).toContain('covert')
    const ordinary = executeCombatAction(
      concealed,
      attack(),
      { kind: 'unit', combatantId: 'enemy' },
      PV1F_COMBAT_CONTENT,
    )
    expect(statuses(ordinary.state)).not.toContain('invisible')
    expect(statuses(ordinary.state)).toContain('covert')
    const shielded = {
      ...grantBarrier(armed, 'enemy', 'enemy', 'test.return-barrier', 40).state,
      modularSkillPolicyVersion: 1 as const,
    }
    const noHp = interceptCombatReversal(shielded, {
      actorId: 'enemy',
      recipientId: 'actor',
      actionId: 'test.incoming',
      family: 'physical',
      wouldHpDamage: 40,
      content: PV1F_COMBAT_CONTENT,
    })!
    expect(noHp.events).toContainEqual(
      expect.objectContaining({ event: 'reversal_triggered', returnedDamage: 0 }),
    )
    expect(statuses(noHp.state)).toContain('invisible')
  })
  it('keeps a lower-initiative preparation through the round boundary until that owner actually starts', () => {
    const { state, captured } = encounter()
    const lower = captureCombatAbilitySource({
      ...captured,
      ownerCombatantId: 'enemy',
      sourceInstanceId: 'lower-reversal',
    })
    const ready = reconcileCombatAbilitySources(state, [captured, lower])
    let next = finishPv1fTurn(ready as never, 'east').state
    const armed = primeCombatControlledAbility({
      state: next,
      actorId: 'enemy',
      sourceInstanceId: lower.sourceInstanceId,
      behaviorId: 'prepare',
      content: PV1F_COMBAT_CONTENT,
    })
    next = reattachStatDrivenCombatBridge(armed.state, next.statBridge)
    const round = next.tactical.battle.round
    for (let n = 0; n < 8 && next.tactical.battle.round === round; n++)
      next = finishPv1fTurn(next, 'east').state
    expect(next.tactical.battle.currentTurn?.combatantId).toBe('actor')
    expect(hasArmedCombatReversal(next, 'enemy')).toBe(true)
    next = finishPv1fTurn(next, 'east').state
    expect(next.tactical.battle.currentTurn?.combatantId).toBe('enemy')
    expect(hasArmedCombatReversal(next, 'enemy')).toBe(false)
    expect(hasCombatReversalStrain(next, 'enemy')).toBe(true)
  })
  it.each(['physical', 'mystic'] as const)(
    'uses the Basic Attack dynamically resolved Mystic family against %s preparation',
    (family) => {
      const { state, captured } = encounter(family)
      const armed = atEnemyTurn(prime(state, captured).state)
      const bridged = reattachStatDrivenCombatBridge(armed, {
        ...state.statBridge,
        combatants: state.statBridge.combatants.map((row) =>
          row.combatantId === 'enemy' ? { ...row, physicalPower: 10, mysticPower: 80 } : row,
        ),
      })
      const out = executePv1fAction(bridged, 'basic.attack.unarmed.basic', {
        kind: 'unit',
        combatantId: 'actor',
      })
      expect(
        out.events.some(
          (event) =>
            event &&
            typeof event === 'object' &&
            'event' in event &&
            event.event === 'reversal_triggered',
        ),
      ).toBe(family === 'mystic')
      expect(hasArmedCombatReversal(out.state, 'actor')).toBe(family !== 'mystic')
    },
  )

  it('does not add an accuracy or critical draw to the committed incoming outcome', () => {
    const { state, captured } = encounter()
    const armed = atEnemyTurn(prime(state, captured).state)
    const current = createCurrentStatDrivenCombatEncounterState(
      armed,
      state.statBridge.combatants.map((row) => ({
        ...row,
        physicalPower: row.physicalPower ?? 20,
        mysticPower: row.mysticPower ?? 20,
        level: 1,
        criticalChance: row.combatantId === 'enemy' ? 10000 : 0,
      })),
    )
    const incoming = {
      ...attack(),
      sourceType: 'discipline-skill' as const,
      accuracyRule: { kind: 'fixed' as const, chanceBasisPoints: 10000 },
    }
    const reversed = executeCombatAction(
      current,
      incoming,
      { kind: 'unit', combatantId: 'actor' },
      PV1F_COMBAT_CONTENT,
    )
    const ended = endCombatReversal(current, 'actor', 'cancelled')
    const ordinary = executeCombatAction(
      ended.state,
      incoming,
      { kind: 'unit', combatantId: 'actor' },
      PV1F_COMBAT_CONTENT,
    )
    expect(reversed.state.tactical.battle.rng).toEqual(ordinary.state.tactical.battle.rng)
    expect(
      reversed.events.filter((event) => event.event === 'combat_accuracy_resolved'),
    ).toHaveLength(
      ordinary.events.filter((event) => event.event === 'combat_accuracy_resolved').length,
    )
    expect(
      reversed.events.filter((event) => event.event === 'combat_critical_resolved'),
    ).toHaveLength(
      ordinary.events.filter((event) => event.event === 'combat_critical_resolved').length,
    )
    expect(reversed.events.some((event) => event.event === 'reversal_triggered')).toBe(true)
  })

  it('rejects another Controlled companion while preserving ordinary queued utility timing', () => {
    const captured = reversalSource()
    const guard = {
      id: 'guard',
      payload: {
        type: 'apply-status' as const,
        recipient: 'actor' as const,
        target: 'self' as const,
        statusId: 'guarded',
        stacks: 1,
      },
    }
    const mixed = {
      ...captured,
      definition: {
        ...captured.definition,
        behaviors: captured.definition.behaviors.map((behavior) => ({
          ...behavior,
          effects: [...behavior.effects, guard],
        })),
      },
    }
    const explicit = structuredClone(mixed.definition)
    Object.assign(explicit.behaviors[0]!.effects[1]!, { timing: 'controlled' })
    expect(validateAbilityDefinition(explicit).length).toBeGreaterThan(0)
    expect(() =>
      applyAbilityTimingDefaults(mixed.definition.behaviors[0]!, {
        version: 1,
        modes: { guarded: 'controlled' },
        tagAuthority: 'global',
      }),
    ).toThrow(/another Controlled/)
    const state = reconcileCombatAbilitySources(
      {
        ...preparePv1fTurnEconomy(percentageDotEncounter()),
        effectTimingPolicy: {
          version: 1,
          modes: { guarded: 'next-round' },
          tagAuthority: 'global',
        },
      },
      [captureCombatAbilitySource(mixed)],
    )
    const armed = prime(state, captureCombatAbilitySource(mixed))
    expect(hasArmedCombatReversal(armed.state, 'actor')).toBe(true)
    expect(
      armed.state.pendingEffects?.some(
        (pending) =>
          pending.effect.type === 'apply-status' && pending.effect.statusId === 'guarded',
      ),
    ).toBe(true)
    expect(
      armed.state.statusState
        .find((row) => row.combatantId === 'actor')!
        .statuses.some((status) => status.statusId === 'guarded'),
    ).toBe(false)
  })
  it('does not let AI forecasts discover a Covert-protected armed counter', () => {
    const { state, captured } = encounter()
    const covert = {
      ...state,
      statusState: state.statusState.map((row) =>
        row.combatantId === 'actor'
          ? {
              ...row,
              statuses: [
                {
                  statusId: 'covert',
                  statusVersion: 1,
                  stacks: 1,
                  remainingOwnerTurnStarts: 3,
                  sourceCombatantId: 'actor',
                },
              ],
            }
          : row,
      ),
    }
    const armed = atEnemyTurn(prime(covert, captured).state)
    const offense = captureCombatAbilitySource({
      ...source(
        {
          costs: [{ resource: 'ap', amount: 1 }],
          effects: [
            { id: 'hit', payload: { type: 'damage', recipient: 'primary-unit', amount: 20 } },
          ],
        },
        'ai-offense',
      ),
      ownerCombatantId: 'enemy',
      abilityId: 'test.ai-offense',
    })
    const ready = reattachStatDrivenCombatBridge(
      reconcileCombatAbilitySources(armed, [captured, offense]),
      state.statBridge,
    )
    const unarmed = {
      ...ready,
      reversalState: { ...ready.reversalState!, armed: [] },
      abilityRuntime: {
        ...ready.abilityRuntime!,
        controlled: { ...ready.abilityRuntime!.controlled!, primes: [] },
      },
    }
    const options = {
      profile: getRecruitAiProfile('high'),
      tieBreakSeed: 42,
      skillOptions: { canonicalSources: [offense], committedSkills: [] },
    }
    const visible = chooseBuildAwareRecruitAiDecision({ ...options, state: unarmed })
    const hidden = chooseBuildAwareRecruitAiDecision({ ...options, state: ready })
    expect(visible.intent).toMatchObject({ kind: 'action', actionId: offense.abilityId })
    expect(hidden.intent).toEqual(visible.intent)
    if (hidden.intent.kind !== 'action') throw new Error('Expected ordinary visible attack choice.')
    const executed = executeBuildAwareRecruitAiAction(
      ready,
      hidden.intent.actionId,
      hidden.intent.target,
      options.skillOptions,
    )
    expect(
      executed.events.some(
        (event) =>
          event &&
          typeof event === 'object' &&
          'event' in event &&
          event.event === 'reversal_triggered',
      ),
    ).toBe(true)
  })
})

import { expect, it } from 'vitest'
import { executeCombatAction, validateCombatEncounterState } from './actions'
import { captureCombatAbilitySource } from './combat-behavior-capture'
import { source } from './combat-behavior.test-utils'
import { percentageDotEncounter } from './combat-percentage-dots.test-utils'
import { withAuthoredEffectTarget, deriveSharedEffectAim } from './combat-effect-target-authoring'
import {
  combatAbilityCommandContext,
  reconcileCombatAbilitySources,
} from './combat-behavior-runtime'
import { prepareCombatAbilityCommand, commitCombatAbilityCommand } from './combat-ability-command'
import { PV1F_COMBAT_CONTENT } from './pv1f-action-economy'
import { grantBarrier, currentBarrierAmount } from './combat-barrier'

function input(hp = 1000, barrier = 0, target = 'self' as 'self' | 'anyone') {
  const payload = withAuthoredEffectTarget(
    { type: 'damage' as const, recipient: 'primary-unit' as const, amount: 20 },
    target,
  )
  const original = source()
  const captured = captureCombatAbilitySource(
    source({
      costs: [{ resource: 'mp', amount: 2 }],
      targeting: deriveSharedEffectAim(
        { ...original.definition.behaviors[0]!.targeting!, minimumRange: 0 },
        [payload],
      ),
      effects: [{ id: 'hit', timing: 'instant', payload }],
    }),
  )
  let state = { ...percentageDotEncounter(), selfDamagePolicyVersion: 1 as const }
  state.tactical.battle.combatants = state.tactical.battle.combatants.map((unit) =>
    unit.id === 'actor' ? { ...unit, hp } : unit,
  )
  if (barrier)
    state = grantBarrier(state, 'actor', 'actor', 'test.shield', barrier).state as typeof state
  state = reconcileCombatAbilitySources(state, [captured]) as typeof state
  return {
    state,
    actorId: 'actor',
    root: { kind: 'canonical' as const, source: captured },
    selection:
      target === 'self'
        ? { kind: 'self' as const }
        : { kind: 'unit' as const, combatantId: 'actor' },
    content: PV1F_COMBAT_CONTENT,
    context: combatAbilityCommandContext(state, captured),
  }
}

it.each(['self', 'anyone'] as const)(
  'quotes and commits explicit %s damage to the caster after reload',
  (target) => {
    const command = input(1000, 0, target)
    command.state = JSON.parse(JSON.stringify(command.state))
    const quote = prepareCombatAbilityCommand(command)
    expect(quote.evaluation.legal).toBe(true)
    const before = JSON.stringify(command.state)
    const out = commitCombatAbilityCommand(command)
    expect(out.events).toContainEqual(
      expect.objectContaining({
        event: 'damage_applied',
        sourceCombatantId: 'actor',
        targetCombatantId: 'actor',
        amount: 20,
      }),
    )
    expect(out.state.tactical.battle.combatants.find((unit) => unit.id === 'actor')).toMatchObject({
      hp: 980,
      mp: 18,
    })
    expect(
      (out.state.effectState?.damageHistory ?? []).some((row) => row.combatantId === 'actor'),
    ).toBe(false)
    expect(JSON.stringify(command.state)).toBe(before)
  },
)

it('lets Barrier absorb Self damage while leaving hostile damage triggers unearned', () => {
  const out = commitCombatAbilityCommand(input(1000, 30))
  expect(out.state.tactical.battle.combatants.find((unit) => unit.id === 'actor')!.hp).toBe(1000)
  expect(currentBarrierAmount(out.state, 'actor')).toBe(10)
})

it('settles lethal Self damage through the existing defeat and turn lifecycle', () => {
  const out = commitCombatAbilityCommand(input(5))
  expect(out.state.tactical.battle.combatants.find((unit) => unit.id === 'actor')).toMatchObject({
    hp: 0,
    mp: 18,
  })
  expect(out.state.tactical.battle.currentTurn?.combatantId).not.toBe('actor')
  expect(
    out.events.filter((event) => event.event === 'turn_ended' && event.combatantId === 'actor'),
  ).toHaveLength(1)
  expect(validateCombatEncounterState(JSON.parse(JSON.stringify(out.state)))).toEqual([])
})

it.each(['anyone'] as const)(
  'settles every lethal %s area recipient before actor defeat decides the result',
  (target) => {
    const payload = {
      type: 'damage' as const,
      recipient: 'affected-units' as const,
      target,
      amount: 20,
    }
    const original = source()
    const captured = captureCombatAbilitySource(
      source({
        costs: [],
        targeting: deriveSharedEffectAim(
          {
            ...original.definition.behaviors[0]!.targeting!,
            minimumRange: 0,
            shape: { kind: 'circle', radius: 2 },
            friendlyFire: 'all-units',
          },
          [payload],
        ),
        effects: [{ id: 'area', timing: 'instant', payload }],
      }),
    )
    const base = percentageDotEncounter()
    const state = reconcileCombatAbilitySources(
      {
        ...base,
        selfDamagePolicyVersion: 1,
        tactical: {
          ...base.tactical,
          battle: {
            ...base.tactical.battle,
            combatants: base.tactical.battle.combatants.map((unit) => ({ ...unit, hp: 5 })),
          },
        },
      },
      [captured],
    )
    const out = commitCombatAbilityCommand({
      state,
      actorId: 'actor',
      root: { kind: 'canonical', source: captured },
      selection: { kind: 'activate' },
      content: PV1F_COMBAT_CONTENT,
      context: combatAbilityCommandContext(state, captured),
    })
    expect(
      out.events
        .filter((event) => event.event === 'damage_applied')
        .map((event) => event.targetCombatantId),
    ).toEqual(['ally', 'enemy', 'other', 'actor'])
    expect(out.events.filter((event) => event.event === 'battle_completed')).toEqual([
      expect.objectContaining({ event: 'battle_completed', winningTeamId: null }),
    ])
    expect(out.state.tactical.battle.combatants.every((unit) => unit.hp === 0)).toBe(true)
    expect(validateCombatEncounterState(JSON.parse(JSON.stringify(out.state)))).toEqual([])
  },
)

it.each([false, true])(
  'settles a lethal Ground area before battle completion (explicit effect target=%s)',
  (explicit) => {
    const base = percentageDotEncounter()
    const state = {
      ...base,
      selfDamagePolicyVersion: 1 as const,
      tactical: {
        ...base.tactical,
        battle: {
          ...base.tactical.battle,
          combatants: base.tactical.battle.combatants.map((unit) => ({ ...unit, hp: 5 })),
        },
      },
    }
    const out = executeCombatAction(
      state,
      {
        id: 'test.lethal-ground',
        version: 1,
        sourceType: 'test',
        tags: [],
        cost: { mp: 0, spendsAction: false },
        requirements: [],
        target: {
          kind: 'ground-tile',
          teamPolicy: 'any',
          shape: { kind: 'circle', radius: 2 },
          minimumRange: 0,
          maximumRange: 4,
          requiresLineOfSight: false,
          maximumElevationDifference: null,
          friendlyFire: 'all-units',
        },
        effects: [
          {
            type: 'damage',
            recipient: 'affected-units',
            ...(explicit ? { target: 'ground' as const } : {}),
            amount: 20,
          },
        ],
      },
      { kind: 'tile', position: { x: 2, y: 1 } },
      PV1F_COMBAT_CONTENT,
    )
    expect(
      out.events
        .filter((event) => event.event === 'damage_applied')
        .map((event) => event.targetCombatantId),
    ).toEqual(['ally', 'enemy', 'other', 'actor'])
    expect(out.events.filter((event) => event.event === 'battle_completed')).toEqual([
      expect.objectContaining({ event: 'battle_completed', winningTeamId: null }),
    ])
    expect(validateCombatEncounterState(JSON.parse(JSON.stringify(out.state)))).toEqual([])
  },
)

import { advanceSkillCooldownsAtOwnerTurnStart } from './skill-cooldowns'
import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { captureCombatAbilitySource } from './combat-behavior-capture'
import { type AbilityDefinition } from './combat-definition'
import {
  combatAbilityCommandContext,
  reconcileCombatAbilitySources,
  primeCombatControlledAbility,
  cancelCombatControlledAbility,
  combatControlledAbilityAvailability,
} from './combat-behavior-runtime'
import { commitCombatAbilityCommand, prepareCombatAbilityCommand } from './combat-ability-command'
import { parseCombatEffectTimingPolicy } from './combat-effect-timing'
import { percentageDotEncounter } from './combat-percentage-dots.test-utils'
import {
  preparePv1fTurnEconomy,
  executePv1fMovement,
  finishPv1fTurn,
  PV1F_COMBAT_CONTENT,
} from './pv1f-action-economy'
import { reattachStatDrivenCombatBridge } from './stat-driven-combat'
import { grantBarrier, currentBarrierAmount } from './combat-barrier'
import { type CombatEncounterState, type CombatTargetSelection } from './actions'

const cohort: {
  timingChanges: { tagAuthority: 'global'; modes: Record<string, 'instant' | 'controlled'> }
  records: {
    id: string
    kind: 'skill' | 'essence' | 'resonance'
    after: {
      contentVersion: number
      sourceDisciplineId?: string
      tags?: string[]
      ability: AbilityDefinition
    }
  }[]
} = JSON.parse(
  readFileSync(
    new URL(
      '../../../../docs/superpowers/specs/2026-10-18-modular-correction-cohort.json',
      import.meta.url,
    ),
    'utf8',
  ),
)
const policy = parseCombatEffectTimingPolicy({
  version: 8,
  ...cohort.timingChanges,
  modes: {
    summon: 'instant',
    displace: 'instant',
    'mp-drain': 'instant',
    'remove-status': 'instant',
    ...cohort.timingChanges.modes,
  },
})
function capture(id: string, ownerCombatantId = 'actor') {
  const row = cohort.records.find((record) => record.id === id)!
  return captureCombatAbilitySource({
    schemaVersion: 1,
    sourceInstanceId: `${ownerCombatantId}:${id}`,
    ownerCombatantId,
    abilityId: id,
    contentVersion: row.after.contentVersion,
    sourceKind: row.kind === 'skill' ? 'discipline-skill' : row.kind,
    sourceDisciplineId: row.after.sourceDisciplineId,
    tags: row.after.tags ?? [],
    definition: row.after.ability,
  })
}
function ready(sources: ReturnType<typeof capture>[]) {
  const base = percentageDotEncounter()
  return reattachStatDrivenCombatBridge(
    reconcileCombatAbilitySources(
      { ...preparePv1fTurnEconomy(base), modularSkillPolicyVersion: 1, effectTimingPolicy: policy },
      sources,
    ),
    base.statBridge,
  )
}
function command(
  state: CombatEncounterState,
  source: ReturnType<typeof capture>,
  selection: CombatTargetSelection,
) {
  return {
    state,
    actorId: source.ownerCombatantId,
    root: { kind: 'canonical' as const, source },
    selection,
    content: PV1F_COMBAT_CONTENT,
    context: combatAbilityCommandContext(state, source),
  }
}
it('keeps the real Rewind prime, anchor and maintained Resonance coherent under global timing', () => {
  const rewind = capture('chronist.rewind-step')
  const resonance = capture('resonance.aetherist-chronist.linked-sequence')
  const initial = ready([rewind, resonance])
  expect(initial.abilityRuntime!.maintained).toEqual([])
  const primeInput = {
    actorId: 'actor',
    sourceInstanceId: rewind.sourceInstanceId,
    behaviorId: rewind.definition.behaviors[0]!.id,
  }
  const primed = primeCombatControlledAbility({ ...primeInput, state: initial }).state
  expect(primed.abilityRuntime!.maintained).toContainEqual(
    expect.objectContaining({ sourceInstanceId: resonance.sourceInstanceId }),
  )
  const cancelled = cancelCombatControlledAbility({ ...primeInput, state: primed }).state
  expect(cancelled.abilityRuntime!.maintained).toEqual([])
  const again = primeCombatControlledAbility({ ...primeInput, state: cancelled }).state
  const moved = executePv1fMovement(reattachStatDrivenCombatBridge(again, initial.statBridge), [
    { x: 1, y: 1 },
    { x: 1, y: 0 },
  ]).state
  const released = commitCombatAbilityCommand(command(moved, rewind, { kind: 'self' })).state
  expect(released.tactical.placements.find((row) => row.combatantId === 'actor')!.position).toEqual(
    { x: 1, y: 1 },
  )
  expect(released.abilityRuntime!.maintained).toEqual([])
  const before = JSON.stringify(released)
  expect(combatControlledAbilityAvailability({ ...primeInput, state: released })).toMatchObject({
    phase: 'unprimed',
    canPrime: false,
    canCancel: false,
  })
  expect(() => primeCombatControlledAbility({ ...primeInput, state: released })).toThrow(
    'controlled-cooldown-active',
  )
  expect(JSON.stringify(released)).toBe(before)
  let cooled = released
  for (let turn = 0; turn < 4; turn++) {
    cooled = {
      ...cooled,
      tactical: {
        ...cooled.tactical,
        battle: {
          ...cooled.tactical.battle,
          combatants: cooled.tactical.battle.combatants.map((unit) =>
            unit.id === 'actor' ? advanceSkillCooldownsAtOwnerTurnStart(unit).combatant : unit,
          ),
        },
      },
    }
    expect(combatControlledAbilityAvailability({ ...primeInput, state: cooled })!.canPrime).toBe(
      turn === 3,
    )
  }
  expect(
    primeCombatControlledAbility({ ...primeInput, state: cooled }).state.abilityRuntime!.controlled!
      .primes,
  ).toHaveLength(1)
})
it('pays the real Overchannel HP cost from HP while retaining Barrier', () => {
  const skill = capture('aetherist.overchannel')
  const state = grantBarrier(ready([skill]), 'actor', 'actor', 'test.shield', 20).state
  const before = state.tactical.battle.combatants.find((row) => row.id === 'actor')!.hp
  const payment = skill.definition.behaviors[0]!.costs.find(
    (cost) => cost.resource === 'hp',
  )!.amount
  const out = commitCombatAbilityCommand(
    command(state, skill, { kind: 'unit', combatantId: 'enemy' }),
  )
  expect(out.state.tactical.battle.combatants.find((row) => row.id === 'actor')!.hp).toBe(
    before - payment,
  )
  expect(currentBarrierAmount(out.state, 'actor')).toBe(20)
})
it('the real Pierce tag destroys Barrier while retaining ordinary Mystic Defense', () => {
  const skill = capture('runeblade.aether-cut')
  const base = ready([skill])
  const bridge = {
    ...base.statBridge,
    combatants: base.statBridge.combatants.map((row) =>
      row.combatantId === 'enemy' ? { ...row, ward: 100 } : row,
    ),
  }
  const defended = reattachStatDrivenCombatBridge(base, bridge)
  const unshielded = commitCombatAbilityCommand(
    command(defended, skill, { kind: 'unit', combatantId: 'enemy' }),
  )
  const shielded = grantBarrier(defended, 'enemy', 'enemy', 'test.shield', 200).state
  const hit = commitCombatAbilityCommand(
    command(shielded, skill, { kind: 'unit', combatantId: 'enemy' }),
  )
  const enemyHp = (state: CombatEncounterState) =>
    state.tactical.battle.combatants.find((row) => row.id === 'enemy')!.hp
  expect(currentBarrierAmount(hit.state, 'enemy')).toBe(0)
  expect(enemyHp(hit.state)).toBe(enemyHp(unshielded.state))
  const undefended = commitCombatAbilityCommand(
    command(base, skill, { kind: 'unit', combatantId: 'enemy' }),
  )
  expect(enemyHp(unshielded.state)).toBeGreaterThan(enemyHp(undefended.state))
})
it('copies the real enemy Blindside through Copy Debuffs without turning it into a caster buff', () => {
  const backstab = capture('shadehand.backstab')
  const copy = capture('lifebinder.searing-bloom', 'enemy')
  const initial = ready([backstab, copy])
  const afflicted = commitCombatAbilityCommand(
    command(initial, backstab, { kind: 'unit', combatantId: 'enemy' }),
  ).state
  expect(afflicted.statusState.find((row) => row.combatantId === 'enemy')!.statuses).toContainEqual(
    expect.objectContaining({ statusId: 'blindside-vulnerability' }),
  )
  const next = finishPv1fTurn(
    reattachStatDrivenCombatBridge(afflicted, initial.statBridge),
    'west',
  ).state
  let out = commitCombatAbilityCommand(
    command(next, copy, { kind: 'unit', combatantId: 'actor' }),
  ).state
  expect(out.statusState.find((row) => row.combatantId === 'enemy')!.statuses).toContainEqual(
    expect.objectContaining({ statusId: 'blindside-vulnerability', stacks: 1 }),
  )
  // Copy follows the same global Normal setting as every Copy Debuffs Skill.
  while (out.tactical.battle.round < 2)
    out = finishPv1fTurn(reattachStatDrivenCombatBridge(out, initial.statBridge), 'west').state
  expect(out.statusState.find((row) => row.combatantId === 'actor')!.statuses).toContainEqual(
    expect.objectContaining({ statusId: 'blindside-vulnerability', stacks: 1 }),
  )
  expect(out.statusState.find((row) => row.combatantId === 'enemy')!.statuses).not.toContainEqual(
    expect.objectContaining({ statusId: 'blindside-vulnerability' }),
  )
})

it.each([
  ['west', false],
  ['north', true],
  ['east', true],
] as const)(
  'real Flanking Cut applies Blindside only from a side or rear (%s)',
  (facing, granted) => {
    const skill = capture('edgedancer.flanking-cut')
    const initial = ready([skill])
    const state = {
      ...initial,
      blindsideActivationPolicyVersion: 1 as const,
      tactical: {
        ...initial.tactical,
        placements: initial.tactical.placements.map((row) =>
          row.combatantId === 'actor'
            ? { ...row, position: { x: 0, y: 1 } }
            : row.combatantId === 'enemy'
              ? { ...row, facing }
              : row,
        ),
      },
    }
    const input = {
      ...command(state, skill, { kind: 'tile', position: { x: 2, y: 1 } }),
      movementPath: [
        { x: 0, y: 1 },
        { x: 1, y: 1 },
      ],
    }
    const prepared = prepareCombatAbilityCommand(input)
    expect(prepared.evaluation.legal).toBe(true)
    const out = commitCombatAbilityCommand(input)
    expect(
      out.state.tactical.placements.find((row) => row.combatantId === 'actor')!.position,
    ).toEqual({ x: 1, y: 1 })
    expect(out.events.some((event) => event.event === 'damage_applied')).toBe(true)
    expect(
      out.state.statusState
        .find((row) => row.combatantId === 'enemy')!
        .statuses.some((status) => status.statusId === 'blindside-vulnerability'),
    ).toBe(granted)
  },
)

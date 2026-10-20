import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import type { CombatEncounterState, CombatTargetSelection } from './actions'
import { captureCombatAbilitySource } from './combat-behavior-capture'
import type { EssenceDefinition } from './essence'
import {
  combatAbilityCommandContext,
  primeCombatControlledAbility,
  reconcileCombatAbilitySources,
} from './combat-behavior-runtime'
import { commitCombatAbilityCommand, prepareCombatAbilityCommand } from './combat-ability-command'
import { currentBarrierAmount, grantBarrier } from './combat-barrier'
import { parseCombatEffectTimingPolicy } from './combat-effect-timing'
import { percentageDotEncounter } from './combat-percentage-dots.test-utils'
import {
  executePv1fMovement,
  preparePv1fTurnEconomy,
  PV1F_COMBAT_CONTENT,
} from './pv1f-action-economy'
import { reattachStatDrivenCombatBridge } from './stat-driven-combat'

const rows: { id: string; kind: string; after: EssenceDefinition }[] = JSON.parse(
  readFileSync(
    new URL(
      '../../../../docs/superpowers/specs/2026-10-19-essence-resonance-identity-cohort.json',
      import.meta.url,
    ),
    'utf8',
  ),
).records
const policy = parseCombatEffectTimingPolicy({
  version: 8,
  tagAuthority: 'global',
  modes: {
    summon: 'instant',
    displace: 'instant',
    'mp-drain': 'instant',
    'remove-status': 'instant',
    'barrier-change': 'instant',
    blindside: 'instant',
    'return-to-turn-start': 'controlled',
  },
})
function setup(id: string) {
  const definition = rows.find((row) => row.id === id)!.after
  const source = captureCombatAbilitySource({
    schemaVersion: 1,
    sourceInstanceId: `actor:${id}`,
    ownerCombatantId: 'actor',
    abilityId: id,
    contentVersion: definition.contentVersion,
    sourceKind: 'essence',
    sourceDisciplineId: definition.sourceDisciplineId,
    tags: definition.skill.tags,
    definition: definition.ability!,
  })
  const base = percentageDotEncounter()
  const state = reattachStatDrivenCombatBridge(
    reconcileCombatAbilitySources(
      { ...preparePv1fTurnEconomy(base), modularSkillPolicyVersion: 1, effectTimingPolicy: policy },
      [source],
    ),
    base.statBridge,
  )
  return { source, state }
}
function health(state: CombatEncounterState, id: string, hp: number) {
  return {
    ...state,
    tactical: {
      ...state.tactical,
      battle: {
        ...state.tactical.battle,
        combatants: state.tactical.battle.combatants.map((unit) =>
          unit.id === id ? { ...unit, hp } : unit,
        ),
      },
    },
  }
}
function command(
  state: CombatEncounterState,
  source: ReturnType<typeof setup>['source'],
  selection: CombatTargetSelection,
  behaviorId?: string,
) {
  return {
    state,
    actorId: 'actor',
    root: { kind: 'canonical' as const, source, ...(behaviorId ? { behaviorId } : {}) },
    selection,
    content: PV1F_COMBAT_CONTENT,
    context: combatAbilityCommandContext(state, source),
  }
}
const unit = (state: CombatEncounterState, id = 'actor') =>
  state.tactical.battle.combatants.find((row) => row.id === id)!

it('Unbroken Strike pays real HP, breaks Barrier and queues both its protection and committed-ground drawback', () => {
  const { source, state } = setup('essence.vanguard.unbroken-strike')
  const shielded = grantBarrier(state, 'enemy', 'enemy', 'enemy.shield', 200).state
  const input = command(shielded, source, { kind: 'unit', combatantId: 'enemy' })
  expect(prepareCombatAbilityCommand(input).evaluation.legal).toBe(true)
  const result = commitCombatAbilityCommand(input)
  expect(unit(result.state).hp).toBe(960)
  expect(currentBarrierAmount(result.state, 'enemy')).toBe(0)
  expect(unit(result.state, 'enemy').hp).toBeLessThan(1000)
  expect(
    result.events
      .filter((event) => event.event === 'damage_applied')
      .map((event) => event.targetCombatantId),
  ).not.toContain('actor')
  expect(
    result.state.pendingEffects
      ?.filter((effect) => effect.actorId === 'actor')
      .map((effect) => (effect.effect.type === 'apply-status' ? effect.effect.statusId : null)),
  ).toEqual(expect.arrayContaining(['guarded', 'root']))
})

it("Verdant Rupture spends the healer's life once to rescue several chosen allies, without refunding the sacrifice", () => {
  const { source, state } = setup('essence.lifebinder.verdant-rupture')
  const changed = {
    ...state,
    tactical: {
      ...state.tactical,
      battle: {
        ...state.tactical.battle,
        combatants: state.tactical.battle.combatants.map((row) =>
          row.id === 'other' ? { ...row, teamId: 'players' } : row,
        ),
      },
    },
  }
  const wounded = health(health(changed, 'ally', 600), 'other', 600)
  const input = command(
    wounded,
    source,
    {
      kind: 'selections',
      selections: [
        { kind: 'unit', combatantId: 'ally' },
        { kind: 'unit', combatantId: 'other' },
      ],
    },
    'shelter',
  )
  expect(prepareCombatAbilityCommand(input).evaluation.legal).toBe(true)
  const result = commitCombatAbilityCommand(input)
  expect(unit(result.state).hp).toBe(940)
  expect(unit(result.state).mp).toBe(8)
  expect(unit(result.state, 'ally').hp).toBe(800)
  expect(unit(result.state, 'other').hp).toBe(800)
  expect(
    prepareCombatAbilityCommand(command(wounded, source, { kind: 'self' }, 'shelter')).evaluation
      .legal,
  ).toBe(false)
})

it('Red Tempest cannot spend the last HP or pay with Barrier', () => {
  const { source, state } = setup('essence.ravager.red-tempest')
  const selection = { kind: 'activate' as const }
  const paid = commitCombatAbilityCommand(command(health(state, 'actor', 61), source, selection))
  expect(unit(paid.state).hp).toBe(1)
  expect(paid.events.some((event) => event.event === 'damage_applied')).toBe(true)
  const insufficient = grantBarrier(
    health(state, 'actor', 60),
    'actor',
    'actor',
    'safety',
    200,
  ).state
  const before = JSON.stringify(insufficient)
  expect(
    prepareCombatAbilityCommand(command(insufficient, source, selection)).evaluation.legal,
  ).toBe(false)
  expect(JSON.stringify(insufficient)).toBe(before)
  expect(currentBarrierAmount(insufficient, 'actor')).toBe(200)
})

it('Borrowed Hour returns to its real prime anchor without refunding spent AP or Movement', () => {
  const { source, state } = setup('essence.chronist.borrowed-hour')
  const wounded = health(state, 'actor', 600)
  expect(
    prepareCombatAbilityCommand(command(wounded, source, { kind: 'self' })).evaluation.legal,
  ).toBe(false)
  const primed = primeCombatControlledAbility({
    state: wounded,
    actorId: 'actor',
    sourceInstanceId: source.sourceInstanceId,
    behaviorId: 'borrowed-hour',
  }).state
  const moved = executePv1fMovement(reattachStatDrivenCombatBridge(primed, state.statBridge), [
    { x: 1, y: 1 },
    { x: 1, y: 0 },
  ]).state
  const movement = moved.tactical.battle.currentTurn!.movementRemaining
  const input = command(moved, source, { kind: 'self' })
  expect(prepareCombatAbilityCommand(input).evaluation.legal).toBe(true)
  const result = commitCombatAbilityCommand(input)
  expect(
    result.state.tactical.placements.find((row) => row.combatantId === 'actor')!.position,
  ).toEqual({ x: 1, y: 1 })
  expect(result.state.tactical.battle.currentTurn!.movementRemaining).toBe(movement)
  expect(
    unit(result.state).temporaryResources.find((row) => row.key === 'pv1f.action-economy')!.current,
  ).toBe(20)
  expect(unit(result.state).mp).toBe(2)
  expect(unit(result.state).hp).toBe(660)
  expect(result.state.abilityRuntime!.controlled!.primes).toHaveLength(0)
  expect(
    prepareCombatAbilityCommand(command(result.state, source, { kind: 'self' })).evaluation.legal,
  ).toBe(false)
})

it('Tidal Crown restores every chosen friendly and creates independent future recovery applications', () => {
  const { source, state } = setup('essence.tidecaller.tidal-crown')
  const wounded = health(health(state, 'actor', 600), 'ally', 600)
  const input = command(wounded, source, {
    kind: 'selections',
    selections: [
      { kind: 'unit', combatantId: 'actor' },
      { kind: 'unit', combatantId: 'ally' },
    ],
  })
  expect(prepareCombatAbilityCommand(input).evaluation.legal).toBe(true)
  const result = commitCombatAbilityCommand(input)
  expect(unit(result.state).hp).toBe(680)
  expect(unit(result.state, 'ally').hp).toBe(680)
  expect(
    result.events
      .filter((event) => event.event === 'healing_applied')
      .map((event) => event.targetCombatantId)
      .sort(),
  ).toEqual(['actor', 'ally'])
})

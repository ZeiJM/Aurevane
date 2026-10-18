import { appendFileSync } from 'node:fs'
import { expect, it, vi } from 'vitest'
import type { CombatEncounterState } from '@aurevane/game-core/combat/actions'
import type { GridPosition } from '@aurevane/game-core/combat/board'
import {
  commitCombatAbilityCommand,
  prepareCombatAbilityCommand,
} from '@aurevane/game-core/combat/combat-ability-command'
import { combatAbilityCommandContext } from '@aurevane/game-core/combat/combat-behavior-runtime'
import {
  normalizeCombatEffectState,
  type CombatSummonInstance,
} from '@aurevane/game-core/combat/combat-effect-state'
import {
  evaluatePv1fSummonAbility,
  executePv1fAction,
  executePv1fMovement,
  executePv1fSummonAbility,
  finishPv1fTurn,
  PV1F_BASIC_ATTACK_ID,
  PV1F_COMBAT_CONTENT,
  readPv1fActionEconomy,
} from '@aurevane/game-core/combat/pv1f-action-economy'
import { executeBuildAwareRecruitAiAction } from '@aurevane/game-core/combat/recruit-ai-build'
import { readSkillCooldown } from '@aurevane/game-core/combat/skill-cooldowns'
import {
  reattachStatDrivenCombatBridge,
  validateStatDrivenCombatEncounterState,
  type StatDrivenCombatEncounterState,
} from '@aurevane/game-core/combat/stat-driven-combat'
import { chooseSummonAiDecision } from '@aurevane/game-core/combat/summon-ai'
import { createLegalRosterDuel, legalRosterCycleKits } from './roster-legal-duel.test-utils'

vi.mock('server-only', () => ({}))

const call = 'wildwarden.renewing-herbs'
const mend = 'wildwarden.verdant-stalker.verdant-mend'
const rake = 'wildwarden.verdant-stalker.thorn-rake'
const baseKit = legalRosterCycleKits.find((kit) => kit.primary === 'wildwarden' && !kit.secondary)!
const kit = {
  ...baseKit,
  name: `${baseKit.name}:earned-summon`,
  ids: baseKit.ids.map((id) => (id === 'wildwarden.field-remedy' ? call : id)),
}
const opponentKit = legalRosterCycleKits.find(
  (kit) => kit.primary === 'vanguard' && !kit.secondary,
)!
const cases = ([1, 100] as const).flatMap((level) =>
  (['pve', 'pvp'] as const).map((context) => ({ name: `${level}:${context}`, level, context })),
)
type State = StatDrivenCombatEncounterState
type Participant = Awaited<ReturnType<typeof createLegalRosterDuel>>['participants'][number]
type Stage = { label: string; state: State; events: readonly unknown[] }
type World = { state: State; actor: Participant; opponent: Participant; stages: Stage[] }
function unit(state: State, id: string) {
  return state.tactical.battle.combatants.find((row) => row.id === id)
}
function position(state: State, id: string) {
  return state.tactical.placements.find((row) => row.combatantId === id)!.position
}
function ap(state: State, id: string) {
  return readPv1fActionEconomy(state, id)!.current
}
function current(world: World) {
  return world.state.tactical.battle.currentTurn!.combatantId
}
function active(state: State, id: string) {
  return normalizeCombatEffectState(state.effectState).summons?.find(
    (row) => row.combatantId === id,
  )
}
function named(events: readonly unknown[], name: string) {
  return events.filter(
    (event) =>
      typeof event === 'object' && event !== null && 'event' in event && event.event === name,
  )
}
function step<T extends { state: CombatEncounterState; events: readonly unknown[] }>(
  world: World,
  label: string,
  run: (state: State) => T,
) {
  const before = JSON.stringify(world.state)
  const result = run(world.state)
  expect(JSON.stringify(world.state)).toBe(before)
  const restored: State = JSON.parse(
    JSON.stringify(
      reattachStatDrivenCombatBridge(
        result.state,
        (result.state as Partial<State>).statBridge ?? world.state.statBridge,
      ),
    ),
  )
  expect(validateStatDrivenCombatEncounterState(restored)).toEqual([])
  world.state = restored
  world.stages.push({ label, state: restored, events: result.events })
  return { ...result, state: restored }
}
function end(world: World) {
  const id = current(world)
  const facing = world.state.tactical.placements.find((row) => row.combatantId === id)!.facing
  return step(world, `end:${id}`, (state) => finishPv1fTurn(state, facing))
}
function toTurn(world: World, actorId: string) {
  for (let turns = 0; current(world) !== actorId; turns++) {
    expect(turns).toBeLessThan(4)
    end(world)
  }
}
function walk(world: World, ...path: GridPosition[]) {
  const id = current(world)
  const before = ap(world.state, id)
  const result = step(world, 'walk', (state) =>
    executePv1fMovement(state, [position(state, id), ...path]),
  )
  expect(ap(result.state, id)).toBe(before - path.length * 20)
  return result
}
function basic(world: World, targetId: string, route: 'ai' | 'canonical' | 'native-player' = 'ai') {
  expect(current(world)).toBe(world.opponent.actorId)
  const before = unit(world.state, targetId)!.hp
  const beforeAp = ap(world.state, world.opponent.actorId)
  const result = step(world, `opposing-basic:${route}`, (state) =>
    route === 'native-player'
      ? executePv1fAction(state, PV1F_BASIC_ATTACK_ID, { kind: 'unit', combatantId: targetId })
      : route === 'canonical'
        ? commitCombatAbilityCommand({
            state,
            actorId: world.opponent.actorId,
            root: {
              kind: 'canonical',
              source: world.opponent.sources.find((row) => row.basic?.id === 'unarmed.basic')!,
            },
            selection: { kind: 'unit', combatantId: targetId },
            content: PV1F_COMBAT_CONTENT,
            context: combatAbilityCommandContext(
              state,
              world.opponent.sources.find((row) => row.basic?.id === 'unarmed.basic')!,
            ),
          })
        : executeBuildAwareRecruitAiAction(
            state,
            PV1F_BASIC_ATTACK_ID,
            { kind: 'unit', combatantId: targetId },
            {
              committedSkills: world.opponent.definitions,
              canonicalSources: world.opponent.sources,
            },
          ),
  )
  const after = unit(result.state, targetId)?.hp ?? 0
  expect(after).toBeLessThanOrEqual(before)
  expect(ap(result.state, world.opponent.actorId)).toBe(beforeAp - 30)
  if (after === before) {
    expect(named(result.events, 'stat_driven_attack_resolved')).toContainEqual(
      expect.objectContaining({ actorId: world.opponent.actorId, targetId, hit: false }),
    )
    expect(named(result.events, 'damage_applied')).toEqual([])
  } else
    expect(named(result.events, 'damage_applied')).toContainEqual(
      expect.objectContaining({
        actionId: PV1F_BASIC_ATTACK_ID,
        sourceCombatantId: world.opponent.actorId,
        targetCombatantId: targetId,
        hpBefore: before,
        hpAfter: after,
      }),
    )
  return result
}
async function setup(scenario: (typeof cases)[number]): Promise<World> {
  const duel = await createLegalRosterDuel({
    ...scenario,
    kit,
    opponentKit,
    seed: 1,
    board: {
      width: 6,
      height: 4,
      positions: [
        { x: 1, y: 1 },
        { x: 2, y: 1 },
      ],
    },
  })
  const [actor, opponent] = duel.participants
  expect(actor!.committed.disciplineSkills).toHaveLength(4)
  expect(actor!.committed.disciplineSkills.map((row) => row.skillId)).toContain(call)
  const state: State = JSON.parse(JSON.stringify(duel.state))
  expect(validateStatDrivenCombatEncounterState(state)).toEqual([])
  const world = { actor: actor!, opponent: opponent!, state, stages: [] as Stage[] }
  world.stages.push({ label: 'startup', state, events: [] })
  toTurn(world, actor!.actorId)
  return world
}
function rootCommand(world: World, target: GridPosition) {
  const source = world.state.capturedAbilitySources!.find(
    (row) => row.ownerCombatantId === world.actor.actorId && row.abilityId === call,
  )!
  expect(source.contentVersion).toBe(7)
  return {
    state: world.state,
    actorId: world.actor.actorId,
    root: { kind: 'canonical' as const, source },
    selection: { kind: 'tile' as const, position: target },
    content: PV1F_COMBAT_CONTENT,
    context: combatAbilityCommandContext(world.state, source),
  }
}
function spawn(world: World) {
  expect(current(world)).toBe(world.actor.actorId)
  const before = JSON.stringify(world.state)
  const beforeMp = unit(world.state, world.actor.actorId)!.mp
  const beforeAp = ap(world.state, world.actor.actorId)
  const input = rootCommand(world, { x: 1, y: 2 })
  const quote = prepareCombatAbilityCommand(input)
  expect(JSON.stringify(world.state)).toBe(before)
  expect(quote.evaluation.legal, JSON.stringify(quote.evaluation.issues)).toBe(true)
  const result = step(world, 'spawn', () => commitCombatAbilityCommand(input))
  expect(ap(result.state, world.actor.actorId)).toBe(beforeAp - 50)
  expect(unit(result.state, world.actor.actorId)!.mp).toBe(beforeMp - 6)
  expect(
    readSkillCooldown(unit(world.state, world.actor.actorId)!, { key: call, ownerTurns: 4 }),
  ).toEqual({
    active: true,
    cooldownKey: call,
    ownerTurns: 4,
    ticksRemaining: 5,
  })
  const instances = normalizeCombatEffectState(world.state.effectState).summons!
  expect(instances).toHaveLength(1)
  const child = instances[0]!
  expect(child).toMatchObject({
    ownerCombatantId: world.actor.actorId,
    sourceSkillId: call,
    sourceSkillVersion: 7,
    turnsCompleted: 0,
  })
  expect(child.profile).toMatchObject({
    id: 'summon.wildwarden.verdant-stalker',
    maxHp: 36,
    maxMp: 12,
    lifetimeTurns: 5,
  })
  expect(child.profile.abilities.map((row) => row.id)).toEqual([rake, mend])
  expect(unit(world.state, child.combatantId)).toMatchObject({
    hp: 36,
    maxHp: 36,
    mp: 12,
    maxMp: 12,
    teamId: unit(world.state, world.actor.actorId)!.teamId,
  })
  expect(named(result.events, 'summon_spawned')).toEqual([
    expect.objectContaining({
      combatantId: child.combatantId,
      ownerCombatantId: world.actor.actorId,
      sourceSkillId: call,
      sourceSkillVersion: 7,
    }),
  ])
  return child
}
function wound(world: World, deeply = false, retreat = false) {
  const actorId = world.actor.actorId
  for (
    let steps = 0;
    deeply
      ? unit(world.state, actorId)!.hp * 100 > unit(world.state, actorId)!.maxHp * 60
      : unit(world.state, actorId)!.hp === unit(world.state, actorId)!.maxHp;
    steps++
  ) {
    expect(steps).toBeLessThan(60)
    if (current(world) === world.opponent.actorId && ap(world.state, world.opponent.actorId) >= 30)
      basic(world, actorId)
    else end(world)
    expect(world.state.tactical.battle.lifecycle).toBe('active')
  }
  expect(unit(world.state, actorId)!.hp).toBeGreaterThan(0)
  if (retreat) {
    if (ap(world.state, world.opponent.actorId) < 40) {
      end(world)
      toTurn(world, world.opponent.actorId)
    }
    walk(world, { x: 3, y: 1 }, { x: 4, y: 1 })
  }
  toTurn(world, actorId)
}
function childAction(
  world: World,
  child: CombatSummonInstance,
  actionId: string,
  targetId: string,
) {
  expect(current(world)).toBe(child.combatantId)
  const before = JSON.stringify(world.state)
  const beforeAp = ap(world.state, child.combatantId)
  const beforeMp = unit(world.state, child.combatantId)!.mp
  const target = { kind: 'unit' as const, combatantId: targetId }
  const quoted = evaluatePv1fSummonAbility(world.state, child, actionId, target)
  expect(JSON.stringify(world.state)).toBe(before)
  expect(quoted.evaluation.legal, JSON.stringify(quoted.evaluation.issues)).toBe(true)
  const result = step(world, actionId, (state) =>
    executePv1fSummonAbility(state, child, actionId, target),
  )
  expect(ap(world.state, child.combatantId)).toBe(beforeAp - 45)
  expect(unit(world.state, child.combatantId)!.mp).toBe(beforeMp)
  expect(named(result.events, 'summon_ability_used')).toEqual([
    expect.objectContaining({ combatantId: child.combatantId, actionId }),
  ])
  expect(named(result.events, 'action_economy_spent')).toEqual([
    expect.objectContaining({
      combatantId: child.combatantId,
      amount: 45,
      remaining: beforeAp - 45,
    }),
  ])
  return result
}
function assertHealed(world: World, child: CombatSummonInstance) {
  const owner = unit(world.state, world.actor.actorId)!
  const beforeHp = owner.hp
  const expected = Math.min(
    owner.maxHp - owner.hp,
    Math.max(1, Math.floor((owner.maxHp * 4) / 100)),
  )
  expect(expected).toBeGreaterThan(0)
  const result = childAction(world, child, mend, world.actor.actorId)
  expect(unit(world.state, world.actor.actorId)!.hp).toBe(beforeHp + expected)
  expect(named(result.events, 'healing_applied')).toEqual([
    expect.objectContaining({
      actionId: mend,
      sourceCombatantId: child.combatantId,
      targetCombatantId: world.actor.actorId,
      amount: expected,
      hpBefore: beforeHp,
      hpAfter: beforeHp + expected,
    }),
  ])
  return result
}
function removed(world: World, child: CombatSummonInstance, reason: 'expired' | 'defeated') {
  expect(active(world.state, child.combatantId)).toBeUndefined()
  expect(unit(world.state, child.combatantId)).toBeUndefined()
  expect(world.state.tactical.placements.some((row) => row.combatantId === child.combatantId)).toBe(
    false,
  )
  expect(world.state.tactical.battle.initiativeOrder).not.toContain(child.combatantId)
  expect(
    world.state.statBridge.combatants.some((row) => row.combatantId === child.combatantId),
  ).toBe(false)
  expect(
    world.state.turnTriggerState?.combatants.some((row) => row.combatantId === child.combatantId),
  ).toBe(false)
  const allEvents = world.stages.flatMap((stage) => stage.events)
  expect(named(allEvents, `summon_${reason}`)).toEqual([
    expect.objectContaining({
      combatantId: child.combatantId,
      sourceSkillId: call,
      sourceSkillVersion: 7,
    }),
  ])
  expect(named(allEvents, reason === 'expired' ? 'summon_defeated' : 'summon_expired')).toEqual([])
  expect(world.state.tactical.battle.lifecycle).toBe('active')
  expect(unit(world.state, world.actor.actorId)!.hp).toBeGreaterThan(0)
  const original = JSON.stringify(world.state)
  expect(() =>
    evaluatePv1fSummonAbility(world.state, child, mend, {
      kind: 'unit',
      combatantId: world.actor.actorId,
    }),
  ).toThrow('no longer active')
  expect(() =>
    executePv1fSummonAbility(world.state, child, mend, {
      kind: 'unit',
      combatantId: world.actor.actorId,
    }),
  ).toThrow('no longer active')
  expect(() =>
    chooseSummonAiDecision({ state: world.state, summon: child, tieBreakSeed: 1 }),
  ).toThrow('active summon')
  expect(JSON.stringify(world.state)).toBe(original)
  toTurn(world, world.actor.actorId)
  walk(world, { x: 1, y: 2 })
  expect(position(world.state, world.actor.actorId)).toEqual({ x: 1, y: 2 })
}
function record(kind: string, scenario: (typeof cases)[number], world: World) {
  const path = process.env.AUREVANE_SUMMON_CYCLE_EVIDENCE
  if (!path) return
  appendFileSync(path, JSON.stringify({ kind, ...scenario, seed: 1, stages: world.stages }) + '\n')
}

it.each(cases)(
  '$name uses captured Mend and Thorn Rake on separate actual summon turns',
  async (scenario) => {
    const world = await setup(scenario)
    wound(world)
    const child = spawn(world)
    toTurn(world, child.combatantId)
    assertHealed(world, child)
    const before = JSON.stringify(world.state)
    expect(ap(world.state, child.combatantId)).toBe(55)
    const target = { kind: 'unit' as const, combatantId: world.opponent.actorId }
    expect(evaluatePv1fSummonAbility(world.state, child, rake, target).evaluation.legal).toBe(false)
    expect(() => executePv1fSummonAbility(world.state, child, rake, target)).toThrow(
      'one authored ability',
    )
    expect(JSON.stringify(world.state)).toBe(before)
    end(world)
    toTurn(world, child.combatantId)
    const beforeHp = unit(world.state, world.opponent.actorId)!.hp
    const result = childAction(world, child, rake, world.opponent.actorId)
    const hpAfter = unit(world.state, world.opponent.actorId)!.hp
    expect(hpAfter).toBeLessThan(beforeHp)
    expect(named(result.events, 'damage_applied')).toEqual([
      expect.objectContaining({
        actionId: rake,
        sourceCombatantId: child.combatantId,
        targetCombatantId: world.opponent.actorId,
        hpBefore: beforeHp,
        hpAfter,
      }),
    ])
    record('authored-child-actions', scenario, world)
  },
)

it.each(cases)(
  '$name chooses and executes real summon AI support without an input-state mutation',
  async (scenario) => {
    const world = await setup(scenario)
    wound(world, true, true)
    const child = spawn(world)
    toTurn(world, child.combatantId)
    const before = JSON.stringify(world.state)
    const decision = chooseSummonAiDecision({ state: world.state, summon: child, tieBreakSeed: 1 })
    expect(JSON.stringify(world.state)).toBe(before)
    expect(decision.intent).toEqual({
      kind: 'action',
      actionId: mend,
      target: { kind: 'unit', combatantId: world.actor.actorId },
    })
    expect(decision.reason).toBe('recover-survival')
    assertHealed(world, child)
    const after = JSON.stringify(world.state)
    const next = chooseSummonAiDecision({
      state: world.state,
      summon: active(world.state, child.combatantId)!,
      tieBreakSeed: 2,
    })
    expect(JSON.stringify(world.state)).toBe(after)
    expect(next.intent.kind).not.toBe('action')
    record('native-ai-support', scenario, world)
  },
)

it.each(cases)(
  '$name expires after five actual summon turns and leaves a walkable tile',
  async (scenario) => {
    const world = await setup(scenario)
    const child = spawn(world)
    let childTurns = 0
    for (let turns = 0; active(world.state, child.combatantId); turns++) {
      expect(turns).toBeLessThan(20)
      const outgoing = current(world)
      const before = active(world.state, child.combatantId)!
      expect(before.turnsCompleted).toBe(childTurns)
      end(world)
      if (outgoing === child.combatantId) childTurns++
      if (active(world.state, child.combatantId))
        expect(active(world.state, child.combatantId)!.turnsCompleted).toBe(childTurns)
    }
    expect(childTurns).toBe(5)
    removed(world, child, 'expired')
    record('finite-expiry', scenario, world)
  },
)

it.each(
  cases.flatMap((scenario) =>
    (['ai', 'canonical', 'native-player'] as const).map((route) => ({ ...scenario, route })),
  ),
)(
  '$name:$route removes an actually defeated summon without ending its living owner battle',
  async (scenario) => {
    const world = await setup(scenario)
    const child = spawn(world)
    let attacks = 0
    for (let turns = 0; active(world.state, child.combatantId); turns++) {
      expect(turns).toBeLessThan(20)
      if (current(world) === world.opponent.actorId) {
        if (position(world.state, world.opponent.actorId).y === 1) walk(world, { x: 2, y: 2 })
        if (ap(world.state, world.opponent.actorId) >= 30) {
          const result = basic(world, child.combatantId, scenario.route)
          attacks++
          if (!unit(world.state, child.combatantId)?.hp) {
            expect(active(world.state, child.combatantId)).toBeUndefined()
            expect(named(result.events, 'summon_defeated')).toHaveLength(1)
          }
        } else end(world)
      } else end(world)
    }
    expect(attacks).toBeGreaterThan(0)
    removed(world, child, 'defeated')
    record(`enemy-defeat:${scenario.route}`, scenario, world)
  },
)

it.each(cases)(
  '$name rejects an occupied spawn before payment and still accepts the free tile',
  async (scenario) => {
    const world = await setup(scenario)
    const before = JSON.stringify(world.state)
    const input = rootCommand(world, { x: 2, y: 1 })
    expect(prepareCombatAbilityCommand(input).evaluation.legal).toBe(false)
    expect(() => commitCombatAbilityCommand(input)).toThrow()
    expect(JSON.stringify(world.state)).toBe(before)
    expect(
      readSkillCooldown(unit(world.state, world.actor.actorId)!, { key: call, ownerTurns: 4 })
        .active,
    ).toBe(false)
    expect(normalizeCombatEffectState(world.state.effectState).summons ?? []).toHaveLength(0)
    spawn(world)
    const after = JSON.stringify(world.state)
    const repeated = rootCommand(world, { x: 2, y: 2 })
    expect(prepareCombatAbilityCommand(repeated).evaluation.legal).toBe(false)
    expect(() => commitCombatAbilityCommand(repeated)).toThrow()
    expect(JSON.stringify(world.state)).toBe(after)
    expect(normalizeCombatEffectState(world.state.effectState).summons).toHaveLength(1)
    record('occupied-spawn-and-repeat', scenario, world)
  },
)

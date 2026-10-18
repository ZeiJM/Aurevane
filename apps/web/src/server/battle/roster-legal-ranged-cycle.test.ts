import { describe, expect, it, vi } from 'vitest'
import {
  commitCombatAbilityCommand,
  prepareCombatAbilityCommand,
} from '@aurevane/game-core/combat/combat-ability-command'
import {
  combatAbilityCommandContext,
  primeCombatControlledAbility,
} from '@aurevane/game-core/combat/combat-behavior-runtime'
import {
  chooseBuildAwareRecruitAiDecision,
  executeBuildAwareRecruitAiAction,
} from '@aurevane/game-core/combat/recruit-ai-build'
import {
  executePv1fMovement,
  finishPv1fTurn,
  PV1F_COMBAT_CONTENT,
  readPv1fActionEconomy,
} from '@aurevane/game-core/combat/pv1f-action-economy'
import {
  reattachStatDrivenCombatBridge,
  validateStatDrivenCombatEncounterState,
  type StatDrivenCombatEncounterState,
} from '@aurevane/game-core/combat/stat-driven-combat'
import { createLegalRosterDuel, legalRosterCycleKits } from './roster-legal-duel.test-utils'

vi.mock('server-only', () => ({}))
const kit = legalRosterCycleKits.find((row) => row.primary === 'farstrider' && !row.secondary)!
const cases = ([1, 100] as const).flatMap((level) =>
  (['pve', 'pvp'] as const).map((context) => ({ name: `${level}:${context}`, level, context })),
)
function restore(state: StatDrivenCombatEncounterState) {
  const next: StatDrivenCombatEncounterState = JSON.parse(JSON.stringify(state))
  expect(validateStatDrivenCombatEncounterState(next)).toEqual([])
  return next
}
function end(state: StatDrivenCombatEncounterState) {
  const actorId = state.tactical.battle.currentTurn!.combatantId
  return restore(
    finishPv1fTurn(
      state,
      state.tactical.placements.find((row) => row.combatantId === actorId)!.facing,
    ).state,
  )
}
function command(
  state: StatDrivenCombatEncounterState,
  actorId: string,
  enemyId: string,
  abilityId = 'farstrider.aimed-shot',
) {
  const source = state.capturedAbilitySources!.find(
    (row) => row.ownerCombatantId === actorId && row.abilityId === abilityId,
  )!
  return {
    state,
    actorId,
    root: { kind: 'canonical' as const, source },
    selection:
      enemyId === actorId
        ? { kind: 'self' as const }
        : { kind: 'unit' as const, combatantId: enemyId },
    content: PV1F_COMBAT_CONTENT,
    context: combatAbilityCommandContext(state, source),
  }
}
function fire(
  input: Parameters<typeof commitCombatAbilityCommand>[0] & {
    state: StatDrivenCombatEncounterState
  },
) {
  expect(prepareCombatAbilityCommand(input).evaluation.legal).toBe(true)
  const before = JSON.stringify(input.state)
  const out = commitCombatAbilityCommand(input)
  expect(JSON.stringify(input.state)).toBe(before)
  return {
    ...out,
    state: restore(reattachStatDrivenCombatBridge(out.state, input.state.statBridge)),
  }
}

describe('actual legal Farstrider ranged opportunity / paid closing / paid retreat cycle', () => {
  it('keeps the previous adjacent default state identical to explicit default board input', async () => {
    const baseline = await createLegalRosterDuel({ kit, level: 100, context: 'pvp', seed: 1 })
    const explicit = await createLegalRosterDuel({
      kit,
      level: 100,
      context: 'pvp',
      seed: 1,
      board: {
        width: 5,
        height: 3,
        positions: [
          { x: 1, y: 1 },
          { x: 2, y: 1 },
        ],
      },
    })
    expect(baseline.state.tactical.width).toBe(5)
    expect(baseline.state.tactical.height).toBe(3)
    expect(baseline.state.tactical.placements.map((row) => row.position)).toEqual([
      { x: 1, y: 1 },
      { x: 2, y: 1 },
    ])
    expect(explicit).toEqual(baseline)
  })
  it.each(cases)(
    '$name keeps actual minimum range, cooldown and native walking authority',
    async ({ level, context }) => {
      const duel = await createLegalRosterDuel({
        kit,
        level,
        context,
        seed: 1,
        board: {
          width: 7,
          height: 3,
          positions: [
            { x: 1, y: 1 },
            { x: 4, y: 1 },
          ],
        },
      })
      const [actor, enemy] = duel.participants
      let state = restore(duel.state)
      while (state.tactical.battle.currentTurn!.combatantId !== actor!.actorId) state = end(state)
      const options = {
        committedSkills: actor!.definitions,
        canonicalSources: state.capturedAbilitySources!,
      }
      const decision = chooseBuildAwareRecruitAiDecision({
        state,
        tieBreakSeed: 1,
        skillOptions: options,
      })
      const { intent } = decision
      expect(intent.kind).toBe('action')
      if (intent.kind !== 'action') throw new Error('Expected an owned ranged command')
      const chosen = actor!.sources.find((source) => source.abilityId === intent.actionId)
      expect(
        chosen?.definition.behaviors.some(
          (b) => b.classification === 'attack' && b.targeting!.minimumRange >= 2,
        ),
      ).toBe(true)
      const planned = executeBuildAwareRecruitAiAction(
        state,
        intent.actionId,
        intent.target,
        options,
        intent,
      )
      expect(
        validateStatDrivenCombatEncounterState(JSON.parse(JSON.stringify(planned.state))),
      ).toEqual([])
      const opening = fire(command(state, actor!.actorId, enemy!.actorId))
      expect(
        opening.events.some(
          (e) => e.event === 'damage_applied' && e.targetCombatantId === enemy!.actorId,
        ),
      ).toBe(true)
      state = end(opening.state)
      for (let turns = 0; turns < 12; turns++) {
        if (
          state.tactical.battle.currentTurn!.combatantId === actor!.actorId &&
          prepareCombatAbilityCommand(command(state, actor!.actorId, enemy!.actorId)).evaluation
            .legal
        )
          break
        state = end(state)
      }
      expect(
        prepareCombatAbilityCommand(command(state, actor!.actorId, enemy!.actorId)).evaluation
          .legal,
      ).toBe(true)
      state = end(state)
      expect(state.tactical.battle.currentTurn!.combatantId).toBe(enemy!.actorId)
      const closing = executePv1fMovement(state, [
        { x: 4, y: 1 },
        { x: 3, y: 1 },
        { x: 2, y: 1 },
      ])
      expect(readPv1fActionEconomy(closing.state, enemy!.actorId)!.current).toBe(60)
      state = end(restore(closing.state))
      const deniedBefore = JSON.stringify(state)
      const denied = prepareCombatAbilityCommand(command(state, actor!.actorId, enemy!.actorId))
      expect(denied.evaluation.legal).toBe(false)
      expect(denied.evaluation.issues).toContainEqual(
        expect.objectContaining({ code: 'target-out-of-range' }),
      )
      expect(JSON.stringify(state)).toBe(deniedBefore)
      const movementBefore = state.tactical.battle.currentTurn!.movementRemaining
      const retreat = executePv1fMovement(state, [
        { x: 1, y: 1 },
        { x: 0, y: 1 },
      ])
      expect(readPv1fActionEconomy(retreat.state, actor!.actorId)!.current).toBe(80)
      expect(retreat.state.tactical.battle.currentTurn!.movementRemaining).toBe(movementBefore - 1)
      const restoredRange = fire(command(restore(retreat.state), actor!.actorId, enemy!.actorId))
      expect(readPv1fActionEconomy(restoredRange.state, actor!.actorId)!.current).toBe(35)
    },
  )
})

const fieldKit = {
  ...kit,
  name: `${kit.name}:fieldcraft-focus`,
  ids: [
    'farstrider.aimed-shot',
    'farstrider.fieldcraft',
    'farstrider.keen-focus',
    'farstrider.scouts-mark',
  ],
}

describe('actual legal Fieldcraft wounded escape / included Move cost / opposing Root cycle', () => {
  it.each(cases)(
    '$name pays40AP for two entered tiles and one real recovery, while Root denies the whole command',
    async ({ level, context }) => {
      const hunter = legalRosterCycleKits.find(
        (row) => row.primary === 'wildwarden' && !row.secondary,
      )!
      const duel = await createLegalRosterDuel({
        kit: fieldKit,
        opponentKit: hunter,
        level,
        context,
        seed: 1,
        board: {
          width: 7,
          height: 3,
          positions: [
            { x: 1, y: 1 },
            { x: 4, y: 1 },
          ],
        },
      })
      const [actor, enemy] = duel.participants
      let state = restore(duel.state)
      while (state.tactical.battle.currentTurn!.combatantId !== enemy!.actorId) state = end(state)
      const wounded = fire(
        command(state, enemy!.actorId, actor!.actorId, 'wildwarden.pursuit-shot'),
      )
      expect(
        wounded.events.some(
          (event) => event.event === 'damage_applied' && event.targetCombatantId === actor!.actorId,
        ),
      ).toBe(true)
      const ready = end(wounded.state)
      const path = [
        { x: 1, y: 1 },
        { x: 0, y: 1 },
        { x: 0, y: 0 },
      ]
      const beforeUnit = ready.tactical.battle.combatants.find((row) => row.id === actor!.actorId)!
      const escaped = fire({
        ...command(ready, actor!.actorId, actor!.actorId, 'farstrider.fieldcraft'),
        movementPath: path,
      })
      expect(readPv1fActionEconomy(escaped.state, actor!.actorId)!.current).toBe(60)
      expect(escaped.state.tactical.battle.currentTurn!.movementRemaining).toBe(
        ready.tactical.battle.currentTurn!.movementRemaining - 2,
      )
      expect(
        escaped.state.tactical.placements.find((row) => row.combatantId === actor!.actorId)!
          .position,
      ).toEqual({ x: 0, y: 0 })
      expect(
        escaped.state.tactical.battle.combatants.find((row) => row.id === actor!.actorId)!.hp -
          beforeUnit.hp,
      ).toBe(
        Math.min(
          beforeUnit.maxHp - beforeUnit.hp,
          Math.max(1, Math.floor(beforeUnit.maxHp * 0.04)),
        ),
      )
      expect(escaped.events).toContainEqual(
        expect.objectContaining({
          event: 'skill_cooldown_started',
          cooldownKey: 'farstrider.fieldcraft',
          ownerTurns: 4,
        }),
      )
      let rooted = fire(command(wounded.state, enemy!.actorId, actor!.actorId, 'wildwarden.snare'))
      expect(readPv1fActionEconomy(rooted.state, enemy!.actorId)!.current).toBe(10)
      for (
        let attempt = 0;
        !rooted.state.statusState
          .find((row) => row.combatantId === actor!.actorId)!
          .statuses.some((row) => row.statusId === 'root') && attempt < 3;
        attempt++
      ) {
        let ready = end(rooted.state)
        for (let turn = 0; turn < 12; turn++) {
          if (
            ready.tactical.battle.currentTurn!.combatantId === enemy!.actorId &&
            prepareCombatAbilityCommand(
              command(ready, enemy!.actorId, actor!.actorId, 'wildwarden.snare'),
            ).evaluation.legal
          )
            break
          ready = end(ready)
        }
        rooted = fire(command(ready, enemy!.actorId, actor!.actorId, 'wildwarden.snare'))
      }
      expect(
        rooted.state.statusState
          .find((row) => row.combatantId === actor!.actorId)!
          .statuses.some((row) => row.statusId === 'root'),
        JSON.stringify(rooted.events),
      ).toBe(true)
      expect(
        rooted.state.tactical.battle.combatants.find((row) => row.id === actor!.actorId)!.hp,
      ).toBe(wounded.state.tactical.battle.combatants.find((row) => row.id === actor!.actorId)!.hp)
      const rootedTurn = end(rooted.state)
      expect(
        rootedTurn.statusState
          .find((row) => row.combatantId === actor!.actorId)!
          .statuses.some((row) => row.statusId === 'root'),
      ).toBe(true)
      const blocked = {
        ...command(rootedTurn, actor!.actorId, actor!.actorId, 'farstrider.fieldcraft'),
        movementPath: path,
      }
      const original = JSON.stringify(rootedTurn)
      expect(prepareCombatAbilityCommand(blocked).evaluation.legal).toBe(false)
      expect(() => commitCombatAbilityCommand(blocked)).toThrow()
      expect(JSON.stringify(rootedTurn)).toBe(original)
      let later = rootedTurn
      for (let turn = 0; turn < 4; turn++) later = end(later)
      expect(
        later.statusState
          .find((row) => row.combatantId === actor!.actorId)!
          .statuses.some((row) => row.statusId === 'root'),
      ).toBe(false)
      expect(
        prepareCombatAbilityCommand({
          ...command(later, actor!.actorId, actor!.actorId, 'farstrider.fieldcraft'),
          movementPath: path,
        }).evaluation.legal,
      ).toBe(true)
    },
  )
})

describe('actual legal Keen Focus paid attachment / opportunity cost / root-classification boundary', () => {
  it.each(cases)(
    '$name explicitly adds the real modifier price and refuses a legal recovery root',
    async ({ level, context }) => {
      const duel = await createLegalRosterDuel({
        kit: fieldKit,
        level,
        context,
        seed: 1,
        board: {
          width: 7,
          height: 3,
          positions: [
            { x: 1, y: 1 },
            { x: 4, y: 1 },
          ],
        },
      })
      const [actor, enemy] = duel.participants
      let state = restore(duel.state)
      while (state.tactical.battle.currentTurn!.combatantId !== actor!.actorId) state = end(state)
      const focus = actor!.sources.find((source) => source.abilityId === 'farstrider.keen-focus')!
      const modifier = { sourceInstanceId: focus.sourceInstanceId, behaviorId: 'keen-focus' }
      const plain = fire(command(state, actor!.actorId, enemy!.actorId))
      const enhanced = fire({
        ...command(state, actor!.actorId, enemy!.actorId),
        manualModifiers: [modifier],
      })
      const loss = (out: typeof plain) =>
        out.events.reduce(
          (sum, event) =>
            sum +
            (event.event === 'damage_applied' && event.targetCombatantId === enemy!.actorId
              ? event.amount
              : 0),
          0,
        )
      expect(loss(plain)).toBeGreaterThan(0)
      expect(loss(enhanced)).toBeGreaterThan(loss(plain))
      expect(readPv1fActionEconomy(enhanced.state, actor!.actorId)!.current).toBe(45)
      expect(
        enhanced.state.tactical.battle.combatants.find((row) => row.id === actor!.actorId)!.mp,
      ).toBe(state.tactical.battle.combatants.find((row) => row.id === actor!.actorId)!.mp - 3)
      expect(enhanced.events).toContainEqual(
        expect.objectContaining({
          event: 'skill_cooldown_started',
          cooldownKey: 'farstrider.keen-focus',
          ownerTurns: 3,
        }),
      )
      const recovery = {
        ...command(state, actor!.actorId, actor!.actorId, 'farstrider.fieldcraft'),
        movementPath: [
          { x: 1, y: 1 },
          { x: 0, y: 1 },
        ],
      }
      expect(prepareCombatAbilityCommand(recovery).evaluation.legal).toBe(true)
      const unchanged = JSON.stringify(state)
      expect(() =>
        prepareCombatAbilityCommand({ ...recovery, manualModifiers: [modifier] }),
      ).toThrow('modifier-')
      expect(() =>
        commitCombatAbilityCommand({ ...recovery, manualModifiers: [modifier] }),
      ).toThrow('modifier-')
      expect(JSON.stringify(state)).toBe(unchanged)
    },
  )
})

describe('actual legal Wildwarden mark / conditional Pursuit / opposing Cleanse cycle', () => {
  it.each(cases)(
    '$name pays to prepare a quarry and loses only the optional packet after real Cleanse',
    async ({ level, context }) => {
      const hunter = legalRosterCycleKits.find(
        (row) => row.primary === 'wildwarden' && !row.secondary,
      )!
      const tide = legalRosterCycleKits.find(
        (row) => row.primary === 'tidecaller' && !row.secondary,
      )!
      const duel = await createLegalRosterDuel({
        kit: hunter,
        opponentKit: tide,
        level,
        context,
        seed: 1,
        board: {
          width: 7,
          height: 3,
          positions: [
            { x: 1, y: 1 },
            { x: 4, y: 1 },
          ],
        },
      })
      const [actor, enemy] = duel.participants
      let state = restore(duel.state)
      while (state.tactical.battle.currentTurn!.combatantId !== actor!.actorId) state = end(state)
      const targetHp = state.tactical.battle.combatants.find((row) => row.id === enemy!.actorId)!.hp
      const marked = fire(command(state, actor!.actorId, enemy!.actorId, 'wildwarden.hunters-mark'))
      expect(readPv1fActionEconomy(marked.state, actor!.actorId)!.current).toBe(70)
      expect(
        marked.state.statusState
          .find((row) => row.combatantId === enemy!.actorId)!
          .statuses.some((row) => row.statusId === 'mark'),
      ).toBe(true)
      expect(
        marked.state.tactical.battle.combatants.find((row) => row.id === enemy!.actorId)!.hp,
      ).toBe(targetHp)
      const payoff = fire(
        command(marked.state, actor!.actorId, enemy!.actorId, 'wildwarden.pursuit-shot'),
      )
      const packets = payoff.events.filter(
        (event) => event.event === 'damage_applied' && event.targetCombatantId === enemy!.actorId,
      )
      expect(packets).toHaveLength(2)
      expect(packets.every((event) => event.event === 'damage_applied' && event.amount > 0)).toBe(
        true,
      )
      expect(readPv1fActionEconomy(payoff.state, actor!.actorId)!.current).toBe(20)
      const enemyTurn = end(marked.state)
      expect(enemyTurn.tactical.battle.currentTurn!.combatantId).toBe(enemy!.actorId)
      const cleansed = fire(
        command(enemyTurn, enemy!.actorId, enemy!.actorId, 'tidecaller.cleansing-rain'),
      )
      expect(readPv1fActionEconomy(cleansed.state, enemy!.actorId)!.current).toBe(50)
      expect(
        cleansed.state.tactical.battle.combatants.find((row) => row.id === enemy!.actorId)!.mp,
      ).toBe(enemyTurn.tactical.battle.combatants.find((row) => row.id === enemy!.actorId)!.mp - 6)
      expect(
        cleansed.state.statusState
          .find((row) => row.combatantId === enemy!.actorId)!
          .statuses.some((row) => row.statusId === 'mark'),
      ).toBe(false)
      const counterWindow = end(cleansed.state)
      const counter = fire(
        command(counterWindow, actor!.actorId, enemy!.actorId, 'wildwarden.pursuit-shot'),
      )
      expect(
        counter.events.filter(
          (event) => event.event === 'damage_applied' && event.targetCombatantId === enemy!.actorId,
        ),
      ).toHaveLength(1)
      expect(readPv1fActionEconomy(counter.state, actor!.actorId)!.current).toBe(50)
    },
  )
})

describe('actual legal Longshot held-prime / minimum-range counter / release cycle', () => {
  it.each(cases)(
    '$name preserves the once-per-battle prime across paid enemy closing',
    async ({ level, context }) => {
      const longshotKit = {
        ...kit,
        name: `${kit.name}:longshot`,
        ids: kit.ids.map((id) => (id === 'farstrider.aimed-shot' ? 'farstrider.longshot' : id)),
      }
      const duel = await createLegalRosterDuel({
        kit: longshotKit,
        level,
        context,
        seed: 1,
        board: {
          width: 8,
          height: 3,
          positions: [
            { x: 2, y: 1 },
            { x: 6, y: 1 },
          ],
        },
      })
      const [actor, enemy] = duel.participants
      let state = restore(duel.state)
      while (state.tactical.battle.currentTurn!.combatantId !== actor!.actorId) state = end(state)
      const source = actor!.sources.find((row) => row.abilityId === 'farstrider.longshot')!
      const primeInput = {
        state,
        actorId: actor!.actorId,
        sourceInstanceId: source.sourceInstanceId,
        behaviorId: 'longshot',
      }
      const original = JSON.stringify(state)
      const primed = primeCombatControlledAbility(primeInput)
      expect(JSON.stringify(state)).toBe(original)
      expect(primed.events).toEqual([])
      expect(primed.state.tactical.battle.combatants).toEqual(state.tactical.battle.combatants)
      expect(primed.state.statusState).toEqual(state.statusState)
      state = end(restore(reattachStatDrivenCombatBridge(primed.state, state.statBridge)))
      expect(state.tactical.battle.currentTurn!.combatantId).toBe(enemy!.actorId)
      const closing = executePv1fMovement(state, [
        { x: 6, y: 1 },
        { x: 5, y: 1 },
        { x: 4, y: 1 },
      ])
      expect(readPv1fActionEconomy(closing.state, enemy!.actorId)!.current).toBe(60)
      state = end(restore(closing.state))
      const held = structuredClone(state.abilityRuntime!.controlled!.primes)
      expect(held).toHaveLength(1)
      const deniedBefore = JSON.stringify(state)
      const denied = prepareCombatAbilityCommand(
        command(state, actor!.actorId, enemy!.actorId, 'farstrider.longshot'),
      )
      expect(denied.evaluation.legal).toBe(false)
      expect(denied.evaluation.issues).toContainEqual(
        expect.objectContaining({ code: 'target-out-of-range' }),
      )
      expect(JSON.stringify(state)).toBe(deniedBefore)
      expect(state.abilityRuntime!.controlled!.primes).toEqual(held)
      const retreat = executePv1fMovement(state, [
        { x: 2, y: 1 },
        { x: 1, y: 1 },
      ])
      expect(readPv1fActionEconomy(retreat.state, actor!.actorId)!.current).toBe(80)
      expect(retreat.state.abilityRuntime!.controlled!.primes).toEqual(held)
      const released = fire(
        command(restore(retreat.state), actor!.actorId, enemy!.actorId, 'farstrider.longshot'),
      )
      expect(
        released.events.some(
          (e) => e.event === 'damage_applied' && e.targetCombatantId === enemy!.actorId,
        ),
      ).toBe(true)
      expect(readPv1fActionEconomy(released.state, actor!.actorId)!.current).toBe(20)
      expect(
        released.state.tactical.battle.combatants.find((row) => row.id === actor!.actorId)!.mp,
      ).toBe(state.tactical.battle.combatants.find((row) => row.id === actor!.actorId)!.mp - 3)
      expect(released.state.abilityRuntime!.controlled!.primes).toHaveLength(0)
      expect(released.state.abilityRuntime!.controlled!.used).toHaveLength(1)
      const final = JSON.stringify(released.state)
      expect(() => primeCombatControlledAbility({ ...primeInput, state: released.state })).toThrow(
        'controlled-prime-used',
      )
      expect(JSON.stringify(released.state)).toBe(final)
    },
  )
})

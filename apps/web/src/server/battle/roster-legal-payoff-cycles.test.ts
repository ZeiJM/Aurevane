import { describe, expect, it, vi } from 'vitest'
import {
  commitCombatAbilityCommand,
  prepareCombatAbilityCommand,
} from '@aurevane/game-core/combat/combat-ability-command'
import { combatAbilityCommandContext } from '@aurevane/game-core/combat/combat-behavior-runtime'
import { executeBuildAwareRecruitAiAction } from '@aurevane/game-core/combat/recruit-ai-build'
import {
  finishPv1fTurn,
  PV1F_BASIC_ATTACK_ID,
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

const mercy = 'resonance.lifebinder-vanguard.mercys-edge'
const kits = legalRosterCycleKits.filter((kit) => kit.name.startsWith(`${mercy}:`))
const scenarios = kits.flatMap((kit) =>
  ([1, 100] as const).flatMap((level) =>
    (['pve', 'pvp'] as const).map((context) => ({
      name: `${kit.primary}:${level}:${context}`,
      kit,
      level,
      context,
    })),
  ),
)

function unit(state: StatDrivenCombatEncounterState, actorId: string) {
  return state.tactical.battle.combatants.find((row) => row.id === actorId)!
}
function restore(state: StatDrivenCombatEncounterState) {
  const restored: StatDrivenCombatEncounterState = JSON.parse(JSON.stringify(state))
  expect(validateStatDrivenCombatEncounterState(restored)).toEqual([])
  return restored
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
  abilityId: string,
  targetId: string,
) {
  const source = state.capturedAbilitySources!.find(
    (row) => row.ownerCombatantId === actorId && row.abilityId === abilityId,
  )!
  if (!source) throw new Error(`Unequipped command ${abilityId}`)
  return {
    state,
    actorId,
    root: { kind: 'canonical' as const, source },
    selection:
      targetId === actorId
        ? { kind: 'self' as const }
        : { kind: 'unit' as const, combatantId: targetId },
    content: PV1F_COMBAT_CONTENT,
    context: combatAbilityCommandContext(state, source),
  }
}
function cast(input: ReturnType<typeof command>) {
  const before = JSON.stringify(input.state)
  const quote = prepareCombatAbilityCommand(input)
  expect(quote.evaluation.legal, JSON.stringify(quote.evaluation.issues)).toBe(true)
  const result = commitCombatAbilityCommand(input)
  expect(JSON.stringify(input.state)).toBe(before)
  return {
    ...result,
    state: restore(reattachStatDrivenCombatBridge(result.state, input.state.statBridge)),
  }
}
function hexed(state: StatDrivenCombatEncounterState, actorId: string) {
  return state.statusState
    .find((row) => row.combatantId === actorId)!
    .statuses.some((row) => row.statusId === 'hexed')
}

async function mercyWindow(
  kit: (typeof kits)[number],
  level: 1 | 100,
  context: 'pve' | 'pvp',
  seed: number,
) {
  const duel = await createLegalRosterDuel({ kit, level, context, seed })
  const [actor, opponent] = duel.participants
  let state = restore(duel.state)
  while (state.tactical.battle.currentTurn!.combatantId !== actor!.actorId) state = end(state)
  const full = JSON.stringify(state)
  expect(
    prepareCombatAbilityCommand(command(state, actor!.actorId, mercy, opponent!.actorId)).evaluation
      .legal,
  ).toBe(false)
  expect(JSON.stringify(state)).toBe(full)

  // Real opponent attacks earn the wounded window; no HP/status/accuracy patching.
  for (
    let attempts = 0;
    unit(state, actor!.actorId).hp * 100 > unit(state, actor!.actorId).maxHp * 60;
    attempts++
  ) {
    if (attempts > 40) throw new Error('No natural wounded window within the scenario horizon')
    if (
      state.tactical.battle.currentTurn!.combatantId === opponent!.actorId &&
      readPv1fActionEconomy(state, opponent!.actorId)!.current >= 30
    ) {
      state = restore(
        executeBuildAwareRecruitAiAction(
          state,
          PV1F_BASIC_ATTACK_ID,
          { kind: 'unit', combatantId: actor!.actorId },
          { committedSkills: opponent!.definitions, canonicalSources: opponent!.sources },
        ).state,
      )
    } else state = end(state)
    expect(state.tactical.battle.lifecycle).toBe('active')
  }
  expect(state.tactical.battle.currentTurn!.combatantId).toBe(opponent!.actorId)
  // Leave enough real AP for the named opposing counter in a parallel branch.
  if (readPv1fActionEconomy(state, opponent!.actorId)!.current < 45) state = end(end(state))
  const window = end(state)
  return { actor: actor!, opponent: opponent!, state, window }
}

describe('Mercy at the Breach actual earned-kit wound / pressure / counter cycle', () => {
  it.each(scenarios)(
    '$name pays for the conditional sustain decision after real incoming attacks',
    async ({ kit, level, context }) => {
      const { actor, opponent, state, window } = await mercyWindow(
        kit,
        level,
        context,
        level === 1 ? 1 : 12345,
      )
      const eligible = command(window, actor!.actorId, mercy, opponent!.actorId)
      expect(prepareCombatAbilityCommand(eligible).evaluation.legal).toBe(true)
      const ordinary = cast(
        command(window, actor!.actorId, 'vanguard.forceful-strike', opponent!.actorId),
      )
      expect(unit(ordinary.state, actor!.actorId).hp).toBe(unit(window, actor!.actorId).hp)
      expect(readPv1fActionEconomy(ordinary.state, actor!.actorId)!.current).toBe(55)
      const outcome = cast(eligible)
      expect(readPv1fActionEconomy(outcome.state, actor!.actorId)!.current).toBe(50)
      expect(unit(outcome.state, actor!.actorId).mp).toBe(unit(window, actor!.actorId).mp - 5)
      const connected = outcome.events.some(
        (event) =>
          event.event === 'damage_applied' && event.targetCombatantId === opponent!.actorId,
      )
      expect(connected, JSON.stringify(outcome.events)).toBe(true)
      const expectedRecovery = connected
        ? Math.max(1, Math.floor(unit(window, actor!.actorId).maxHp * 0.05))
        : 0
      expect(unit(outcome.state, actor!.actorId).hp - unit(window, actor!.actorId).hp).toBe(
        expectedRecovery,
      )
      expect(
        prepareCombatAbilityCommand(
          command(outcome.state, actor!.actorId, mercy, opponent!.actorId),
        ).evaluation.legal,
      ).toBe(false)

      let denied = cast(command(state, opponent!.actorId, 'lifebinder.vital-sever', actor!.actorId))
      // Current Accuracy and resistance remain real. A failed counter still pays;
      // retry only after its actual cooldown instead of patching in a status.
      for (let retry = 0; !hexed(denied.state, actor!.actorId) && retry < 3; retry++) {
        let ready = end(denied.state)
        for (let turns = 0; turns < 8; turns++) {
          if (
            ready.tactical.battle.currentTurn!.combatantId === opponent!.actorId &&
            prepareCombatAbilityCommand(
              command(ready, opponent!.actorId, 'lifebinder.vital-sever', actor!.actorId),
            ).evaluation.legal
          )
            break
          ready = end(ready)
        }
        denied = cast(command(ready, opponent!.actorId, 'lifebinder.vital-sever', actor!.actorId))
      }
      expect(hexed(denied.state, actor!.actorId), JSON.stringify(denied.events)).toBe(true)
      const counterWindow = end(denied.state)
      const counter = cast(command(counterWindow, actor!.actorId, mercy, opponent!.actorId))
      const counterConnected = counter.events.some(
        (event) =>
          event.event === 'damage_applied' && event.targetCombatantId === opponent!.actorId,
      )
      expect(counterConnected, JSON.stringify(counter.events)).toBe(true)
      const reduced = counterConnected
        ? Math.floor(
            Math.max(1, Math.floor(unit(counterWindow, actor!.actorId).maxHp * 0.05)) * 0.75,
          )
        : 0
      expect(unit(counter.state, actor!.actorId).hp - unit(counterWindow, actor!.actorId).hp).toBe(
        reduced,
      )
      expect(unit(counter.state, actor!.actorId).mp).toBe(
        unit(counterWindow, actor!.actorId).mp - 5,
      )
      expect(readPv1fActionEconomy(counter.state, actor!.actorId)!.current).toBe(50)
    },
    30_000,
  )
  it.each(kits)(
    '$primary preserves a paid natural miss after the same real wound setup',
    async (kit) => {
      const { actor, opponent, window } = await mercyWindow(kit, 1, 'pvp', 12345)
      const result = cast(command(window, actor.actorId, mercy, opponent.actorId))
      expect(result.events).toContainEqual(
        expect.objectContaining({
          event: 'combat_accuracy_resolved',
          actionId: mercy,
          hitChanceBasisPoints: 8000,
          rollBasisPoints: 8930,
          hit: false,
        }),
      )
      expect(unit(result.state, actor.actorId).hp).toBe(unit(window, actor.actorId).hp)
      expect(unit(result.state, opponent.actorId).hp).toBe(unit(window, opponent.actorId).hp)
      expect(unit(result.state, actor.actorId).mp).toBe(unit(window, actor.actorId).mp - 5)
      expect(readPv1fActionEconomy(result.state, actor.actorId)!.current).toBe(50)
      expect(
        prepareCombatAbilityCommand(command(result.state, actor.actorId, mercy, opponent.actorId))
          .evaluation.legal,
      ).toBe(false)
    },
  )
})

const veiled = 'resonance.aetherist-shadehand.veiled-conduit'
const veiledScenarios = legalRosterCycleKits
  .filter((kit) => kit.name.startsWith(`${veiled}:`))
  .flatMap((kit) =>
    ([1, 100] as const).flatMap((level) =>
      (['pve', 'pvp'] as const).map((context) => ({
        name: `${kit.primary}:${level}:${context}`,
        kit,
        level,
        context,
      })),
    ),
  )

describe('Veiled Conduit actual Mana Shield / sacrifice / finite reserve cycle', () => {
  it.each(veiledScenarios)(
    '$name exchanges an earned protection after paying for its real setup',
    async ({ kit, level, context }) => {
      const duel = await createLegalRosterDuel({ kit, level, context, seed: 12345 })
      const actor = duel.participants[0]!
      let state = restore(duel.state)
      while (state.tactical.battle.currentTurn!.combatantId !== actor.actorId) state = end(state)
      const initial = JSON.stringify(state)
      expect(
        prepareCombatAbilityCommand(command(state, actor.actorId, veiled, actor.actorId)).evaluation
          .legal,
      ).toBe(false)
      expect(JSON.stringify(state)).toBe(initial)
      const shield = cast(command(state, actor.actorId, 'aetherist.mana-shield', actor.actorId))
      expect(unit(shield.state, actor.actorId).mp).toBe(unit(state, actor.actorId).mp - 6)
      expect(readPv1fActionEconomy(shield.state, actor.actorId)!.current).toBe(65)
      expect(
        shield.state.statusState
          .find((row) => row.combatantId === actor.actorId)!
          .statuses.some((row) => row.statusId === 'guarded'),
      ).toBe(true)
      const keepingProtection = JSON.stringify(shield.state)
      const result = cast(command(shield.state, actor.actorId, veiled, actor.actorId))
      expect(JSON.stringify(shield.state)).toBe(keepingProtection)
      expect(unit(result.state, actor.actorId).mp).toBe(unit(state, actor.actorId).mp - 2)
      expect(readPv1fActionEconomy(result.state, actor.actorId)!.current).toBe(30)
      const statuses = result.state.statusState.find(
        (row) => row.combatantId === actor.actorId,
      )!.statuses
      expect(statuses.some((row) => row.statusId === 'guarded')).toBe(false)
      expect(statuses.some((row) => row.statusId === 'covert')).toBe(true)
      expect(result.events).toContainEqual(
        expect.objectContaining({
          event: 'status_removed',
          targetCombatantId: actor.actorId,
          statusId: 'guarded',
        }),
      )
      const used = JSON.stringify(result.state)
      expect(
        prepareCombatAbilityCommand(command(result.state, actor.actorId, veiled, actor.actorId))
          .evaluation.legal,
      ).toBe(false)
      expect(JSON.stringify(result.state)).toBe(used)
      let later = result.state
      for (let turn = 0; turn < 8; turn++) later = end(later)
      expect(
        later.statusState
          .find((row) => row.combatantId === actor.actorId)!
          .statuses.some((row) => row.statusId === 'covert'),
      ).toBe(false)
      expect(
        prepareCombatAbilityCommand(command(later, actor.actorId, veiled, actor.actorId)).evaluation
          .legal,
      ).toBe(false)
      expect(unit(later, actor.actorId).mp).toBe(unit(result.state, actor.actorId).mp)
    },
  )
})

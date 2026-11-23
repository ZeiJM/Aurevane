import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import {
  captured,
  fixture,
  input,
  unit,
  ap,
  pair,
  commitRosterCommand as cast,
  rejectRosterCommand as blocked,
  restoreRosterEncounter as restored,
  advanceRosterTurns as nextTurns,
} from './roster-outcome.test-utils'
import { currentBarrierAmount } from './combat-barrier'
import { prepareCombatAbilityCommand } from './combat-ability-command'
import { captureCombatAbilitySource } from './combat-behavior-capture'
import {
  combatAbilityCommandContext,
  reconcileCombatAbilitySources,
} from './combat-behavior-runtime'
import { PV1F_COMBAT_CONTENT } from './pv1f-action-economy'

const inventory = JSON.parse(
  readFileSync(
    new URL(
      '../../../../docs/superpowers/specs/2026-10-10-roster-rebalance-coverage.json',
      import.meta.url,
    ),
    'utf8',
  ),
) as {
  selectedActivationCombinations: { combination: string }[]
  unselectedActivationCombinations: string[]
}
interface ActivationCase {
  combination: string
  recordId: string
  version: number
  exercise: () => void
}
const cases: ActivationCase[] = [
  {
    combination: 'manual/action',
    recordId: 'vanguard.forceful-strike',
    version: 6,
    exercise() {
      const id = 'vanguard.forceful-strike',
        state = fixture([id])
      expect(unit(nextTurns(state, 4), 'enemy').hp).toBe(1000)
      const out = cast(input(state, id))
      expect(unit(out.state, 'enemy').hp).toBe(972)
      expect(ap(out.state)).toBe(55)
      expect(unit(out.state).mp).toBe(20)
      blocked(input(out.state, id), {
        code: 'cooldown-active',
        message: 'A participating cooldown is active.',
      })
    },
  },
  {
    combination: 'automatic/action',
    recordId: 'ironfist.counter-palm',
    version: 5,
    exercise() {
      const id = 'ironfist.counter-palm',
        strike = 'vanguard.forceful-strike',
        second = 'vanguard.guard-break',
        bolt = 'aetherist.arc-bolt'
      const state = fixture([id, strike, second, bolt])
      expect(() =>
        prepareCombatAbilityCommand(input(state, id, { kind: 'self' }, 'counter-palm')),
      ).toThrow('automatic-event-required')
      const idle = nextTurns(state, 4)
      expect(currentBarrierAmount(idle, 'actor')).toBe(0)
      expect(unit(idle).mp).toBe(20)
      const physical = cast(input(state, strike))
      expect(currentBarrierAmount(physical.state, 'actor')).toBe(12)
      expect(unit(physical.state).mp).toBe(17)
      expect(ap(physical.state)).toBe(55)
      const repeated = cast(input(physical.state, second))
      expect(currentBarrierAmount(repeated.state, 'actor')).toBe(12)
      expect(unit(repeated.state).mp).toBe(17)
      const mystic = cast(input(state, bolt))
      expect(currentBarrierAmount(mystic.state, 'actor')).toBe(0)
      expect(unit(mystic.state).mp).toBe(17) //Only Arc Bolt's authored3MP, no reaction payment.
      const poor = restored(state)
      unit(poor).mp = 2
      const unaffordable = cast(input(poor, strike))
      expect(currentBarrierAmount(unaffordable.state, 'actor')).toBe(0)
      expect(unit(unaffordable.state).mp).toBe(2)
      const foe = captureCombatAbilitySource({
        ...captured(strike),
        ownerCombatantId: 'enemy',
        sourceInstanceId: 'enemy.forceful-strike',
      })
      const enemyTurn = nextTurns(
        restored(reconcileCombatAbilitySources(state, [...state.capturedAbilitySources!, foe])),
        1,
      )
      expect(enemyTurn.tactical.battle.currentTurn?.combatantId).toBe('enemy')
      const foreign = cast({
        state: enemyTurn,
        actorId: 'enemy',
        root: { kind: 'canonical', source: foe },
        selection: { kind: 'unit', combatantId: 'actor' },
        content: PV1F_COMBAT_CONTENT,
        context: combatAbilityCommandContext(enemyTurn, foe),
      })
      expect(unit(foreign.state).hp).toBe(972)
      expect(currentBarrierAmount(foreign.state, 'actor')).toBe(0)
      expect(unit(foreign.state).mp).toBe(20)
    },
  },
  {
    combination: 'manual/modifier',
    recordId: 'farstrider.keen-focus',
    version: 5,
    exercise() {
      const id = 'farstrider.keen-focus',
        shot = 'farstrider.aimed-shot',
        another = 'farstrider.pinning-shot'
      const state = fixture([id, shot, another])
      state.tactical.placements.find((row) => row.combatantId === 'actor')!.position = {
        x: 0,
        y: 1,
      }
      expect(() => prepareCombatAbilityCommand(input(state, id))).toThrow(
        'ability-action-behavior-required',
      )
      const plain = cast(input(state, shot))
      expect(unit(plain.state, 'enemy').hp).toBe(974)
      expect(ap(plain.state)).toBe(55)
      expect(unit(plain.state).mp).toBe(20)
      const manualModifiers = [{ sourceInstanceId: id, behaviorId: 'keen-focus' }]
      const attached = cast({ ...input(state, shot), manualModifiers })
      expect(unit(attached.state, 'enemy').hp).toBe(971)
      expect(ap(attached.state)).toBe(45)
      expect(unit(attached.state).mp).toBe(17)
      const replay = nextTurns(attached.state, 4)
      expect(prepareCombatAbilityCommand(input(replay, another)).evaluation.legal).toBe(true)
      blocked(
        { ...input(replay, another), manualModifiers },
        { code: 'cooldown-active', message: 'A participating cooldown is active.' },
      )
      const omitted = cast(input(replay, another))
      expect(unit(omitted.state).mp).toBe(unit(replay).mp)
    },
  },
  {
    combination: 'ongoing/modifier',
    recordId: pair('aetherist', 'ravager'),
    version: 6,
    exercise() {
      const id = pair('aetherist', 'ravager'),
        bolt = 'aetherist.arc-bolt'
      const state = fixture([id, bolt])
      unit(state).hp = 350
      expect(() => prepareCombatAbilityCommand(input(state, id))).toThrow(
        'ability-action-behavior-required',
      )
      const idle = nextTurns(state, 4)
      expect(unit(idle, 'enemy').hp).toBe(1000)
      expect(unit(idle).mp).toBe(20)
      const boosted = cast(input(state, bolt))
      expect(unit(boosted.state, 'enemy').hp).toBe(973)
      expect(ap(boosted.state)).toBe(55)
      expect(unit(boosted.state).mp).toBe(17)
      const healthy = restored(state)
      unit(healthy).hp = 351
      expect(unit(cast(input(healthy, bolt)).state, 'enemy').hp).toBe(975)
      const poor = restored(state)
      unit(poor).mp = 9
      expect(unit(cast(input(poor, bolt)).state, 'enemy').hp).toBe(975)
      const removed = restored(reconcileCombatAbilitySources(state, [captured(bolt)]))
      expect(unit(cast(input(removed, bolt)).state, 'enemy').hp).toBe(975)
    },
  },
]

it('requires a real executable witness for every selected final-roster activation/mode combination', () => {
  expect(cases.map((row) => row.combination).sort()).toEqual(
    inventory.selectedActivationCombinations.map((row) => row.combination).sort(),
  )
  expect(inventory.unselectedActivationCombinations).toEqual(['automatic/modifier'])
})
it.each(cases)('$combination has a pinned final-roster eligible/counter/finite outcome', (row) => {
  const source = captured(row.recordId)
  expect(source.contentVersion).toBe(row.version)
  const group = source.definition.behaviors[0]!
  expect(`${group.activation}/${group.mode}`).toBe(row.combination)
  row.exercise()
})

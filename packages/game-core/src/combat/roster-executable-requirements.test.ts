import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import type { RequirementNode } from './combat-requirements'
import { validateAbilityRequirements } from './combat-requirements'
import { captureCombatAbilitySource } from './combat-behavior-capture'
import {
  combatAbilityCommandContext,
  reconcileCombatAbilitySources,
  primeCombatControlledAbility,
  cancelCombatControlledAbility,
} from './combat-behavior-runtime'
import { prepareCombatAbilityCommand } from './combat-ability-command'
import { finishPv1fTurn, PV1F_COMBAT_CONTENT } from './pv1f-action-economy'
import { currentBarrierAmount } from './combat-barrier'
import {
  captured,
  fixture,
  input,
  unit,
  ap,
  hasStatus,
  pair,
  commitRosterCommand as cast,
  rejectRosterCommand as blocked,
  restoreRosterEncounter as restored,
  advanceRosterTurns as nextTurns,
} from './roster-outcome.test-utils'
import type { CombatEncounterState } from './actions'

const design = JSON.parse(
  readFileSync(
    new URL(
      '../../../../docs/superpowers/specs/2026-10-10-roster-rebalance-coverage.json',
      import.meta.url,
    ),
    'utf8',
  ),
) as { requirementCoverage: { kind: RequirementNode['kind'] }[] }
const self = { kind: 'self' as const }
const enemy = { kind: 'unit' as const, combatantId: 'enemy' }
const secondWind = 'vanguard.second-wind'

function nodes(node: RequirementNode | null): readonly RequirementNode[] {
  return node ? [node, ...('children' in node ? node.children.flatMap(nodes) : [])] : []
}
function uses(state: CombatEncounterState, id: string) {
  return state.abilityRuntime?.usage.filter((row) => row.key.includes(id)).length ?? 0
}
function incoming(hp: number, mp = 20) {
  const reaction = captured(secondWind),
    strike = captured('vanguard.forceful-strike')
  const foe = captureCombatAbilitySource({
    ...strike,
    sourceInstanceId: 'enemy.forceful-strike',
    ownerCombatantId: 'enemy',
  })
  let state = restored(reconcileCombatAbilitySources(fixture([secondWind]), [reaction, foe]))
  unit(state).hp = hp
  unit(state).mp = mp
  state = finishPv1fTurn(state, 'east').state
  expect(state.tactical.battle.currentTurn?.combatantId).toBe('enemy')
  expect(unit(state).hp).toBe(hp)
  const command = {
    state,
    actorId: 'enemy',
    root: { kind: 'canonical' as const, source: foe },
    selection: { kind: 'unit' as const, combatantId: 'actor' },
    content: PV1F_COMBAT_CONTENT,
    context: combatAbilityCommandContext(state, foe),
  }
  return { state, command }
}
interface RequirementCase {
  recordId: string
  version: number
  exercise: () => void
}
// Preserve the released inventory's eight kinds. The additive causal relation has
// native coverage in combat-subject-relation.test.ts until a new roster selects it.
const cases = {
  all: {
    recordId: secondWind,
    version: 6,
    exercise() {
      const eligible = incoming(327),
        paid = cast(eligible.command)
      expect(unit(paid.state).hp).toBe(379) //327 - actual28damage +80recovery.
      expect(unit(paid.state).mp).toBe(16)
      expect(hasStatus(paid.state, 'guarded')).toBe(true)
      expect(uses(paid.state, secondWind)).toBe(1)
      const unavailable = incoming(327, 3),
        denied = cast(unavailable.command)
      expect(unit(denied.state).hp).toBe(299)
      expect(unit(denied.state).mp).toBe(3)
      expect(hasStatus(denied.state, 'guarded')).toBe(false)
      expect(uses(denied.state, secondWind)).toBe(0)
      const idle = fixture([secondWind])
      unit(idle).hp = 250
      const later = nextTurns(idle, 4)
      expect(unit(later).hp).toBe(250)
      expect(unit(later).mp).toBe(20)
      expect(uses(later, secondWind)).toBe(0)
    },
  },
  any: {
    recordId: 'shadehand.exploit-opening',
    version: 6,
    exercise() {
      const id = 'shadehand.exploit-opening',
        mark = 'farstrider.scouts-mark',
        expose = 'aetherist.arcane-field'
      blocked(input(fixture([id]), id), { code: 'requirement-not-met' })
      for (const setup of [mark, expose]) {
        const initial = fixture([id, setup])
        const prepared = cast(
          input(initial, setup, setup === expose ? { kind: 'activate' } : enemy),
        )
        const ready = nextTurns(prepared.state, 4)
        expect(hasStatus(ready, setup === mark ? 'mark' : 'exposed', 'enemy')).toBe(true)
        const hp = unit(ready, 'enemy').hp
        const result = cast(input(ready, id))
        expect(unit(result.state, 'enemy').hp).toBeLessThan(hp)
        expect(ap(result.state)).toBe(50)
      }
    },
  },
  'resource-state': {
    recordId: 'lifebinder.mend',
    version: 6,
    exercise() {
      const id = 'lifebinder.mend',
        target = { kind: 'unit' as const, combatantId: 'ally' }
      const threshold = fixture([id])
      unit(threshold, 'ally').hp = 350
      const result = cast(input(threshold, id, target))
      expect(unit(result.state, 'ally').hp).toBe(470)
      expect(ap(result.state)).toBe(65)
      expect(unit(result.state).mp).toBe(14)
      const above = fixture([id])
      unit(above, 'ally').hp = 351
      blocked(input(above, id, target), { code: 'requirement-not-met' })
      const defeated = fixture([id])
      unit(defeated, 'ally').hp = 0
      blocked(input(defeated, id, target))
      expect(unit(defeated, 'ally').hp).toBe(0)
    },
  },
  'resource-threshold-crossing': {
    recordId: secondWind,
    version: 6,
    exercise() {
      for (const scenario of [
        { before: 329, after: 301, spent: false },
        { before: 328, after: 380, spent: true },
        { before: 327, after: 379, spent: true },
        { before: 290, after: 262, spent: false },
      ]) {
        const { command } = incoming(scenario.before),
          out = cast(command)
        expect(unit(out.state).hp).toBe(scenario.after)
        expect(unit(out.state).mp).toBe(scenario.spent ? 16 : 20)
        expect(uses(out.state, secondWind)).toBe(scenario.spent ? 1 : 0)
      }
    },
  },
  'status-presence': {
    recordId: 'shadehand.exploit-opening',
    version: 6,
    exercise() {
      const id = 'shadehand.exploit-opening',
        setup = 'farstrider.scouts-mark'
      const state = fixture([id, setup])
      const elsewhere = cast(input(state, setup, { kind: 'unit', combatantId: 'other' }))
      expect(hasStatus(elsewhere.state, 'mark', 'other')).toBe(true)
      expect(hasStatus(elsewhere.state, 'mark', 'enemy')).toBe(false)
      blocked(input(elsewhere.state, id), { code: 'requirement-not-met' })
      const marked = cast(input(state, setup))
      const out = cast(input(marked.state, id))
      expect(unit(out.state, 'enemy').hp).toBe(970)
      expect(ap(out.state)).toBe(20) //30setup +50attack.
      expect(unit(out.state).mp).toBe(18)
    },
  },
  'prime-presence': {
    recordId: pair('aetherist', 'chronist'),
    version: 5,
    exercise() {
      const root = 'aetherist.arc-bolt',
        rewind = 'chronist.rewind-step',
        held = pair('aetherist', 'chronist')
      const initial = fixture([root, rewind, held]),
        before = JSON.stringify(initial)
      const plain = cast(input(initial, root))
      expect(unit(plain.state, 'enemy').hp).toBe(975)
      const primeInput = {
        state: initial,
        actorId: 'actor',
        sourceInstanceId: rewind,
        behaviorId: captured(rewind).definition.behaviors[0]!.id,
      }
      const primed = primeCombatControlledAbility(primeInput).state
      expect(JSON.stringify(initial)).toBe(before)
      expect(ap(primed)).toBe(100)
      expect(unit(primed).mp).toBe(20)
      const boosted = cast(input(restored(primed), root))
      expect(unit(boosted.state, 'enemy').hp).toBe(973)
      expect(ap(boosted.state)).toBe(55)
      expect(unit(boosted.state).mp).toBe(17)
      const canceled = cancelCombatControlledAbility({
        ...primeInput,
        state: restored(primed),
      }).state
      const noPrime = cast(input(canceled, root))
      expect(unit(noPrime.state, 'enemy').hp).toBe(975)
      const low = restored(primed)
      unit(low).mp = 11
      expect(unit(cast(input(low, root)).state, 'enemy').hp).toBe(975)
    },
  },
  event: {
    recordId: secondWind,
    version: 6,
    exercise() {
      const gather = pair('aetherist', 'edgedancer'),
        state = fixture([secondWind, gather])
      unit(state).hp = 305
      unit(state).mp = 8
      const out = cast(input(state, gather, self, 'gather'))
      expect(unit(out.state).hp).toBe(295) //Real HP payment crosses30%, but it is not damage_applied.
      expect(unit(out.state).mp).toBe(8)
      expect(ap(out.state)).toBe(70)
      expect(uses(out.state, secondWind)).toBe(0)
      const damage = cast(incoming(327).command)
      expect(unit(damage.state).hp).toBe(379)
      expect(uses(damage.state, secondWind)).toBe(1)
    },
  },
  action: {
    recordId: 'farstrider.keen-focus',
    version: 5,
    exercise() {
      const modifier = 'farstrider.keen-focus',
        shot = 'farstrider.aimed-shot',
        spell = 'aetherist.arc-bolt',
        state = fixture([modifier, shot, spell])
      state.tactical.placements.find((row) => row.combatantId === 'actor')!.position = {
        x: 0,
        y: 1,
      }
      const selection = [
        { sourceInstanceId: modifier, behaviorId: captured(modifier).definition.behaviors[0]!.id },
      ]
      expect(prepareCombatAbilityCommand(input(state, spell)).evaluation.legal).toBe(true)
      const before = JSON.stringify(state)
      expect(() =>
        prepareCombatAbilityCommand({ ...input(state, spell), manualModifiers: selection }),
      ).toThrow('modifier-requirement-not-met')
      expect(JSON.stringify(state)).toBe(before)
      const out = cast({ ...input(state, shot), manualModifiers: selection })
      expect(unit(out.state, 'enemy').hp).toBe(971)
      expect(ap(out.state)).toBe(45)
      expect(unit(out.state).mp).toBe(17)
      expect(currentBarrierAmount(out.state, 'actor')).toBe(0)
    },
  },
} satisfies Record<Exclude<RequirementNode['kind'], 'subject-relation'>, RequirementCase>

it('requires executable scenarios for every Requirement kind in the released roster', () => {
  expect(Object.keys(cases).sort()).toEqual(
    design.requirementCoverage.map((row) => row.kind).sort(),
  )
})
it.each(Object.entries(cases))(
  '%s uses a pinned final roster definition and real eligible/ineligible outcomes',
  (kind, row) => {
    const source = captured(row.recordId),
      requirement = source.definition.behaviors[0]!.requirements
    expect(source.contentVersion).toBe(row.version)
    expect(validateAbilityRequirements(requirement)).toEqual([])
    expect(nodes(requirement).some((node) => node.kind === kind)).toBe(true)
    row.exercise()
  },
)

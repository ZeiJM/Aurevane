import { expect, it } from 'vitest'
import { parseAbilityDefinition } from './combat-definition'
import { evaluateAbilityRequirements } from './combat-requirements'
import { commitCombatAbilityCommand } from './combat-ability-command'
import {
  combatAbilitySubject,
  primeCombatControlledAbility,
  cancelCombatControlledAbility,
} from './combat-behavior-runtime'
import {
  identityBaseline,
  identityCandidate,
  identitySource,
  identityState,
  identityCommand,
  identityUnit,
  readIdentityJson,
  type IdentityRow,
} from './essence-resonance-identity.test-utils'
import { give } from './roster-outcome.test-utils'

const correction = readIdentityJson('2026-10-19-resonance-modularity-cohort') as {
  records: IdentityRow[]
}
const current = new Map(identityBaseline.records.map((row) => [row.id, row]))
for (const row of [...identityCandidate.records, ...correction.records]) current.set(row.id, row)

it.each([...current.values()])('$id retains an executable current canonical definition', (row) => {
  expect(() => parseAbilityDefinition(row.after.ability)).not.toThrow()
})

it('Held Formula accepts any genuine Controlled prime and the exact editable MP threshold', () => {
  const held = identitySource(current.get('resonance.aetherist-chronist.linked-sequence')!)
  const row = structuredClone(current.get('chronist.rewind-step')!)
  row.id = 'custom.controlled-step'
  const prepared = identitySource(row)
  const state = identityState([held, prepared])
  identityUnit(state).mp = 12
  const requirement = held.definition.behaviors[0]!.requirements
  const context = (value: typeof state) => ({ owner: combatAbilitySubject(value, 'actor')! })
  expect(evaluateAbilityRequirements(requirement, context(state))).toBe(false)
  const primed = primeCombatControlledAbility({
    state,
    actorId: 'actor',
    sourceInstanceId: prepared.sourceInstanceId,
    behaviorId: prepared.definition.behaviors[0]!.id,
  }).state as typeof state
  expect(evaluateAbilityRequirements(requirement, context(primed))).toBe(true)
  const saved = JSON.parse(JSON.stringify(primed)) as typeof state
  identityUnit(saved).mp = 11
  expect(evaluateAbilityRequirements(requirement, context(saved))).toBe(false)
  identityUnit(saved).mp = 12
  const cancelled = cancelCombatControlledAbility({
    state: saved,
    actorId: 'actor',
    sourceInstanceId: prepared.sourceInstanceId,
    behaviorId: prepared.definition.behaviors[0]!.id,
  }).state as typeof state
  expect(evaluateAbilityRequirements(requirement, context(cancelled))).toBe(false)
})

it.each([
  { atCap: false, minimum: 1, activates: true },
  { atCap: true, minimum: 1, activates: false },
  { atCap: false, minimum: 36, activates: false },
])(
  'Restorative Current requires native positive MP gain: $atCap / $minimum',
  ({ atCap, minimum, activates }) => {
    const resonanceRow = structuredClone(
      current.get('resonance.lifebinder-stormsinger.linked-sequence')!,
    )
    const requirements = resonanceRow.after.ability.behaviors[0]!.requirements!
    if (requirements.kind !== 'all') throw new Error('Expected modular trigger')
    resonanceRow.after.ability = {
      ...resonanceRow.after.ability,
      behaviors: resonanceRow.after.ability.behaviors.map((behavior, index) =>
        index
          ? behavior
          : {
              ...behavior,
              requirements: {
                ...requirements,
                children: requirements.children.map((node) =>
                  node.kind === 'resource-change' ? { ...node, minimumAmount: minimum } : node,
                ),
              },
            },
      ),
    }
    // A legal Master edit allows this recovery at the cap, where its native mutation is zero.
    const rootRow = structuredClone(current.get('stormsinger.storm-breath')!)
    if (atCap)
      rootRow.after.ability = {
        ...rootRow.after.ability,
        behaviors: rootRow.after.ability.behaviors.map((behavior) => ({
          ...behavior,
          requirements: null,
        })),
      }
    const resonance = identitySource(resonanceRow)
    const root = identitySource(rootRow)
    const state = identityState([resonance, root])
    identityUnit(state).hp = 500
    identityUnit(state).mp = atCap ? 500 : 100
    give(state, 'guarded', 'actor')
    const out = commitCombatAbilityCommand(identityCommand(state, root, { kind: 'self' }))
    expect(
      out.events.some(
        (event) => event.event === 'combat_action_used' && event.actionId === resonance.abilityId,
      ),
    ).toBe(activates)
    expect(identityUnit(out.state).hp).toBe(activates ? 550 : 500)
    expect(identityUnit(out.state).mp).toBe(atCap ? 500 : activates ? 133 : 135)
    expect(
      out.state.statusState
        .find((row) => row.combatantId === 'actor')!
        .statuses.some((status) => status.statusId === 'guarded'),
    ).toBe(!activates)
  },
)

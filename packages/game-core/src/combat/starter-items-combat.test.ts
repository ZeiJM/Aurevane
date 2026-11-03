import { expect, it } from 'vitest'
import { starterItemDefinitions } from '../content/starter-items'
import { captureEquipmentAbilitySource } from './combat-behavior-capture'
import { defaultBasicSkills, captureBasicSkillSources } from './combat-basic-actions'
import { compileEquipmentAbility, type BattleEquipmentCapture } from './combat-equipment'
import {
  activateCombatAbilitySources,
  prepareCombatAbilityCommand,
  commitCombatAbilityCommand,
  combatAbilityRemainingUses,
} from './combat-ability-command'
import { combatAbilityCommandContext } from './combat-behavior-runtime'
import { fixture, captured, damage, ap, unit, give } from './roster-outcome.test-utils'
import { createCurrentStatDrivenCombatEncounterState } from './stat-driven-combat'
import { PV1F_COMBAT_CONTENT, executePv1fMovement } from './pv1f-action-economy'
import { combatStatBonus } from './combat-stat-bonuses'
import { currentBarrierAmount } from './combat-barrier'
const catalogue = starterItemDefinitions()
const equipment = (ids: string[]): BattleEquipmentCapture => ({
  schemaVersion: 1,
  inventoryRevision: 1,
  selectedSupport: { kind: 'basic', actionId: 'basic.recover' },
  equipment: ids.map((id, index) => ({
    position:
      catalogue.find((x) => x.id === id)!.equipment!.slot === 'boots'
        ? 'boots'
        : index === 0
          ? 'main-hand'
          : 'off-hand',
    ownedStackId: `private-${index}`,
    item: catalogue.find((x) => x.id === id)!,
  })),
})
function ready(ids: string[], power = 100, defense = 0) {
  const raw = fixture([])
  const base = createCurrentStatDrivenCombatEncounterState(
    { ...raw, abilityUsageLimitPolicyVersion: 1 },
    raw.statBridge.combatants.map((p) => ({
      ...p,
      physicalPower: power,
      mysticPower: power,
      armor: defense,
      ward: defense,
      accuracy: 14000,
      evasion: 0,
      level: 1,
      criticalChance: 0,
      statusResistance: 0,
    })),
  )
  const capture = equipment(ids),
    sources = capture.equipment.map((e) => captureEquipmentAbilitySource(capture, e, 'actor')!)
  return {
    state: activateCombatAbilitySources(base, sources, PV1F_COMBAT_CONTENT, true).state,
    sources,
    capture,
  }
}
function input(
  state: ReturnType<typeof ready>['state'],
  source: ReturnType<typeof ready>['sources'][number],
  behaviorId?: string,
) {
  const behavior = source.definition.behaviors.find(
    (b) =>
      b.id ===
      (behaviorId ?? source.definition.behaviors.find((b) => b.activation === 'manual')?.id),
  )!
  return {
    state,
    actorId: 'actor',
    root: { kind: 'canonical' as const, source, behaviorId: behavior.id },
    selection:
      behavior.targeting?.kind === 'self'
        ? { kind: 'self' as const }
        : { kind: 'unit' as const, combatantId: 'enemy' },
    content: PV1F_COMBAT_CONTENT,
    context: combatAbilityCommandContext(state, source),
  }
}
it.each([100, 200])(
  'measures weapon output and per-AP against actual Discipline and unarmed at Power %s',
  (power) => {
    const rows = []
    for (const defense of [0, 50, 150]) {
      const { state } = ready([], power, defense)
      const source = captured('vanguard.forceful-strike')
      const dState = activateCombatAbilitySources(state, [source], PV1F_COMBAT_CONTENT, true).state
      const dResult = commitCombatAbilityCommand(input(dState, source))
      const dDamage = damage(dResult.events).reduce((a, b) => a + b, 0),
        dAp = 100 - ap(dResult.state)!
      const unarmed = captureBasicSkillSources({
        ownerCombatantId: 'actor',
        supportActionId: 'basic.recover',
        definitions: defaultBasicSkills(),
      }).find((s) => s.basic?.id === 'unarmed.basic')!
      const uState = activateCombatAbilitySources(state, [unarmed], PV1F_COMBAT_CONTENT, true).state
      const uResult = commitCombatAbilityCommand(input(uState, unarmed)),
        uDamage = damage(uResult.events).reduce((a, b) => a + b, 0)
      for (const item of catalogue.filter((x) => x.itemClass === 'weapon')) {
        const { state, sources } = ready([item.id], power, defense)
        const command = input(state, sources[0]!),
          quote = prepareCombatAbilityCommand(command),
          result = commitCombatAbilityCommand(command)
        const dealt = damage(result.events).reduce((a, b) => a + b, 0),
          spent = 100 - ap(result.state)!,
          ratio = dealt / spent / (dDamage / dAp)
        rows.push({
          power,
          defense,
          id: item.id,
          damage: dealt,
          ap: spent,
          perAP: dealt / spent,
          discipline: dDamage,
          disciplineAP: dAp,
          unarmed: uDamage,
          ratio,
        })
        expect(quote.action.sourceType).toBe('basic-attack')
        expect(spent).toBe(item.ability!.behaviors[0]!.costs[0]!.amount)
        expect.soft(ratio, item.id).toBeLessThan(0.75)
        if (defense === 0 && !['buckler-patience', 'tower-shield'].includes(item.id)) {
          expect.soft(ratio, item.id).toBeGreaterThanOrEqual(0.6)
          expect.soft(ratio, item.id).toBeLessThanOrEqual(0.7)
        }
      }
    }
    console.log(JSON.stringify(rows))
  },
)
it('executes two distinct cuts, storm Conductive, Guard bash and defensive shield passives', () => {
  const twins = ready(['twinfang-blade'])
  expect(
    damage(commitCombatAbilityCommand(input(twins.state, twins.sources[0]!)).events),
  ).toHaveLength(2)
  for (const [id, statusId, target] of [
    ['stormcaller-staff', 'conductive', 'enemy'],
    ['buckler-patience', 'guarded', 'actor'],
  ] as const) {
    const r = ready([id]),
      result = commitCombatAbilityCommand(input(r.state, r.sources[0]!))
    expect(
      result.state.statusState
        .find((s) => s.combatantId === target)
        ?.statuses.some((s) => s.statusId === statusId),
    ).toBe(true)
  }
  const tower = ready(['tower-shield'])
  expect(combatStatBonus(tower.state, 'actor', 'physical-defense')).toBe(18)
  expect(combatStatBonus(tower.state, 'actor', 'mystic-defense')).toBe(10)
  expect(
    compileEquipmentAbility(tower.capture, tower.capture.equipment[0]!).behaviors.map((b) => b.id),
  ).not.toContain('guard')
})
it.each([
  'mender-salve',
  'clarity-draught',
  'purifying-incense',
  'whetstone-charm',
  'ironbark-tonic',
  'swiftleaf-tea',
  'emberflask',
  'vulnerability-oil',
  'frostbind-powder',
  'smoke-veil',
  'ward-sigil-scroll',
])('uses genuine %s through quote, payment, finite counter and reset', (id) => {
  const r = ready([id]),
    source = r.sources[0]!
  unit(r.state).hp = 400
  unit(r.state).mp = 5
  give(r.state, 'exposed', 'actor')
  const before = JSON.stringify(r.state),
    command = input(r.state, source),
    quote = prepareCombatAbilityCommand(command)
  expect(quote.evaluation.legal).toBe(true)
  expect(JSON.stringify(r.state)).toBe(before)
  const result = commitCombatAbilityCommand(command),
    definition = catalogue.find((x) => x.id === id)!
  expect(ap(result.state)).toBe(100 - definition.ability!.behaviors[0]!.costs[0]!.amount)
  expect(combatAbilityRemainingUses(result.state, source, source.definition.behaviors[0]!)).toBe(
    definition.battleUses! - 1,
  )
  expect(
    combatAbilityRemainingUses(
      JSON.parse(JSON.stringify(result.state)),
      source,
      source.definition.behaviors[0]!,
    ),
  ).toBe(definition.battleUses! - 1)
  expect(
    combatAbilityRemainingUses(ready([id]).state, source, source.definition.behaviors[0]!),
  ).toBe(definition.battleUses)
  if (id === 'mender-salve') expect(unit(result.state).hp).toBe(520)
  if (id === 'clarity-draught') expect(unit(result.state).mp).toBe(7)
  if (id === 'purifying-incense')
    expect(result.state.statusState.find((s) => s.combatantId === 'actor')!.statuses).toEqual([])
  if (id === 'ward-sigil-scroll') expect(currentBarrierAmount(result.state, 'actor')).toBe(200)
  if (id === 'emberflask') expect(damage(result.events)[0]).toBeGreaterThan(0)
})
it.each([
  ['trailbound-boots', 1],
  ['galewalker-boots', 2],
] as const)('%s extends Movement without bypassing AP', (id, bonus) => {
  const r = ready([id])
  expect(r.state.tactical.battle.currentTurn?.movementBonusAtTurnStart).toBe(bonus)
  expect(r.state.tactical.battle.currentTurn?.movementMaximum).toBe(4 + bonus)
  const moved = executePv1fMovement(r.state as ReturnType<typeof fixture>, [
    { x: 1, y: 1 },
    { x: 0, y: 1 },
  ])
  expect(ap(moved.state)).toBe(80)
})

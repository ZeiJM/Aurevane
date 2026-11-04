import { writeFileSync } from 'node:fs'
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
  schemaVersion: 2,
  inventoryRevision: 1,
  selectedSupport: { kind: 'basic', actionId: 'basic.recover' },
  equipment: ids.map((id, index) => ({
    position:
      catalogue.find((x) => x.id === id)!.itemClass === 'battle-item'
        ? 'consumable-1'
        : catalogue.find((x) => x.id === id)!.itemClass === 'hand-armor'
          ? 'off-hand'
          : catalogue.find((x) => x.id === id)!.equipment!.slot === 'boots'
            ? 'boots'
            : 'main-hand',
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
    if (process.env.AV_STARTER_BALANCE_EVIDENCE)
      writeFileSync(
        `${process.env.AV_STARTER_BALANCE_EVIDENCE}-${power}.json`,
        JSON.stringify(rows, null, 2),
      )
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
  if (id === 'frostbind-powder')
    expect(
      result.state.statusState
        .find((s) => s.combatantId === 'enemy')!
        .statuses.some((s) => s.statusId === 'frozen'),
    ).toBe(true)
  if (id === 'smoke-veil')
    expect(
      result.state.statusState
        .find((s) => s.combatantId === 'actor')!
        .statuses.find((s) => s.statusId === 'guarded'),
    ).toMatchObject({ potencyBasisPoints: 2000 })
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

it('uses Emberbrand only on matching direct packets and never reapplies it to captured Burn ticks', async () => {
  const { percentageDotEncounter } = await import('./combat-percentage-dots.test-utils')
  const { materializeCombatAbilityAction, reconcileCombatAbilitySources } =
    await import('./combat-behavior-runtime')
  const { executeCombatAction } = await import('./actions')
  const { applyCurrentBurnState } = await import('./combat-dots')
  const { finishPv1fTurn } = await import('./pv1f-action-economy')
  const ember = ready(['emberbrand']).sources[0]!
  let state = reconcileCombatAbilitySources(percentageDotEncounter(), [ember])
  const action = {
    ...materializeCombatAbilityAction(ember, ember.definition.behaviors[0]!),
    costs: [],
    effectTimingModes: undefined,
    effectOrigins: undefined,
    effects: (['fire', 'water'] as const).map((element) => ({
      type: 'damage' as const,
      recipient: 'primary-unit' as const,
      amount: 10,
      element,
    })),
  }
  expect(
    damage(
      executeCombatAction(
        state,
        action,
        { kind: 'unit', combatantId: 'enemy' },
        PV1F_COMBAT_CONTENT,
      ).events,
    ),
  ).toEqual([11, 10])
  state = applyCurrentBurnState(state, 'actor', 'enemy', 'captured-burn', false, undefined, 2, {
    capturedDamage: 100,
    profile: { kind: 'attack-percentage', basisPoints: 1500 },
  })
  const events = []
  while (state.tactical.battle.round === 1) {
    const next = finishPv1fTurn(state as never, 'east')
    state = next.state
    events.push(...(next.events as import('./actions').CombatResolutionEvent[]))
  }
  expect(damage(events)).toEqual([15])
})
it('executes selected genuine Support Actions with their AP, cooldown and protection', () => {
  for (const [id, behaviorId] of [
    ['wardstone-bracer', 'ward'],
    ['tower-shield', 'guard'],
  ] as const) {
    const r = ready([id])
    const capture: BattleEquipmentCapture = {
      ...r.capture,
      selectedSupport: {
        kind: 'equipment',
        position: r.capture.equipment[0]!.position,
        itemId: id,
        behaviorId,
      },
    }
    const source = captureEquipmentAbilitySource(capture, capture.equipment[0]!, 'actor')!
    const state = activateCombatAbilitySources(
      ready([]).state,
      [source],
      PV1F_COMBAT_CONTENT,
      true,
    ).state
    const result = commitCombatAbilityCommand(input(state, source, behaviorId))
    expect(ap(result.state)).toBe(70)
    expect(
      prepareCombatAbilityCommand(input(result.state, source, behaviorId)).evaluation.legal,
    ).toBe(false)
    if (id === 'wardstone-bracer') expect(currentBarrierAmount(result.state, 'actor')).toBe(80)
    else
      expect(
        result.state.statusState
          .find((x) => x.combatantId === 'actor')!
          .statuses.find((x) => x.statusId === 'guarded'),
      ).toMatchObject({ potencyBasisPoints: 3000 })
  }
})

it.each([
  ['twinfang-blade', 'quickstep', 15],
  ['stormcaller-staff', 'storm-ward', 25],
  ['emberbrand', 'kindle', 20],
] as const)(
  'executes selectable %s Support through the real command and cooldown',
  (id, behaviorId, cost) => {
    const r = ready([id])
    expect(r.sources[0]!.definition.behaviors.map((b) => b.id)).not.toContain(behaviorId)
    const capture: BattleEquipmentCapture = {
      ...r.capture,
      selectedSupport: { kind: 'equipment', position: 'main-hand', itemId: id, behaviorId },
    }
    const source = captureEquipmentAbilitySource(capture, capture.equipment[0]!, 'actor')!
    const state = activateCombatAbilitySources(
      ready([]).state,
      [source],
      PV1F_COMBAT_CONTENT,
      true,
    ).state
    const command = input(state, source, behaviorId)
    expect(prepareCombatAbilityCommand(command).evaluation.legal).toBe(true)
    const result = commitCombatAbilityCommand(command)
    expect(ap(result.state)).toBe(100 - cost)
    expect(
      prepareCombatAbilityCommand(
        input(JSON.parse(JSON.stringify(result.state)), source, behaviorId),
      ).evaluation.legal,
    ).toBe(false)
    if (id === 'stormcaller-staff') expect(currentBarrierAmount(result.state, 'actor')).toBe(80)
    else {
      const status = result.state.statusState
        .find((row) => row.combatantId === 'actor')!
        .statuses.find((status) => status.statusId === (id === 'emberbrand' ? 'inspired' : 'haste'))
      expect(status).toMatchObject(
        id === 'emberbrand' ? { potencyBasisPoints: 1000 } : { movementApAdjustment: 5 },
      )
      if (id === 'twinfang-blade') {
        const moved = executePv1fMovement(result.state as ReturnType<typeof fixture>, [
          { x: 1, y: 1 },
          { x: 0, y: 1 },
        ])
        expect(ap(moved.state)).toBe(70)
      }
    }
    expect(
      compileEquipmentAbility(capture, capture.equipment[0]!).behaviors.filter(
        (b) => b.id === behaviorId,
      ),
    ).toHaveLength(1)
  },
)
it.each([
  ['whetstone-charm', 'higher'],
  ['ironbark-tonic', 'lower'],
  ['vulnerability-oil', 'higher'],
] as const)('%s changes actual subsequent Discipline damage', (id, direction) => {
  const r = ready([id]),
    strike = captured('vanguard.forceful-strike')
  const state = activateCombatAbilitySources(
    r.state,
    [...r.sources, strike],
    PV1F_COMBAT_CONTENT,
    true,
  ).state
  const baseline = damage(commitCombatAbilityCommand(input(state, strike)).events).reduce(
    (a, b) => a + b,
    0,
  )
  const applied = commitCombatAbilityCommand(input(state, r.sources[0]!))
  const actual = damage(commitCombatAbilityCommand(input(applied.state, strike)).events).reduce(
    (a, b) => a + b,
    0,
  )
  if (direction === 'higher') expect(actual).toBeGreaterThan(baseline)
  else expect(actual).toBeLessThan(baseline)
})
it('Swiftleaf Tea reduces paid ordinary Move AP while preserving movement accounting', () => {
  const r = ready(['swiftleaf-tea'])
  const used = commitCombatAbilityCommand(input(r.state, r.sources[0]!))
  const moved = executePv1fMovement(used.state as ReturnType<typeof fixture>, [
    { x: 1, y: 1 },
    { x: 0, y: 1 },
  ])
  expect(ap(used.state)).toBe(75)
  expect(ap(moved.state)).toBe(65)
})

it('Iron Shortsword reaches distance two where unarmed cannot attack', () => {
  const sword = ready(['iron-shortsword'])
  for (const placement of sword.state.tactical.placements) {
    if (placement.combatantId === 'actor') placement.position = { x: 0, y: 1 }
    if (placement.combatantId === 'enemy') placement.position = { x: 2, y: 1 }
  }
  const command = input(sword.state, sword.sources[0]!)
  expect(prepareCombatAbilityCommand(command).evaluation.legal).toBe(true)
  const result = commitCombatAbilityCommand(command)
  expect(damage(result.events)).toEqual([23])
  expect(ap(result.state)).toBe(70)
  const unarmed = captureBasicSkillSources({
    ownerCombatantId: 'actor',
    supportActionId: 'basic.recover',
    definitions: defaultBasicSkills(),
  }).find((source) => source.basic?.id === 'unarmed.basic')!
  const unarmedState = activateCombatAbilitySources(
    ready([]).state,
    [unarmed],
    PV1F_COMBAT_CONTENT,
    true,
  ).state
  for (const placement of unarmedState.tactical.placements) {
    if (placement.combatantId === 'actor') placement.position = { x: 0, y: 1 }
    if (placement.combatantId === 'enemy') placement.position = { x: 2, y: 1 }
  }
  const rejected = prepareCombatAbilityCommand(input(unarmedState, unarmed)).evaluation
  expect(rejected.legal).toBe(false)
  expect(rejected.issues).toContainEqual(expect.objectContaining({ code: 'target-out-of-range' }))
})

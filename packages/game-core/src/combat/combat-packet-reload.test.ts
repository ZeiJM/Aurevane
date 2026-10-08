import { expect, it } from 'vitest'
import {
  executeCombatAction,
  endCombatTurn,
  validateCombatEncounterState,
  type CombatActionDefinition,
  type CombatEncounterState,
} from './actions'
import { percentageDotEncounter } from './combat-percentage-dots.test-utils'
import { selectCurrentFinalFacing } from './board'
const content = { statuses: [] }
function state(): CombatEncounterState {
  const base = percentageDotEncounter()
  return {
    ...base,
    skillPacketPolicyVersion: 1,
    statBalancePolicyVersion: 1,
    effectTimingPolicy: { version: 2, modes: { damage: 'delayed', bleed: 'delayed' } },
    statBridge: {
      ...base.statBridge,
      schemaVersion: 4,
      rulesVersion: 4,
      combatants: base.statBridge.combatants.map((p) => ({
        ...p,
        level: 1,
        accuracy: 5000,
        criticalChance: 7500,
        statusResistance: 1000,
      })),
    },
  }
}
const action: CombatActionDefinition = {
  id: 'test.packet-reload',
  version: 1,
  sourceType: 'discipline-skill',
  tags: ['attack'],
  accuracyMode: 'per-target',
  cost: { mp: 3, spendsAction: false },
  requirements: [],
  target: {
    kind: 'unit',
    teamPolicy: 'enemy',
    shape: { kind: 'single' },
    minimumRange: 0,
    maximumRange: 5,
    maximumElevationDifference: null,
    requiresLineOfSight: false,
    friendlyFire: 'enemies-only',
  },
  effects: [
    ...Array.from({ length: 7 }, () => ({
      type: 'damage' as const,
      recipient: 'primary-unit' as const,
      amount: 9,
    })),
    {
      type: 'bleed',
      recipient: 'primary-unit',
      ticks: 3,
      damageProfile: { kind: 'attack-percentage', basisPoints: 2000 },
    },
  ],
}
it('pins partial packet hits and criticals through Delayed activation and captures actual DoT command damage', () => {
  const result = executeCombatAction(
    state(),
    action,
    { kind: 'unit', combatantId: 'enemy' },
    content,
  )
  const hits = result.events.filter(
    (e) => e.event === 'combat_accuracy_resolved' && e.hit && e.effectOrdinals !== undefined,
  )
  expect(result.events.filter((e) => e.event === 'combat_accuracy_resolved')).toHaveLength(8)
  expect(result.state.pendingEffects!.filter((e) => e.effect.type === 'damage')).toHaveLength(
    hits.filter((e) => e.event === 'combat_accuracy_resolved' && e.effectOrdinals![0]! < 7).length,
  )
  let loaded = JSON.parse(JSON.stringify(result.state)) as CombatEncounterState
  expect(validateCombatEncounterState(loaded)).toEqual([])
  const draws = loaded.tactical.battle.rng.draws
  const events: unknown[] = []
  while (loaded.tactical.battle.round < 3) {
    const r = endCombatTurn(
      { ...loaded, tactical: selectCurrentFinalFacing(loaded.tactical, 'west').state },
      content,
    )
    loaded = r.state
    events.push(...r.events)
  }
  expect(loaded.tactical.battle.rng.draws).toBe(draws)
  expect(
    events.filter((e) => (e as { event: string }).event === 'combat_accuracy_resolved'),
  ).toHaveLength(0)
  const damage = events.filter((e) => (e as { event: string }).event === 'damage_applied') as {
    amount: number
  }[]
  const total = damage.reduce((n, e) => n + e.amount, 0)
  expect(loaded.effectState?.bleed).toHaveLength(1)
  for (const bleed of loaded.effectState!.bleed)
    expect(bleed.percentageDamage!.capturedDamage).toBe(total)
  expect(loaded.pendingEffects).toHaveLength(0)
  expect(loaded.tactical.battle.combatants.find((u) => u.id === 'actor')!.mp).toBe(17)
})
it('finishes a lethal multi-hit command once without duplicated battle-completion receipts', () => {
  const initial = state()
  initial.effectTimingPolicy = { version: 2, modes: { damage: 'instant' } }
  initial.statBridge!.combatants = initial.statBridge!.combatants.map((p) => ({
    ...p,
    accuracy: 10000,
    criticalChance: 0,
  }))
  initial.tactical.battle.combatants = initial.tactical.battle.combatants.map((u) => ({
    ...u,
    hp: u.id === 'enemy' ? 1 : u.teamId === 'enemies' ? 0 : u.hp,
  }))
  const result = executeCombatAction(
    initial,
    { ...action, effects: action.effects.slice(0, 7) },
    { kind: 'unit', combatantId: 'enemy' },
    content,
  )
  expect(result.state.tactical.battle.lifecycle).toBe('completed')
  expect(result.events.filter((e) => e.event === 'battle_completed')).toHaveLength(1)
  expect(result.state.pendingEffects ?? []).toHaveLength(0)
})

it('aggregates delayed damage before one Absorb/Reflect pass and settles dependent DoT before source defeat', () => {
  let initial = state()
  initial.tactical.battle.combatants.find((unit) => unit.id === 'actor')!.hp = 1
  initial.statBridge!.combatants = initial.statBridge!.combatants.map((p) => ({
    ...p,
    accuracy: 10000,
    criticalChance: 0,
    statusResistance: 0,
  }))
  const status = {
    polarity: 'positive' as const,
    reactionClass: 'reactive' as const,
    id: 'test.delayed-reactions',
    version: 1,
    maximumStacks: 1,
    durationOwnerTurnStarts: 10,
    damageTakenMultiplierBasisPoints: 10000,
    absorbHpBasisPoints: 1000,
    reflectBasisPoints: 5000,
  }
  const catalog = { statuses: [status] }
  initial.statusState = initial.statusState.map((r) =>
    r.combatantId === 'enemy'
      ? {
          ...r,
          statuses: [
            {
              statusId: status.id,
              statusVersion: 1,
              stacks: 1,
              remainingOwnerTurnStarts: 10,
              sourceCombatantId: 'enemy',
            },
          ],
        }
      : r,
  )
  initial = executeCombatAction(
    initial,
    {
      ...action,
      effects: [
        { type: 'damage', recipient: 'primary-unit', amount: 1 },
        { type: 'damage', recipient: 'primary-unit', amount: 1 },
        {
          type: 'bleed',
          recipient: 'primary-unit',
          ticks: 3,
          damageProfile: { kind: 'attack-percentage', basisPoints: 2000 },
        },
      ],
    },
    { kind: 'unit', combatantId: 'enemy' },
    catalog,
  ).state
  const events: import('./actions').CombatResolutionEvent[] = []
  while (initial.tactical.battle.round < 3) {
    const r = endCombatTurn(
      { ...initial, tactical: selectCurrentFinalFacing(initial.tactical, 'west').state },
      catalog,
    )
    initial = JSON.parse(JSON.stringify(r.state))
    events.push(...r.events)
  }
  const absorb = events.filter(
    (e) => e.event === 'healing_applied' && e.actionId === 'status.absorb-hp.current.v1',
  )
  const reflect = events.filter(
    (e) => e.event === 'damage_applied' && e.actionId === 'status.reflect.current.v1',
  )
  expect(absorb).toHaveLength(1)
  expect(absorb).toContainEqual(expect.objectContaining({ amount: 1 }))
  expect(reflect).toHaveLength(1)
  expect(reflect).toContainEqual(expect.objectContaining({ amount: 1 }))
  expect(initial.effectState!.bleed[0]!.percentageDamage!.capturedDamage).toBe(2)
  expect(validateCombatEncounterState(initial)).toEqual([])
})

it('rejects missing, mismatched and out-of-range persisted packet command identities', () => {
  const cast = executeCombatAction(
    state(),
    action,
    { kind: 'unit', combatantId: 'enemy' },
    content,
  ).state
  for (const corrupt of ['missing', 'range', 'identity', 'sequence']) {
    const loaded = JSON.parse(JSON.stringify(cast)) as CombatEncounterState
    if (corrupt === 'missing') delete loaded.pendingEffects![0]!.skillPacketCommandId
    if (corrupt === 'range') loaded.pendingEffects![0]!.skillPacketCommandId = 0
    if (corrupt === 'identity') loaded.pendingEffects![0]!.actorId = 'ally'
    if (corrupt === 'sequence') loaded.nextSkillPacketCommandId = 1
    expect(validateCombatEncounterState(loaded).length).toBeGreaterThan(0)
  }
})

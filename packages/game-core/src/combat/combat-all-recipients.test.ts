import { expect, it } from 'vitest'
import {
  executeCombatAction,
  evaluateCombatAction,
  validateCombatEncounterState,
  endCombatTurn,
  type CombatActionDefinition,
  type CombatEncounterState,
} from './actions'
import { selectCurrentFinalFacing } from './board'
import { percentageDotEncounter } from './combat-percentage-dots.test-utils'
import {
  PV1F_COMBAT_CONTENT,
  preparePv1fTurnEconomy,
  finishPv1fTurn,
  executePv1fSummonAbility,
} from './pv1f-action-economy'
import { combatEffectRecipientIds } from './combat-effect-recipients'
import { captureCombatAbilitySource } from './combat-behavior-capture'
import { source } from './combat-behavior.test-utils'
import {
  combatAbilityCommandContext,
  reconcileCombatAbilitySources,
} from './combat-behavior-runtime'
import { prepareCombatAbilityCommand, commitCombatAbilityCommand } from './combat-ability-command'
import { resolveMatureSkillVersion } from './mature-skills'
import { spawnCombatSummon } from './combat-summons'
import { createCurrentStatDrivenCombatEncounterState } from './stat-driven-combat'

const aim = {
  kind: 'unit',
  teamPolicy: 'enemy',
  friendlyFire: 'enemies-only',
  shape: { kind: 'single' },
  minimumRange: 1,
  maximumRange: 1,
  maximumSelections: 1,
  requiresLineOfSight: false,
  maximumElevationDifference: 0,
} satisfies CombatActionDefinition['target']
const effects = [
  { type: 'damage', recipient: 'affected-units', target: 'all', amount: 20 },
  { type: 'displace', recipient: 'affected-units', target: 'all', direction: 'push', distance: 8 },
] satisfies CombatActionDefinition['effects']
function action(payloads: CombatActionDefinition['effects'] = effects): CombatActionDefinition {
  return {
    id: 'test.all',
    version: 1,
    sourceType: 'test',
    tags: ['attack'],
    cost: { spendsAction: false, mp: 0 },
    requirements: [],
    target: aim,
    effects: payloads,
  }
}
const selection = { kind: 'unit', combatantId: 'enemy' } as const

it('settles Damage20 and Push8 All on every living unit independently of Enemy Single aim', () => {
  const profile = resolveMatureSkillVersion('wildwarden.renewing-herbs', 6)!.summonProfile!
  const original = percentageDotEncounter()
  const current = createCurrentStatDrivenCombatEncounterState(
    original,
    original.statBridge.combatants.map((row) => ({
      ...row,
      level: 1,
      criticalChance: 0,
      statusResistance: 0,
      physicalPower: 20,
      mysticPower: 20,
    })),
  )
  const base = spawnCombatSummon(current, {
    ownerCombatantId: 'actor',
    sourceSkillId: 'test.summon',
    sourceSkillVersion: 1,
    profile,
    position: { x: 0, y: 3 },
    facing: 'east',
  }).state
  const ids = base.tactical.battle.combatants
    .filter((row) => row.hp > 0)
    .map((row) => row.id)
    .sort()
  const quote = evaluateCombatAction(base, action(), selection, PV1F_COMBAT_CONTENT)
  expect(quote.legal).toBe(true)
  expect(
    quote.projectedEffects
      .filter((row) => row.effectType === 'damage')
      .map((row) => row.combatantId)
      .sort(),
  ).toEqual(ids)
  const result = executeCombatAction(base, action(), selection, PV1F_COMBAT_CONTENT)
  expect(
    result.events
      .flatMap((row) =>
        row &&
        typeof row === 'object' &&
        'event' in row &&
        row.event === 'damage_applied' &&
        'targetCombatantId' in row
          ? [row.targetCombatantId]
          : [],
      )
      .sort(),
  ).toEqual(ids)
  expect(
    result.events
      .flatMap((row) =>
        row.event === 'combatant_displaced' || row.event === 'displacement_failed'
          ? [row.combatantId]
          : [],
      )
      .sort(),
  ).toEqual(ids)
  expect(result.events).toContainEqual(
    expect.objectContaining({
      event: 'displacement_failed',
      combatantId: 'actor',
      reason: 'direction-undefined',
    }),
  )
  expect(validateCombatEncounterState(JSON.parse(JSON.stringify(result.state)))).toEqual([])
})

it('settles the complete All damage packet before a lethal caster receives its Draw verdict', () => {
  const base = percentageDotEncounter()
  const state = {
    ...base,
    tactical: {
      ...base.tactical,
      battle: {
        ...base.tactical.battle,
        combatants: base.tactical.battle.combatants.map((row) => ({
          ...row,
          hp: ['actor', 'enemy'].includes(row.id) ? 5 : 0,
        })),
      },
    },
  }
  const result = executeCombatAction(state, action([effects[0]!]), selection, PV1F_COMBAT_CONTENT)
  expect(
    result.events
      .flatMap((row) => (row.event === 'damage_applied' ? [row.targetCombatantId] : []))
      .sort(),
  ).toEqual(['actor', 'enemy'])
  expect(result.state.tactical.battle.lifecycle).toBe('completed')
  expect(result.events).toContainEqual(
    expect.objectContaining({ event: 'battle_completed', winningTeamId: null }),
  )
  expect(validateCombatEncounterState(JSON.parse(JSON.stringify(result.state)))).toEqual([])
})

it('preserves explicit packet targets other than All and excludes defeated units', () => {
  const state = percentageDotEncounter()
  const selected = [{ x: 2, y: 1 }]
  for (const [target, ids] of [
    ['enemy', ['enemy']],
    ['ally', []],
    ['anyone', ['enemy']],
  ] as const)
    expect(
      combatEffectRecipientIds(
        state,
        'actor',
        'enemy',
        ['enemy'],
        selected,
        { ...effects[0]!, target },
        aim,
        PV1F_COMBAT_CONTENT,
      ),
    ).toEqual(ids)
  const defeated = {
    ...state,
    tactical: {
      ...state.tactical,
      battle: {
        ...state.tactical.battle,
        combatants: state.tactical.battle.combatants.map((row) =>
          row.id === 'other' ? { ...row, hp: 0 } : row,
        ),
      },
    },
  }
  expect(
    combatEffectRecipientIds(
      defeated,
      'actor',
      'enemy',
      ['enemy'],
      selected,
      effects[0]!,
      aim,
      PV1F_COMBAT_CONTENT,
    ).sort(),
  ).toEqual(['actor', 'ally', 'enemy'])
})

it('retains All recipients through canonical capture and reload without broadening local packets', () => {
  const captured = captureCombatAbilitySource(
    source({
      targeting: aim,
      costs: [],
      accuracy: { kind: 'fixed', chanceBasisPoints: 10000 },
      effects: [
        { id: 'hit', timing: 'instant', payload: effects[0]! },
        { id: 'push', timing: 'instant', payload: effects[1]! },
        {
          id: 'enemy-slow',
          timing: 'instant',
          payload: {
            type: 'apply-status',
            recipient: 'affected-units',
            target: 'enemy',
            statusId: 'slow',
            stacks: 1,
          },
        },
      ],
    }),
  )
  const state = reconcileCombatAbilitySources(preparePv1fTurnEconomy(percentageDotEncounter()), [
    captured,
  ])
  const restored = JSON.parse(JSON.stringify(state)) as typeof state
  const input = {
    state: restored,
    actorId: 'actor',
    root: { kind: 'canonical' as const, source: captured },
    selection,
    content: PV1F_COMBAT_CONTENT,
    context: combatAbilityCommandContext(restored, captured),
  }
  expect(prepareCombatAbilityCommand(input).evaluation.legal).toBe(true)
  const result = commitCombatAbilityCommand(input)
  expect(
    result.events
      .flatMap((row) => (row.event === 'damage_applied' ? [row.targetCombatantId] : []))
      .sort(),
  ).toEqual(['actor', 'ally', 'enemy', 'other'])
  expect(
    result.events.flatMap((row) =>
      row.event === 'status_applied' && row.statusId === 'slow' ? [row.targetCombatantId] : [],
    ),
  ).toEqual(['enemy'])
})

it.each([false, true])(
  'settles canonical lethal All damage atomically with current stat policy %s',
  (currentPolicy) => {
    const original = percentageDotEncounter()
    const base = currentPolicy
      ? {
          ...createCurrentStatDrivenCombatEncounterState(
            original,
            original.statBridge.combatants.map((row) => ({
              ...row,
              level: 1,
              criticalChance: 0,
              statusResistance: 0,
              physicalPower: 20,
              mysticPower: 20,
            })),
          ),
          statBalancePolicyVersion: 1 as const,
        }
      : original
    const captured = captureCombatAbilitySource(
      source({
        costs: [],
        targeting: aim,
        accuracy: { kind: 'fixed', chanceBasisPoints: 10000 },
        effects: [{ id: 'hit', timing: 'instant', payload: effects[0]! }],
      }),
    )
    const state = reconcileCombatAbilitySources(
      preparePv1fTurnEconomy({
        ...base,
        tactical: {
          ...base.tactical,
          battle: {
            ...base.tactical.battle,
            combatants: base.tactical.battle.combatants.map((row) => ({
              ...row,
              hp: ['actor', 'enemy'].includes(row.id) ? 5 : 0,
            })),
          },
        },
      }),
      [captured],
    )
    const result = commitCombatAbilityCommand({
      state,
      actorId: 'actor',
      root: { kind: 'canonical', source: captured },
      selection,
      content: PV1F_COMBAT_CONTENT,
      context: combatAbilityCommandContext(state, captured),
    })
    expect(
      result.events
        .flatMap((row) => (row.event === 'damage_applied' ? [row.targetCombatantId] : []))
        .sort(),
    ).toEqual(['actor', 'enemy'])
    expect(result.events).toContainEqual(
      expect.objectContaining({ event: 'battle_completed', winningTeamId: null }),
    )
    expect(validateCombatEncounterState(JSON.parse(JSON.stringify(result.state)))).toEqual([])
  },
)

it('preserves already captured narrower All recipients through a historical pending activation', () => {
  const initial = {
    ...percentageDotEncounter(),
    effectTimingPolicy: { version: 1 as const, modes: { damage: 'next-round' as const } },
  }
  const cast = executeCombatAction(initial, action([effects[0]!]), selection, PV1F_COMBAT_CONTENT)
  let state = JSON.parse(
    JSON.stringify({
      ...cast.state,
      pendingEffects: cast.state.pendingEffects!.map((row) => ({
        ...row,
        recipientIds: ['enemy', 'other'],
      })),
    }),
  ) as CombatEncounterState
  expect(validateCombatEncounterState(state)).toEqual([])
  const ids: string[] = []
  for (let i = 0; i < 4; i++) {
    const next = endCombatTurn(
      { ...state, tactical: selectCurrentFinalFacing(state.tactical, 'east').state },
      PV1F_COMBAT_CONTENT,
    )
    ids.push(
      ...next.events.flatMap((row) =>
        row.event === 'damage_applied' ? [row.targetCombatantId] : [],
      ),
    )
    state = next.state
  }
  expect(ids).toEqual(['enemy', 'other'])
})

it('keeps ordinary explicit Self damage rejected', () => {
  const quote = evaluateCombatAction(
    percentageDotEncounter(),
    action([{ type: 'damage', recipient: 'actor', target: 'self', amount: 20 }]),
    selection,
    PV1F_COMBAT_CONTENT,
  )
  expect(quote.issues).toContainEqual(expect.objectContaining({ code: 'self-damage-deferred' }))
})

it('applies All debuffs, HP/MP recovery and removal to both teams and the caster', () => {
  const base = percentageDotEncounter()
  const state = {
    ...base,
    tactical: {
      ...base.tactical,
      battle: {
        ...base.tactical.battle,
        combatants: base.tactical.battle.combatants.map((row) => ({ ...row, hp: 900, mp: 5 })),
      },
    },
  }
  const result = executeCombatAction(
    state,
    action([
      {
        type: 'apply-status',
        recipient: 'affected-units',
        target: 'all',
        statusId: 'slow',
        stacks: 1,
        durationTurns: 2,
      },
      { type: 'healing', recipient: 'affected-units', target: 'all', amount: 10 },
      {
        type: 'percentage-recovery',
        recipient: 'affected-units',
        target: 'all',
        resource: 'mp',
        percent: 20,
      },
      { type: 'remove-status', recipient: 'affected-units', target: 'all', statusIds: ['slow'] },
    ]),
    selection,
    PV1F_COMBAT_CONTENT,
  )
  expect(
    result.events
      .flatMap((row) =>
        row.event === 'status_applied' && row.statusId === 'slow' ? [row.targetCombatantId] : [],
      )
      .sort(),
  ).toEqual(['actor', 'ally', 'enemy', 'other'])
  expect(
    result.state.tactical.battle.combatants.every((row) => row.hp === 910 && row.mp === 9),
  ).toBe(true)
  expect(
    result.state.statusState.every(
      (row) => !row.statuses.some((status) => status.statusId === 'slow'),
    ),
  ).toBe(true)
  expect(validateCombatEncounterState(result.state)).toEqual([])
})

it('keeps All target semantics in a captured native Summon ability', () => {
  const base = percentageDotEncounter()
  const initial = createCurrentStatDrivenCombatEncounterState(
    base,
    base.statBridge.combatants.map((row) => ({
      ...row,
      level: 1,
      criticalChance: 0,
      physicalPower: 20,
      mysticPower: 20,
    })),
  )
  const template = resolveMatureSkillVersion('wildwarden.renewing-herbs', 6)!.summonProfile!
  const ability = {
    ...template.abilities[0]!,
    tags: ['attack'],
    apCost: 20,
    target: { ...aim, maximumRange: 20 },
    effects,
  }
  let state = spawnCombatSummon(initial, {
    ownerCombatantId: 'actor',
    sourceSkillId: 'test.all-summon',
    sourceSkillVersion: 1,
    profile: {
      ...template,
      maxHp: 1000,
      stats: { ...template.stats, accuracy: 10000 },
      abilities: [ability],
    },
    position: { x: 0, y: 3 },
    facing: 'east',
  }).state
  const summon = state.effectState!.summons![0]!
  for (
    let i = 0;
    i < 10 && state.tactical.battle.currentTurn?.combatantId !== summon.combatantId;
    i++
  )
    state = finishPv1fTurn(state, 'east').state
  expect(state.tactical.battle.currentTurn?.combatantId).toBe(summon.combatantId)
  const ids = state.tactical.battle.combatants
    .filter((row) => row.hp > 0)
    .map((row) => row.id)
    .sort()
  const result = executePv1fSummonAbility(
    JSON.parse(JSON.stringify(state)),
    summon,
    ability.id,
    selection,
  )
  expect(
    result.events
      .flatMap((row) =>
        row &&
        typeof row === 'object' &&
        'event' in row &&
        row.event === 'damage_applied' &&
        'targetCombatantId' in row
          ? [row.targetCombatantId]
          : [],
      )
      .sort(),
  ).toEqual(ids)
  expect(validateCombatEncounterState(result.state)).toEqual([])
})

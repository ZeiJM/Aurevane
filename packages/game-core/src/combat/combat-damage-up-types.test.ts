import { expect, it } from 'vitest'
import { executeCombatAction, type CombatEncounterState } from './actions'
import { source } from './combat-behavior.test-utils'
import { percentageDotEncounter } from './combat-percentage-dots.test-utils'
import {
  materializeCombatAbilityAction,
  reconcileCombatAbilitySources,
  combatAbilityCommandContext,
} from './combat-behavior-runtime'
import { commitCombatAbilityCommand } from './combat-ability-command'
import { PV1F_COMBAT_CONTENT } from './pv1f-combat-content'
import { validateCombatTagPayload } from './combat-tag-registry'

const types = ['pierce', 'fire', 'water', 'ice', 'storm'] as const
const scopes = [
  undefined,
  ...Array.from({ length: 31 }, (_, mask) => types.filter((_, i) => (mask + 1) & (1 << i))),
]
const packets = [
  { element: 'fire' as const },
  { element: 'water' as const },
  { element: 'ice' as const },
  { element: 'storm' as const },
  {},
  { piercing: true },
  { piercing: true, element: 'fire' as const },
]
const target = { kind: 'unit' as const, combatantId: 'enemy' }
function attack(effects: readonly object[]) {
  const root = source({ costs: [] })
  return {
    ...materializeCombatAbilityAction(root, root.definition.behaviors[0]!),
    effectTimingModes: undefined,
    effectOrigins: undefined,
    effects,
  } as ReturnType<typeof materializeCombatAbilityAction>
}
const damagePackets = packets.map((packet) => ({
  type: 'damage',
  recipient: 'primary-unit',
  amount: 10,
  ...packet,
}))
function expected(scope: (typeof scopes)[number]) {
  return packets.map((packet) =>
    !scope ||
    (packet.piercing ? scope.includes('pierce') : false) ||
    (packet.element ? scope.includes(packet.element) : false)
      ? 15
      : 10,
  )
}
function damage(out: ReturnType<typeof executeCombatAction>) {
  return out.events.filter((event) => event.event === 'damage_applied').map((event) => event.amount)
}
it.each(scopes.map((damageTypes) => ({ damageTypes })))(
  'settles only selected Damage Up packet types for scope $damageTypes and retains captured tuning',
  ({ damageTypes }) => {
    const action = attack([
      {
        type: 'apply-status',
        recipient: 'actor',
        statusId: 'inspired',
        stacks: 1,
        durationTurns: 3,
        potencyBasisPoints: 5000,
        ...(damageTypes ? { damageTypes } : {}),
      },
      ...damagePackets,
    ])
    const original = percentageDotEncounter()
    const out = executeCombatAction(original, action, target, PV1F_COMBAT_CONTENT)
    expect(damage(out)).toEqual(expected(damageTypes))
    const captured = out.state.statusState
      .find((row) => row.combatantId === 'actor')!
      .statuses.find((row) => row.statusId === 'inspired')!
    expect(captured.damageTypes).toEqual(damageTypes)
    const reloaded = JSON.parse(JSON.stringify(out.state)) as CombatEncounterState
    expect(
      damage(executeCombatAction(reloaded, attack(damagePackets), target, PV1F_COMBAT_CONTENT)),
    ).toEqual(expected(damageTypes))
    expect(original.statusState.find((row) => row.combatantId === 'actor')?.statuses ?? []).toEqual(
      [],
    )
  },
)
it.each(['ongoing', 'manual', 'automatic'] as const)(
  'enforces selected canonical %s Damage Up in actual packet settlement',
  (activation) => {
    const root = source({ costs: [] })
    const modifier = source(
      {
        activation,
        mode: 'modifier',
        targeting: null,
        costs: [],
        requirements:
          activation === 'automatic'
            ? { kind: 'event', eventType: 'combat_action_used', phase: 'before' }
            : null,
        effects: [
          {
            id: 'bonus',
            payload: {
              type: 'damage-bonus',
              recipient: 'actor',
              multiplierBasisPoints: 15000,
              damageTypes: ['pierce', 'fire'],
            },
          },
        ],
      },
      'scoped-amplifier',
    )
    const state = reconcileCombatAbilitySources(percentageDotEncounter(), [modifier])
    const action = attack(damagePackets)
    const out =
      activation === 'ongoing'
        ? executeCombatAction(state, action, target, PV1F_COMBAT_CONTENT)
        : commitCombatAbilityCommand({
            state,
            actorId: 'actor',
            root: {
              kind: 'native',
              action,
              sourceInstanceId: 'native',
              costs: [],
              classification: 'attack',
              attackFamily: 'physical',
            },
            selection: target,
            content: PV1F_COMBAT_CONTENT,
            context: combatAbilityCommandContext(state, root),
            manualModifiers:
              activation === 'manual'
                ? [{ sourceInstanceId: modifier.sourceInstanceId, behaviorId: 'strike' }]
                : undefined,
          })
    expect(damage(out)).toEqual(expected(['pierce', 'fire']))
  },
)
it.each([[], ['fire', 'fire'], ['earth'], ['all', 'fire']].map((damageTypes) => ({ damageTypes })))(
  'rejects malformed scopes $damageTypes',
  ({ damageTypes }) => {
    expect(
      validateCombatTagPayload({
        type: 'apply-status',
        recipient: 'actor',
        statusId: 'inspired',
        stacks: 1,
        durationTurns: 2,
        damageTypes,
      }),
    ).not.toEqual([])
    expect(
      validateCombatTagPayload({
        type: 'damage-bonus',
        recipient: 'actor',
        multiplierBasisPoints: 15000,
        damageTypes,
      }),
    ).not.toEqual([])
  },
)
it('rejects scopes on other statuses and conflicting legacy scalar scopes', () => {
  expect(
    validateCombatTagPayload({
      type: 'apply-status',
      recipient: 'actor',
      statusId: 'hexed',
      stacks: 1,
      durationTurns: 2,
      damageTypes: ['fire'],
    }),
  ).not.toEqual([])
  expect(
    validateCombatTagPayload({
      type: 'damage-bonus',
      recipient: 'actor',
      multiplierBasisPoints: 15000,
      elementFilter: 'water',
      damageTypes: ['fire'],
    }),
  ).not.toEqual([])
})

it('retains distinct scopes and percentages through stacked applications and Copy Buffs', async () => {
  const { applyCombatStatusCopies } = await import('./combat-status-copy')
  const { validateCombatEncounterState } = await import('./actions')
  const buffs = [
    {
      type: 'apply-status',
      recipient: 'primary-unit',
      statusId: 'inspired',
      stacks: 1,
      durationTurns: 3,
      potencyBasisPoints: 5000,
      damageTypes: ['fire'],
    },
    {
      type: 'apply-status',
      recipient: 'primary-unit',
      statusId: 'inspired',
      stacks: 1,
      durationTurns: 3,
      potencyBasisPoints: 2000,
      damageTypes: ['water'],
    },
  ]
  let state = executeCombatAction(
    percentageDotEncounter(),
    attack(buffs),
    target,
    PV1F_COMBAT_CONTENT,
  ).state
  state = applyCombatStatusCopies(
    state,
    'actor',
    'enemy',
    'copy-scoped-up',
    {
      type: 'copy-statuses',
      recipient: 'primary-unit',
      mode: 'amplify',
      statusIds: ['inspired'],
      durationPolicyVersion: 1,
    },
    PV1F_COMBAT_CONTENT,
  ).state
  state = JSON.parse(JSON.stringify(state))
  expect(validateCombatEncounterState(state)).toEqual([])
  expect(
    damage(executeCombatAction(state, attack(damagePackets), target, PV1F_COMBAT_CONTENT)),
  ).toEqual([15, 12, 10, 10, 10, 10, 15])
  expect(
    state.statusState
      .find((row) => row.combatantId === 'actor')!
      .statuses.find((row) => row.statusId === 'inspired')!
      .applicationModifiers?.map((row) => row.damageTypes),
  ).toEqual([['fire'], ['water']])
})
it('stops a scoped boost after ordinary Dispel and expiry', async () => {
  const { endCombatTurn } = await import('./actions')
  const { selectCurrentFinalFacing } = await import('./board')
  const buff = {
    type: 'apply-status',
    recipient: 'actor',
    statusId: 'inspired',
    stacks: 1,
    durationTurns: 1,
    potencyBasisPoints: 5000,
    damageTypes: ['fire'],
  }
  let state = executeCombatAction(
    percentageDotEncounter(),
    attack([buff]),
    target,
    PV1F_COMBAT_CONTENT,
  ).state
  expect(
    damage(
      executeCombatAction(
        state,
        attack([
          {
            type: 'remove-status',
            recipient: 'actor',
            selectionKind: 'buffs',
            removalMode: 'specified',
            statusIds: ['inspired'],
          },
          ...damagePackets,
        ]),
        target,
        PV1F_COMBAT_CONTENT,
      ),
    ),
  ).toEqual(packets.map(() => 10))
  for (let i = 0; i < 8; i++)
    state = endCombatTurn(
      { ...state, tactical: selectCurrentFinalFacing(state.tactical, 'west').state },
      PV1F_COMBAT_CONTENT,
    ).state
  expect(
    damage(executeCombatAction(state, attack(damagePackets), target, PV1F_COMBAT_CONTENT)),
  ).toEqual(packets.map(() => 10))
})
it('settles delayed Fire and Water using the captured scoped Damage Up once each', async () => {
  const { captureCombatAbilitySource } = await import('./combat-behavior-capture')
  const { preparePv1fTurnEconomy } = await import('./pv1f-action-economy')
  const { endCombatTurn } = await import('./actions')
  const { selectCurrentFinalFacing } = await import('./board')
  const delayed = captureCombatAbilitySource(
    source({
      costs: [],
      effects: [
        ...['fire', 'water'].map((element, index) => ({
          id: `hit-${index}`,
          timing: 'next-round' as const,
          payload: {
            type: 'damage' as const,
            recipient: 'primary-unit' as const,
            amount: 10,
            element: element as 'fire' | 'water',
          },
        })),
        {
          id: 'fire-cleanse',
          timing: 'instant',
          payload: { type: 'remove-status', recipient: 'actor', statusIds: ['frozen'] },
        },
        {
          id: 'water-drenched',
          timing: 'instant',
          payload: {
            type: 'apply-status',
            recipient: 'primary-unit',
            statusId: 'wet',
            stacks: 1,
            durationTurns: 2,
            potencyBasisPoints: 2000,
          },
        },
      ],
    }),
  )
  let state = reconcileCombatAbilitySources(
    preparePv1fTurnEconomy({
      ...percentageDotEncounter(),
      effectTimingPolicy: { version: 1, modes: { inspired: 'instant' } },
    }),
    [delayed],
  )
  state = executeCombatAction(
    state,
    attack([
      {
        type: 'apply-status',
        recipient: 'actor',
        statusId: 'inspired',
        stacks: 1,
        durationTurns: 5,
        potencyBasisPoints: 5000,
        damageTypes: ['fire'],
      },
    ]),
    target,
    PV1F_COMBAT_CONTENT,
  ).state
  state = commitCombatAbilityCommand({
    state,
    actorId: 'actor',
    root: { kind: 'canonical', source: delayed },
    selection: target,
    content: PV1F_COMBAT_CONTENT,
    context: combatAbilityCommandContext(state, delayed),
  }).state
  expect(state.pendingEffects).toHaveLength(2)
  const amounts: number[] = []
  for (let i = 0; i < 4; i++) {
    const out = endCombatTurn(
      { ...state, tactical: selectCurrentFinalFacing(state.tactical, 'west').state },
      PV1F_COMBAT_CONTENT,
    )
    state = out.state
    amounts.push(...damage(out))
  }
  expect(amounts).toEqual([15, 10])
})

it('boosts the canonical Pierce opcode rather than relying on its displayed name', () => {
  const root = source({
    costs: [],
    effects: [
      {
        id: 'actual-pierce',
        payload: {
          type: 'pierce',
          recipient: 'primary-unit',
          amount: 10,
          armorIgnoredBasisPoints: 10000,
        },
      },
    ],
  })
  let state = reconcileCombatAbilitySources(percentageDotEncounter(), [root])
  state = executeCombatAction(
    state,
    attack([
      {
        type: 'apply-status',
        recipient: 'actor',
        statusId: 'inspired',
        stacks: 1,
        durationTurns: 3,
        potencyBasisPoints: 5000,
        damageTypes: ['pierce'],
      },
    ]),
    target,
    PV1F_COMBAT_CONTENT,
  ).state
  const out = commitCombatAbilityCommand({
    state,
    actorId: 'actor',
    root: { kind: 'canonical', source: root },
    selection: target,
    content: PV1F_COMBAT_CONTENT,
    context: combatAbilityCommandContext(state, root),
  })
  expect(damage(out)).toEqual([15])
})
it('does not amplify an already captured Burn tick with scoped Damage Up', async () => {
  const { applyCurrentBurnState } = await import('./combat-dots')
  const { finishPv1fTurn } = await import('./pv1f-action-economy')
  let state = executeCombatAction(
    percentageDotEncounter(),
    attack([
      {
        type: 'apply-status',
        recipient: 'actor',
        statusId: 'inspired',
        stacks: 1,
        durationTurns: 3,
        potencyBasisPoints: 5000,
        damageTypes: ['fire'],
      },
    ]),
    target,
    PV1F_COMBAT_CONTENT,
  ).state
  state = applyCurrentBurnState(state, 'actor', 'enemy', 'captured-burn', false, undefined, 2, {
    capturedDamage: 100,
    profile: { kind: 'attack-percentage', basisPoints: 1500 },
  })
  const amounts: number[] = []
  while (state.tactical.battle.round === 1) {
    const out = finishPv1fTurn(state as never, 'east')
    state = out.state
    amounts.push(...damage(out as ReturnType<typeof executeCombatAction>))
  }
  expect(amounts).toEqual([15])
})

it('retains selected command Damage Up on persistent Ground placement and reload pulses', async () => {
  const { endCombatTurn, validateCombatEncounterState } = await import('./actions')
  const { selectCurrentFinalFacing } = await import('./board')
  const bonus = {
    sourceInstanceId: 'ground-bonus',
    contentId: 'ground-bonus',
    contentVersion: 1,
    behaviorId: 'bonus',
    effectId: 'bonus',
    multiplierBasisPoints: 15000,
    damageTypes: ['fire'] as const,
  }
  const base = attack([
    { type: 'damage', recipient: 'affected-units', amount: 10, element: 'fire' },
  ])
  const action = {
    ...base,
    commandDamageBonuses: [bonus],
    target: { ...base.target, kind: 'ground-tile' as const },
    groundArea: {
      durationRounds: 3,
      visualPresetId: 'embers' as const,
      entryEffectOrdinals: [0],
      timing: 'instant' as const,
    },
  }
  const initial = {
    ...percentageDotEncounter(),
    groundEffectPolicyVersion: 1 as const,
    groundContactPolicyVersion: 1 as const,
    effectTimingPolicy: { version: 1, modes: { 'ground-area': 'instant' as const } },
  }
  const placed = executeCombatAction(
    initial,
    action,
    { kind: 'tile', position: { x: 2, y: 1 } },
    PV1F_COMBAT_CONTENT,
  )
  expect(damage(placed)).toEqual([15])
  let state = JSON.parse(JSON.stringify(placed.state)) as CombatEncounterState
  expect(state.groundAreas![0]!.commandDamageBonuses).toEqual([bonus])
  expect(validateCombatEncounterState(state)).toEqual([])
  const amounts: number[] = []
  for (let i = 0; i < 4; i++) {
    const out = endCombatTurn(
      { ...state, tactical: selectCurrentFinalFacing(state.tactical, 'west').state },
      PV1F_COMBAT_CONTENT,
    )
    state = out.state
    amounts.push(...damage(out))
  }
  expect(amounts.length).toBeGreaterThan(0)
  expect(amounts.every((amount) => amount === 15)).toBe(true)
  const forged = JSON.parse(JSON.stringify(state))
  forged.groundAreas[0].commandDamageBonuses[0].damageTypes = ['unknown']
  expect(validateCombatEncounterState(forged)).not.toEqual([])
})

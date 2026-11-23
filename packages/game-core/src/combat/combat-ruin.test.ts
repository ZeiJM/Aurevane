import { describe, expect, it } from 'vitest'
import {
  executeCombatAction,
  evaluateCombatAction,
  validateCombatEncounterState,
  type CombatActionDefinition,
  type CombatEffectDefinition,
  type CombatEncounterState,
} from './actions'
import { percentageDotEncounter } from './combat-percentage-dots.test-utils'
import { PV1F_COMBAT_CONTENT as content } from './pv1f-combat-content'
import { grantBarrier } from './combat-barrier'
const target = { kind: 'unit', combatantId: 'enemy' } as const
function encounter(current = true): CombatEncounterState {
  return {
    ...percentageDotEncounter(),
    ...(current ? { ruinPolicyVersion: 1 } : {}),
    effectTimingPolicy: { version: 1, modes: {} },
  } as CombatEncounterState
}
function command(effects: readonly CombatEffectDefinition[], ruin = true): CombatActionDefinition {
  return {
    id: 'test.ruin',
    version: 1,
    sourceType: 'test',
    tags: ['attack', 'physical'],
    target: {
      kind: 'unit',
      teamPolicy: 'enemy',
      friendlyFire: 'enemies-only',
      shape: { kind: 'single' },
      minimumRange: 1,
      maximumRange: 4,
      requiresLineOfSight: false,
      maximumElevationDifference: null,
    },
    cost: { spendsAction: false, mp: 0 },
    requirements: [],
    accuracyRule: { kind: 'fixed', chanceBasisPoints: 10000 },
    effectTimingModes: [
      ...effects.map(() => 'instant' as const),
      ...(ruin ? ['instant' as const] : []),
    ],
    effects: [
      ...effects,
      ...(ruin
        ? [{ type: 'ruin', recipient: 'actor', bonusPerDebuffBasisPoints: 5000 } as const]
        : []),
    ],
  }
}
const damage = { type: 'damage', recipient: 'primary-unit', target: 'enemy', amount: 20 } as const
const slow = {
  type: 'apply-status',
  recipient: 'primary-unit',
  target: 'enemy',
  statusId: 'slow',
  stacks: 1,
  durationTurns: 2,
  movementApAdjustment: 10,
} as const
const root = {
  type: 'apply-status',
  recipient: 'primary-unit',
  target: 'enemy',
  statusId: 'root',
  stacks: 1,
  durationTurns: 2,
} as const
function cast(state: CombatEncounterState, action = command([damage])) {
  return executeCombatAction(state, action, target, content)
}
function seed(current = true) {
  return cast(encounter(current), command([slow, root], false)).state
}
const hp = (state: CombatEncounterState, id = 'enemy') =>
  state.tactical.battle.combatants.find((row) => row.id === id)!.hp
const statuses = (state: CombatEncounterState) =>
  state.statusState.find((row) => row.combatantId === 'enemy')!.statuses

describe('current Ruin consumption', () => {
  it('spends two distinct captured debuffs on only the first landed packet', () => {
    const result = cast(seed(), command([damage, damage]))
    expect(hp(result.state)).toBe(940)
    expect(statuses(result.state).some((row) => ['slow', 'root'].includes(row.statusId))).toBe(
      false,
    )
    const hits = result.events.filter((event) => event.event === 'damage_applied')
    expect(hits).toMatchObject([{ amount: 40, ruinBonusBasisPoints: 10000 }, { amount: 20 }])
    expect(hits[1]).not.toHaveProperty('ruinBonusBasisPoints')
    expect(validateCombatEncounterState(result.state)).toEqual([])
  })
  it('keeps newly applied prefix and suffix applications of the same type', () => {
    const initial = cast(encounter(), command([slow], false)).state
    const result = cast(
      initial,
      command([{ ...slow, durationTurns: 5 }, damage, { ...slow, durationTurns: 6 }]),
    )
    expect(hp(result.state)).toBe(970)
    const remaining = statuses(result.state).find((row) => row.statusId === 'slow')!
    expect(remaining.stacks).toBe(2)
    expect(remaining.remainingOwnerTurnEnds).toBe(6)
    expect(validateCombatEncounterState(result.state)).toEqual([])
  })
  it('keeps captured debuffs after a miss and uses them on the next successful command', () => {
    const initial = seed()
    const missed = cast(initial, {
      ...command([damage]),
      accuracyRule: { kind: 'fixed', chanceBasisPoints: 0 },
    })
    expect(hp(missed.state)).toBe(1000)
    expect(statuses(missed.state)).toHaveLength(2)
    expect(hp(cast(missed.state).state)).toBe(960)
  })
  it('consumes a landed boosted packet absorbed fully by Barrier', () => {
    const initial = grantBarrier(seed(), 'enemy', 'enemy', 'test.barrier', 100).state
    const result = cast(initial)
    expect(hp(result.state)).toBe(1000)
    expect(statuses(result.state)).toHaveLength(0)
    expect(result.events).toContainEqual(
      expect.objectContaining({ event: 'damage_applied', amount: 0, ruinBonusBasisPoints: 10000 }),
    )
  })
  it('keeps legacy repeated packet bonuses and debuffs when the policy is absent', () => {
    const result = cast(seed(false), command([damage, damage]))
    expect(hp(result.state)).toBe(920)
    expect(statuses(result.state)).toHaveLength(2)
    expect(result.state).not.toHaveProperty('ruinState')
  })
  it('keeps preview input and RNG unchanged while showing current first-packet bonus', () => {
    const initial = seed()
    const bytes = JSON.stringify(initial)
    const quote = evaluateCombatAction(initial, command([damage, damage]), target, content)
    expect(quote.legal).toBe(true)
    expect(JSON.stringify(initial)).toBe(bytes)
    expect(initial).not.toHaveProperty('ruinState')
  })
})
const finish = async (state: CombatEncounterState, turns = 1) => {
  const { endCombatTurn } = await import('./actions')
  const { selectCurrentFinalFacing } = await import('./board')
  for (let i = 0; i < turns; i++)
    state = endCombatTurn(
      { ...state, tactical: selectCurrentFinalFacing(state.tactical, 'west').state },
      content,
    ).state
  return state
}
it('intersects two queued captures with live unspent applications after JSON reload', async () => {
  let state = cast(
    encounter(),
    command(
      [
        { ...slow, durationTurns: 6 },
        { ...root, durationTurns: 6 },
      ],
      false,
    ),
  ).state
  const queued = { ...command([damage]), effectTimingModes: ['delayed', 'instant'] as const }
  state = cast(state, queued).state
  state = cast(state, queued).state
  expect(hp(state)).toBe(1000)
  const captures = state.pendingEffects!.filter((row) => row.effect.type === 'damage')
  expect(captures).toHaveLength(2)
  expect(captures[0]!.effect).not.toBe(captures[1]!.effect)
  state = await finish(JSON.parse(JSON.stringify(state)), 8)
  expect(hp(state)).toBe(940)
  expect(statuses(state)).toHaveLength(0)
  expect(validateCombatEncounterState(state)).toEqual([])
})
it('allows a fresh command of the same Skill in the same turn to spend new build-up', () => {
  let state = cast(seed()).state
  state = cast(state, command([slow], false)).state
  const result = cast(state)
  expect(hp(result.state)).toBe(930)
  expect(statuses(result.state)).toHaveLength(0)
})
it('does not consume on a zero packet and spends the bonus on the next positive packet', () => {
  const result = cast(seed(), command([{ ...damage, amount: 0 }, damage]))
  expect(hp(result.state)).toBe(960)
  const hits = result.events.filter((event) => event.event === 'damage_applied')
  expect(hits[0]).not.toHaveProperty('ruinBonusBasisPoints')
  expect(hits[1]).toMatchObject({ amount: 40, ruinBonusBasisPoints: 10000 })
})
it('keeps a removed then reapplied same-type application outside the old capture', () => {
  const result = cast(
    seed(),
    command([
      {
        type: 'remove-status',
        recipient: 'primary-unit',
        target: 'enemy',
        statusIds: ['slow'],
        removalMode: 'specified',
        selectionKind: 'debuffs',
      },
      slow,
      damage,
    ]),
  )
  expect(hp(result.state)).toBe(970)
  expect(statuses(result.state).map((row) => row.statusId)).toEqual(['slow'])
  expect(statuses(result.state)[0]!.stacks).toBe(1)
})
it('does not resurrect a consumed base identity when a prefix survivor is copied and reapplied after reload', () => {
  let state = cast(encounter(), command([slow], false)).state
  state = cast(state, command([{ ...slow, durationTurns: 5 }, damage])).state
  expect(statuses(state)[0]!.stacks).toBe(1)
  expect(statuses(state)[0]).not.toHaveProperty('ruinApplicationId')
  state = JSON.parse(JSON.stringify(state))
  state = cast(state, command([slow], false)).state
  const result = cast(state)
  expect(hp(result.state)).toBe(940)
  expect(statuses(result.state)).toHaveLength(0)
  expect(validateCombatEncounterState(result.state)).toEqual([])
})
it('keeps prefix refreshed Suppress as a new operative instance without spending the old capture', () => {
  const suppress = {
    type: 'apply-status',
    recipient: 'primary-unit',
    target: 'enemy',
    statusId: 'suppress',
    stacks: 1,
    durationTurns: 2,
    potencyBasisPoints: 5000,
  } as const
  const initial = cast(encounter(), command([suppress], false)).state
  const result = cast(
    initial,
    command([{ ...suppress, durationTurns: 5, potencyBasisPoints: 1000 }, damage]),
  )
  expect(hp(result.state)).toBe(980)
  expect(statuses(result.state)[0]).toMatchObject({
    statusId: 'suppress',
    potencyBasisPoints: 5000,
    remainingOwnerTurnEnds: 5,
  })
  expect(result.events.find((event) => event.event === 'damage_applied')).not.toHaveProperty(
    'ruinBonusBasisPoints',
  )
})
it('counts each independent DoT type once and removes actual captured native instances', async () => {
  const { applyCurrentPoisonState, applyCurrentBurnState, applyCurrentBleedState } =
    await import('./combat-dots')
  let state = applyCurrentPoisonState(encounter(), 'actor', 'enemy', 'test.poison', true, 2, 3)
  state = applyCurrentBurnState(state, 'actor', 'enemy', 'test.burn', true, 3, 3)
  state = applyCurrentBurnState(state, 'actor', 'enemy', 'test.burn2', true, 3, 3)
  state = applyCurrentBleedState(state, 'actor', 'enemy', 'test.bleed', 2, 3, true)
  const result = cast(state)
  expect(hp(result.state)).toBe(950)
  expect(result.state.effectState!.poison).toEqual([])
  expect(result.state.effectState!.burn).toEqual([])
  expect(result.state.effectState!.bleed).toEqual([])
  expect(result.events.find((event) => event.event === 'damage_applied')).toMatchObject({
    ruinBonusBasisPoints: 15000,
  })
  expect(validateCombatEncounterState(result.state)).toEqual([])
})
it('evaluates independent recipients and consumes their first packet separately', () => {
  let state = seed()
  state = executeCombatAction(
    state,
    command([slow], false),
    { kind: 'unit', combatantId: 'other' },
    content,
  ).state
  const area: CombatActionDefinition = {
    ...command([
      { ...damage, recipient: 'affected-units' },
      { ...damage, recipient: 'affected-units' },
    ]),
    target: { ...command([]).target, shape: { kind: 'circle', radius: 2 } },
  }
  const result = cast(state, area)
  expect(hp(result.state, 'enemy')).toBe(940)
  expect(hp(result.state, 'other')).toBe(950)
  expect(result.state.statusState.flatMap((row) => row.statuses)).toEqual([])
})
it('does not count pending statuses, buffs, or neutral effects as consumable build-up', () => {
  const pending = { ...command([slow], false), effectTimingModes: ['delayed'] as const }
  let state = cast(encounter(), pending).state
  state = cast(
    state,
    command(
      [
        {
          type: 'apply-status',
          recipient: 'primary-unit',
          target: 'enemy',
          statusId: 'guarded',
          stacks: 1,
          durationTurns: 5,
        },
        {
          type: 'apply-status',
          recipient: 'primary-unit',
          target: 'enemy',
          statusId: 'reckless',
          stacks: 1,
          durationTurns: 5,
        },
        {
          type: 'apply-status',
          recipient: 'primary-unit',
          target: 'enemy',
          statusId: 'fortified',
          stacks: 1,
          durationTurns: 5,
        },
      ],
      false,
    ),
  ).state
  const result = cast(state)
  expect(hp(result.state)).toBe(hp(cast(state, command([damage], false)).state))
  expect(result.events.find((event) => event.event === 'damage_applied')).not.toHaveProperty(
    'ruinBonusBasisPoints',
  )
  expect(statuses(result.state).map((row) => row.statusId)).toEqual([
    'fortified',
    'guarded',
    'reckless',
  ])
  expect(result.state.pendingEffects).toHaveLength(1)
})
it('does not reuse a captured DoT identity after all old rows were cleared and a later application reused its native order', async () => {
  const { applyCurrentBurnState, removeCurrentBurnState } = await import('./combat-dots')
  let state = applyCurrentBurnState(encounter(), 'actor', 'enemy', 'old.burn', true, 2, 6)
  state = cast(state, { ...command([damage]), effectTimingModes: ['delayed', 'instant'] }).state
  const oldId = state.effectState!.burn[0]!.ruinApplicationId
  const oldOrder = state.effectState!.burn[0]!.applicationOrder
  state = removeCurrentBurnState(state, 'enemy')
  state = applyCurrentBurnState(state, 'actor', 'enemy', 'new.burn', true, 2, 6)
  expect(state.effectState!.burn[0]!.applicationOrder).toBe(oldOrder)
  expect(state.effectState!.burn[0]!.ruinApplicationId).toBeUndefined()
  state = await finish(JSON.parse(JSON.stringify(state)), 8)
  expect(state.effectState!.burn).toHaveLength(1)
  expect(state.effectState!.burn[0]!.ruinApplicationId).toBeUndefined()
  expect(state.ruinState!.spentTargets).toHaveLength(0)
  expect(oldId).toBeDefined()
  expect(validateCombatEncounterState(state)).toEqual([])
})
it('does not spend an older queued Poison capture after a new operative percentage refresh', async () => {
  const { applyCurrentPoisonState } = await import('./combat-dots')
  const profile = { kind: 'attack-percentage', basisPoints: 2000 } as const
  let state = applyCurrentPoisonState(
    { ...encounter(), dotTriggerPolicyVersion: 2 },
    'actor',
    'enemy',
    'old.poison',
    true,
    undefined,
    6,
    { capturedDamage: 20, profile },
  )
  state = cast(state, { ...command([damage]), effectTimingModes: ['delayed', 'instant'] }).state
  const oldId = state.effectState!.poison[0]!.ruinApplicationId
  state = applyCurrentPoisonState(state, 'actor', 'enemy', 'new.poison', true, undefined, 8, {
    capturedDamage: 10,
    profile: { ...profile, basisPoints: 1000 },
  })
  expect(state.effectState!.poison[0]!.ruinApplicationId).toBeUndefined()
  expect(state.effectState!.poison[0]!.percentageDamage!.profile.basisPoints).toBe(2000)
  state = await finish(JSON.parse(JSON.stringify(state)), 8)
  expect(state.effectState!.poison).toHaveLength(1)
  expect(state.ruinState!.spentTargets).toHaveLength(0)
  expect(oldId).toBeDefined()
  expect(validateCombatEncounterState(state)).toEqual([])
})
it('preserves the same operative Poison identity through passive five-tile refresh and spends it later', async () => {
  const { applyCurrentPoisonState, advanceCurrentPoisonMovement } = await import('./combat-dots')
  let state = applyCurrentPoisonState(
    { ...encounter(), dotTriggerPolicyVersion: 2 },
    'actor',
    'enemy',
    'old.poison',
    true,
    undefined,
    6,
    { capturedDamage: 20, profile: { kind: 'attack-percentage', basisPoints: 2000 } },
  )
  state = cast(state, { ...command([damage]), effectTimingModes: ['delayed', 'instant'] }).state
  const oldId = state.effectState!.poison[0]!.ruinApplicationId
  state = advanceCurrentPoisonMovement(JSON.parse(JSON.stringify(state)), 'enemy', 5).state
  expect(state.effectState!.poison[0]!.ruinApplicationId).toBe(oldId)
  state = await finish(state, 8)
  expect(state.effectState!.poison).toEqual([])
  expect(state.ruinState!.spentTargets).toHaveLength(1)
})
it('counts Storm Conductive before native elemental consumption and cannot reuse it on the next packet', () => {
  const conductive = {
    type: 'apply-status',
    recipient: 'primary-unit',
    target: 'enemy',
    statusId: 'conductive',
    stacks: 1,
    durationTurns: 6,
    potencyBasisPoints: 2000,
  } as const
  const initial = cast(
    { ...encounter(), elementalDamagePolicyVersion: 2 },
    command([conductive], false),
  ).state
  const result = cast(initial, command([{ ...damage, element: 'storm' }, damage]))
  const hits = result.events.filter((event) => event.event === 'damage_applied')
  expect(hits[0]).toMatchObject({ ruinBonusBasisPoints: 5000 })
  expect(hits[1]).not.toHaveProperty('ruinBonusBasisPoints')
  expect(result.state.ruinState!.spentTargets).toHaveLength(1)
})
it('keeps other attack annotations on later packets after Ruin is spent', () => {
  const definition = command([damage, damage])
  const result = cast(seed(), {
    ...definition,
    effectTimingModes: undefined,
    effects: [
      ...definition.effects,
      { type: 'weak-point', recipient: 'actor', debuffThreshold: 0 },
      { type: 'spike', recipient: 'actor' },
    ],
  })
  expect(hp(result.state)).toBe(820)
  expect(result.events.filter((event) => event.event === 'damage_applied')).toMatchObject([
    { amount: 120, ruinBonusBasisPoints: 10000 },
    { amount: 60 },
  ])
})
it('does not transfer donor identities when Copy Debuffs adds new applications after capture', async () => {
  let state = cast(encounter(), command([slow], false)).state
  // Stamp an existing enemy application without spending it.
  state = cast(state, command([{ ...damage, amount: 0 }])).state
  const enemyOldId =
    statuses(state)[0]!.applicationModifiers?.[0]?.ruinApplicationId ??
    statuses(state)[0]!.ruinApplicationId
  // Give the caster a real Slow application, then commit a fresh Ruin snapshot before copying it.
  const self: CombatActionDefinition = {
    ...command([], false),
    tags: [],
    accuracyRule: undefined,
    target: {
      ...command([]).target,
      kind: 'self',
      teamPolicy: 'self',
      minimumRange: 0,
      maximumRange: 0,
    },
    effects: [{ ...slow, recipient: 'actor', target: 'self' }],
    effectTimingModes: ['instant'],
  }
  state = executeCombatAction(state, self, { kind: 'self' }, content).state
  const copy = {
    type: 'copy-statuses',
    recipient: 'primary-unit',
    target: 'enemy',
    mode: 'curse',
    statusIds: ['slow'],
    durationPolicyVersion: 1,
    allowNoEligibleEffects: true,
  } as const
  const result = cast(state, command([copy, damage]))
  expect(statuses(result.state)[0]!.stacks).toBe(1)
  expect(statuses(result.state)[0]!.applicationModifiers?.[0]?.ruinApplicationId).not.toBe(
    enemyOldId,
  )
  expect(validateCombatEncounterState(JSON.parse(JSON.stringify(result.state)))).toEqual([])
})
it('gives copied Suppress a fresh Ruin identity while preserving the donor', () => {
  let state = encounter()
  state = {
    ...state,
    statusState: state.statusState.map((row) =>
      row.combatantId !== 'actor'
        ? row
        : {
            ...row,
            statuses: [
              ...row.statuses,
              {
                statusId: 'suppress',
                statusVersion: 1,
                stacks: 1,
                potencyBasisPoints: 2500,
                originalDurationTurns: 4,
                remainingOwnerTurnStarts: 4,
                sourceCombatantId: 'enemy',
              },
            ],
          },
    ),
  }
  const result = cast(
    state,
    command([
      {
        type: 'copy-statuses',
        recipient: 'primary-unit',
        target: 'enemy',
        mode: 'curse',
        statusIds: ['suppress'],
        durationPolicyVersion: 1,
        allowNoEligibleEffects: true,
      },
      damage,
    ]),
  )
  const donor = result.state.statusState.find((row) => row.combatantId === 'actor')!.statuses[0]!
  const receiver = statuses(result.state).find((row) => row.statusId === 'suppress')!
  expect(donor.ruinApplicationId).toBeDefined()
  expect(receiver.ruinApplicationId).toBeUndefined()
  expect(receiver.potencyBasisPoints).toBe(donor.potencyBasisPoints)
  expect(validateCombatEncounterState(JSON.parse(JSON.stringify(result.state)))).toEqual([])
  const next = cast(result.state)
  expect(statuses(next.state).some((row) => row.statusId === 'suppress')).toBe(false)
  expect(next.events).toContainEqual(
    expect.objectContaining({ event: 'damage_applied', ruinBonusBasisPoints: 5000 }),
  )
})

it('recaptures Ruin only when a new Ground contact packet is committed and preserves its suffix debuff', async () => {
  let state = {
    ...seed(),
    groundEffectPolicyVersion: 1 as const,
    groundContactPolicyVersion: 1 as const,
  }
  const definition: CombatActionDefinition = {
    ...command([
      { ...damage, recipient: 'affected-units', target: 'ground' },
      { ...slow, recipient: 'affected-units', target: 'ground' },
    ]),
    target: {
      ...command([]).target,
      kind: 'ground-tile',
      geometryVersion: 3,
      categories: ['ground'],
      maximumSelections: 1,
      minimumRange: 0,
    },
    groundArea: {
      durationRounds: 3,
      visualPresetId: 'arcane-pulse',
      entryEffectOrdinals: [0, 1],
      timing: 'instant',
    },
  }
  state = executeCombatAction(
    state,
    definition,
    { kind: 'tile', position: { x: 2, y: 1 } },
    content,
  ).state as typeof state
  expect(hp(state)).toBe(960)
  expect(statuses(state).map((row) => row.statusId)).toEqual(['slow'])
  state = (await finish(JSON.parse(JSON.stringify(state)))) as typeof state
  expect(hp(state)).toBe(930)
  expect(statuses(state)[0]!.stacks).toBe(1)
  expect(validateCombatEncounterState(state)).toEqual([])
})
it('rejects authored Ruin capture forgery and malformed queued identity references', async () => {
  const { validateCombatTagPayload } = await import('./combat-tag-registry')
  let state = cast(seed(), {
    ...command([damage]),
    effectTimingModes: ['delayed', 'instant'],
  }).state
  const pending = state.pendingEffects![0]!
  if (pending.effect.type !== 'damage') throw new Error('Expected committed Damage capture.')
  const actual = pending.effect.attackTagCapture!
  expect(validateCombatTagPayload({ ...damage, attackTagCapture: actual })).not.toEqual([])
  const forged = {
    ...pending,
    effect: {
      ...pending.effect,
      attackTagCapture: { ...actual, ruinCommandId: state.ruinState!.nextCommandId },
    },
  }
  expect(
    validateCombatEncounterState({ ...state, pendingEffects: [forged] }).some(
      (issue) => issue.field === 'ruinState',
    ),
  ).toBe(true)
  state = JSON.parse(JSON.stringify(state))
  expect(validateCombatEncounterState(state)).toEqual([])
})
it.each(['discipline-skill', 'essence', 'resonance'] as const)(
  'captures and spends canonical %s Ruin without changing its source definition',
  async (sourceKind) => {
    const { source } = await import('./combat-behavior.test-utils')
    const { captureCombatAbilitySource } = await import('./combat-behavior-capture')
    const { reconcileCombatAbilitySources, combatAbilityCommandContext } =
      await import('./combat-behavior-runtime')
    const { commitCombatAbilityCommand } = await import('./combat-ability-command')
    const { preparePv1fTurnEconomy } = await import('./pv1f-action-economy')
    const captured = captureCombatAbilitySource({
      ...source({
        effects: [
          { id: 'hit-1', timing: 'instant', payload: damage },
          { id: 'hit-2', timing: 'instant', payload: damage },
          {
            id: 'ruin',
            timing: 'instant',
            payload: { type: 'ruin', recipient: 'actor', bonusPerDebuffBasisPoints: 5000 },
          },
        ],
      }),
      sourceKind,
    })
    const bytes = JSON.stringify(captured)
    const state = reconcileCombatAbilitySources(
      preparePv1fTurnEconomy(
        seed() as import('./stat-driven-combat').StatDrivenCombatEncounterState,
      ),
      [captured],
    )
    const result = commitCombatAbilityCommand({
      state,
      actorId: 'actor',
      root: { kind: 'canonical', source: captured },
      selection: target,
      content,
      context: combatAbilityCommandContext(state, captured),
    })
    expect(hp(result.state)).toBe(940)
    expect(statuses(result.state)).toHaveLength(0)
    expect(JSON.stringify(captured)).toBe(bytes)
    expect(JSON.stringify(result.state.capturedAbilitySources![0])).toBe(bytes)
    expect(bytes).not.toMatch(/ruinApplicationId|attackTagCapture|ruinState/)
    expect(validateCombatEncounterState(JSON.parse(JSON.stringify(result.state)))).toEqual([])
  },
)
async function reversalReady(cancel = false) {
  const { source } = await import('./combat-behavior.test-utils')
  const { captureCombatAbilitySource } = await import('./combat-behavior-capture')
  const {
    reconcileCombatAbilitySources,
    primeCombatControlledAbility,
    cancelCombatControlledAbility,
  } = await import('./combat-behavior-runtime')
  const { preparePv1fTurnEconomy } = await import('./pv1f-action-economy')
  const captured = captureCombatAbilitySource(
    source({
      id: 'prepare',
      classification: 'utility',
      attackFamily: undefined,
      costs: [
        { resource: 'ap', amount: 50 },
        { resource: 'mp', amount: 5 },
      ],
      targeting: {
        kind: 'self',
        teamPolicy: 'self',
        friendlyFire: 'allies-only',
        shape: { kind: 'single' },
        minimumRange: 0,
        maximumRange: 0,
        requiresLineOfSight: false,
        maximumElevationDifference: null,
        maximumSelections: 1,
      },
      effects: [
        {
          id: 'reversal',
          timing: 'controlled',
          payload: {
            type: 'reversal',
            recipient: 'actor',
            version: 1,
            family: 'physical',
            reflectionBasisPoints: 10000,
            attackerMaxHpCapBasisPoints: 2000,
            defenderMaxHpCapBasisPoints: 2500,
          },
        },
      ],
    }),
  )
  let state = reconcileCombatAbilitySources(
    preparePv1fTurnEconomy(
      encounter() as import('./stat-driven-combat').StatDrivenCombatEncounterState,
    ),
    [captured],
  )
  const self: CombatActionDefinition = {
    ...command([], false),
    tags: [],
    accuracyRule: undefined,
    target: {
      ...command([]).target,
      kind: 'self',
      teamPolicy: 'self',
      minimumRange: 0,
      maximumRange: 0,
    },
    effects: [{ ...slow, recipient: 'actor', target: 'self' }],
    effectTimingModes: ['instant'],
  }
  state = executeCombatAction(state, self, { kind: 'self' }, content).state
  state = primeCombatControlledAbility({
    state,
    actorId: 'actor',
    sourceInstanceId: captured.sourceInstanceId,
    behaviorId: 'prepare',
    content,
  }).state
  if (cancel)
    state = cancelCombatControlledAbility({
      state,
      actorId: 'actor',
      sourceInstanceId: captured.sourceInstanceId,
      behaviorId: 'prepare',
    }).state
  const { endCombatTurn } = await import('./actions')
  const { selectCurrentFinalFacing } = await import('./board')
  return endCombatTurn(
    { ...state, tactical: selectCurrentFinalFacing(state.tactical, 'east').state },
    content,
  ).state
}
it('excludes protected real Reversal Strain while consuming ordinary negative status applications', async () => {
  const { hasCombatReversalStrain } = await import('./combat-reversal')
  const state = await reversalReady(true)
  expect(hasCombatReversalStrain(state, 'actor')).toBe(true)
  const result = executeCombatAction(
    state,
    {
      ...command([damage]),
      target: { ...command([]).target, teamPolicy: 'any', friendlyFire: 'all-units' },
    },
    { kind: 'unit', combatantId: 'actor' },
    content,
  )
  expect(hp(state, 'actor') - hp(result.state, 'actor')).toBe(30)
  expect(result.events.find((event) => event.event === 'damage_applied')).toMatchObject({
    ruinBonusBasisPoints: 5000,
  })
  expect(hasCombatReversalStrain(result.state, 'actor')).toBe(true)
  expect(
    result.state.statusState
      .find((row) => row.combatantId === 'actor')!
      .statuses.some((row) => row.statusId === 'slow'),
  ).toBe(false)
})
it('does not consume or spend a bonus when real Reversal prevents the hit', async () => {
  const state = await reversalReady()
  const result = executeCombatAction(
    state,
    {
      ...command([damage]),
      target: { ...command([]).target, teamPolicy: 'any', friendlyFire: 'all-units' },
    },
    { kind: 'unit', combatantId: 'actor' },
    content,
  )
  expect(hp(result.state, 'actor')).toBe(hp(state, 'actor'))
  expect(
    result.state.statusState
      .find((row) => row.combatantId === 'actor')!
      .statuses.some((row) => row.statusId === 'slow'),
  ).toBe(true)
  expect(result.state.ruinState!.spentTargets).toHaveLength(0)
  expect(
    result.events
      .filter((event) => event.event === 'damage_applied')
      .every((event) => event.ruinBonusBasisPoints === undefined),
  ).toBe(true)
})
it('preserves the applied bonus receipt on a finishing hit after HP clamping and cleanup', () => {
  const initial = seed()
  const state = {
    ...initial,
    tactical: {
      ...initial.tactical,
      battle: {
        ...initial.tactical.battle,
        combatants: initial.tactical.battle.combatants.map((row) =>
          row.id === 'enemy' ? { ...row, hp: 10 } : row,
        ),
      },
    },
  }
  const result = cast(state)
  expect(hp(result.state)).toBe(0)
  expect(result.events.find((event) => event.event === 'damage_applied')).toMatchObject({
    amount: 10,
    resolvedDamage: 40,
    ruinBonusBasisPoints: 10000,
  })
  expect(result.state.ruinState!.spentTargets).toHaveLength(1)
  expect(statuses(result.state)).toHaveLength(0)
})
it('does not spend the allowance on a requirement-ineligible first packet', () => {
  const result = cast(seed(), {
    ...command([damage, damage]),
    effectEligibleRecipientIds: [[], undefined, undefined],
  })
  expect(hp(result.state)).toBe(960)
  expect(result.events.filter((event) => event.event === 'damage_applied')).toMatchObject([
    { amount: 40, ruinBonusBasisPoints: 10000 },
  ])
})
it('does not consume when the Ruin annotation requirement is false', () => {
  const result = cast(seed(), { ...command([damage]), effectEligibleRecipientIds: [undefined, []] })
  expect(hp(result.state)).toBe(980)
  expect(statuses(result.state)).toHaveLength(2)
  expect(result.state.ruinState!.spentTargets).toEqual([])
})
it('adds no RNG draws compared with the same attack without Ruin', () => {
  const initial = seed()
  const normal = cast(initial, command([damage, damage], false))
  const ruin = cast(initial, command([damage, damage]))
  expect(ruin.state.tactical.battle.rng).toEqual(normal.state.tactical.battle.rng)
})
it('boosts current Pierce without re-enabling its critical or Spike bonus', () => {
  const definition = command([{ ...damage, shattersBarrier: true }, damage])
  const result = cast(
    { ...seed(), pierceCriticalPolicyVersion: 1 },
    {
      ...definition,
      effectTimingModes: undefined,
      effects: [
        ...definition.effects,
        { type: 'weak-point', recipient: 'actor', debuffThreshold: 0 },
        { type: 'spike', recipient: 'actor' },
      ],
    },
  )
  const hits = result.events.filter((event) => event.event === 'damage_applied')
  expect(hits[0]).toMatchObject({ amount: 40, critical: false, ruinBonusBasisPoints: 10000 })
  expect(hits[1]).not.toHaveProperty('ruinBonusBasisPoints')
})
it('forecasts first-packet Ruin spending on a detached projection with exact HP deltas', () => {
  const initial = seed()
  const bytes = JSON.stringify(initial)
  const quote = evaluateCombatAction(initial, command([damage, damage]), target, content)
  expect(
    quote.projectedEffects
      .filter((row) => row.effectType === 'damage')
      .map((row) => [row.before, row.after]),
  ).toEqual([
    [1000, 960],
    [960, 940],
  ])
  expect(JSON.stringify(initial)).toBe(bytes)
  expect(initial).not.toHaveProperty('ruinState')
})
it('forecasts a prefix Suppress refresh as replacing the old capturable instance', () => {
  const suppress = {
    type: 'apply-status',
    recipient: 'primary-unit',
    target: 'enemy',
    statusId: 'suppress',
    stacks: 1,
    durationTurns: 6,
    potencyBasisPoints: 5000,
  } as const
  const initial = cast(encounter(), command([suppress], false)).state
  const definition = command([{ ...suppress, potencyBasisPoints: 1000 }, damage, damage])
  const quote = evaluateCombatAction(initial, definition, target, content)
  expect(
    quote.projectedEffects.filter((row) => row.effectType === 'damage').map((row) => row.after),
  ).toEqual([980, 960])
  expect(statuses(initial)[0]).not.toHaveProperty('ruinApplicationId')
})
it('forecasts a prefix Poison application without spending the replaced old instance', async () => {
  const { applyCurrentPoisonState } = await import('./combat-dots')
  const initial = applyCurrentPoisonState(encounter(), 'actor', 'enemy', 'old.poison', true, 2, 6)
  const bytes = JSON.stringify(initial)
  const definition = command([
    { type: 'poison', recipient: 'primary-unit', target: 'enemy', power: 1, durationTurns: 6 },
    damage,
    damage,
  ])
  const quote = evaluateCombatAction(initial, definition, target, content)
  expect(
    quote.projectedEffects.filter((row) => row.effectType === 'damage').map((row) => row.after),
  ).toEqual([980, 960])
  expect(JSON.stringify(initial)).toBe(bytes)
})
it('keeps identities monotonic after complete removal and cannot spend a new build-up from an older queued capture', async () => {
  let state = cast(encounter(), command([{ ...slow, durationTurns: 8 }], false)).state
  state = cast(state, { ...command([damage]), effectTimingModes: ['delayed', 'instant'] }).state
  const oldId =
    statuses(state)[0]!.applicationModifiers?.[0]?.ruinApplicationId ??
    statuses(state)[0]!.ruinApplicationId
  state = cast(state).state
  expect(statuses(state)).toEqual([])
  state = JSON.parse(JSON.stringify(state))
  state = cast(state, command([{ ...slow, durationTurns: 8 }], false)).state
  state = cast(state, command([{ ...damage, amount: 0 }])).state
  const freshId =
    statuses(state)[0]!.applicationModifiers?.[0]?.ruinApplicationId ??
    statuses(state)[0]!.ruinApplicationId
  expect(freshId).toBeGreaterThan(oldId!)
  state = await finish(state, 8)
  expect(hp(state)).toBe(950)
  expect(statuses(state)).toHaveLength(1)
  expect(validateCombatEncounterState(state)).toEqual([])
})
it('keeps pending Copy donor IDs separate from the new target applications before queued Ruin', async () => {
  let state = cast(encounter(), command([{ ...root, durationTurns: 8 }], false)).state
  const self: CombatActionDefinition = {
    ...command([], false),
    tags: [],
    accuracyRule: undefined,
    target: {
      ...command([]).target,
      kind: 'self',
      teamPolicy: 'self',
      minimumRange: 0,
      maximumRange: 0,
    },
    effects: [{ ...slow, recipient: 'actor', target: 'self', durationTurns: 8 }],
    effectTimingModes: ['instant'],
  }
  state = executeCombatAction(state, self, { kind: 'self' }, content).state
  const copy = {
    type: 'copy-statuses',
    recipient: 'primary-unit',
    target: 'enemy',
    mode: 'curse',
    statusIds: ['slow'],
    durationPolicyVersion: 1,
    allowNoEligibleEffects: true,
  } as const
  state = cast(state, {
    ...command([copy, damage]),
    effectTimingModes: ['next-round', 'next-round', 'instant'],
  }).state
  const donorId = state.statusState.find((row) => row.combatantId === 'actor')!.statuses[0]!
    .applicationModifiers?.[0]?.ruinApplicationId
  expect(donorId).toBeDefined()
  state = await finish(JSON.parse(JSON.stringify(state)), 4)
  expect(hp(state)).toBe(970)
  expect(statuses(state)).toHaveLength(1)
  expect(statuses(state)[0]!.statusId).toBe('slow')
  expect(statuses(state)[0]!.applicationModifiers?.[0]?.ruinApplicationId).not.toBe(donorId)
  expect(
    state.statusState.find((row) => row.combatantId === 'actor')!.statuses[0]!
      .applicationModifiers?.[0]?.ruinApplicationId,
  ).toBe(donorId)
  expect(validateCombatEncounterState(state)).toEqual([])
})

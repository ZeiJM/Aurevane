import { executeCombatAction as executeLegacyCombatAction } from './actions-legacy'
import { expect, it } from 'vitest'
import {
  applyCurrentBurnBacklash,
  defeatCombatActionActor,
  evaluateCombatAction,
  executeCombatAction,
  endCombatTurn,
  validateCombatEncounterState,
  type CombatActionDefinition,
  type CombatEncounterState,
} from './actions'
import { selectCurrentFinalFacing } from './board'
import { percentageDotEncounter } from './combat-percentage-dots.test-utils'
import { resolveEssenceForBuild, validateEssenceDefinition } from './essence'
import {
  resolveMatureSkillVersion,
  latestEnabledMatureSkills,
  toCombatActionDefinition,
} from './mature-skills'
import { PV1F_COMBAT_CONTENT } from './pv1f-action-economy'
import { validateCombatActionDefinition } from './combat-authoring-validation'

const content = PV1F_COMBAT_CONTENT
const selection = { kind: 'unit' as const, combatantId: 'enemy' }
const action: CombatActionDefinition = {
  id: 'test.blindside',
  version: 1,
  sourceType: 'test',
  tags: ['attack'],
  cost: { mp: 0, spendsAction: false },
  requirements: [],
  target: {
    kind: 'unit',
    teamPolicy: 'enemy',
    shape: { kind: 'single' },
    minimumRange: 1,
    maximumRange: 1,
    requiresLineOfSight: false,
    maximumElevationDifference: 0,
    friendlyFire: 'enemies-only',
  },
  effects: [
    {
      type: 'apply-status',
      recipient: 'actor',
      statusId: 'blindside',
      stacks: 1,
      durationTurns: 1,
    },
    { type: 'damage', recipient: 'primary-unit', amount: 20 },
  ],
}
function faced(facing: 'west' | 'north' | 'east'): CombatEncounterState {
  const state = percentageDotEncounter()
  return {
    ...state,
    effectTimingPolicy: { version: 1, modes: {} },
    tactical: {
      ...state.tactical,
      placements: state.tactical.placements.map((row) =>
        row.combatantId === 'enemy' ? { ...row, facing } : row,
      ),
    },
  }
}
const customBlindsideEffect = {
  type: 'apply-status' as const,
  recipient: 'actor' as const,
  statusId: 'blindside',
  stacks: 1,
  durationTurns: 1,
  blindsideModifiersBasisPoints: { side: 17500, rear: 25000 },
}
const customBlindside = {
  ...action,
  effects: [customBlindsideEffect, action.effects[1]!],
}
it.each([
  ['west', 20],
  ['north', 35],
  ['east', 50],
] as const)(
  'uses the Skill-authored Blindside values for %s in preview and committed damage',
  (facing, amount) => {
    const state = faced(facing)
    expect(
      evaluateCombatAction(state, customBlindside, selection, content).projectedEffects,
    ).toContainEqual({
      effectType: 'damage',
      combatantId: 'enemy',
      before: 1000,
      after: 1000 - amount,
    })
    const result = executeCombatAction(state, customBlindside, selection, content)
    expect(result.events).toContainEqual(
      expect.objectContaining({ event: 'damage_applied', amount }),
    )
    expect(result.state.statusState[0]!.statuses[0]).toMatchObject({
      blindsideModifiersBasisPoints: { side: 17500, rear: 25000 },
    })
  },
)
it('preserves independently authored Blindside applications after reapplication and restore', () => {
  const initial = { ...faced('east'), effectStackingPolicyVersion: 1 as const }
  const first = executeCombatAction(initial, customBlindside, selection, content).state
  const next = {
    ...customBlindside,
    effects: [
      {
        ...customBlindsideEffect,
        blindsideModifiersBasisPoints: { side: 12500, rear: 18000 },
      },
    ],
  }
  const second = executeCombatAction(first, next, selection, content).state
  const restored = JSON.parse(JSON.stringify(second)) as CombatEncounterState
  const hit = executeCombatAction(
    restored,
    { ...action, effects: [action.effects[1]!] },
    selection,
    content,
  )
  expect(hit.events).toContainEqual(
    expect.objectContaining({ event: 'damage_applied', amount: 90 }),
  )
  expect(restored.statusState[0]!.statuses[0]!.applicationModifiers).toEqual([
    expect.objectContaining({ blindsideModifiersBasisPoints: { side: 17500, rear: 25000 } }),
    expect.objectContaining({ blindsideModifiersBasisPoints: { side: 12500, rear: 18000 } }),
  ])
})
it.each([undefined, 1] as const)(
  'Copy Buffs preserves the granting Skill’s Blindside values with stacking policy %s',
  (effectStackingPolicyVersion) => {
    const initial = {
      ...faced('east'),
      ...(effectStackingPolicyVersion === undefined ? {} : { effectStackingPolicyVersion }),
      effectTimingPolicy: {
        version: 1,
        modes: { 'copy-statuses': 'instant' as const, copy: 'instant' as const },
      },
    }
    const granted = executeCombatAction(
      initial,
      {
        ...action,
        effects: [{ ...customBlindsideEffect, recipient: 'primary-unit' as const }],
      },
      selection,
      content,
    ).state
    const copied = executeCombatAction(
      granted,
      {
        ...action,
        effects: [{ type: 'copy-statuses', recipient: 'primary-unit', mode: 'amplify' }],
      },
      selection,
      content,
    ).state
    const result = executeCombatAction(
      copied,
      { ...action, effects: [action.effects[1]!] },
      selection,
      content,
    )
    expect(result.events).toContainEqual(
      expect.objectContaining({ event: 'damage_applied', amount: 50 }),
    )
  },
)
it.each([
  { side: 9999, rear: 22000 },
  { side: 16000.5, rear: 22000 },
  { side: 16000, rear: Number.NaN },
])('rejects invalid authored Blindside percentages %j', (modifiers) => {
  expect(() =>
    validateCombatActionDefinition({
      ...customBlindside,
      effects: [{ ...customBlindsideEffect, blindsideModifiersBasisPoints: modifiers }],
    }),
  ).toThrow(/Blindside/)
})
it.each(['status', 'application'] as const)(
  'rejects malformed restored Blindside %s metadata',
  (location) => {
    const result = executeCombatAction(
      { ...faced('east'), effectStackingPolicyVersion: 1 },
      customBlindside,
      selection,
      content,
    )
    const restored = JSON.parse(JSON.stringify(result.state))
    const status = restored.statusState[0].statuses[0]
    const row = location === 'status' ? status : status.applicationModifiers[0]
    row.blindsideModifiersBasisPoints.rear = 9999
    expect(validateCombatEncounterState(restored).length).toBeGreaterThan(0)
  },
)
it.each([
  ['west', 20],
  ['north', 32],
  ['east', 44],
] as const)(
  'Blindside instantly buffs the %s-facing Skill hit for one owner turn',
  (facing, damage) => {
    const state = faced(facing)
    const savedAction = JSON.stringify(action)
    expect(evaluateCombatAction(state, action, selection, content).projectedEffects).toContainEqual(
      { effectType: 'damage', combatantId: 'enemy', before: 1000, after: 1000 - damage },
    )
    const result = executeCombatAction(state, action, selection, content)
    expect(result.events.filter((event) => event.event === 'damage_applied')).toEqual([
      expect.objectContaining({ amount: damage }),
    ])
    expect(result.state.statusState[0]!.statuses).toContainEqual(
      expect.objectContaining({ statusId: 'blindside', remainingOwnerTurnEnds: 1 }),
    )
    expect(result.state.pendingEffects ?? []).toEqual([])
    expect(JSON.stringify(action)).toBe(savedAction)
  },
)
it('the one-turn buff enhances another Skill, excludes Basic Attack, and expires at owner turn end', () => {
  const buffed = executeCombatAction(faced('east'), action, selection, content).state
  const hit = { ...action, effects: [action.effects[1]!] }
  const skill = executeCombatAction(buffed, hit, selection, content)
  expect(skill.events).toContainEqual(
    expect.objectContaining({ event: 'damage_applied', amount: 44 }),
  )
  const basic = executeCombatAction(
    buffed,
    {
      ...hit,
      sourceType: 'basic-attack',
      tags: ['attack'],
      cost: { ...hit.cost, spendsAction: true },
    },
    selection,
    content,
  )
  expect(basic.events).toContainEqual(
    expect.objectContaining({ event: 'damage_applied', amount: 20 }),
  )
  const ended = endCombatTurn(
    { ...buffed, tactical: selectCurrentFinalFacing(buffed.tactical, 'west').state },
    content,
  )
  expect(ended.state.statusState[0]!.statuses).not.toContainEqual(
    expect.objectContaining({ statusId: 'blindside' }),
  )
})
it.each(['pve', 'pvp'] as const)(
  'Perfect Opening has one ordinary power-20 hit and an Instant one-turn Blindside buff in %s',
  (context) => {
    const essence = resolveEssenceForBuild('shadehand', null)!
    const old = resolveEssenceForBuild('shadehand', null, essence.contentVersion - 1)!
    expect(essence.skill.effects).toEqual([
      {
        type: 'apply-status',
        recipient: 'actor',
        statusId: 'blindside',
        stacks: 1,
        durationTurns: 1,
      },
      { type: 'damage', recipient: 'primary-unit', amount: 20, durationTurns: 0 },
    ])
    expect(old.skill.effects[0]).toMatchObject({
      facingModifiersBasisPoints: { front: 12000, side: 16000, rear: 22000 },
    })
    expect(validateEssenceDefinition(essence)).toEqual([])
    const skill = toCombatActionDefinition(essence.skill, context)
    const front = executeCombatAction(faced('west'), skill, selection, content)
    const rear = executeCombatAction(faced('east'), skill, selection, content)
    const frontDamage = front.events.find((event) => event.event === 'damage_applied')!
    const rearDamage = rear.events.find((event) => event.event === 'damage_applied')!
    expect(rearDamage).toMatchObject({
      amount: frontDamage.event === 'damage_applied' ? Math.floor(frontDamage.amount * 2.2) : -1,
    })
    expect(essence.skill.apCost).toBe(old.skill.apCost)
    expect(essence.skill.cooldown).toEqual(old.skill.cooldown)
  },
)
it('an expired Blindside buff does not enhance stored delayed damage after restore', () => {
  let state = executeCombatAction(
    { ...faced('east'), effectTimingPolicy: { version: 2, modes: { damage: 'delayed' } } },
    action,
    selection,
    content,
  ).state
  expect(state.statusState[0]!.statuses).toContainEqual(
    expect.objectContaining({ statusId: 'blindside', remainingOwnerTurnEnds: 1 }),
  )
  state = JSON.parse(JSON.stringify(state)) as CombatEncounterState
  const events = []
  while (state.tactical.battle.round < 3) {
    const result = endCombatTurn(
      { ...state, tactical: selectCurrentFinalFacing(state.tactical, 'west').state },
      content,
    )
    state = result.state
    events.push(...result.events)
  }
  expect(events.filter((event) => event.event === 'damage_applied')).toEqual([
    expect.objectContaining({ amount: 20 }),
  ])
  expect(state.statusState.every((row) => row.statuses.length === 0)).toBe(true)
})

it.each([
  'shadehand.backstab',
  'shadehand.exploit-opening',
  'shadehand.execution-cut',
  'edgedancer.flanking-cut',
])('converts %s to the same Instant one-turn buff without rewriting history or costs', (id) => {
  const current = resolveMatureSkillVersion(id)!
  const old = resolveMatureSkillVersion(id, current.contentVersion - 1)!
  expect(
    old.effects.some((effect) => effect.type === 'damage' && effect.facingModifiersBasisPoints),
  ).toBe(true)
  expect(current.effects[0]).toEqual({
    type: 'apply-status',
    recipient: 'actor',
    statusId: 'blindside',
    stacks: 1,
    durationTurns: 1,
  })
  expect(
    current.effects.filter((effect) => effect.type === 'damage').map((effect) => effect.amount),
  ).toEqual(old.effects.filter((effect) => effect.type === 'damage').map((effect) => effect.amount))
  expect(current.apCost).toBe(old.apCost)
  expect(current.overrides).toEqual(old.overrides)
  expect(current.cooldown).toEqual(old.cooldown)
  expect(
    current.effects.some((effect) => effect.type === 'damage' && effect.facingModifiersBasisPoints),
  ).toBe(false)
})
it('no current Discipline Skill retains a hidden positional damage multiplier', () => {
  expect(
    latestEnabledMatureSkills().flatMap((skill) =>
      skill.effects.filter(
        (effect) => effect.type === 'damage' && effect.facingModifiersBasisPoints,
      ),
    ),
  ).toEqual([])
})

it.each(['burn-backlash', 'forced-defeat'] as const)(
  'expires Blindside when %s ends the holder turn by defeat',
  (reason) => {
    const state = executeCombatAction(faced('east'), action, selection, content).state
    state.tactical.battle.combatants[0]!.hp = 1
    const result =
      reason === 'burn-backlash'
        ? applyCurrentBurnBacklash(state, 'actor', 1)
        : defeatCombatActionActor(state, 'actor', content)
    expect(result.state.tactical.battle.combatants[0]!.hp).toBe(0)
    expect(result.state.tactical.battle.currentTurn?.combatantId).not.toBe('actor')
    expect(result.state.statusState[0]!.statuses).not.toContainEqual(
      expect.objectContaining({ statusId: 'blindside' }),
    )
  },
)

it.each([
  ['west', 20, false],
  ['north', 32, true],
  ['east', 44, true],
] as const)(
  'new encounters grant Blindside only on a qualifying %s hit',
  (facing, damage, active) => {
    const state = { ...faced(facing), blindsideActivationPolicyVersion: 1 as const }
    const preview = evaluateCombatAction(state, action, selection, content)
    expect(preview.projectedEffects.some((effect) => effect.effectType === 'apply-status')).toBe(
      active,
    )
    const result = executeCombatAction(state, action, selection, content)
    expect(result.events).toContainEqual(
      expect.objectContaining({ event: 'damage_applied', amount: damage }),
    )
    expect(
      result.events.some(
        (event) => event.event === 'status_applied' && event.statusId === 'blindside',
      ),
    ).toBe(active)
    expect(
      result.state.statusState[0]!.statuses.some((status) => status.statusId === 'blindside'),
    ).toBe(active)
    const restored = JSON.parse(JSON.stringify(result.state)) as CombatEncounterState
    expect(restored.blindsideActivationPolicyVersion).toBe(1)
    expect(validateCombatEncounterState(restored)).toEqual([])
  },
)

it('a missed flank, a front cast and an authored 100% flank do not grant or refresh Blindside', () => {
  const flank = { ...faced('east'), blindsideActivationPolicyVersion: 1 as const }
  const missed = executeLegacyCombatAction(
    flank,
    action,
    selection,
    content,
    undefined,
    new Set(['enemy']),
  )
  expect(missed.events.some((event) => event.event === 'status_applied')).toBe(false)
  expect(missed.state.statusState[0]!.statuses).toEqual([])
  const neutral = {
    ...action,
    effects: [
      { ...customBlindsideEffect, blindsideModifiersBasisPoints: { side: 10000, rear: 10000 } },
      action.effects[1]!,
    ],
  }
  expect(
    executeCombatAction(flank, neutral, selection, content).state.statusState[0]!.statuses,
  ).toEqual([])
  const buffed = executeCombatAction(flank, action, selection, content).state
  const front = {
    ...buffed,
    tactical: {
      ...buffed.tactical,
      placements: buffed.tactical.placements.map((row) =>
        row.combatantId === 'enemy' ? { ...row, facing: 'west' as const } : row,
      ),
    },
  }
  const repeated = executeCombatAction(front, action, selection, content)
  expect(repeated.events.some((event) => event.event === 'status_applied')).toBe(false)
  expect(repeated.state.statusState).toEqual(buffed.statusState)
})

it('a missed damage packet cannot grant Blindside through an independent actor packet', () => {
  const state = { ...faced('east'), blindsideActivationPolicyVersion: 1 as const }
  const result = executeLegacyCombatAction(
    state,
    action,
    selection,
    content,
    undefined,
    new Set(),
    undefined,
    new Map([['enemy', new Set([1])]]),
  )
  expect(result.events.some((event) => event.event === 'status_applied')).toBe(false)
  expect(result.state.statusState[0]!.statuses).toEqual([])
})

it.each(['next-round', 'delayed'] as const)(
  'retains an earned %s Blindside application through restore and activation',
  (mode) => {
    let state = executeCombatAction(
      {
        ...faced('east'),
        blindsideActivationPolicyVersion: 1,
        effectTimingPolicy: { version: 3, modes: { blindside: mode } },
      },
      action,
      selection,
      content,
    ).state
    expect(
      state.pendingEffects?.some(
        (pending) =>
          pending.effect.type === 'apply-status' && pending.effect.statusId === 'blindside',
      ),
    ).toBe(true)
    state = JSON.parse(JSON.stringify(state)) as CombatEncounterState
    const events = []
    while (state.tactical.battle.round < (mode === 'delayed' ? 3 : 2)) {
      const result = endCombatTurn(
        { ...state, tactical: selectCurrentFinalFacing(state.tactical, 'west').state },
        content,
      )
      state = result.state
      events.push(...result.events)
    }
    expect(events).toContainEqual(
      expect.objectContaining({ event: 'status_applied', statusId: 'blindside' }),
    )
    expect(state.statusState[0]!.statuses).toContainEqual(
      expect.objectContaining({ statusId: 'blindside' }),
    )
  },
)

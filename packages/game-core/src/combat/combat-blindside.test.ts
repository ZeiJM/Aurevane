import { expect, it } from 'vitest'
import {
  applyCurrentBurnBacklash,
  defeatCombatActionActor,
  evaluateCombatAction,
  executeCombatAction,
  endCombatTurn,
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

import { capturedMatureSkillAbilitySource } from './combat-action-source'
import { readFileSync } from 'node:fs'
import { hasCurrentPoison, currentBurnInstance } from './combat-dots'
import { describe, expect, it } from 'vitest'
import type { MatureSkillDefinition } from './mature-skills'
import {
  chooseBuildAwareRecruitAiDecision,
  executeBuildAwareRecruitAiAction,
} from './recruit-ai-build'
import { projectPublicCombatGroundAreas } from './combat-ground-visuals'
import { parseAbilityDefinition, validateAbilityDefinition } from './combat-definition'
import { source } from './combat-behavior.test-utils'
import {
  materializeCombatAbilityAction,
  reconcileCombatAbilitySources,
  combatAbilityCommandContext,
} from './combat-behavior-runtime'
import { captureCombatAbilitySource } from './combat-behavior-capture'
import { commitCombatAbilityCommand, prepareCombatAbilityCommand } from './combat-ability-command'
import { percentageDotEncounter } from './combat-percentage-dots.test-utils'
import {
  PV1F_COMBAT_CONTENT,
  preparePv1fTurnEconomy,
  executePv1fMovement,
} from './pv1f-action-economy'
import { endCombatTurn, validateCombatEncounterState, type CombatEncounterState } from './actions'
import type { StatDrivenCombatEncounterState } from './stat-driven-combat'
import { selectCurrentFinalFacing } from './board'
import { advanceCombatGroundAreas, validateCombatGroundAreas } from './combat-ground-areas'

function groundSource() {
  return source({
    targeting: {
      ...source().definition.behaviors[0]!.targeting!,
      kind: 'ground-tile',
      geometryVersion: 3,
      categories: ['ground'],
      minimumRange: 0,
    },
    effects: [
      { id: 'walk', payload: { type: 'move', recipient: 'actor', maximumTiles: 1 } },
      {
        id: 'hit',
        timing: 'instant',
        payload: { type: 'damage', recipient: 'affected-units', amount: 10 },
      },
      { id: 'self-heal', payload: { type: 'healing', recipient: 'actor', amount: 2 } },
      {
        id: 'slow',
        timing: 'next-round',
        payload: {
          type: 'apply-status',
          recipient: 'affected-units',
          statusId: 'slow',
          stacks: 1,
          durationTurns: 2,
        },
      },
    ],
    groundArea: {
      durationRounds: 3,
      visualPresetId: 'arcane-pulse',
      entryEffectIds: ['slow', 'hit'],
      timing: 'instant',
    },
  })
}

describe('canonical persistent Ground groups', () => {
  it('accepts a finite Ground-only area and resolves stable effect IDs after Move filtering', () => {
    const captured = groundSource()
    expect(validateAbilityDefinition(captured.definition)).toEqual([])
    const parsed = parseAbilityDefinition(captured.definition)
    expect(parsed.behaviors[0]!.groundArea).toEqual(captured.definition.behaviors[0]!.groundArea)
    const action = materializeCombatAbilityAction(captured, parsed.behaviors[0]!)
    expect(action.groundArea).toEqual({
      durationRounds: 3,
      visualPresetId: 'arcane-pulse',
      entryEffectOrdinals: [2, 0],
      timing: 'instant',
    })
    expect(action.effects.map((effect) => effect.type)).toEqual([
      'damage',
      'healing',
      'apply-status',
    ])
    expect(action.effectOrigins?.map((origin) => origin?.effectId)).toEqual([
      'hit',
      'self-heal',
      'slow',
    ])
    expect(action.effectTimingModes).toEqual(['instant', undefined, 'next-round'])
  })

  it.each([
    null,
    { durationRounds: 0 },
    { durationRounds: 5 },
    { durationRounds: 1.5 },
    { visualPresetId: 'scripted-vfx' },
    { timing: 'controlled' },
    { entryEffectIds: [] },
    { entryEffectIds: ['hit', 'hit'] },
    { entryEffectIds: ['missing'] },
    { entryEffectIds: ['self-heal'] },
    { entryEffectIds: ['walk'] },
    { entryEffectIds: [0] },
    { entryEffectOrdinals: [0] },
    { script: 'arbitrary' },
  ])('rejects malformed or unsupported Ground metadata: %j', (patch) => {
    const value = structuredClone(groundSource().definition)
    const group = value.behaviors[0]!
    const malformed = {
      ...group,
      groundArea: patch === null ? null : { ...group.groundArea, ...patch },
    }
    expect(validateAbilityDefinition({ ...value, behaviors: [malformed] }).length).toBeGreaterThan(
      0,
    )
  })

  it.each([
    {
      targeting: {
        ...groundSource().definition.behaviors[0]!.targeting!,
        kind: 'unit',
        categories: ['enemy'],
      },
    },
    {
      targeting: {
        ...groundSource().definition.behaviors[0]!.targeting!,
        categories: ['ground', 'enemy'],
      },
    },
    { mode: 'modifier', targeting: null },
    {
      effects: [
        {
          id: 'hit',
          timing: 'controlled',
          payload: { type: 'damage', recipient: 'affected-units', amount: 10 },
        },
      ],
    },
  ])('rejects non-Ground or Controlled persistent groups: %j', (patch) => {
    const value = groundSource().definition
    expect(
      validateAbilityDefinition({ ...value, behaviors: [{ ...value.behaviors[0], ...patch }] })
        .length,
    ).toBeGreaterThan(0)
  })
})

function persistentCast(conditional = false) {
  const template = groundSource()
  const behavior = template.definition.behaviors[0]!
  const captured = captureCombatAbilitySource(
    source({
      ...behavior,
      effects: behavior.effects
        .filter((effect) => effect.id !== 'walk')
        .map((effect) => ({
          ...effect,
          ...(conditional && effect.id === 'hit'
            ? {
                requirements: {
                  kind: 'status-presence' as const,
                  subject: 'affected' as const,
                  statusId: 'marked',
                  present: true,
                },
              }
            : {}),
        })),
    }),
  )
  const state = reconcileCombatAbilitySources(
    {
      ...preparePv1fTurnEconomy(percentageDotEncounter()),
      groundEffectPolicyVersion: 1 as const,
    },
    [captured],
  )
  const input = {
    state,
    actorId: 'actor',
    root: { kind: 'canonical' as const, source: captured },
    selection: { kind: 'tile' as const, position: { x: 2, y: 2 } },
    content: PV1F_COMBAT_CONTENT,
    context: combatAbilityCommandContext(state, captured),
  }
  expect(prepareCombatAbilityCommand(input).evaluation.legal).toBe(true)
  return commitCombatAbilityCommand(input)
}
function enemyTurn(state: CombatEncounterState) {
  return endCombatTurn(
    { ...state, tactical: selectCurrentFinalFacing(state.tactical, 'west').state },
    PV1F_COMBAT_CONTENT,
  ).state
}

it('captures ordered entry eligibility and timing and obeys them after JSON restore and source removal', () => {
  const cast = persistentCast(true)
  const area = cast.state.groundAreas![0]!
  expect(area.entryEffectOrigins?.map((origin) => origin?.effectId)).toEqual(['slow', 'hit'])
  expect(area.entryEffectEligibleRecipientIds).toEqual([null, []])
  expect(area.entryEffectTimingModes).toEqual(['next-round', 'instant'])
  let restored = JSON.parse(JSON.stringify(cast.state)) as CombatEncounterState
  restored = reconcileCombatAbilitySources(restored, [])
  expect(validateCombatEncounterState(restored)).toEqual([])
  const next = enemyTurn(restored)
  const entered = executePv1fMovement(next as StatDrivenCombatEncounterState, [
    { x: 2, y: 1 },
    { x: 2, y: 2 },
  ])
  expect(entered.state.tactical.battle.combatants.find((unit) => unit.id === 'enemy')!.hp).toBe(
    1000,
  )
  expect(
    entered.events.some(
      (event) =>
        event && typeof event === 'object' && 'event' in event && event.event === 'damage_applied',
    ),
  ).toBe(false)
  expect(
    entered.state.statusState.find((row) => row.combatantId === 'enemy')!.statuses,
  ).toContainEqual(expect.objectContaining({ statusId: 'slow', stacks: 1 }))
  expect(validateCombatEncounterState(JSON.parse(JSON.stringify(entered.state)))).toEqual([])
})

it('preserves one payment, entry claims and finite expiry for a canonical empty-tile cast', () => {
  const cast = persistentCast()
  expect(cast.state.groundAreas).toHaveLength(1)
  expect(cast.events.filter((event) => event.event === 'mp_spent')).toHaveLength(1)
  const next = enemyTurn(cast.state)
  const entered = executePv1fMovement(next as StatDrivenCombatEncounterState, [
    { x: 2, y: 1 },
    { x: 2, y: 2 },
  ])
  const firstHp = entered.state.tactical.battle.combatants.find((unit) => unit.id === 'enemy')!.hp
  expect(firstHp).toBeLessThan(1000)
  const returned = executePv1fMovement(entered.state as StatDrivenCombatEncounterState, [
    { x: 2, y: 2 },
    { x: 3, y: 2 },
    { x: 2, y: 2 },
  ])
  expect(returned.state.tactical.battle.combatants.find((unit) => unit.id === 'enemy')!.hp).toBe(
    firstHp,
  )
  const expired = advanceCombatGroundAreas({
    ...returned.state,
    tactical: {
      ...returned.state.tactical,
      battle: {
        ...returned.state.tactical.battle,
        round: cast.state.groundAreas![0]!.expiresAtRound,
      },
    },
  })
  expect(expired.groundAreas).toEqual([])
})

it.each([
  { entryEffectTimingModes: ['instant'] },
  { entryEffectTimingModes: ['controlled', null] },
  { entryEffectEligibleRecipientIds: [null] },
  { entryEffectEligibleRecipientIds: [null, ['enemy', 'enemy']] },
])('rejects misaligned or forged captured entry metadata: %j', (patch) => {
  const state = JSON.parse(JSON.stringify(persistentCast().state)) as CombatEncounterState
  Object.assign(state.groundAreas![0]!, patch)
  expect(validateCombatGroundAreas(state).length).toBeGreaterThan(0)
})

it('rejects Pierce as a repeating entry payload without its specialized equipment-Armor resolver', () => {
  const value = groundSource().definition
  const group = value.behaviors[0]!
  expect(
    validateAbilityDefinition({
      ...value,
      behaviors: [
        {
          ...group,
          effects: [
            {
              id: 'pierce',
              payload: {
                type: 'pierce',
                recipient: 'affected-units',
                amount: 10,
                armorIgnoredBasisPoints: 5000,
              },
            },
          ],
          groundArea: { ...group.groundArea!, entryEffectIds: ['pierce'] },
        },
      ],
    }).length,
  ).toBeGreaterThan(0)
})

const groundCandidates: {
  id: string
  after: MatureSkillDefinition
}[] = JSON.parse(
  readFileSync(
    new URL(
      '../../../../docs/superpowers/specs/2026-10-10-roster-rebalance-proposals.json',
      import.meta.url,
    ),
    'utf8',
  ),
).records

it.each(['wildwarden.venom-shot', 'cinderweaver.flame-burst', 'frostweaver.chilling-mist'])(
  'compiles and executes the exact reviewed persistent group for %s and keeps its finite source on restore',
  (id) => {
    const row = groundCandidates.find((candidate) => candidate.id === id)!
    const captured = capturedMatureSkillAbilitySource(percentageDotEncounter(), row.after, 'actor')
    expect(captured).not.toBeNull()
    if (!captured) throw new Error('Missing actual Ground capture.')
    const state = reconcileCombatAbilitySources(
      {
        ...preparePv1fTurnEconomy(percentageDotEncounter()),
        groundEffectPolicyVersion: 1 as const,
      },
      [captured],
    )
    const input = {
      state,
      actorId: 'actor',
      root: { kind: 'canonical' as const, source: captured },
      selection: { kind: 'activate' as const },
      content: PV1F_COMBAT_CONTENT,
      context: combatAbilityCommandContext(state, captured),
    }
    const quote = prepareCombatAbilityCommand(input)
    expect(quote.evaluation.legal).toBe(true)
    expect(quote.action.groundArea).toMatchObject(row.after.groundArea!)
    const cast = commitCombatAbilityCommand(input)
    const area = cast.state.groundAreas![0]!
    expect(area.sourceActionId).toBe(id)
    expect(area.expiresAtRound - area.activationRound).toBe(row.after.groundArea!.durationRounds)
    expect(area.entryEffects).toEqual(
      row.after.groundArea!.entryEffectOrdinals.map((ordinal) => row.after.effects[ordinal]),
    )
    expect(area.entryEffects.every((effect) => effect.recipient !== 'actor')).toBe(true)
    const restored = JSON.parse(JSON.stringify(cast.state)) as CombatEncounterState
    expect(validateCombatEncounterState(restored)).toEqual([])
    const visible = projectPublicCombatGroundAreas(
      restored.groundAreas!,
      restored.tactical.battle.round,
      'active',
    )
    expect(Object.keys(visible[0]!).sort()).toEqual([
      'activationRound',
      'expiresAtRound',
      'id',
      'tiles',
      'visualPresetId',
    ])
    expect(
      advanceCombatGroundAreas({
        ...restored,
        tactical: {
          ...restored.tactical,
          battle: { ...restored.tactical.battle, lifecycle: 'completed' },
        },
      }).groundAreas,
    ).toEqual([])
  },
)

it('lets the real AI quote and commit a captured persistent Ground command', () => {
  const captured = captureCombatAbilitySource({
    ...groundSource(),
    definition: {
      schemaVersion: 1,
      behaviors: [
        {
          ...groundSource().definition.behaviors[0]!,
          effects: [
            { id: 'hit', payload: { type: 'damage', recipient: 'affected-units', amount: 20 } },
          ],
          targeting: {
            ...groundSource().definition.behaviors[0]!.targeting!,
            shape: { kind: 'circle', radius: 1 },
            maximumRange: 1,
          },
          groundArea: {
            durationRounds: 2,
            visualPresetId: 'arcane-pulse',
            entryEffectIds: ['hit'],
            timing: 'instant',
          },
        },
      ],
    },
  })
  const state = reconcileCombatAbilitySources(
    { ...preparePv1fTurnEconomy(percentageDotEncounter()), groundEffectPolicyVersion: 1 as const },
    [captured],
  ) as StatDrivenCombatEncounterState
  const before = JSON.stringify(state)
  const choice = chooseBuildAwareRecruitAiDecision({ state, tieBreakSeed: 1 })
  expect(choice.intent).toMatchObject({
    kind: 'action',
    actionId: captured.abilityId,
    behaviorId: 'strike',
  })
  expect(JSON.stringify(state)).toBe(before)
  if (choice.intent.kind !== 'action') throw new Error('Expected a canonical Ground action.')
  const cast = executeBuildAwareRecruitAiAction(
    state,
    choice.intent.actionId,
    choice.intent.target,
    undefined,
    { behaviorId: choice.intent.behaviorId },
  )
  expect(cast.state.groundAreas).toHaveLength(1)
  expect(cast.state.groundAreas![0]!.sourceActionId).toBe(captured.abilityId)
})

it.each(['poison', 'burn'] as const)(
  'does not apply conditional %s on entry when its captured recipient Requirement failed',
  (dotType) => {
    const group = groundSource().definition.behaviors[0]!
    const captured = captureCombatAbilitySource(
      source({
        ...group,
        effects: [
          { id: 'hit', payload: { type: 'damage', recipient: 'affected-units', amount: 20 } },
          {
            id: 'dot',
            requirements: {
              kind: 'status-presence',
              subject: 'affected',
              statusId: 'marked',
              present: true,
            },
            payload: {
              type: dotType,
              recipient: 'affected-units',
              durationTurns: 2,
              curseCopyable: true,
              damageProfile: {
                kind: 'attack-percentage',
                basisPoints: 1500,
                ...(dotType === 'burn' ? { decayBasisPointsPerTick: 500 } : {}),
              },
            },
          },
        ],
        groundArea: {
          durationRounds: 3,
          visualPresetId: 'arcane-pulse',
          entryEffectIds: ['hit', 'dot'],
          timing: 'instant',
        },
      }),
    )
    const state = reconcileCombatAbilitySources(
      {
        ...preparePv1fTurnEconomy(percentageDotEncounter()),
        groundEffectPolicyVersion: 1 as const,
      },
      [captured],
    )
    const cast = commitCombatAbilityCommand({
      state,
      actorId: 'actor',
      root: { kind: 'canonical', source: captured },
      selection: { kind: 'tile', position: { x: 2, y: 2 } },
      content: PV1F_COMBAT_CONTENT,
      context: combatAbilityCommandContext(state, captured),
    })
    expect(cast.state.groundAreas![0]!.entryEffectEligibleRecipientIds).toEqual([null, []])
    const entered = executePv1fMovement(enemyTurn(cast.state) as StatDrivenCombatEncounterState, [
      { x: 2, y: 1 },
      { x: 2, y: 2 },
    ])
    expect(
      entered.state.tactical.battle.combatants.find((unit) => unit.id === 'enemy')!.hp,
    ).toBeLessThan(1000)
    expect(hasCurrentPoison(entered.state, 'enemy')).toBe(false)
    expect(currentBurnInstance(entered.state, 'enemy')).toBeNull()
  },
)

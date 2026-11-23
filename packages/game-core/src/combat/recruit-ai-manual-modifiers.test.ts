import { expect, it } from 'vitest'
import {
  captured,
  fixture,
  unit,
  ap,
  give,
  hasStatus,
  restoreRosterEncounter as restored,
} from './roster-outcome.test-utils'
import {
  chooseBuildAwareRecruitAiDecision,
  executeBuildAwareRecruitAiAction,
} from './recruit-ai-build'
import { resolveMatureSkillVersion } from './mature-skills'
import { captureCombatAbilitySource } from './combat-behavior-capture'
import { reconcileCombatAbilitySources } from './combat-behavior-runtime'
import { source as authoredSource } from './combat-behavior.test-utils'
import { RECRUIT_STANDARD_PROFILE, chooseRecruitAiDecision } from './recruit-ai'
import { PV1F_BASIC_ATTACK_ID } from './pv1f-action-economy'

const shot = 'farstrider.aimed-shot',
  focus = 'farstrider.keen-focus'
const references = [{ sourceInstanceId: focus, behaviorId: 'keen-focus' }]
function ready() {
  const state = fixture([shot, focus])
  state.tactical.placements.find((row) => row.combatantId === 'actor')!.position = { x: 0, y: 1 }
  return restored(state)
}
it('AI chooses a useful exact proposed Manual attachment and commits its real damage and combined price', () => {
  const state = ready(),
    before = JSON.stringify(state)
  expect(captured(shot).contentVersion).toBe(5)
  expect(captured(focus).contentVersion).toBe(5)
  const decision = chooseBuildAwareRecruitAiDecision({ state, tieBreakSeed: 7 })
  expect(decision.intent).toMatchObject({
    kind: 'action',
    actionId: shot,
    manualModifiers: references,
  })
  expect(chooseBuildAwareRecruitAiDecision({ state, tieBreakSeed: 7 })).toEqual(decision)
  expect(JSON.stringify(state)).toBe(before)
  if (decision.intent.kind !== 'action') throw new Error('Expected an actual paid action.')
  const out = executeBuildAwareRecruitAiAction(
    state,
    decision.intent.actionId,
    decision.intent.target,
    {},
    { ...decision.intent },
  )
  expect(unit(restored(out.state), 'enemy').hp).toBe(971)
  expect(ap(out.state)).toBe(45)
  expect(unit(out.state).mp).toBe(17)
  expect(JSON.stringify(state)).toBe(before)
})
it('AI omits an unaffordable or nonbeneficial optional Manual attachment', () => {
  const poor = ready()
  unit(poor).mp = 2
  const unavailable = chooseBuildAwareRecruitAiDecision({ state: poor, tieBreakSeed: 7 })
  expect(unavailable.intent).toMatchObject({ kind: 'action', actionId: shot })
  expect(unavailable.intent).not.toHaveProperty('manualModifiers')
  const capped = ready()
  unit(capped, 'enemy').hp = 1
  unit(capped, 'other').hp = 1
  const pointless = chooseBuildAwareRecruitAiDecision({ state: capped, tieBreakSeed: 7 })
  expect(pointless.intent).toMatchObject({ kind: 'action', actionId: shot })
  expect(pointless.intent).not.toHaveProperty('manualModifiers')
})
it('AI captures a free Controlled bundle, restores it and releases the identical attachment set once', () => {
  // An authored Controlled attack exercises this generic contract; the proposed
  // Aimed Shot explicitly fixes Instant timing and must never be rewritten.
  const root = captureCombatAbilitySource({
    ...authoredSource(
      {
        costs: [{ resource: 'ap', amount: 45 }],
        accuracy: { kind: 'fixed', chanceBasisPoints: 10000 },
        effects: [
          {
            id: 'hit',
            timing: 'controlled',
            payload: { type: 'damage', recipient: 'primary-unit', amount: 20 },
          },
        ],
      },
      'ai.controlled-root',
    ),
    abilityId: 'test.ai-controlled-shot',
    sourceDisciplineId: 'farstrider',
  })
  const base = fixture([focus])
  base.tactical.placements.find((row) => row.combatantId === 'actor')!.position = { x: 0, y: 1 }
  const initial = restored(
      reconcileCombatAbilitySources(base, [...base.capturedAbilitySources!, root]),
    ),
    before = JSON.stringify(initial)
  const prime = chooseBuildAwareRecruitAiDecision({ state: initial, tieBreakSeed: 7 })
  expect(prime.intent).toMatchObject({
    kind: 'ability-prime',
    actionId: root.abilityId,
    manualModifiers: references,
  })
  if (prime.intent.kind !== 'ability-prime') throw new Error('Expected a free whole-action prime.')
  const primed = executeBuildAwareRecruitAiAction(
    initial,
    prime.intent.actionId,
    { kind: 'self' },
    {},
    { ...prime.intent, controlledOperation: 'prime' },
  )
  expect(primed.events).toEqual([])
  expect(ap(primed.state)).toBe(100)
  expect(unit(primed.state).mp).toBe(20)
  const restoredPrime = restored(
    reconcileCombatAbilitySources(restored(primed.state), [
      ...primed.state.capturedAbilitySources!,
      extraModifier('ai-new-after-prime'),
    ]),
  )
  expect(restoredPrime.abilityRuntime!.controlled!.primes[0]!.manualModifiers).toMatchObject(
    references,
  )
  const poor = restored(restoredPrime)
  unit(poor).mp = 2
  const poorBefore = JSON.stringify(poor)
  expect(
    chooseBuildAwareRecruitAiDecision({ state: poor, tieBreakSeed: 7 }).intent,
  ).not.toMatchObject({ kind: 'action', actionId: root.abilityId })
  expect(JSON.stringify(poor)).toBe(poorBefore)
  expect(poor.abilityRuntime!.controlled!.primes).toHaveLength(1)
  const beforeRelease = JSON.stringify(restoredPrime)
  expect(() =>
    executeBuildAwareRecruitAiAction(
      restoredPrime,
      root.abilityId,
      { kind: 'unit', combatantId: 'enemy' },
      {},
      { behaviorId: 'strike' },
    ),
  ).toThrow('controlled-modifier-bundle-mismatch')
  expect(JSON.stringify(restoredPrime)).toBe(beforeRelease)
  const release = chooseBuildAwareRecruitAiDecision({ state: restoredPrime, tieBreakSeed: 7 })
  expect(release.intent).toMatchObject({
    kind: 'action',
    actionId: root.abilityId,
    manualModifiers: references,
  })
  if (release.intent.kind !== 'action') throw new Error('Expected a paid release.')
  const out = executeBuildAwareRecruitAiAction(
    restoredPrime,
    root.abilityId,
    release.intent.target,
    {},
    { ...release.intent },
  )
  expect(unit(restored(out.state), 'enemy').hp).toBe(968)
  expect(ap(out.state)).toBe(45)
  expect(unit(out.state).mp).toBe(17)
  expect(out.state.abilityRuntime!.controlled!.primes).toEqual([])
  expect(out.state.abilityRuntime!.controlled!.used).toHaveLength(1)
  expect(
    chooseBuildAwareRecruitAiDecision({ state: restored(out.state), tieBreakSeed: 7 }).intent,
  ).not.toMatchObject({ kind: 'ability-prime', actionId: root.abilityId })
  expect(JSON.stringify(initial)).toBe(before)
})
it('AI can choose and execute the same attachment on an existing native Skill root', () => {
  const state = fixture([focus])
  state.tactical.placements.find((row) => row.combatantId === 'actor')!.position = { x: 0, y: 1 }
  const definition = resolveMatureSkillVersion(shot)!,
    skillOptions = { committedSkills: [definition] }
  const decision = chooseBuildAwareRecruitAiDecision({ state, skillOptions, tieBreakSeed: 7 })
  expect(decision.intent).toMatchObject({
    kind: 'action',
    actionId: shot,
    manualModifiers: references,
  })
  if (decision.intent.kind !== 'action') throw new Error('Expected a native Skill.')
  const plain = executeBuildAwareRecruitAiAction(state, shot, decision.intent.target, skillOptions)
  const out = executeBuildAwareRecruitAiAction(state, shot, decision.intent.target, skillOptions, {
    ...decision.intent,
  })
  expect(unit(out.state, 'enemy').hp).toBeLessThan(unit(plain.state, 'enemy').hp)
  expect(ap(out.state)).toBe(ap(plain.state)! - 10)
  expect(unit(out.state).mp).toBe(unit(plain.state).mp - 3)
  restored(out.state)
})

function extraModifier(id: string, amount = 1) {
  return captureCombatAbilitySource({
    ...authoredSource(
      {
        activation: 'manual',
        mode: 'modifier',
        classification: 'utility',
        attackFamily: undefined,
        targeting: null,
        requirements: null,
        costs: [{ resource: 'ap', amount }],
        cooldown: null,
        effects: [
          {
            id: 'bonus',
            payload: { type: 'damage-bonus', recipient: 'actor', multiplierBasisPoints: 11000 },
          },
        ],
      },
      id,
    ),
    abilityId: `test.${id}`,
  })
}
it('AI also considers an optional Manual bundle for a historical native Basic Attack', () => {
  const base = fixture([]),
    modifier = extraModifier('ai-basic-boost', 5)
  const state = restored(reconcileCombatAbilitySources(base, [modifier]))
  const decision = chooseBuildAwareRecruitAiDecision({ state, tieBreakSeed: 7 })
  expect(decision.intent).toMatchObject({
    kind: 'action',
    actionId: PV1F_BASIC_ATTACK_ID,
    manualModifiers: [{ sourceInstanceId: modifier.sourceInstanceId, behaviorId: 'strike' }],
  })
  if (decision.intent.kind !== 'action') throw new Error('Expected a Basic attack.')
  const plain = executeBuildAwareRecruitAiAction(
    state,
    PV1F_BASIC_ATTACK_ID,
    decision.intent.target,
  )
  const out = executeBuildAwareRecruitAiAction(
    state,
    PV1F_BASIC_ATTACK_ID,
    decision.intent.target,
    {},
    { ...decision.intent },
  )
  expect(unit(out.state, 'enemy').hp).toBeLessThan(unit(plain.state, 'enemy').hp)
  expect(ap(out.state)).toBe(65)
})
it('AI scores plural targets separately for each exact bundle and pays two modifiers only once', () => {
  const extra = extraModifier('ai-second-boost', 5)
  const original = captured(shot)
  const root = captureCombatAbilitySource({
    ...original,
    sourceInstanceId: 'ai.plural-root',
    abilityId: 'test.ai-plural-shot',
    contentVersion: 1,
    definition: {
      ...original.definition,
      behaviors: original.definition.behaviors.map((group) => ({
        ...group,
        targeting: { ...group.targeting!, maximumSelections: 2 },
      })),
    },
  })
  // Generic authored plural-root contract, separate from the immutable proposed Aimed Shot.
  const base = fixture([focus])
  base.tactical.placements.find((row) => row.combatantId === 'actor')!.position = { x: 0, y: 1 }
  const state = restored(
    reconcileCombatAbilitySources(base, [...base.capturedAbilitySources!, root, extra]),
  )
  const decision = chooseBuildAwareRecruitAiDecision({ state, tieBreakSeed: 7 })
  expect(decision.intent.kind).toBe('action')
  if (decision.intent.kind !== 'action') throw new Error('Expected a plural attack.')
  expect(decision.intent.target).toEqual({
    kind: 'selections',
    selections: [
      { kind: 'unit', combatantId: 'enemy' },
      { kind: 'unit', combatantId: 'other' },
    ],
  })
  expect(decision.intent.manualModifiers).toHaveLength(2)
  const out = executeBuildAwareRecruitAiAction(
    state,
    root.abilityId,
    decision.intent.target,
    {},
    { ...decision.intent },
  )
  expect(unit(out.state, 'enemy').hp).toBeLessThan(971)
  expect(unit(out.state, 'other').hp).toBe(unit(out.state, 'enemy').hp)
  expect(ap(out.state)).toBe(40)
  expect(unit(out.state).mp).toBe(17)
  restored(out.state)
})
it('AI bounds custom-catalogue bundle search by the profile budget and remains deterministic', () => {
  const base = fixture([shot])
  base.tactical.placements.find((row) => row.combatantId === 'actor')!.position = { x: 0, y: 1 }
  const state = restored(
    reconcileCombatAbilitySources(base, [
      ...base.capturedAbilitySources!,
      ...Array.from({ length: 8 }, (_, i) => extraModifier(`ai-budget-${i}`)),
    ]),
  )
  const before = JSON.stringify(state),
    baseline = chooseRecruitAiDecision({ state, tieBreakSeed: 7 })
  const decision = chooseBuildAwareRecruitAiDecision({ state, tieBreakSeed: 7 })
  expect(decision.candidateCount - baseline.candidateCount).toBe(
    2 * RECRUIT_STANDARD_PROFILE.maxCandidates,
  )
  expect(chooseBuildAwareRecruitAiDecision({ state, tieBreakSeed: 7 })).toEqual(decision)
  expect(JSON.stringify(state)).toBe(before)
})
it.each(['missing', 'duplicate', 'unaffordable', 'foreign', 'inactive'] as const)(
  'AI executor rejects a %s explicit attachment without dropping it or paying',
  (kind) => {
    let state = ready()
    let refs =
      kind === 'duplicate'
        ? [...references, ...references]
        : kind === 'missing'
          ? [{ sourceInstanceId: 'absent', behaviorId: 'keen-focus' }]
          : references
    if (kind === 'unaffordable') unit(state).mp = 2
    if (kind === 'inactive')
      state = restored(reconcileCombatAbilitySources(state, [captured(shot)]))
    if (kind === 'foreign') {
      refs = [{ sourceInstanceId: 'foreign-focus', behaviorId: 'keen-focus' }]
      state = restored(
        reconcileCombatAbilitySources(state, [
          captured(shot),
          captureCombatAbilitySource({
            ...captured(focus),
            ownerCombatantId: 'ally',
            sourceInstanceId: 'foreign-focus',
          }),
        ]),
      )
    }
    const before = JSON.stringify(state)
    const errors = {
      missing: 'modifier-source-missing',
      duplicate: 'duplicate-modifier-reference',
      unaffordable: 'insufficient-mp',
      foreign: 'modifier-source-owner-mismatch',
      inactive: 'modifier-source-inactive',
    }
    expect(() =>
      executeBuildAwareRecruitAiAction(
        state,
        shot,
        { kind: 'unit', combatantId: 'enemy' },
        {},
        { manualModifiers: refs },
      ),
    ).toThrow(errors[kind])
    expect(JSON.stringify(state)).toBe(before)
  },
)
it('AI respects the existing Revealed aggregate AP price when choosing optional attachments', () => {
  const state = restored(give(ready(), 'revealed', 'actor'))
  expect(hasStatus(state, 'revealed')).toBe(true)
  const decision = chooseBuildAwareRecruitAiDecision({ state, tieBreakSeed: 7 })
  expect(decision.intent).toMatchObject({ kind: 'action', actionId: shot })
  expect(decision.intent).not.toHaveProperty('manualModifiers')
  if (decision.intent.kind !== 'action') throw new Error('Expected an unaffixed Skill.')
  const out = executeBuildAwareRecruitAiAction(
    state,
    shot,
    decision.intent.target,
    {},
    { ...decision.intent },
  )
  expect(ap(out.state)).toBe(10)
  expect(unit(out.state).mp).toBe(20)
})
it('a genuine terminal hit prevents further AI choice or attachment execution without changing state', () => {
  const state = ready()
  unit(state, 'enemy').hp = 1
  unit(state, 'other').hp = 0
  const out = executeBuildAwareRecruitAiAction(state, shot, { kind: 'unit', combatantId: 'enemy' })
  expect(unit(out.state, 'enemy').hp).toBe(0)
  expect(out.state.tactical.battle.lifecycle).not.toBe('active')
  const before = JSON.stringify(out.state)
  expect(() => chooseBuildAwareRecruitAiDecision({ state: out.state, tieBreakSeed: 7 })).toThrow(
    'active battle turn',
  )
  expect(() =>
    executeBuildAwareRecruitAiAction(
      out.state,
      shot,
      { kind: 'unit', combatantId: 'enemy' },
      {},
      { manualModifiers: references },
    ),
  ).toThrow('active turn')
  expect(JSON.stringify(out.state)).toBe(before)
})

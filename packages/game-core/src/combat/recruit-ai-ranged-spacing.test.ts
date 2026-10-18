import { afterEach, describe, expect, it, vi } from 'vitest'
import * as commands from './combat-ability-command'
import { captureCombatAbilitySource } from './combat-behavior-capture'
import { source as authoredSource } from './combat-behavior.test-utils'
import {
  captureBasicSkillSources,
  defaultBasicSkills,
  type BasicSkillDefinition,
} from './combat-basic-actions'
import {
  reconcileCombatAbilitySources,
  primeCombatControlledAbility,
} from './combat-behavior-runtime'
import {
  fixture,
  give,
  unit,
  restoreRosterEncounter,
  captured,
  input,
  commitRosterCommand,
} from './roster-outcome.test-utils'
import { applySkillCooldown } from './skill-cooldowns'
import { resolveMatureSkillVersion } from './mature-skills'
import {
  chooseBuildAwareRecruitAiDecision,
  executeBuildAwareRecruitAiAction,
  projectedCombatEffectUtility,
} from './recruit-ai-build'
import { RECRUIT_EASY_PROFILE, RECRUIT_STANDARD_PROFILE, RECRUIT_HIGH_PROFILE } from './recruit-ai'
import {
  executePv1fMovement,
  finishPv1fTurn,
  readPv1fActionEconomy,
  PV1F_ACTION_ECONOMY_RESOURCE_KEY,
  PV1F_BASIC_ATTACK_ID,
  evaluatePv1fAction,
  evaluatePv1fMatureSkill,
} from './pv1f-action-economy'
afterEach(() => vi.restoreAllMocks())
function ready(basics: readonly BasicSkillDefinition[] = defaultBasicSkills()) {
  let state = fixture(['farstrider.volley'])
  state.tactical.battle.combatants = state.tactical.battle.combatants.map((u) =>
    u.id === 'ally' ? { ...u, teamId: 'enemies' } : u,
  )
  const positions = {
    actor: { x: 1, y: 1 },
    enemy: { x: 2, y: 1 },
    other: { x: 1, y: 0 },
    ally: { x: 1, y: 2 },
  }
  const facings = { actor: 'east', enemy: 'west', other: 'south', ally: 'north' } as const
  state.tactical.placements = state.tactical.placements.map((p) => ({
    ...p,
    position: positions[p.combatantId as keyof typeof positions],
    facing: facings[p.combatantId as keyof typeof facings],
  }))
  state = restoreRosterEncounter(
    reconcileCombatAbilitySources(state, [
      ...state.capturedAbilitySources!,
      ...captureBasicSkillSources({
        ownerCombatantId: 'actor',
        supportActionId: 'basic.recover',
        definitions: basics,
      }),
    ]),
  )
  return state
}
function moveDefinition(
  cost: number,
  kind: 'flat' | 'per-terrain-point' = 'per-terrain-point',
  enabled = true,
) {
  return defaultBasicSkills().map((b) =>
    b.id !== 'basic.move'
      ? b
      : {
          ...b,
          contentVersion: 2,
          enabled,
          execution: { kind: 'basic-move' as const, costBasis: kind },
          ability: {
            ...b.ability,
            behaviors: b.ability.behaviors.map((g) => ({
              ...g,
              costs: [{ resource: 'ap' as const, amount: cost }],
            })),
          },
        },
  )
}
function heldLongshot(basics: readonly BasicSkillDefinition[] = defaultBasicSkills()) {
  let state = fixture(['farstrider.longshot', 'farstrider.keen-focus'])
  state.tactical.battle.combatants = state.tactical.battle.combatants.map((unit) =>
    unit.id === 'other' ? { ...unit, teamId: 'players' } : unit,
  )
  state.tactical.placements = state.tactical.placements.map((p) =>
    p.combatantId === 'enemy'
      ? { ...p, position: { x: 3, y: 1 } }
      : p.combatantId === 'other'
        ? { ...p, position: { x: 4, y: 4 } }
        : p,
  )
  state = restoreRosterEncounter(
    reconcileCombatAbilitySources(state, [
      ...state.capturedAbilitySources!,
      ...captureBasicSkillSources({
        ownerCombatantId: 'actor',
        supportActionId: 'basic.recover',
        definitions: basics,
      }),
    ]),
  )
  const references = [{ sourceInstanceId: 'farstrider.keen-focus', behaviorId: 'keen-focus' }]
  const primed = primeCombatControlledAbility({
    state,
    actorId: 'actor',
    sourceInstanceId: 'farstrider.longshot',
    behaviorId: 'longshot',
    manualModifiers: references,
  })
  state = restoreRosterEncounter(primed.state)
  return state
}
describe('bounded ranged opportunity planning uses live shared command authority', () => {
  it.each([RECRUIT_EASY_PROFILE, RECRUIT_STANDARD_PROFILE, RECRUIT_HIGH_PROFILE])(
    '$id is immutable, deterministic, independent of future RNG and bounded in this four-unit fixture',
    (profile) => {
      const state = ready(),
        before = JSON.stringify(state)
      const spy = vi.spyOn(commands, 'prepareCombatAbilityCommand')
      const decision = chooseBuildAwareRecruitAiDecision({ state, profile, tieBreakSeed: 7 })
      expect(decision.reason).toBe('ranged-spacing')
      expect(decision.intent.kind).toBe('move')
      expect(spy.mock.calls.length).toBeGreaterThan(0)
      expect(spy.mock.calls.length).toBeLessThanOrEqual(profile.maxCandidates)
      expect(chooseBuildAwareRecruitAiDecision({ state, profile, tieBreakSeed: 7 })).toEqual(
        decision,
      )
      const different = structuredClone(state)
      different.tactical.battle.rng = {
        ...different.tactical.battle.rng,
        state: 987654321,
        draws: 123,
      }
      expect(
        chooseBuildAwareRecruitAiDecision({ state: different, profile, tieBreakSeed: 7 }),
      ).toEqual(decision)
      expect(JSON.stringify(state)).toBe(before)
    },
  )
  it.each([
    'root',
    'movement',
    'ap',
    'cooldown',
    'removed',
    'disabled',
    'expensive',
    'rough',
    'jump',
  ] as const)('%s cannot create an unaffordable or unavailable firing lane', (constraint) => {
    let state = ready(
      constraint === 'disabled'
        ? moveDefinition(20, 'per-terrain-point', false)
        : constraint === 'expensive'
          ? moveDefinition(60)
          : undefined,
    )
    if (constraint === 'root') state = give(state, 'root', 'actor')
    if (constraint === 'rough') {
      state.tactical.terrains = [
        ...state.tactical.terrains,
        { id: 'rough-spacing', traversalCost: 3 },
      ]
      state.tactical.tiles = state.tactical.tiles.map((tile) =>
        tile.position.x === 0 && tile.position.y === 1
          ? { ...tile, terrainId: 'rough-spacing' }
          : tile,
      )
    }
    if (constraint === 'jump')
      state.tactical.tiles = state.tactical.tiles.map((tile) =>
        tile.position.x === 0 && tile.position.y === 1 ? { ...tile, elevation: 1 } : tile,
      )
    if (constraint === 'movement') {
      state.tactical.battle.currentTurn!.movementRemaining = 0
      state.tactical.battle.currentTurn!.movementSpent =
        state.tactical.battle.currentTurn!.movementMaximum
    }
    if (constraint === 'ap')
      unit(state).temporaryResources = unit(state).temporaryResources.map((r) =>
        r.key === PV1F_ACTION_ECONOMY_RESOURCE_KEY ? { ...r, current: 74 } : r,
      )
    if (constraint === 'cooldown') {
      const b = state.capturedAbilitySources!.find((s) => s.abilityId === 'farstrider.volley')!
        .definition.behaviors[0]!
      const cooled = applySkillCooldown(unit(state), b.cooldown!, {
        actionId: 'farstrider.volley',
        definitionVersion: 5,
      })
      state.tactical.battle.combatants = state.tactical.battle.combatants.map((u) =>
        u.id === 'actor' ? cooled.combatant : u,
      )
    }
    if (constraint === 'removed')
      state = restoreRosterEncounter(
        reconcileCombatAbilitySources(
          state,
          state.capturedAbilitySources!.filter((s) => s.abilityId !== 'farstrider.volley'),
        ),
      )
    const before = JSON.stringify(state)
    const decision = chooseBuildAwareRecruitAiDecision({ state, tieBreakSeed: 7 })
    expect(decision.reason).not.toBe('ranged-spacing')
    expect(decision.intent).toMatchObject({
      kind: 'action',
      actionId: 'basic.attack.unarmed.basic',
    })
    expect(JSON.stringify(state)).toBe(before)
  })
  it('does not promise a followup through a real captured Ground entry area', () => {
    let state: ReturnType<typeof ready> = { ...ready(), groundEffectPolicyVersion: 1 }
    state = restoreRosterEncounter(
      reconcileCombatAbilitySources(state, [
        ...state.capturedAbilitySources!,
        captured('wildwarden.venom-shot'),
      ]),
    )
    state = commitRosterCommand(input(state, 'wildwarden.venom-shot', { kind: 'activate' })).state
    for (let i = 0; i < 4; i++) {
      const owner = state.tactical.battle.currentTurn!.combatantId
      const facing = state.tactical.placements.find((row) => row.combatantId === owner)!.facing
      state = restoreRosterEncounter(finishPv1fTurn(state, facing).state)
    }
    expect(state.tactical.battle.currentTurn!.combatantId).toBe('actor')
    expect(
      state.groundAreas?.some((area) => area.tiles.some((tile) => tile.x === 0 && tile.y === 1)),
    ).toBe(true)
    const before = JSON.stringify(state)
    expect(chooseBuildAwareRecruitAiDecision({ state, tieBreakSeed: 7 }).reason).not.toBe(
      'ranged-spacing',
    )
    expect(JSON.stringify(state)).toBe(before)
  })
  it('uses the captured flat Basic Move command and its exact one-time payment', () => {
    const state = ready(moveDefinition(15, 'flat'))
    const decision = chooseBuildAwareRecruitAiDecision({ state, tieBreakSeed: 7 })
    expect(decision.intent).toMatchObject({
      kind: 'action',
      actionId: 'basic.move',
      target: { kind: 'self' },
    })
    if (decision.intent.kind !== 'action') throw Error('Expected captured flat Move facade')
    const moved = executeBuildAwareRecruitAiAction(
      state,
      decision.intent.actionId,
      decision.intent.target,
      {},
      decision.intent,
    )
    expect(readPv1fActionEconomy(moved.state)!.current).toBe(85)
    const shot = chooseBuildAwareRecruitAiDecision({ state: moved.state, tieBreakSeed: 7 })
    expect(shot.intent).toMatchObject({ kind: 'action', actionId: 'farstrider.volley' })
  })
  it('does not project a richer flat Move without its actual MP payment', () => {
    const basics = moveDefinition(15, 'flat').map((basic) =>
      basic.id !== 'basic.move'
        ? basic
        : {
            ...basic,
            ability: {
              ...basic.ability,
              behaviors: basic.ability.behaviors.map((behavior) => ({
                ...behavior,
                costs: [...behavior.costs, { resource: 'mp' as const, amount: 15 }],
              })),
            },
          },
    )
    const state = heldLongshot(basics)
    const before = JSON.stringify(state)
    const moved = executeBuildAwareRecruitAiAction(
      state,
      'basic.move',
      { kind: 'self' },
      {},
      {
        movementPath: [
          { x: 1, y: 1 },
          { x: 0, y: 1 },
        ],
      },
    )
    expect(unit(moved.state).mp).toBe(5)
    expect(
      commands.prepareCombatAbilityCommand({
        ...input(moved.state, 'farstrider.longshot'),
        manualModifiers: [{ sourceInstanceId: 'farstrider.keen-focus', behaviorId: 'keen-focus' }],
      }).evaluation.legal,
    ).toBe(false)
    expect(chooseBuildAwareRecruitAiDecision({ state, tieBreakSeed: 7 }).reason).not.toBe(
      'ranged-spacing',
    )
    expect(JSON.stringify(state)).toBe(before)
  })
  it('keeps an immediately available historical native Basic attachment with better paid value per AP', () => {
    const modifier = captureCombatAbilitySource(
      authoredSource(
        {
          activation: 'manual',
          mode: 'modifier',
          classification: 'utility',
          attackFamily: undefined,
          targeting: null,
          requirements: null,
          cooldown: null,
          costs: [{ resource: 'ap', amount: 1 }],
          effects: [
            {
              id: 'boost',
              payload: { type: 'damage-bonus', recipient: 'actor', multiplierBasisPoints: 15000 },
            },
          ],
        },
        'spacing.native-boost',
      ),
    )
    const shot = captureCombatAbilitySource({
      ...authoredSource(
        {
          costs: [{ resource: 'ap', amount: 45 }],
          targeting: { ...authoredSource().definition.behaviors[0]!.targeting!, minimumRange: 2 },
          effects: [
            { id: 'hit', payload: { type: 'damage', recipient: 'primary-unit', amount: 16 } },
          ],
        },
        'spacing.native-shot',
      ),
      abilityId: 'test.spacing-shot',
    })
    const base = fixture([])
    const geometry = ready()
    base.tactical.placements = geometry.tactical.placements.map((placement) =>
      placement.combatantId === 'other' ? { ...placement, position: { x: 4, y: 4 } } : placement,
    )
    base.tactical.battle.combatants = base.tactical.battle.combatants.map((combatant) => ({
      ...combatant,
      teamId: combatant.id === 'enemy' || combatant.id === 'other' ? 'enemies' : 'players',
    }))
    const state = restoreRosterEncounter(reconcileCombatAbilitySources(base, [shot, modifier]))
    const references = [{ sourceInstanceId: modifier.sourceInstanceId, behaviorId: 'strike' }]
    const basic = evaluatePv1fAction(
      state,
      PV1F_BASIC_ATTACK_ID,
      { kind: 'unit', combatantId: 'enemy' },
      { manualModifiers: references },
    )
    expect(basic.evaluation.issues).toEqual([])
    expect(basic.evaluation.legal).toBe(true)
    const moved = executePv1fMovement(state, [
      { x: 1, y: 1 },
      { x: 0, y: 1 },
    ])
    const volley = commands.prepareCombatAbilityCommand({
      ...input(moved.state, 'farstrider.volley'),
      root: { kind: 'canonical', source: shot },
      manualModifiers: references,
    })
    expect(volley.evaluation.legal).toBe(true)
    const value = projectedCombatEffectUtility(
      volley.evaluation,
      moved.state,
      volley.action.effects,
    )
    const cost = volley.costs
      .filter((row) => row.resource === 'ap')
      .reduce((sum, row) => sum + row.amount, 0)
    const basicUtility = projectedCombatEffectUtility(
      basic.evaluation,
      basic.prepared,
      basic.action.effects,
    )
    expect(basicUtility / basic.cost).toBeGreaterThan(value / (20 + cost))
    expect(value - 20 / 5).toBeGreaterThan(basicUtility)
    const before = JSON.stringify(state)
    expect(chooseBuildAwareRecruitAiDecision({ state, tieBreakSeed: 7 }).intent).toMatchObject({
      kind: 'action',
      actionId: PV1F_BASIC_ATTACK_ID,
      manualModifiers: references,
    })
    expect(JSON.stringify(state)).toBe(before)
  })
  it('does not omit a legal positive-value zero-AP immediate canonical alternative', () => {
    const free = captureCombatAbilitySource(
      authoredSource(
        {
          costs: [],
          targeting: {
            ...authoredSource().definition.behaviors[0]!.targeting!,
            minimumRange: 1,
            maximumRange: 1,
          },
          effects: [
            { id: 'free-hit', payload: { type: 'damage', recipient: 'primary-unit', amount: 1 } },
          ],
        },
        'spacing.free-immediate',
      ),
    )
    const base = ready()
    const state = restoreRosterEncounter(
      reconcileCombatAbilitySources(base, [...base.capturedAbilitySources!, free]),
    )
    const quote = commands.prepareCombatAbilityCommand({
      ...input(state, 'farstrider.volley'),
      root: { kind: 'canonical', source: free },
    })
    expect(quote.evaluation.legal).toBe(true)
    expect(
      quote.costs
        .filter((cost) => cost.resource === 'ap')
        .reduce((sum, cost) => sum + cost.amount, 0),
    ).toBe(0)
    expect(
      projectedCombatEffectUtility(quote.evaluation, state, quote.action.effects),
    ).toBeGreaterThan(0)
    const before = JSON.stringify(state)
    expect(chooseBuildAwareRecruitAiDecision({ state, tieBreakSeed: 7 }).reason).not.toBe(
      'ranged-spacing',
    )
    expect(JSON.stringify(state)).toBe(before)
  })
  it.each(['mana', 'cooldown'] as const)(
    'does not multiply a captured Basic with %s restrictions into a repeatable turn',
    (restriction) => {
      const basics = defaultBasicSkills().map((basic) =>
        basic.id !== 'unarmed.basic'
          ? basic
          : {
              ...basic,
              contentVersion: 2,
              ability: {
                ...basic.ability,
                behaviors: basic.ability.behaviors.map((behavior) => ({
                  ...behavior,
                  costs:
                    restriction === 'mana'
                      ? [...behavior.costs, { resource: 'mp' as const, amount: 15 }]
                      : behavior.costs,
                  cooldown:
                    restriction === 'cooldown'
                      ? { key: 'spacing.basic-cooldown', ownerTurns: 3 }
                      : behavior.cooldown,
                })),
              },
            },
      )
      let state = ready(basics)
      state.tactical.battle.combatants = state.tactical.battle.combatants.map((combatant) => ({
        ...combatant,
        teamId: combatant.id === 'enemy' ? 'enemies' : 'players',
      }))
      const shot = captureCombatAbilitySource({
        ...authoredSource(
          {
            costs: [{ resource: 'ap', amount: 45 }],
            targeting: { ...authoredSource().definition.behaviors[0]!.targeting!, minimumRange: 2 },
            effects: [
              { id: 'hit', payload: { type: 'damage', recipient: 'primary-unit', amount: 20 } },
            ],
          },
          'spacing.pure-shot',
        ),
        abilityId: 'test.spacing-pure-shot',
      })
      state = restoreRosterEncounter(
        reconcileCombatAbilitySources(state, [
          ...state.capturedAbilitySources!.filter(
            (source) => source.abilityId !== 'farstrider.volley',
          ),
          shot,
        ]),
      )
      const basic = evaluatePv1fAction(state, PV1F_BASIC_ATTACK_ID, {
        kind: 'unit',
        combatantId: 'enemy',
      })
      expect(basic.evaluation.legal).toBe(true)
      const once = executeBuildAwareRecruitAiAction(state, PV1F_BASIC_ATTACK_ID, {
        kind: 'unit',
        combatantId: 'enemy',
      })
      expect(
        evaluatePv1fAction(once.state, PV1F_BASIC_ATTACK_ID, { kind: 'unit', combatantId: 'enemy' })
          .evaluation.legal,
      ).toBe(false)
      const moved = executePv1fMovement(state, [
        { x: 1, y: 1 },
        { x: 0, y: 1 },
      ])
      const opportunity = commands.prepareCombatAbilityCommand({
        ...input(moved.state, 'farstrider.volley'),
        root: { kind: 'canonical', source: shot },
      })
      expect(opportunity.evaluation.legal).toBe(true)
      const value = projectedCombatEffectUtility(
        opportunity.evaluation,
        moved.state,
        opportunity.action.effects,
      )
      const basicValue = projectedCombatEffectUtility(
        basic.evaluation,
        basic.prepared,
        basic.action.effects,
      )
      const cost = opportunity.costs
        .filter((c) => c.resource === 'ap')
        .reduce((sum, c) => sum + c.amount, 0)
      expect(value / (20 + cost)).toBeGreaterThan(basicValue / basic.cost)
      expect(value).toBeLessThan(basicValue * 3)
      const before = JSON.stringify(state)
      expect(chooseBuildAwareRecruitAiDecision({ state, tieBreakSeed: 7 }).reason).toBe(
        'ranged-spacing',
      )
      expect(JSON.stringify(state)).toBe(before)
    },
  )
  it('includes a quoted historical Skill even when its raw utility is below the immediate winner', () => {
    const original = resolveMatureSkillVersion('vanguard.forceful-strike', 2)!
    const native = {
      ...original,
      id: 'test.spacing-efficient-native',
      apCost: 1,
      mpCost: 0,
      requirements: [],
      cooldown: { ...original.cooldown!, key: 'test.spacing-efficient-native' },
      overrides: {},
      ai: { ...original.ai, baseUtility: 0 },
    }
    const state = ready()
    const quote = evaluatePv1fMatureSkill(
      state,
      native,
      { kind: 'unit', combatantId: 'enemy' },
      'pve',
    )
    expect(quote.evaluation.legal).toBe(true)
    expect(quote.cost).toBe(1)
    expect(
      projectedCombatEffectUtility(quote.evaluation, state, quote.action.effects),
    ).toBeGreaterThan(0)
    const before = JSON.stringify(state)
    expect(
      chooseBuildAwareRecruitAiDecision({
        state,
        tieBreakSeed: 7,
        skillOptions: { committedSkills: [native] },
      }).reason,
    ).not.toBe('ranged-spacing')
    expect(JSON.stringify(state)).toBe(before)
  })
  it('preserves an already-held Controlled attachment bundle through the real reposition and release', () => {
    const state = heldLongshot()
    const references = [{ sourceInstanceId: 'farstrider.keen-focus', behaviorId: 'keen-focus' }]
    const prime = JSON.stringify(state.abilityRuntime!.controlled!.primes)
    const decision = chooseBuildAwareRecruitAiDecision({ state, tieBreakSeed: 7 })
    expect(decision.intent.kind).toBe('move')
    if (decision.intent.kind !== 'move') throw Error('Expected range3 reposition')
    const moved = executePv1fMovement(state, decision.intent.path)
    expect(JSON.stringify(moved.state.abilityRuntime!.controlled!.primes)).toBe(prime)
    const release = chooseBuildAwareRecruitAiDecision({ state: moved.state, tieBreakSeed: 7 })
    expect(release.intent).toMatchObject({
      kind: 'action',
      actionId: 'farstrider.longshot',
      manualModifiers: references,
    })
    if (release.intent.kind !== 'action') throw Error('Expected exact held release')
    const out = executeBuildAwareRecruitAiAction(
      moved.state,
      release.intent.actionId,
      release.intent.target,
      {},
      release.intent,
    )
    expect(readPv1fActionEconomy(out.state)!.current).toBe(10)
    expect(unit(out.state).mp).toBe(14)
    expect(out.state.abilityRuntime!.controlled!.primes).toHaveLength(0)
    expect(out.state.abilityRuntime!.controlled!.used).toHaveLength(1)
  })
})

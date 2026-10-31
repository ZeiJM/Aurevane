import { describe, expect, it } from 'vitest'
import {
  executeCombatAction,
  evaluateCombatAction,
  endCombatTurn,
  validateCombatEncounterState,
  type CombatActionDefinition,
  type CombatEncounterState,
  type CombatEffectDefinition,
} from './actions'
import { percentageDotEncounter } from './combat-percentage-dots.test-utils'
import { createCurrentStatDrivenCombatEncounterState } from './stat-driven-combat'
import { PHASE4_STATUSES } from './status-content'
import { createAuthorableEffectPayload } from './combat-effect-authoring'
import { validateCombatTagPayload } from './combat-tag-registry'
import { resolveMatureSkillVersion, validateMatureSkillDefinition } from './mature-skills'
import { createCombatGroundArea } from './combat-ground-areas'
import { resolveCombatMovementStepEffects } from './actions-legacy'
import {
  applyCurrentPoisonState,
  applyCurrentBurnState,
  applyCurrentBleedState,
} from './combat-dots'
import { captureCombatAbilitySource } from './combat-behavior-capture'
import { source } from './combat-behavior.test-utils'
import {
  activateCombatAbility,
  reconcileCombatAbilitySources,
  combatAbilityCommandContext,
  primeCombatControlledAbility,
} from './combat-behavior-runtime'
import { preparePv1fTurnEconomy } from './pv1f-action-economy'
import { selectCurrentFinalFacing } from './board'
import { captureAttackTagDamage } from './combat-attack-tags'
import { armCombatReversal, endCombatReversal, hasCombatReversalStrain } from './combat-reversal'

const definitions = ['test.a', 'test.b', 'test.c'].map((id) => ({
  id,
  version: 1,
  polarity: 'negative' as const,
  maximumStacks: 5,
  durationOwnerTurnStarts: 4,
  damageTakenMultiplierBasisPoints: 10000,
}))
const content = {
  statuses: [
    ...PHASE4_STATUSES,
    ...definitions,
    { ...definitions[0]!, id: 'test.buff', polarity: 'positive' as const },
    { ...definitions[0]!, id: 'test.neutral', polarity: 'neutral' as const },
  ],
}
function state(criticalChance = 0) {
  const base = percentageDotEncounter()
  return createCurrentStatDrivenCombatEncounterState(
    base,
    base.statBridge.combatants.map((row) => ({
      ...row,
      physicalPower: row.physicalPower ?? 20,
      mysticPower: row.mysticPower ?? 20,
      level: 1,
      criticalChance,
      statusResistance: 0,
    })),
  )
}
function debuffed(initial = state(), target = 'enemy', ids = ['test.a', 'test.b']) {
  return {
    ...initial,
    statusState: initial.statusState.map((row) =>
      row.combatantId === target
        ? {
            ...row,
            statuses: ids.map((statusId) => ({
              statusId,
              statusVersion: 1,
              stacks: 1,
              remainingOwnerTurnStarts: 4,
              sourceCombatantId: 'actor',
            })),
          }
        : row,
    ),
  }
}
const weak = (threshold: number) =>
  ({
    type: 'weak-point',
    recipient: 'actor',
    debuffThreshold: threshold,
  }) as unknown as CombatEffectDefinition
const ruin = (bonus: number) =>
  ({
    type: 'ruin',
    recipient: 'actor',
    bonusPerDebuffBasisPoints: bonus,
  }) as unknown as CombatEffectDefinition
const spike = { type: 'spike', recipient: 'actor' } as unknown as CombatEffectDefinition
function action(tags: readonly CombatEffectDefinition[], amount = 20): CombatActionDefinition {
  return {
    id: 'test.attack-tags',
    version: 1,
    sourceType: 'test',
    tags: ['attack', 'physical'],
    target: {
      kind: 'unit',
      teamPolicy: 'enemy',
      shape: { kind: 'single' },
      minimumRange: 1,
      maximumRange: 4,
      requiresLineOfSight: false,
      maximumElevationDifference: 0,
      friendlyFire: 'enemies-only',
    },
    cost: { spendsAction: false, mp: 0 },
    requirements: [],
    accuracyRule: { kind: 'fixed', chanceBasisPoints: 10000 },
    effects: [{ type: 'damage', recipient: 'primary-unit', amount }, ...tags],
  }
}
function cast(initial: CombatEncounterState, tags: readonly CombatEffectDefinition[], amount = 20) {
  return executeCombatAction(
    initial,
    action(tags, amount),
    { kind: 'unit', combatantId: 'enemy' },
    content,
  )
}
const hp = (initial: CombatEncounterState, target = 'enemy') =>
  initial.tactical.battle.combatants.find((row) => row.id === target)!.hp

describe('Weak Point, Spike and Ruin attack annotations', () => {
  it('registers independent authoring payloads', () => {
    expect(createAuthorableEffectPayload('weak-point')).toMatchObject({
      type: 'weak-point',
      recipient: 'actor',
      debuffThreshold: 2,
    })
    expect(createAuthorableEffectPayload('spike')).toEqual({ type: 'spike', recipient: 'actor' })
    expect(createAuthorableEffectPayload('ruin')).toMatchObject({
      type: 'ruin',
      recipient: 'actor',
      bonusPerDebuffBasisPoints: 1000,
    })
  })
  it('uses a strict more-than threshold without guaranteeing a hit', () => {
    expect(hp(cast(debuffed(), [weak(1)]).state)).toBe(970)
    expect(hp(cast(debuffed(), [weak(2)]).state)).toBe(980)
    const miss = {
      ...action([weak(0)]),
      accuracyRule: { kind: 'fixed' as const, chanceBasisPoints: 0 },
    }
    const result = executeCombatAction(
      debuffed(),
      miss,
      { kind: 'unit', combatantId: 'enemy' },
      content,
    )
    expect(hp(result.state)).toBe(1000)
  })
  it('doubles the complete rounded critical result and leaves ordinary hits alone', () => {
    expect(hp(cast(state(10000), [spike], 3).state)).toBe(992)
    expect(hp(cast(state(), [spike], 20).state)).toBe(980)
  })
  it('increases Damage per distinct active debuff without stack inflation', () => {
    const initial = debuffed()
    initial.statusState.find((row) => row.combatantId === 'enemy')!.statuses[0]!.stacks = 4
    expect(hp(cast(initial, [ruin(1000)]).state)).toBe(976)
    expect(hp(cast(initial, [weak(1), spike, ruin(1000)]).state)).toBe(928)
  })
  it('counts real active Reversal Strain once alongside ordinary debuffs', () => {
    const captured = captureCombatAbilitySource(
      source({
        classification: 'utility',
        attackFamily: undefined,
        costs: [],
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
    let initial: CombatEncounterState = preparePv1fTurnEconomy(
      debuffed(state(), 'actor', ['test.a', 'test.b', 'test.buff', 'test.neutral']),
    )
    initial = {
      ...initial,
      statusState: initial.statusState.map((row) =>
        row.combatantId === 'actor'
          ? {
              ...row,
              statuses: row.statuses.map((status) =>
                status.statusId === 'test.b'
                  ? { ...status, timingState: 'pending' as const, activationRound: 9 }
                  : status,
              ),
            }
          : row,
      ),
    }
    initial = reconcileCombatAbilitySources(initial, [captured])
    const armed = armCombatReversal(initial, captured, captured.definition.behaviors[0]!).state
    expect(hasCombatReversalStrain(armed, 'actor')).toBe(false)
    expect(
      captureAttackTagDamage(armed, action([weak(1), ruin(1000)]), content).effects[0],
    ).toMatchObject({ attackTagCapture: { capturedDebuffs: { actor: 1 } } })
    let strained = endCombatReversal(armed, 'actor', 'cancelled').state
    expect(hasCombatReversalStrain(strained, 'actor')).toBe(true)
    expect(
      captureAttackTagDamage(strained, action([weak(1), ruin(1000)]), content).effects[0],
    ).toMatchObject({ attackTagCapture: { capturedDebuffs: { actor: 2 } } })
    strained = endCombatTurn(
      { ...strained, tactical: selectCurrentFinalFacing(strained.tactical, 'west').state },
      content,
    ).state
    expect(strained.tactical.battle.currentTurn?.combatantId).toBe('enemy')
    expect(hasCombatReversalStrain(strained, 'actor')).toBe(true)
    const attack = (tags: readonly CombatEffectDefinition[]) =>
      executeCombatAction(strained, action(tags), { kind: 'unit', combatantId: 'actor' }, content)
        .state
    expect(hp(attack([weak(1), ruin(1000)]), 'actor')).toBe(964)
    expect(hp(attack([weak(2), ruin(1000)]), 'actor')).toBe(976)
    expect(validateCombatEncounterState(strained)).toEqual([])
  })
  it('retains ordinary critical RNG consumption when Weak Point forces the result', () => {
    const initial = debuffed(state(3500))
    const baseline = cast(initial, [])
    const forced = cast(initial, [weak(0)])
    expect(forced.state.tactical.battle.rng).toEqual(baseline.state.tactical.battle.rng)
    expect(forced.events).toContainEqual(
      expect.objectContaining({ event: 'combat_critical_resolved', critical: true }),
    )
  })
  it('keeps forecasts conditional and does not expose private debuff counts', () => {
    const forecast = evaluateCombatAction(
      debuffed(),
      action([weak(0), ruin(1000)]),
      { kind: 'unit', combatantId: 'enemy' },
      content,
    )
    expect(forecast.targetCriticalChances).toEqual([
      { targetCombatantId: 'enemy', criticalChanceBasisPoints: 0 },
    ])
    expect(JSON.stringify(forecast)).not.toMatch(/capturedDebuff|debuffCount/)
    expect(forecast.projectedEvents).toContainEqual(
      expect.objectContaining({ event: 'damage_applied', amount: 20 }),
    )
  })
  it('captures each area recipient independently', () => {
    const initial = debuffed(debuffed(state(), 'other', ['test.a']))
    const area = action([weak(1)])
    area.target = { ...area.target, shape: { kind: 'circle', radius: 1 } }
    area.effects = [{ type: 'damage', recipient: 'affected-units', amount: 20 }, weak(1)]
    const result = executeCombatAction(
      initial,
      area,
      { kind: 'unit', combatantId: 'enemy' },
      content,
    )
    expect(hp(result.state, 'enemy')).toBe(970)
    expect(hp(result.state, 'other')).toBe(980)
  })
  it('preserves committed per-target bonuses through delayed settlement and JSON restore', () => {
    let initial = debuffed()
    initial = { ...initial, effectTimingPolicy: { version: 1, modes: { damage: 'next-round' } } }
    let current = cast(initial, [weak(1), spike, ruin(1000)]).state
    current = JSON.parse(
      JSON.stringify({
        ...current,
        statusState: current.statusState.map((row) =>
          row.combatantId === 'enemy' ? { ...row, statuses: [] } : row,
        ),
      }),
    ) as CombatEncounterState
    for (let turn = 0; turn < 4; turn++)
      current = endCombatTurn(
        { ...current, tactical: selectCurrentFinalFacing(current.tactical, 'west').state },
        content,
      ).state
    expect(hp(current)).toBe(928)
    expect(validateCombatEncounterState(current)).toEqual([])
  })
  it.each([weak(-1), weak(0.5), ruin(0), ruin(-1), ruin(Infinity)])(
    'rejects invalid profile %j',
    (payload) => expect(validateCombatTagPayload(payload)).not.toEqual([]),
  )
  it('accepts a percentage above 100 and rejects orphan annotations', () => {
    expect(validateCombatTagPayload(ruin(25000))).toEqual([])
    const orphan = { ...action([spike]), accuracyRule: undefined, effects: [spike] }
    expect(() =>
      executeCombatAction(state(), orphan, { kind: 'unit', combatantId: 'enemy' }, content),
    ).toThrow(/Damage|damage/)
  })
  it('recaptures the new Ground entrant instead of using the original targets debuffs', () => {
    const initial = {
      ...debuffed(debuffed(state(), 'other', ['test.a'])),
      groundEffectPolicyVersion: 1 as const,
    }
    const ground = action([weak(1), spike, ruin(1000)])
    ground.target = {
      ...ground.target,
      geometryVersion: 2,
      kind: 'ground-tile',
      minimumRange: 0,
      maximumRange: 1,
      shape: { kind: 'circle', radius: 1 },
    }
    ground.effects = [
      { type: 'damage', recipient: 'affected-units', amount: 20 },
      weak(1),
      spike,
      ruin(1000),
    ]
    ground.groundArea = {
      durationRounds: 2,
      timing: 'instant',
      visualPresetId: 'embers',
      entryEffectOrdinals: [0],
    }
    let current = createCombatGroundArea(initial, 'actor', ground, [{ x: 4, y: 1 }], content)
    current = {
      ...current,
      statusState: current.statusState.map((row) =>
        row.combatantId === 'other'
          ? {
              ...row,
              statuses: current.statusState.find((source) => source.combatantId === 'enemy')!
                .statuses,
            }
          : row,
      ),
      tactical: {
        ...current.tactical,
        placements: current.tactical.placements.map((row) =>
          row.combatantId === 'other' ? { ...row, position: { x: 4, y: 1 } } : row,
        ),
      },
    }
    const entered = resolveCombatMovementStepEffects(current, 'other', content)
    expect(hp(entered.state, 'other')).toBe(928)
    expect(entered.events).toContainEqual(
      expect.objectContaining({
        event: 'combat_critical_resolved',
        targetCombatantId: 'other',
        critical: true,
        rollBasisPoints: null,
      }),
    )
  })

  it('counts active periodic IDs once and excludes pending, positive and neutral statuses', () => {
    let initial: CombatEncounterState = debuffed(state(), 'enemy', [
      'test.a',
      'test.b',
      'test.buff',
      'test.neutral',
    ])
    initial = {
      ...initial,
      statusState: initial.statusState.map((row) =>
        row.combatantId === 'enemy'
          ? {
              ...row,
              statuses: row.statuses.map((status) =>
                status.statusId === 'test.b'
                  ? { ...status, timingState: 'pending' as const, activationRound: 9 }
                  : status,
              ),
            }
          : row,
      ),
    }
    const dot = {
      capturedDamage: 100,
      profile: { kind: 'attack-percentage' as const, basisPoints: 1000 },
    }
    initial = applyCurrentPoisonState(
      initial,
      'actor',
      'enemy',
      'test.poison1',
      false,
      undefined,
      3,
      dot,
    )
    initial = applyCurrentPoisonState(
      initial,
      'actor',
      'enemy',
      'test.poison2',
      false,
      undefined,
      3,
      dot,
    )
    initial = applyCurrentBurnState(
      initial,
      'actor',
      'enemy',
      'test.burn',
      false,
      undefined,
      3,
      dot,
    )
    initial = applyCurrentBleedState(initial, 'actor', 'enemy', 'test.bleed', 1, 3, false, dot)
    expect(hp(cast(initial, [ruin(1000)]).state)).toBe(972)
  })
  it.each(['discipline-skill', 'essence', 'resonance'] as const)(
    'executes all three tags through the canonical %s adapter',
    (sourceKind) => {
      const captured = captureCombatAbilitySource({
        ...source({
          costs: [],
          effects: [
            { id: 'hit', payload: { type: 'damage', recipient: 'primary-unit', amount: 20 } },
            { id: 'weak', payload: { type: 'weak-point', recipient: 'actor', debuffThreshold: 1 } },
            { id: 'spike', payload: { type: 'spike', recipient: 'actor' } },
            {
              id: 'ruin',
              payload: { type: 'ruin', recipient: 'actor', bonusPerDebuffBasisPoints: 1000 },
            },
          ],
        }),
        sourceKind,
      })
      const initial = reconcileCombatAbilitySources(preparePv1fTurnEconomy(debuffed()), [captured])
      const result = activateCombatAbility({
        state: initial,
        actorId: 'actor',
        source: captured,
        selection: { kind: 'unit', combatantId: 'enemy' },
        content,
        context: combatAbilityCommandContext(initial, captured),
      })
      expect(hp(result.state)).toBe(928)
      expect(validateCombatEncounterState(result.state)).toEqual([])
    },
  )
  it('captures Controlled bonuses at the committed release rather than free preparation', () => {
    const captured = captureCombatAbilitySource(
      source({
        costs: [],
        effects: [
          {
            id: 'hit',
            timing: 'controlled',
            payload: { type: 'damage', recipient: 'primary-unit', amount: 20 },
          },
          { id: 'weak', payload: { type: 'weak-point', recipient: 'actor', debuffThreshold: 1 } },
          {
            id: 'ruin',
            payload: { type: 'ruin', recipient: 'actor', bonusPerDebuffBasisPoints: 1000 },
          },
        ],
      }),
    )
    let initial = reconcileCombatAbilitySources(preparePv1fTurnEconomy(debuffed()), [captured])
    initial = primeCombatControlledAbility({
      state: initial,
      actorId: 'actor',
      sourceInstanceId: captured.sourceInstanceId,
      behaviorId: 'strike',
    }).state
    initial = JSON.parse(
      JSON.stringify({
        ...initial,
        statusState: initial.statusState.map((row) =>
          row.combatantId === 'enemy' ? { ...row, statuses: [] } : row,
        ),
      }),
    ) as CombatEncounterState
    const result = activateCombatAbility({
      state: initial,
      actorId: 'actor',
      source: captured,
      selection: { kind: 'unit', combatantId: 'enemy' },
      content,
      context: combatAbilityCommandContext(initial, captured),
    })
    expect(hp(result.state)).toBe(980)
  })

  it('rejects authored private target-count captures in native and canonical definitions', () => {
    const definition = resolveMatureSkillVersion('vanguard.forceful-strike')!
    const damage = {
      type: 'damage' as const,
      recipient: 'primary-unit' as const,
      amount: 20,
      attackTagCapture: { weakPointDebuffThreshold: 0, capturedDebuffs: { enemy: 999 } },
    }
    expect(validateMatureSkillDefinition({ ...definition, effects: [damage] })).toContain(
      'effects[0].attackTagCapture',
    )
    expect(validateCombatTagPayload(damage)).not.toEqual([])
  })
  it('honors an explicit Weak Point in native snapshots without ordinary critical stats', () => {
    const initial: CombatEncounterState = {
      ...debuffed(),
      statBridge: percentageDotEncounter().statBridge,
    }
    expect(hp(cast(initial, [weak(1)]).state)).toBe(970)
  })
})

describe('attack annotation wrapper eligibility', () => {
  const cases = [
    {
      tag: { type: 'weak-point', recipient: 'actor', debuffThreshold: 1 },
      chance: 0,
      base: 20,
      enhanced: 30,
    },
    { tag: { type: 'spike', recipient: 'actor' }, chance: 10000, base: 30, enhanced: 60 },
    {
      tag: { type: 'ruin', recipient: 'actor', bonusPerDebuffBasisPoints: 1000 },
      chance: 0,
      base: 20,
      enhanced: 24,
    },
  ] as const
  function ownerHp(initial: CombatEncounterState, enabled: boolean): CombatEncounterState {
    return {
      ...initial,
      tactical: {
        ...initial.tactical,
        battle: {
          ...initial.tactical.battle,
          combatants: initial.tactical.battle.combatants.map((unit) =>
            unit.id === 'actor' ? { ...unit, hp: enabled ? 1000 : 100 } : unit,
          ),
        },
      },
    }
  }
  for (const row of cases) {
    it.each([false, true])(`honors native ${row.tag.type} actor gates (%s)`, (enabled) => {
      const input = action([row.tag])
      input.effectEligibleRecipientIds = [undefined, enabled ? ['actor'] : []]
      const result = executeCombatAction(
        debuffed(state(row.chance)),
        input,
        { kind: 'unit', combatantId: 'enemy' },
        content,
      )
      expect(hp(result.state)).toBe(1000 - (enabled ? row.enhanced : row.base))
    })
    it.each([false, true])(`honors native ${row.tag.type} per-target masks (%s)`, (enabled) => {
      const initial = debuffed(debuffed(state(row.chance), 'other'))
      const input = action([row.tag])
      input.target = { ...input.target, shape: { kind: 'circle', radius: 1 } }
      input.effects = [{ type: 'damage', recipient: 'affected-units', amount: 20 }, row.tag]
      input.effectEligibleRecipientIds = [undefined, enabled ? ['enemy'] : []]
      const result = executeCombatAction(
        initial,
        input,
        { kind: 'unit', combatantId: 'enemy' },
        content,
      )
      expect(hp(result.state)).toBe(1000 - (enabled ? row.enhanced : row.base))
      expect(hp(result.state, 'other')).toBe(1000 - row.base)
    })
    for (const timing of ['instant', 'next-round', 'controlled', 'ground'] as const) {
      it.each([false, true])(
        `honors canonical ${row.tag.type} owner gates at ${timing} commit (%s)`,
        (enabled) => {
          const isGround = timing === 'ground'
          const captured = captureCombatAbilitySource(
            source({
              costs: [],
              ...(isGround
                ? {
                    targeting: {
                      kind: 'ground-tile',
                      teamPolicy: 'enemy',
                      friendlyFire: 'enemies-only',
                      geometryVersion: 3,
                      categories: ['ground'],
                      shape: { kind: 'single' },
                      minimumRange: 0,
                      maximumRange: 4,
                      requiresLineOfSight: false,
                      maximumElevationDifference: 0,
                      maximumSelections: 1,
                    },
                    groundArea: {
                      durationRounds: 2,
                      timing: 'instant',
                      visualPresetId: 'embers',
                      entryEffectIds: ['hit'],
                    },
                  }
                : {}),
              effects: [
                {
                  id: 'hit',
                  ...(timing === 'controlled' || timing === 'next-round' ? { timing } : {}),
                  payload: {
                    type: 'damage',
                    recipient: isGround ? 'affected-units' : 'primary-unit',
                    amount: 20,
                  },
                },
                ...(isGround && row.tag.type === 'spike'
                  ? [
                      {
                        id: 'ground-critical',
                        payload: {
                          type: 'weak-point' as const,
                          recipient: 'actor' as const,
                          debuffThreshold: 1,
                        },
                      },
                    ]
                  : []),
                {
                  id: 'annotation',
                  requirements: {
                    kind: 'resource-state',
                    subject: 'owner',
                    resource: 'hp',
                    comparison: 'at-least',
                    amount: 500,
                  },
                  payload: row.tag,
                },
              ],
            }),
          )
          let initial = reconcileCombatAbilitySources(
            preparePv1fTurnEconomy({
              ...debuffed(state(row.chance)),
              ...(isGround ? { groundEffectPolicyVersion: 1 as const } : {}),
            }),
            [captured],
          )
          if (timing === 'controlled')
            initial = primeCombatControlledAbility({
              state: ownerHp(initial, !enabled),
              actorId: 'actor',
              sourceInstanceId: captured.sourceInstanceId,
              behaviorId: 'strike',
            }).state
          initial = ownerHp(initial, enabled)
          const result = activateCombatAbility({
            state: initial,
            actorId: 'actor',
            source: captured,
            selection: isGround
              ? { kind: 'tile', position: { x: 2, y: 2 } }
              : { kind: 'unit', combatantId: 'enemy' },
            content,
            context: combatAbilityCommandContext(initial, captured),
          })
          let settled = JSON.parse(
            JSON.stringify(ownerHp(result.state, !enabled)),
          ) as CombatEncounterState
          if (timing === 'next-round')
            for (let turn = 0; turn < 4; turn++)
              settled = endCombatTurn(
                { ...settled, tactical: selectCurrentFinalFacing(settled.tactical, 'west').state },
                content,
              ).state
          if (isGround) {
            expect(settled.groundAreas).toHaveLength(1)
            settled = {
              ...settled,
              tactical: {
                ...settled.tactical,
                placements: settled.tactical.placements.map((unit) =>
                  unit.combatantId === 'enemy' ? { ...unit, position: { x: 2, y: 2 } } : unit,
                ),
              },
            }
            const beforeEntry = hp(settled)
            settled = resolveCombatMovementStepEffects(settled, 'enemy', content).state
            expect(beforeEntry - hp(settled)).toBe(
              enabled ? row.enhanced : row.tag.type === 'spike' ? 30 : 20,
            )
          } else expect(hp(settled)).toBe(1000 - (enabled ? row.enhanced : row.base))
          expect(validateCombatEncounterState(settled)).toEqual([])
        },
      )
    }

    it.each([false, true])(
      `preserves canonical ${row.tag.type} selected conditions (%s)`,
      (enabled) => {
        const captured = captureCombatAbilitySource(
          source({
            costs: [],
            effects: [
              { id: 'hit', payload: { type: 'damage', recipient: 'primary-unit', amount: 20 } },
              {
                id: 'annotation',
                requirements: {
                  kind: 'resource-state',
                  subject: 'selected',
                  resource: 'hp',
                  comparison: 'at-least',
                  amount: enabled ? 500 : 2000,
                },
                payload: row.tag,
              },
            ],
          }),
        )
        const initial = reconcileCombatAbilitySources(
          preparePv1fTurnEconomy(debuffed(state(row.chance))),
          [captured],
        )
        const result = activateCombatAbility({
          state: initial,
          actorId: 'actor',
          source: captured,
          selection: { kind: 'unit', combatantId: 'enemy' },
          content,
          context: combatAbilityCommandContext(initial, captured),
        })
        expect(hp(result.state)).toBe(1000 - (enabled ? row.enhanced : row.base))
      },
    )
    it(`retains committed ${row.tag.type} affected Ground gates while refreshing entrant debuffs`, () => {
      const captured = captureCombatAbilitySource(
        source({
          costs: [],
          targeting: {
            kind: 'ground-tile',
            teamPolicy: 'enemy',
            friendlyFire: 'enemies-only',
            geometryVersion: 3,
            categories: ['ground'],
            shape: { kind: 'single' },
            minimumRange: 0,
            maximumRange: 4,
            requiresLineOfSight: false,
            maximumElevationDifference: 0,
            maximumSelections: 1,
          },
          groundArea: {
            durationRounds: 2,
            timing: 'instant',
            visualPresetId: 'embers',
            entryEffectIds: ['hit'],
          },
          effects: [
            { id: 'hit', payload: { type: 'damage', recipient: 'affected-units', amount: 20 } },
            ...(row.tag.type === 'spike'
              ? [
                  {
                    id: 'ground-critical',
                    payload: {
                      type: 'weak-point' as const,
                      recipient: 'actor' as const,
                      debuffThreshold: 1,
                    },
                  },
                ]
              : []),
            {
              id: 'annotation',
              requirements: {
                kind: 'resource-state',
                subject: 'affected',
                resource: 'hp',
                comparison: 'at-least',
                amount: 500,
              },
              payload: row.tag,
            },
          ],
        }),
      )
      const base = debuffed(debuffed(state(row.chance), 'other'))
      let initial = reconcileCombatAbilitySources(
        preparePv1fTurnEconomy({ ...base, groundEffectPolicyVersion: 1 }),
        [captured],
      )
      initial = {
        ...initial,
        tactical: {
          ...initial.tactical,
          battle: {
            ...initial.tactical.battle,
            combatants: initial.tactical.battle.combatants.map((unit) =>
              unit.id === 'other' ? { ...unit, hp: 100 } : unit,
            ),
          },
        },
      }
      let settled = activateCombatAbility({
        state: initial,
        actorId: 'actor',
        source: captured,
        selection: { kind: 'tile', position: { x: 2, y: 2 } },
        content,
        context: combatAbilityCommandContext(initial, captured),
      }).state
      settled = JSON.parse(
        JSON.stringify({
          ...settled,
          tactical: {
            ...settled.tactical,
            battle: {
              ...settled.tactical.battle,
              combatants: settled.tactical.battle.combatants.map((unit) =>
                unit.id === 'enemy'
                  ? { ...unit, hp: 100 }
                  : unit.id === 'other'
                    ? { ...unit, hp: 1000 }
                    : unit,
              ),
            },
          },
          statusState: settled.statusState.map((unit) =>
            ['enemy', 'other'].includes(unit.combatantId)
              ? {
                  ...unit,
                  statuses: [
                    ...unit.statuses,
                    {
                      statusId: 'test.c',
                      statusVersion: 1,
                      stacks: 1,
                      remainingOwnerTurnStarts: 4,
                      sourceCombatantId: 'actor',
                    },
                  ],
                }
              : unit,
          ),
        }),
      ) as CombatEncounterState
      const enter = (id: 'enemy' | 'other') => {
        settled = {
          ...settled,
          tactical: {
            ...settled.tactical,
            placements: settled.tactical.placements.map((unit) =>
              unit.combatantId === id
                ? { ...unit, position: { x: 2, y: 2 } }
                : unit.combatantId === 'enemy'
                  ? { ...unit, position: { x: 2, y: 1 } }
                  : unit,
            ),
          },
        }
        const before = hp(settled, id)
        settled = resolveCombatMovementStepEffects(settled, id, content).state
        return before - hp(settled, id)
      }
      expect(enter('enemy')).toBe(row.tag.type === 'ruin' ? 26 : row.enhanced)
      expect(enter('other')).toBe(row.tag.type === 'spike' ? 30 : 20)
      expect(validateCombatEncounterState(settled)).toEqual([])
    })
    it.each(['instant', 'next-round', 'controlled'] as const)(
      `routes canonical ${row.tag.type} affected conditions over Damage targets at %s`,
      (timing) => {
        const captured = captureCombatAbilitySource(
          source({
            costs: [],
            targeting: {
              kind: 'unit',
              teamPolicy: 'enemy',
              friendlyFire: 'enemies-only',
              geometryVersion: 2,
              shape: { kind: 'circle', radius: 2 },
              minimumRange: 0,
              maximumRange: 2,
              requiresLineOfSight: false,
              maximumElevationDifference: 0,
              maximumSelections: 1,
            },
            effects: [
              {
                id: 'hit',
                ...(timing !== 'instant' ? { timing } : {}),
                payload: { type: 'damage', recipient: 'affected-units', amount: 20 },
              },
              {
                id: 'annotation',
                requirements: {
                  kind: 'resource-state',
                  subject: 'affected',
                  resource: 'hp',
                  comparison: 'at-least',
                  amount: 500,
                },
                payload: row.tag,
              },
            ],
          }),
        )
        let initial: CombatEncounterState = debuffed(debuffed(state(row.chance), 'other'))
        initial = {
          ...initial,
          tactical: {
            ...initial.tactical,
            battle: {
              ...initial.tactical.battle,
              combatants: initial.tactical.battle.combatants.map((unit) =>
                unit.id === 'other' ? { ...unit, hp: 100 } : unit,
              ),
            },
          },
        }
        initial = reconcileCombatAbilitySources(
          preparePv1fTurnEconomy({
            ...initial,
            statBridge: state(row.chance).statBridge,
          } as ReturnType<typeof state>),
          [captured],
        )
        if (timing === 'controlled')
          initial = primeCombatControlledAbility({
            state: initial,
            actorId: 'actor',
            sourceInstanceId: captured.sourceInstanceId,
            behaviorId: 'strike',
          }).state
        const result = activateCombatAbility({
          state: initial,
          actorId: 'actor',
          source: captured,
          selection: { kind: 'activate' },
          content,
          context: combatAbilityCommandContext(initial, captured),
        })
        let settled = JSON.parse(JSON.stringify(result.state)) as CombatEncounterState
        if (timing === 'next-round') {
          settled = {
            ...settled,
            tactical: {
              ...settled.tactical,
              battle: {
                ...settled.tactical.battle,
                combatants: settled.tactical.battle.combatants.map((unit) =>
                  unit.id === 'enemy'
                    ? { ...unit, hp: 100 }
                    : unit.id === 'other'
                      ? { ...unit, hp: 1000 }
                      : unit,
                ),
              },
            },
          }
          for (let turn = 0; turn < 4; turn++)
            settled = endCombatTurn(
              { ...settled, tactical: selectCurrentFinalFacing(settled.tactical, 'west').state },
              content,
            ).state
        }
        expect(hp(settled)).toBe((timing === 'next-round' ? 100 : 1000) - row.enhanced)
        expect(hp(settled, 'other')).toBe((timing === 'next-round' ? 1000 : 100) - row.base)
        expect(validateCombatEncounterState(settled)).toEqual([])
      },
    )
  }
  it('keeps independent annotation conditions on the same Damage packet', () => {
    const captured = captureCombatAbilitySource(
      source({
        costs: [],
        targeting: {
          kind: 'unit',
          teamPolicy: 'enemy',
          friendlyFire: 'enemies-only',
          geometryVersion: 2,
          shape: { kind: 'circle', radius: 2 },
          minimumRange: 0,
          maximumRange: 2,
          requiresLineOfSight: false,
          maximumElevationDifference: 0,
          maximumSelections: 1,
        },
        effects: [
          { id: 'hit', payload: { type: 'damage', recipient: 'affected-units', amount: 20 } },
          {
            id: 'weak',
            requirements: {
              kind: 'resource-state',
              subject: 'affected',
              resource: 'hp',
              comparison: 'at-least',
              amount: 500,
            },
            payload: { type: 'weak-point', recipient: 'actor', debuffThreshold: 1 },
          },
          {
            id: 'spike',
            requirements: {
              kind: 'resource-state',
              subject: 'owner',
              resource: 'hp',
              comparison: 'at-least',
              amount: 999999,
            },
            payload: { type: 'spike', recipient: 'actor' },
          },
          {
            id: 'ruin',
            requirements: {
              kind: 'resource-state',
              subject: 'affected',
              resource: 'hp',
              comparison: 'less-than',
              amount: 500,
            },
            payload: { type: 'ruin', recipient: 'actor', bonusPerDebuffBasisPoints: 1000 },
          },
        ],
      }),
    )
    let initial = reconcileCombatAbilitySources(
      preparePv1fTurnEconomy(debuffed(debuffed(state(), 'other'))),
      [captured],
    )
    initial = {
      ...initial,
      tactical: {
        ...initial.tactical,
        battle: {
          ...initial.tactical.battle,
          combatants: initial.tactical.battle.combatants.map((unit) =>
            unit.id === 'other' ? { ...unit, hp: 100 } : unit,
          ),
        },
      },
    }
    const result = activateCombatAbility({
      state: initial,
      actorId: 'actor',
      source: captured,
      selection: { kind: 'activate' },
      content,
      context: combatAbilityCommandContext(initial, captured),
    })
    expect(hp(result.state)).toBe(970)
    expect(hp(result.state, 'other')).toBe(76)
  })
  it.each(cases)('supports simple affected Requirements on $tag.type', ({ tag }) => {
    expect(() =>
      captureCombatAbilitySource(
        source({
          requirementMode: 'simple',
          costs: [],
          effects: [
            { id: 'hit', payload: { type: 'damage', recipient: 'primary-unit', amount: 20 } },
            {
              id: 'annotation',
              requirements: {
                kind: 'status-presence',
                subject: 'affected',
                statusId: 'burn',
                present: true,
              },
              payload: tag,
            },
          ],
        }),
      ),
    ).not.toThrow()
  })
  it.each(cases)(
    'uses the explicit automatic actor for native $tag.type gates',
    ({ tag, chance, enhanced }) => {
      const initial = endCombatTurn(
        {
          ...debuffed(state(chance)),
          tactical: selectCurrentFinalFacing(debuffed(state(chance)).tactical, 'west').state,
        },
        content,
      ).state
      expect(initial.tactical.battle.currentTurn?.combatantId).toBe('enemy')
      const input = action([tag])
      input.effectEligibleRecipientIds = [undefined, ['actor']]
      const context = combatAbilityCommandContext(initial, {
        ownerCombatantId: 'actor',
        abilityId: input.id,
        contentVersion: 1,
        sourceKind: 'discipline-skill',
      })
      const result = executeCombatAction(
        initial,
        input,
        { kind: 'unit', combatantId: 'enemy' },
        content,
        { ...context, executionAuthority: { activation: 'automatic', actorId: 'actor' } },
      )
      expect(hp(result.state)).toBe(1000 - enhanced)
    },
  )
})

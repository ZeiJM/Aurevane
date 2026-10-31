import { describe, expect, it } from 'vitest'

import {
  createCombatEncounterState,
  executeCombatAction,
  resolveCombatMovementStepEffects,
  type CombatEffectDefinition,
} from './actions'
import { normalBasicAttackDamageAgainst } from './actions-legacy'
import { createPendingBattle, startBattle } from './battle-state'
import { createTacticalBattleState } from './board'
import {
  resolveMatureSkillVersion,
  validateMatureSkillDefinition,
  type MatureSkillDefinition,
} from './mature-skills'
import {
  resolveEssenceForBuild,
  validateEssenceDefinition,
  type EssenceDefinition,
} from './essence'
import { parseAbilityDefinition } from './combat-definition'
import { removeCombatSummon, spawnCombatSummon } from './combat-summons'
import {
  createCurrentStatDrivenCombatEncounterState,
  type StatDrivenCombatEncounterState,
  type StatDrivenCombatProfileV4,
} from './stat-driven-combat'
import {
  SUMMON_PROFILE_SCHEMA_VERSION,
  validateSummonProfileDefinition,
  type SummonProfileDefinition,
} from './summon-content'

function profile(combatantId: string, team: 'players' | 'opponents'): StatDrivenCombatProfileV4 {
  return {
    combatantId,
    provenance: {
      kind: team === 'players' ? 'character-derived' : 'scenario',
      sourceId: team === 'players' ? 'character:test-player' : 'scenario:test-opponent',
      sourceRulesVersion: 4,
    },
    accuracy: 7000,
    evasion: 1000,
    armor: 8,
    ward: 8,
    jump: 1,
    physicalPower: 30,
    mysticPower: 24,
    level: 1,
    criticalChance: 0,
  }
}

function summonProfile(overrides: Partial<SummonProfileDefinition> = {}): SummonProfileDefinition {
  return {
    schemaVersion: SUMMON_PROFILE_SCHEMA_VERSION,
    id: 'summon.wildwarden.verdant-stalker',
    name: 'Verdant Stalker',
    description: 'A temporary woodland hunter that fights beside the summoner.',
    flavorLine: 'Roots twist into a watchful hunter at your side.',
    portraitKey: 'summon.wildwarden.verdant-stalker.portrait',
    tags: ['summon', 'beast', 'verdant'],
    maxHp: 36,
    maxMp: 12,
    initiative: 28,
    movementBudget: 5,
    stats: {
      accuracy: 6800,
      evasion: 1200,
      armor: 8,
      ward: 6,
      jump: 1,
      physicalPower: 24,
      mysticPower: 18,
    },
    aiProfile: 'standard',
    aiPurposeTags: ['damage', 'support'],
    lifetimeTurns: 5,
    abilities: [
      {
        id: 'wildwarden.verdant-stalker.thorn-rake',
        name: 'Thorn Rake',
        description: 'Strike a nearby enemy with thorned claws.',
        apCost: 45,
        mpCost: 0,
        tags: ['attack', 'melee'],
        target: {
          kind: 'unit',
          teamPolicy: 'enemy',
          shape: { kind: 'single' },
          minimumRange: 1,
          maximumRange: 2,
          requiresLineOfSight: true,
          maximumElevationDifference: 0,
          friendlyFire: 'enemies-only',
        },
        requirements: [],
        effects: [{ type: 'damage', recipient: 'primary-unit', amount: 5, durationTurns: 0 }],
        ai: { baseUtility: 70, purposeTags: ['damage', 'pressure'] },
        media: {
          iconKey: 'summon-ability.wildwarden.verdant-stalker.thorn-rake.icon',
          audioCueKey: null,
          vfxKey: null,
        },
      },
    ],
    ...overrides,
  }
}

function encounter(secondEnemy = false): StatDrivenCombatEncounterState {
  const pending = createPendingBattle({
    battleId: 'battle:summon-runtime',
    rulesVersion: 1,
    contentVersion: 1,
    rngSeed: 44,
    combatants: [
      ...(secondEnemy
        ? [
            {
              id: 'enemy2',
              teamId: 'opponents',
              initiative: 5,
              baseMovementBudget: 4,
              hp: 50,
              maxHp: 50,
              mp: 20,
              maxMp: 20,
            },
          ]
        : []),
      {
        id: 'player',
        teamId: 'players',
        initiative: 20,
        baseMovementBudget: 4,
        hp: 50,
        maxHp: 50,
        mp: 20,
        maxMp: 20,
      },
      {
        id: 'enemy',
        teamId: 'opponents',
        initiative: 10,
        baseMovementBudget: 4,
        hp: 50,
        maxHp: 50,
        mp: 20,
        maxMp: 20,
      },
    ],
  })
  const battle = startBattle(pending).state
  const tactical = createTacticalBattleState({
    battle,
    width: 3,
    height: secondEnemy ? 2 : 1,
    terrains: [{ id: 'open-ground', traversalCost: 1 }],
    tiles: [
      ...(secondEnemy
        ? Array.from({ length: 3 }, (_, x) => ({
            position: { x, y: 1 },
            elevation: 0,
            terrainId: 'open-ground',
          }))
        : []),
      { position: { x: 0, y: 0 }, elevation: 0, terrainId: 'open-ground' },
      { position: { x: 1, y: 0 }, elevation: 0, terrainId: 'open-ground' },
      { position: { x: 2, y: 0 }, elevation: 0, terrainId: 'open-ground' },
    ],
    movementProfiles: [
      { id: 'player-ground', maxElevationStep: 1, terrainCostOverrides: [] },
      { id: 'enemy-ground', maxElevationStep: 1, terrainCostOverrides: [] },
    ],
    placements: [
      ...(secondEnemy
        ? [
            {
              combatantId: 'enemy2',
              position: { x: 2, y: 1 },
              facing: 'west' as const,
              movementProfileId: 'enemy-ground',
            },
          ]
        : []),
      {
        combatantId: 'player',
        position: { x: 0, y: 0 },
        facing: 'east',
        movementProfileId: 'player-ground',
      },
      {
        combatantId: 'enemy',
        position: { x: 2, y: 0 },
        facing: 'west',
        movementProfileId: 'enemy-ground',
      },
    ],
  })
  return createCurrentStatDrivenCombatEncounterState(createCombatEncounterState(tactical), [
    profile('player', 'players'),
    profile('enemy', 'opponents'),
    ...(secondEnemy ? [{ ...profile('enemy2', 'opponents'), armor: 100, evasion: 0 }] : []),
  ])
}

function spawn(state = encounter(), summon = summonProfile()) {
  return spawnCombatSummon(state, {
    ownerCombatantId: 'player',
    sourceSkillId: 'wildwarden.renewing-herbs',
    sourceSkillVersion: 5,
    profile: summon,
    position: { x: 1, y: 0 },
    facing: 'east',
  })
}

import {
  evaluatePv1fSummonAbility,
  executePv1fMatureSkill,
  evaluatePv1fMatureSkill,
  executePv1fSummonAbility,
  finishPv1fTurn,
  evaluatePv1fMovement,
  executePv1fMovement,
} from './pv1f-action-economy'
import { grantBarrier, absorbIndirectDamageWithBarrier } from './combat-barrier'
import { captureBasicSkillSources, defaultBasicSkills } from './combat-basic-actions'
import { createCombatGroundArea } from './combat-ground-areas'
import { PV1F_COMBAT_CONTENT } from './pv1f-combat-content'
import { applyCurrentBleedState, applyCurrentPoisonState } from './combat-dots'

function ready(
  potencyBasisPoints: number | null = 4000,
  effects?: readonly CombatEffectDefinition[],
  baseState = encounter(),
) {
  const base = summonProfile()
  const configured = {
    ...base,
    ...(potencyBasisPoints === null ? {} : { potencyBasisPoints }),
    stats: { ...base.stats, accuracy: 10000 },
    abilities: [
      {
        ...base.abilities[0]!,
        target: effects?.some((effect) => effect.recipient === 'affected-units')
          ? { ...base.abilities[0]!.target, shape: { kind: 'circle' as const, radius: 1 } }
          : base.abilities[0]!.target,
        effects: effects ?? [
          {
            type: 'damage' as const,
            recipient: 'primary-unit' as const,
            amount: 99,
            durationTurns: 0,
          },
          {
            type: 'damage' as const,
            recipient: 'primary-unit' as const,
            amount: 99,
            durationTurns: 0,
          },
        ],
      },
    ],
  }
  let state = spawn(baseState, configured).state
  const id = state.effectState!.summons![0]!.combatantId
  for (let n = 0; n < 8 && state.tactical.battle.currentTurn?.combatantId !== id; n++)
    state = finishPv1fTurn(
      state,
      state.tactical.battle.currentTurn?.combatantId === 'enemy' ? 'west' : 'east',
    ).state
  return { state, summon: state.effectState!.summons![0]!, ability: configured.abilities[0]! }
}

function hp(state: { tactical: StatDrivenCombatEncounterState['tactical'] }, id = 'enemy') {
  return state.tactical.battle.combatants.find((row) => row.id === id)!.hp
}

describe('authored Summon potency damage ceiling', () => {
  it('caps the entire multi-packet attack against the same enemy in preview and commit', () => {
    const { state, summon, ability } = ready()
    const snapshot = JSON.stringify(state)
    const target = { kind: 'unit' as const, combatantId: 'enemy' }
    const evaluated = evaluatePv1fSummonAbility(state, summon, ability.id, target)
    const damage = evaluated.evaluation.projectedEffects
      .filter((row) => row.effectType === 'damage')
      .reduce((sum, row) => sum + Number(row.before) - Number(row.after), 0)
    expect(damage).toBe(3) // owner Basic: floor((6 + floor(30 * .15)) / 1.08) = 9; floor(9 * .4).
    expect(JSON.stringify(state)).toBe(snapshot)
    const committed = executePv1fSummonAbility(state, summon, ability.id, target)
    expect(hp(state) - hp(committed.state)).toBe(3)
  })

  it('spends its complete damage budget on Barrier before HP', () => {
    const { state, summon, ability } = ready()
    const protectedState = {
      ...state,
      ...grantBarrier(state, 'enemy', 'enemy', 'test.barrier', 5).state,
      statBridge: state.statBridge,
    }
    const committed = executePv1fSummonAbility(protectedState, summon, ability.id, {
      kind: 'unit',
      combatantId: 'enemy',
    })
    expect(hp(committed.state)).toBe(hp(state))
    expect(committed.state.effectState!.barriers![0]!.amount).toBe(2)
  })

  it('supports zero potency without a minimum-one damage escape', () => {
    const { state, summon, ability } = ready(0)
    const committed = executePv1fSummonAbility(state, summon, ability.id, {
      kind: 'unit',
      combatantId: 'enemy',
    })
    expect(hp(committed.state)).toBe(hp(state))
  })

  it('preserves historical Summons with no potency field', () => {
    const { state, summon, ability } = ready(null)
    const historical = { ...summon, profile: { ...summon.profile } }
    delete (historical.profile as { potencyBasisPoints?: number }).potencyBasisPoints
    const legacy = { ...state, effectState: { ...state.effectState!, summons: [historical] } }
    const committed = executePv1fSummonAbility(legacy, historical, ability.id, {
      kind: 'unit',
      combatantId: 'enemy',
    })
    expect(hp(state) - hp(committed.state)).toBeGreaterThan(3)
  })
  it('uses captured Basic potency and the higher current power without range, costs, or turn legality', () => {
    const { state, summon, ability } = ready()
    const definitions = defaultBasicSkills().map((row) =>
      row.id !== 'unarmed.basic'
        ? row
        : {
            ...row,
            enabled: false,
            execution: { kind: 'basic-attack' as const, scalingBasisPoints: 0 },
            ability: {
              ...row.ability,
              behaviors: row.ability.behaviors.map((behavior) => ({
                ...behavior,
                effects: behavior.effects.map((effect) => ({
                  ...effect,
                  payload: { ...effect.payload, amount: 20 },
                })),
              })),
            },
          },
    )
    const captured = {
      ...state,
      capturedAbilitySources: captureBasicSkillSources({
        ownerCombatantId: 'player',
        supportActionId: 'basic.guard',
        definitions,
      }),
      tactical: {
        ...state.tactical,
        battle: {
          ...state.tactical.battle,
          combatants: state.tactical.battle.combatants.map((row) =>
            row.id === 'player' ? { ...row, hp: 0, mp: 0, temporaryResources: [] } : row,
          ),
        },
      },
    }
    const before = JSON.stringify(captured)
    const quote = evaluatePv1fSummonAbility(captured, summon, ability.id, {
      kind: 'unit',
      combatantId: 'enemy',
    })
    expect(
      quote.evaluation.projectedEffects.reduce(
        (n, row) => n + (row.effectType === 'damage' ? Number(row.before) - Number(row.after) : 0),
        0,
      ),
    ).toBe(7)
    expect(JSON.stringify(captured)).toBe(before)
    expect(
      hp(
        executePv1fSummonAbility(captured, summon, ability.id, {
          kind: 'unit',
          combatantId: 'enemy',
        }).state,
      ),
    ).toBe(43)
  })

  it.each([false, true])(
    'captures eligible summoner Basic Ruin annotations without critical inflation (critical tags: %s)',
    (criticalTags) => {
      const { state, summon, ability } = ready()
      const definitions = defaultBasicSkills().map((row) =>
        row.id !== 'unarmed.basic'
          ? row
          : {
              ...row,
              ability: {
                ...row.ability,
                behaviors: row.ability.behaviors.map((behavior) => ({
                  ...behavior,
                  effects: [
                    ...behavior.effects,
                    {
                      id: 'ruin',
                      requirements: {
                        kind: 'status-presence' as const,
                        subject: 'owner' as const,
                        statusId: 'guarded',
                        present: true,
                      },
                      payload: {
                        type: 'ruin' as const,
                        recipient: 'actor' as const,
                        bonusPerDebuffBasisPoints: 10000,
                      },
                    },
                    ...(criticalTags
                      ? [
                          {
                            id: 'weak-point',
                            payload: {
                              type: 'weak-point' as const,
                              recipient: 'actor' as const,
                              debuffThreshold: 0,
                            },
                          },
                          {
                            id: 'spike',
                            payload: { type: 'spike' as const, recipient: 'actor' as const },
                          },
                        ]
                      : []),
                  ],
                })),
              },
            },
      )
      const captured = {
        ...state,
        capturedAbilitySources: captureBasicSkillSources({
          ownerCombatantId: 'player',
          supportActionId: 'basic.guard',
          definitions,
        }),
        statusState: state.statusState.map((row) =>
          row.combatantId === 'enemy'
            ? {
                ...row,
                statuses: [
                  {
                    statusId: 'slow',
                    statusVersion: 1,
                    stacks: 1,
                    remainingOwnerTurnStarts: 2,
                    sourceCombatantId: 'player',
                  },
                ],
              }
            : row,
        ),
      }
      const unqualified = normalBasicAttackDamageAgainst(
        captured,
        'player',
        'enemy',
        PV1F_COMBAT_CONTENT,
      )
      const qualified = {
        ...captured,
        statusState: captured.statusState.map((row) =>
          row.combatantId === 'player'
            ? {
                ...row,
                statuses: [
                  {
                    statusId: 'guarded',
                    statusVersion: 1,
                    stacks: 1,
                    remainingOwnerTurnStarts: 2,
                    sourceCombatantId: 'player',
                  },
                ],
              }
            : row,
        ),
      }
      const before = JSON.stringify(qualified)
      // The live turn belongs to the Summon, while annotation requirements belong
      // to its actual summoner. The reference remains pure and forced noncritical.
      expect(qualified.tactical.battle.currentTurn?.combatantId).toBe(summon.combatantId)
      expect(
        normalBasicAttackDamageAgainst(qualified, 'player', 'enemy', PV1F_COMBAT_CONTENT),
      ).toBe(unqualified * 2)
      expect(JSON.stringify(qualified)).toBe(before)
      const quote = evaluatePv1fSummonAbility(qualified, summon, ability.id, {
        kind: 'unit',
        combatantId: 'enemy',
      })
      expect(
        quote.evaluation.projectedEffects.reduce(
          (total, effect) =>
            total +
            (effect.effectType === 'damage' ? Number(effect.before) - Number(effect.after) : 0),
          0,
        ),
      ).toBe(7)
      const committed = executePv1fSummonAbility(qualified, summon, ability.id, {
        kind: 'unit',
        combatantId: 'enemy',
      })
      expect(hp(qualified) - hp(committed.state)).toBe(7)
    },
  )

  it('keeps critical hits and outgoing modifiers inside the noncritical Basic ceiling', () => {
    const { state, summon, ability } = ready()
    const critical = {
      ...state,
      statBridge: {
        ...state.statBridge,
        combatants: state.statBridge.combatants.map((row) =>
          row.combatantId === summon.combatantId
            ? { ...row, criticalChance: 10000, physicalPower: 1000 }
            : row,
        ),
      },
    }
    const result = executePv1fSummonAbility(critical, summon, ability.id, {
      kind: 'unit',
      combatantId: 'enemy',
    })
    expect(hp(state) - hp(result.state)).toBe(3)
  })

  it('shares the budget between instant and serialized delayed packets', () => {
    const { state, summon, ability } = ready()
    const action = evaluatePv1fSummonAbility(state, summon, ability.id, {
      kind: 'unit',
      combatantId: 'enemy',
    }).action
    const timed = { ...state, effectTimingPolicy: { version: 1, modes: {} } }
    const cast = executeCombatAction(
      timed,
      { ...action, effectTimingModes: ['instant', 'delayed'] },
      { kind: 'unit', combatantId: 'enemy' },
      PV1F_COMBAT_CONTENT,
    )
    expect(hp(cast.state)).toBe(47)
    expect(cast.state.pendingEffects).toHaveLength(1)
    let restored = JSON.parse(JSON.stringify(cast.state)) as StatDrivenCombatEncounterState
    for (let n = 0; n < 7 && restored.pendingEffects?.length; n++)
      restored = finishPv1fTurn(
        restored,
        restored.tactical.battle.currentTurn?.combatantId === 'enemy' ? 'west' : 'east',
      ).state
    expect(restored.pendingEffects ?? []).toHaveLength(0)
    expect(hp(restored)).toBe(47)
  })

  it('caps stacked periodic packets from the same summoned attack as one tick', () => {
    const { state, summon } = ready()
    const first = applyCurrentBleedState(
      { ...state, effectStackingPolicyVersion: 1 },
      summon.combatantId,
      'enemy',
      'summon.bleed',
      20,
      2,
    )
    let bleeding = applyCurrentBleedState(
      first,
      summon.combatantId,
      'enemy',
      'summon.bleed',
      20,
      2,
    ) as StatDrivenCombatEncounterState
    for (let n = 0; n < 6 && bleeding.tactical.battle.currentTurn?.combatantId !== 'enemy'; n++)
      bleeding = finishPv1fTurn(bleeding, 'east').state
    const ticked = finishPv1fTurn(bleeding, 'west').state
    expect(hp(bleeding) - hp(ticked)).toBe(3)
  })

  it.each([false, true])(
    'keeps expired Summon Ground capped after restore (current stats: %s)',
    (currentStats) => {
      const readyState = ready()
      const summon = readyState.summon
      const state = currentStats
        ? {
            ...readyState.state,
            statBalancePolicyVersion: 1 as const,
            statBridge: {
              ...readyState.state.statBridge,
              combatants: readyState.state.statBridge.combatants.map((row) => ({
                ...row,
                statusResistance: 0,
              })),
            },
          }
        : readyState.state
      const action = {
        id: 'summon.ground',
        version: 1,
        sourceType: 'discipline-skill' as const,
        tags: ['attack'],
        target: {
          kind: 'ground-tile' as const,
          teamPolicy: 'enemy' as const,
          shape: { kind: 'single' as const },
          minimumRange: 0,
          maximumRange: 2,
          requiresLineOfSight: false,
          maximumElevationDifference: 0,
          friendlyFire: 'enemies-only' as const,
        },
        cost: { spendsAction: false, mp: 0 },
        requirements: [],
        effects: [
          { type: 'damage' as const, recipient: 'affected-units' as const, amount: 90 },
          { type: 'damage' as const, recipient: 'affected-units' as const, amount: 90 },
          {
            type: 'apply-status' as const,
            recipient: 'affected-units' as const,
            statusId: 'frozen',
            stacks: 1,
          },
        ],
        groundArea: {
          durationRounds: 3,
          timing: 'instant' as const,
          visualPresetId: 'embers' as const,
          entryEffectOrdinals: [0, 1, 2],
        },
      }
      let placed = createCombatGroundArea(
        { ...state, groundEffectPolicyVersion: 1 },
        summon.combatantId,
        action,
        [{ x: 2, y: 0 }],
        PV1F_COMBAT_CONTENT,
      ) as StatDrivenCombatEncounterState
      placed = finishPv1fTurn(placed, 'east').state
      const removed = removeCombatSummon(placed, summon.combatantId, 'expired').state
      const restored = JSON.parse(JSON.stringify(removed)) as StatDrivenCombatEncounterState
      const before = JSON.stringify(restored)
      const preview = resolveCombatMovementStepEffects(restored, 'enemy', PV1F_COMBAT_CONTENT, {
        preview: true,
      })
      expect(hp(restored) - hp(preview.state)).toBe(3)
      expect(JSON.stringify(restored)).toBe(before)
      const entered = resolveCombatMovementStepEffects(restored, 'enemy', PV1F_COMBAT_CONTENT)
      expect(hp(restored) - hp(entered.state)).toBe(3)
      expect(
        entered.state.tactical.battle.combatants.some((row) => row.id === summon.combatantId),
      ).toBe(false)
    },
  )

  it('caps indirect and reflected output before temporary HP absorption', () => {
    const { state, summon } = ready()
    const protectedState = {
      ...state,
      ...grantBarrier(state, 'enemy', 'enemy', 'test.barrier', 5).state,
      statBridge: state.statBridge,
      modularSkillPolicyVersion: 1 as const,
    }
    const result = absorbIndirectDamageWithBarrier(
      protectedState,
      summon.combatantId,
      'enemy',
      'status.reflect.current.v1',
      1000n,
    )
    expect(result.remainingDamage).toBe(0)
    expect(result.absorbed).toBe(3)
    expect(result.after).toBe(2)
  })

  it('validates the optional authored ceiling and retains legacy absence', () => {
    expect(validateSummonProfileDefinition(summonProfile())).toEqual([])
    for (const potencyBasisPoints of [0, 4000, 10000])
      expect(validateSummonProfileDefinition({ ...summonProfile(), potencyBasisPoints })).toEqual(
        [],
      )
    for (const potencyBasisPoints of [-1, 10001, 0.5, Number.NaN])
      expect(validateSummonProfileDefinition({ ...summonProfile(), potencyBasisPoints })).toContain(
        'potencyBasisPoints',
      )
  })

  it('gives every area recipient a separate ceiling against that same target defense', () => {
    const { state, summon, ability } = ready(
      4000,
      [
        { type: 'damage', recipient: 'affected-units', amount: 99 },
        { type: 'damage', recipient: 'affected-units', amount: 99 },
      ],
      encounter(true),
    )
    const result = executePv1fSummonAbility(state, summon, ability.id, {
      kind: 'unit',
      combatantId: 'enemy',
    })
    expect(hp(state, 'enemy') - hp(result.state, 'enemy')).toBe(3)
    expect(hp(state, 'enemy2') - hp(result.state, 'enemy2')).toBe(2)
  })

  it('uses current Mystic defense and status mitigation in the reference', () => {
    const { state, summon, ability } = ready()
    const mystic = {
      ...state,
      statBridge: {
        ...state.statBridge,
        combatants: state.statBridge.combatants.map((row) =>
          row.combatantId === 'player'
            ? { ...row, mysticPower: 80 }
            : row.combatantId === 'enemy'
              ? { ...row, ward: 100 }
              : row,
        ),
      },
      statusState: state.statusState.map((row) =>
        row.combatantId === 'enemy'
          ? {
              ...row,
              statuses: [
                {
                  statusId: 'guarded',
                  statusVersion: 1,
                  stacks: 1,
                  sourceCombatantId: 'enemy',
                  remainingOwnerTurnStarts: 2,
                },
              ],
            }
          : row,
      ),
    }
    const result = executePv1fSummonAbility(mystic, summon, ability.id, {
      kind: 'unit',
      combatantId: 'enemy',
    })
    // Mystic Basic: (6 + floor(80 * .15)) / 2 = 9; Guard floors to 7; 40% floors to 2.
    expect(hp(state) - hp(result.state)).toBe(2)
  })

  it('does not inflate the reference with ineligible Basic packets or self damage', () => {
    const { state, summon, ability } = ready()
    const definitions = defaultBasicSkills().map((row) =>
      row.id !== 'unarmed.basic'
        ? row
        : {
            ...row,
            ability: {
              ...row.ability,
              behaviors: row.ability.behaviors.map((behavior) => ({
                ...behavior,
                effects: [
                  {
                    id: 'gated',
                    requirements: {
                      kind: 'resource-state' as const,
                      subject: 'selected' as const,
                      resource: 'hp' as const,
                      comparison: 'at-least' as const,
                      amount: 1000,
                    },
                    payload: {
                      type: 'damage' as const,
                      recipient: 'primary-unit' as const,
                      amount: 20,
                    },
                  },
                  {
                    id: 'self',
                    payload: { type: 'damage' as const, recipient: 'actor' as const, amount: 20 },
                  },
                ],
              })),
            },
          },
    )
    const captured = {
      ...state,
      capturedAbilitySources: captureBasicSkillSources({
        ownerCombatantId: 'player',
        supportActionId: 'basic.guard',
        definitions,
      }),
    }
    const result = executePv1fSummonAbility(captured, summon, ability.id, {
      kind: 'unit',
      combatantId: 'enemy',
    })
    expect(hp(state) - hp(result.state)).toBe(0)
  })

  it('uses the summoner Level rather than the summon Level for the ceiling', () => {
    const { state, summon, ability } = ready()
    const leveled = {
      ...state,
      statBridge: {
        ...state.statBridge,
        combatants: state.statBridge.combatants.map((row) =>
          row.combatantId === 'player' ? { ...row, level: 100 } : row,
        ),
      },
    }
    const result = executePv1fSummonAbility(leveled, summon, ability.id, {
      kind: 'unit',
      combatantId: 'enemy',
    })
    expect(hp(state) - hp(result.state)).toBe(6) // Basic9 × Level1.75 floors15; 40% =6.
  })
  it.each([false, true])(
    'keeps independent casts separate after restore, grouping same-cast periodic packets (percentage: %s)',
    (percentage) => {
      const bleed: CombatEffectDefinition = percentage
        ? {
            type: 'bleed',
            recipient: 'primary-unit',
            damageProfile: { kind: 'attack-percentage', basisPoints: 10000 },
            ticks: 4,
          }
        : { type: 'bleed', recipient: 'primary-unit', damagePerTick: 20, ticks: 4 }
      const { state, summon, ability } = ready(4000, [
        ...(percentage
          ? [{ type: 'damage' as const, recipient: 'primary-unit' as const, amount: 99 }]
          : []),
        bleed,
        { ...bleed },
      ])
      let current = {
        ...state,
        effectStackingPolicyVersion: 1 as const,
        ...(percentage ? { percentageDotPolicyVersion: 1 as const } : {}),
      }
      current = executePv1fSummonAbility(current, summon, ability.id, {
        kind: 'unit',
        combatantId: 'enemy',
      }).state as typeof current
      current = JSON.parse(JSON.stringify(current)) as typeof current
      const afterFirstCast = hp(current)
      for (let n = 0; n < 8; n++) {
        current = finishPv1fTurn(
          current,
          current.tactical.battle.currentTurn?.combatantId === 'enemy' ? 'west' : 'east',
        ).state as typeof current
        if (current.tactical.battle.currentTurn?.combatantId === summon.combatantId) break
      }
      expect(afterFirstCast - hp(current)).toBe(3)
      current = executePv1fSummonAbility(current, summon, ability.id, {
        kind: 'unit',
        combatantId: 'enemy',
      }).state as typeof current
      current = JSON.parse(JSON.stringify(current)) as typeof current
      for (let n = 0; n < 5 && current.tactical.battle.currentTurn?.combatantId !== 'enemy'; n++)
        current = finishPv1fTurn(current, 'east').state as typeof current
      current = JSON.parse(JSON.stringify(current)) as typeof current
      const before = hp(current)
      const result = finishPv1fTurn(current, 'west').state
      expect(before - hp(result)).toBe(6)
    },
  )

  it('uses the same per-cast Poison movement budget in walking preview and commit', () => {
    const { state, summon } = ready()
    let current = {
      ...state,
      effectStackingPolicyVersion: 1 as const,
      tactical: {
        ...state.tactical,
        height: 2,
        tiles: [
          ...state.tactical.tiles,
          ...Array.from({ length: 3 }, (_, x) => ({
            position: { x, y: 1 },
            elevation: 0,
            terrainId: 'open-ground',
          })),
        ],
      },
    }
    for (let n = 0; n < 3; n++)
      current = applyCurrentPoisonState(
        current,
        summon.combatantId,
        'enemy',
        'summon.poison',
        undefined,
        20,
        4,
      ) as typeof current
    current = {
      ...current,
      effectState: {
        ...current.effectState!,
        poison: current.effectState!.poison.map((row, index) => ({
          ...row,
          movementRemainder: 4,
          summonDamageCommandId: index < 2 ? 100 : 101,
        })),
      },
    }
    for (let n = 0; n < 6 && current.tactical.battle.currentTurn?.combatantId !== 'enemy'; n++)
      current = finishPv1fTurn(current, 'east').state as typeof current
    const path = [
      { x: 2, y: 0 },
      { x: 2, y: 1 },
    ]
    expect(evaluatePv1fMovement(current, path).poisonForecast.damage).toBe(6)
    expect(hp(current) - hp(executePv1fMovement(current, path).state)).toBe(6)
  })
})

function mpDrainSkill(
  apCost: number,
  effects: readonly CombatEffectDefinition[],
): MatureSkillDefinition {
  const { ability: _ability, ...base } = resolveMatureSkillVersion('vanguard.forceful-strike', 2)!
  void _ability
  return {
    ...base,
    apCost,
    mpCost: 0,
    flavorLine: base.flavorLine ?? 'A measured stroke drains the enemy’s energy.',
    cooldown: { key: base.id, ownerTurns: 1 },
    requirements: [],
    overrides: {},
    target: summonProfile().abilities[0]!.target,
    effects,
    authoring: {
      ...base.authoring,
      validationTags: [...base.authoring.validationTags, 'owner-rebalance-v5'],
    },
  }
}
const percentageDrain: CombatEffectDefinition = {
  type: 'resource-change',
  recipient: 'primary-unit',
  resource: 'mp',
  delta: -10,
  ticks: 1,
  basis: 'maximum-mp-percent',
}
const resourceMp = (
  state: { tactical: StatDrivenCombatEncounterState['tactical'] },
  id = 'enemy',
) => state.tactical.battle.combatants.find((row) => row.id === id)!.mp

function withPower(state: StatDrivenCombatEncounterState, combatantId: string, power: number) {
  return {
    ...state,
    statBridge: {
      ...state.statBridge,
      combatants: state.statBridge.combatants.map((row) => ({
        ...row,
        accuracy: 10000,
        evasion: 0,
        ...(row.combatantId === combatantId ? { physicalPower: power, mysticPower: power } : {}),
      })),
    },
  }
}

describe('percentage MP Drain stays outside offensive power scaling', () => {
  it.each([
    [30, 10],
    [60, 100],
  ])('keeps native Skill MP Drain at its authored percentage (AP%i, power%i)', (apCost, power) => {
    const state = withPower(encounter(), 'player', power)
    const skill = mpDrainSkill(apCost!, [percentageDrain])
    const quote = evaluatePv1fMatureSkill(state, skill, { kind: 'unit', combatantId: 'enemy' })
    expect(quote.action.effects[0]).toMatchObject({ basis: 'maximum-mp-percent', delta: -10 })
    expect(
      resourceMp(
        executePv1fMatureSkill(state, skill, { kind: 'unit', combatantId: 'enemy' }).state,
      ),
    ).toBe(18)
    const template = defaultBasicSkills().find((row) => row.id === 'unarmed.basic')!.ability
      .behaviors[0]!
    const canonical = {
      ...skill,
      ability: parseAbilityDefinition({
        schemaVersion: 1,
        behaviors: [
          {
            ...template,
            classification: 'utility',
            attackFamily: undefined,
            targeting: { ...skill.target, geometryVersion: 3, maximumSelections: 1 },
            costs: [{ resource: 'ap', amount: apCost }],
            effects: [{ id: 'drain', timing: 'instant', payload: percentageDrain }],
          },
        ],
      }),
    }
    expect(
      resourceMp(
        executePv1fMatureSkill(state, canonical, { kind: 'unit', combatantId: 'enemy' }).state,
      ),
    ).toBe(18)
  })

  it.each([
    [30, 10],
    [60, 100],
  ])('keeps Summon MP Drain at its authored percentage (AP%i, power%i)', (apCost, power) => {
    const prepared = ready(4000, [percentageDrain])
    const summon = {
      ...prepared.summon,
      profile: {
        ...prepared.summon.profile,
        abilities: [{ ...prepared.ability, apCost: apCost! }],
      },
    }
    const state = withPower(
      { ...prepared.state, effectState: { ...prepared.state.effectState!, summons: [summon] } },
      summon.combatantId,
      power!,
    )
    const quote = evaluatePv1fSummonAbility(state, summon, prepared.ability.id, {
      kind: 'unit',
      combatantId: 'enemy',
    })
    expect(quote.action.effects[0]).toMatchObject({ basis: 'maximum-mp-percent', delta: -10 })
    expect(
      resourceMp(
        executePv1fSummonAbility(state, summon, prepared.ability.id, {
          kind: 'unit',
          combatantId: 'enemy',
        }).state,
      ),
    ).toBe(18)
  })

  it('does not dilute native HP power scaling when MP Drain shares the action', () => {
    const original = withPower(encounter(), 'player', 30)
    const state = {
      ...original,
      tactical: {
        ...original.tactical,
        battle: {
          ...original.tactical.battle,
          combatants: original.tactical.battle.combatants.map((row) =>
            row.id === 'player' ? { ...row, hp: 20 } : row,
          ),
        },
      },
    }
    const skill = mpDrainSkill(45, [
      percentageDrain,
      { type: 'healing', recipient: 'actor', amount: 5, ticks: 1 },
    ])
    const result = executePv1fMatureSkill(state, skill, {
      kind: 'unit',
      combatantId: 'enemy',
    }).state
    expect(resourceMp(result)).toBe(18)
    expect(hp(result, 'player')).toBe(31)
  })

  it('does not dilute Summon HP power scaling when MP Drain shares the ability', () => {
    const prepared = ready(4000, [
      percentageDrain,
      { type: 'healing', recipient: 'actor', amount: 5, ticks: 1 },
    ])
    const state = {
      ...prepared.state,
      tactical: {
        ...prepared.state.tactical,
        battle: {
          ...prepared.state.tactical.battle,
          combatants: prepared.state.tactical.battle.combatants.map((row) =>
            row.id === prepared.summon.combatantId ? { ...row, hp: 10 } : row,
          ),
        },
      },
    }
    const result = executePv1fSummonAbility(state, prepared.summon, prepared.ability.id, {
      kind: 'unit',
      combatantId: 'enemy',
    }).state
    expect(resourceMp(result)).toBe(18)
    expect(hp(result, prepared.summon.combatantId)).toBe(20)
  })

  it('retains historical flat MP Drain power scaling for native Skills and Summons', () => {
    const flat: CombatEffectDefinition = {
      type: 'resource-change',
      recipient: 'primary-unit',
      resource: 'mp',
      delta: -10,
      ticks: 1,
    }
    const native = executePv1fMatureSkill(
      withPower(encounter(), 'player', 30),
      mpDrainSkill(45, [flat]),
      { kind: 'unit', combatantId: 'enemy' },
    ).state
    expect(resourceMp(native)).toBe(4)
    const prepared = ready(null, [flat])
    const result = executePv1fSummonAbility(prepared.state, prepared.summon, prepared.ability.id, {
      kind: 'unit',
      combatantId: 'enemy',
    }).state
    expect(resourceMp(result)).toBe(5)
  })
})

describe('Summon runtime attack family matches its existing power binding', () => {
  it.each([
    { family: null, element: undefined, counter: 'physical', returned: 3 },
    { family: null, element: 'fire', counter: 'physical', returned: 3 },
    { family: null, element: 'fire', counter: 'mystic', returned: 0 },
    { family: 'mystic', element: 'fire', counter: 'mystic', returned: 3 },
    { family: 'mystic', element: undefined, counter: 'physical', returned: 0 },
  ] as const)(
    'uses $family family / $element element against $counter Counter',
    ({ family, element, counter, returned }) => {
      const prepared = ready(4000, [
        { type: 'damage', recipient: 'primary-unit', amount: 99, ...(element ? { element } : {}) },
      ])
      const summon = {
        ...prepared.summon,
        profile: {
          ...prepared.summon.profile,
          abilities: [
            { ...prepared.ability, tags: ['attack', 'melee', ...(family ? [family] : [])] },
          ],
        },
      }
      const state = {
        ...prepared.state,
        effectState: { ...prepared.state.effectState!, summons: [summon] },
        statusState: prepared.state.statusState.map((row) =>
          row.combatantId === 'enemy'
            ? {
                ...row,
                statuses: [
                  {
                    statusId: 'counter',
                    statusVersion: 1,
                    stacks: 1,
                    remainingOwnerTurnStarts: 2,
                    sourceCombatantId: 'enemy',
                    counter: { kind: counter, basisPoints: 10000 },
                  },
                ],
              }
            : row,
        ),
      }
      const profileBefore = JSON.stringify(summon.profile)
      const result = executePv1fSummonAbility(state, summon, prepared.ability.id, {
        kind: 'unit',
        combatantId: 'enemy',
      }).state
      expect(hp(state) - hp(result)).toBe(3)
      expect(hp(state, summon.combatantId) - hp(result, summon.combatantId)).toBe(returned)
      expect(JSON.stringify(result.effectState!.summons![0]!.profile)).toBe(profileBefore)
    },
  )

  it('classifies retained profiles without a potency field without changing their damage or stored tags', () => {
    const prepared = ready(null, [{ type: 'damage', recipient: 'primary-unit', amount: 5 }])
    const state = {
      ...prepared.state,
      statusState: prepared.state.statusState.map((row) =>
        row.combatantId === 'enemy'
          ? {
              ...row,
              statuses: [
                {
                  statusId: 'counter',
                  statusVersion: 1,
                  stacks: 1,
                  remainingOwnerTurnStarts: 2,
                  sourceCombatantId: 'enemy',
                  counter: { kind: 'physical' as const, basisPoints: 10000 },
                },
              ],
            }
          : row,
      ),
    }
    const result = executePv1fSummonAbility(state, prepared.summon, prepared.ability.id, {
      kind: 'unit',
      combatantId: 'enemy',
    }).state
    expect(hp(state) - hp(result)).toBe(10)
    expect(hp(state, prepared.summon.combatantId) - hp(result, prepared.summon.combatantId)).toBe(
      10,
    )
    expect(result.effectState!.summons![0]!.profile.abilities[0]!.tags).toEqual(['attack', 'melee'])
  })
})

function nativeDrainEssence(skill: MatureSkillDefinition): EssenceDefinition {
  const { ability: _ability, ...base } = resolveEssenceForBuild('vanguard', null)!
  void _ability
  return {
    ...base,
    skill: {
      ...skill,
      id: base.essenceId,
      contentVersion: base.contentVersion,
      sourceDisciplineId: base.sourceDisciplineId,
      tags: [...skill.tags, 'essence'],
    },
  }
}

describe('native v5 percentage MP Drain authoring bounds', () => {
  it.each([50, 100])(
    'accepts and executes %i percent through native Skill and Essence validation',
    (percent) => {
      const skill = mpDrainSkill(60, [{ ...percentageDrain, delta: -percent }])
      expect(validateMatureSkillDefinition(skill)).toEqual([])
      expect(validateEssenceDefinition(nativeDrainEssence(skill))).toEqual([])
      const result = executePv1fMatureSkill(withPower(encounter(), 'player', 100), skill, {
        kind: 'unit',
        combatantId: 'enemy',
      }).state
      expect(resourceMp(result)).toBe(20 - percent / 5)
    },
  )

  it.each([
    { delta: -101, percentage: true },
    { delta: 0, percentage: true },
    { delta: 1, percentage: true },
    { delta: 50, percentage: true },
    { delta: -21, percentage: false },
    { delta: 21, percentage: false },
  ])(
    'rejects delta $delta with percentage=$percentage in Skill and Essence validation',
    ({ delta, percentage }) => {
      const effect: CombatEffectDefinition = {
        type: 'resource-change',
        resource: 'mp',
        recipient: 'primary-unit',
        delta,
        ticks: 1,
        ...(percentage ? { basis: 'maximum-mp-percent' as const } : {}),
      }
      const skill = mpDrainSkill(60, [effect])
      expect(validateMatureSkillDefinition(skill)).toContain('effects[0].delta')
      expect(validateEssenceDefinition(nativeDrainEssence(skill))).toContain('skill.definition')
    },
  )
})

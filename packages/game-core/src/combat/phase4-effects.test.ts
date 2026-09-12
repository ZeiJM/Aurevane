import { P35_REPRESENTATIVE_RESONANCES } from './resonance'
import { createResonanceCombatState } from './resonance'
import { executePv1fMatureSkillWithResonance } from './pv1f-resonance'
import { describe, expect, it } from 'vitest'
import { createPendingBattle, startBattle } from './battle-state'
import { createTacticalBattleState } from './board'
import {
  createCombatEncounterState,
  evaluateCombatAction,
  executeCombatAction,
  type CombatEncounterState,
  type CombatActionDefinition,
  type CombatEffectDefinition,
  type CombatTargetSelection,
} from './actions'
import { conditionalDamageMultiplier, validateDamageModifiers } from './damage-modifiers'
import {
  createPv1fTemporaryResources,
  executePv1fMatureSkill,
  evaluatePv1fMatureSkill,
  finishPv1fTurn,
  evaluatePv1fMovement,
  executePv1fMovement,
  readPv1fActionEconomy,
  preparePv1fTurnEconomy,
  PV1F_ACTION_ECONOMY_RESOURCE_KEY,
  PV1F_COMBAT_CONTENT,
} from './pv1f-action-economy'
import {
  createStatDrivenCombatEncounterState,
  type StatDrivenCombatEncounterState,
} from './stat-driven-combat'
import {
  ADVANCED_DISCIPLINE_SKILLS,
  ADVANCED_DISCIPLINE_ESSENCES,
} from './advanced-discipline-content'
import {
  validateMatureSkillDefinition,
  latestEnabledMatureSkills,
  resolveMatureSkillVersion,
  type MatureSkillDefinition,
  type MatureSkillCombatContext,
} from './mature-skills'
import { P36_REPRESENTATIVE_ESSENCES } from './essence'
import {
  PUBLISHED_SKILL_CONTRACTS,
  HISTORICAL_SKILL_CONTRACTS,
  type PublishedSkillContract,
  type ContractCombatant,
} from './phase4-execution-contracts.test-data'

function encounter(): StatDrivenCombatEncounterState {
  const ids = ['actor', 'enemy', 'other', 'ally']
  const battle = startBattle(
    createPendingBattle({
      battleId: 'phase4-effects',
      rulesVersion: 1,
      contentVersion: 1,
      rngSeed: 42,
      combatants: ids.map((id, index) => ({
        id,
        teamId: id === 'actor' || id === 'ally' ? 'players' : 'enemies',
        initiative: 40 - index * 10,
        baseMovementBudget: 4,
        hp: 25,
        maxHp: 50,
        mp: 10,
        maxMp: 20,
        temporaryResources: createPv1fTemporaryResources(10),
      })),
    }),
  ).state
  const positions = [
    { x: 1, y: 1 },
    { x: 2, y: 1 },
    { x: 3, y: 1 },
    { x: 1, y: 2 },
  ]
  return createStatDrivenCombatEncounterState(
    createCombatEncounterState(
      createTacticalBattleState({
        battle,
        width: 5,
        height: 4,
        terrains: [{ id: 'open', traversalCost: 1 }],
        tiles: Array.from({ length: 20 }, (_, i) => ({
          position: { x: i % 5, y: Math.floor(i / 5) },
          elevation: 0,
          terrainId: 'open',
        })),
        movementProfiles: [{ id: 'ground', maxElevationStep: 0, terrainCostOverrides: [] }],
        placements: ids.map((combatantId, i) => ({
          combatantId,
          position: positions[i]!,
          facing: 'west' as const,
          movementProfileId: 'ground',
        })),
      }),
    ),
    ids.map((combatantId) => ({
      combatantId,
      provenance: { kind: 'scenario' as const, sourceId: 'scenario:phase4', sourceRulesVersion: 1 },
      accuracy: 10000,
      evasion: 0,
      armor: 0,
      ward: 0,
      jump: 0,
    })),
  )
}
function withStatus<T extends CombatEncounterState>(
  state: T,
  owner: string,
  statusId: string,
  source = 'actor',
): T {
  const definition = PV1F_COMBAT_CONTENT.statuses.find((status) => status.id === statusId)!
  return {
    ...state,
    statusState: state.statusState.map((row) =>
      row.combatantId === owner
        ? {
            ...row,
            statuses: [
              ...row.statuses.filter((status) => status.statusId !== statusId),
              {
                statusId,
                statusVersion: 1,
                stacks: 1,
                remainingOwnerTurnStarts: definition.durationOwnerTurnStarts,
                sourceCombatantId: source,
              },
            ].sort((a, b) => a.statusId.localeCompare(b.statusId)),
          }
        : row,
    ),
  }
}
function action(effects: readonly CombatEffectDefinition[]): CombatActionDefinition {
  return {
    id: 'test.effects',
    version: 1,
    sourceType: 'test',
    tags: ['test'],
    cost: { mp: 0, spendsAction: false },
    requirements: [],
    target: {
      kind: 'unit',
      teamPolicy: 'enemy',
      shape: { kind: 'circle', radius: 1 },
      minimumRange: 1,
      maximumRange: 4,
      requiresLineOfSight: false,
      maximumElevationDifference: null,
      friendlyFire: 'enemies-only',
    },
    effects,
  }
}
const target = { kind: 'unit' as const, combatantId: 'enemy' }
const multiplier = (state: CombatEncounterState, from: string, to: string) =>
  conditionalDamageMultiplier(state, from, to, PV1F_COMBAT_CONTENT)

describe('Phase 4 bounded conditional damage and linked tradeoffs', () => {
  it('scopes outgoing reduction and incoming vulnerability to the actual opponent and status source', () => {
    let state = withStatus(encounter(), 'enemy', 'challenged')
    expect(multiplier(state, 'enemy', 'actor')).toBe(10000)
    expect(multiplier(state, 'enemy', 'ally')).toBe(7500)
    state = withStatus(state, 'enemy', 'marked')
    expect(multiplier(state, 'actor', 'enemy')).toBe(12000)
    expect(multiplier(state, 'ally', 'enemy')).toBe(10000)
    state = withStatus(state, 'actor', 'warded')
    expect(multiplier(state, 'enemy', 'actor')).toBe(10000)
    state = withStatus(state, 'enemy', 'burn')
    expect(multiplier(state, 'enemy', 'actor')).toBe(8000)
  })
  it('keeps both halves of a tradeoff under one status and removes both together', () => {
    const state = withStatus(encounter(), 'actor', 'reckless')
    expect(multiplier(state, 'actor', 'enemy')).toBe(14000)
    expect(multiplier(state, 'enemy', 'actor')).toBe(12500)
    const removed = executeCombatAction(
      state,
      action([{ type: 'remove-status', recipient: 'actor', statusIds: ['reckless'] }]),
      target,
      PV1F_COMBAT_CONTENT,
    ).state
    expect(multiplier(removed, 'actor', 'enemy')).toBe(10000)
    expect(multiplier(removed, 'enemy', 'actor')).toBe(10000)
    const fortified = withStatus(encounter(), 'actor', 'fortified')
    expect(multiplier(fortified, 'actor', 'enemy')).toBe(8000)
    expect(multiplier(fortified, 'enemy', 'actor')).toBe(7000)
  })
  it('forecasts area damage per recipient and commits the same values after serialization', () => {
    let state = withStatus(encounter(), 'enemy', 'marked')
    state = withStatus(state, 'actor', 'reckless')
    const definition = action([{ type: 'damage', recipient: 'affected-units', amount: 10 }])
    const preview = evaluateCombatAction(state, definition, target, PV1F_COMBAT_CONTENT)
    expect(preview.legal).toBe(true)
    expect(preview.projectedEffects.map((effect) => [effect.combatantId, effect.after])).toEqual([
      ['enemy', 9],
      ['other', 11],
    ])
    const result = executeCombatAction(
      JSON.parse(JSON.stringify(state)),
      definition,
      target,
      PV1F_COMBAT_CONTENT,
    )
    for (const effect of preview.projectedEffects)
      expect(
        result.state.tactical.battle.combatants.find((unit) => unit.id === effect.combatantId)?.hp,
      ).toBe(effect.after)
    expect(state.tactical.battle.combatants[1]!.hp).toBe(25)
  })
  it('combines modifiers independent of status order, caps them, and rejects malformed authored values', () => {
    const state = withStatus(withStatus(encounter(), 'actor', 'reckless'), 'enemy', 'marked')
    const statuses = PV1F_COMBAT_CONTENT.statuses.map((status) =>
      status.id === 'reckless'
        ? {
            ...status,
            damageModifiers: Array.from({ length: 2 }, () => ({
              direction: 'outgoing' as const,
              multiplierBasisPoints: 15000,
              condition: { kind: 'always' as const },
            })),
          }
        : status,
    )
    expect(conditionalDamageMultiplier(state, 'actor', 'enemy', { statuses })).toBe(20000)
    expect(() =>
      validateDamageModifiers([
        { direction: 'outgoing', multiplierBasisPoints: 20000, condition: { kind: 'always' } },
      ]),
    ).toThrow()
    expect(() =>
      validateDamageModifiers([
        {
          direction: 'incoming',
          multiplierBasisPoints: 8000,
          condition: { kind: 'distance-at-least', tiles: 0 },
        },
      ]),
    ).toThrow()
  })
})

describe('Phase 4 periodic effects, cleanse and movement control', () => {
  it('ticks only at the affected unit’s turn end, including lethal damage, without reviving a defeated unit', () => {
    let state = withStatus(encounter(), 'enemy', 'burn')
    state = {
      ...state,
      tactical: {
        ...state.tactical,
        battle: {
          ...state.tactical.battle,
          combatants: state.tactical.battle.combatants.map((unit) =>
            unit.id === 'enemy' ? { ...unit, hp: 3 } : unit,
          ),
        },
      },
    }
    state = withStatus(state, 'enemy', 'regeneration')
    const enemyTurn = finishPv1fTurn(state, 'east').state
    expect(enemyTurn.tactical.battle.combatants.find((unit) => unit.id === 'enemy')?.hp).toBe(3)
    const after = finishPv1fTurn(enemyTurn, 'west')
    expect(after.state.tactical.battle.currentTurn?.combatantId).toBe('other')
    expect(after.state.tactical.battle.combatants.find((unit) => unit.id === 'enemy')?.hp).toBe(0)
    expect(after.events).toContainEqual(
      expect.objectContaining({ event: 'damage_applied', actionId: 'status.burn', amount: 3 }),
    )
  })
  it('cleansing prevents future ticks and preview does not mutate statuses', () => {
    const state = withStatus(encounter(), 'actor', 'burn')
    const definition = action([{ type: 'remove-status', recipient: 'actor', statusIds: ['burn'] }])
    expect(
      evaluateCombatAction(state, definition, target, PV1F_COMBAT_CONTENT).projectedEffects[0]
        ?.before,
    ).toBe('burn')
    expect(state.statusState[0]?.statuses).toHaveLength(1)
    const cleaned = executeCombatAction(state, definition, target, PV1F_COMBAT_CONTENT).state
    const ended = finishPv1fTurn({ ...cleaned, statBridge: state.statBridge }, 'east')
    expect(ended.state.tactical.battle.combatants[0]?.hp).toBe(25)
  })
  it('Root rejects preview and commit; Slow increases AP without changing Movement allowance', () => {
    const path = [
      { x: 1, y: 1 },
      { x: 0, y: 1 },
    ]
    const rooted = withStatus(encounter(), 'actor', 'root')
    expect(evaluatePv1fMovement(rooted, path).movement.legal).toBe(false)
    expect(() => executePv1fMovement(rooted, path)).toThrow(/Root/)
    const slow = withStatus(encounter(), 'actor', 'slow')
    const preview = evaluatePv1fMovement(slow, path)
    expect(preview.economyCost).toBe(30)
    expect(preview.movement.cost).toBe(1)
    expect(executePv1fMovement(slow, path).state.tactical.placements[0]?.position).toEqual(path[1])
  })
})

describe('Phase 4 advanced libraries', () => {
  it('provides eight authored regular Skills and an Essence per added Discipline', () => {
    const disciplines = new Set(ADVANCED_DISCIPLINE_SKILLS.map((skill) => skill.sourceDisciplineId))
    expect(disciplines.size).toBe(11)
    for (const discipline of disciplines) {
      expect(
        latestEnabledMatureSkills(ADVANCED_DISCIPLINE_SKILLS).filter(
          (skill) => skill.sourceDisciplineId === discipline,
        ),
      ).toHaveLength(8)
      expect(
        ADVANCED_DISCIPLINE_ESSENCES.filter((essence) => essence.sourceDisciplineId === discipline),
      ).toHaveLength(1)
    }
  })
})

const publishedSkills = [
  ...latestEnabledMatureSkills(),
  ...P36_REPRESENTATIVE_ESSENCES.filter((essence) => essence.enabled).map(
    (essence) => essence.skill,
  ),
]
const contractCombatants: readonly ContractCombatant[] = ['actor', 'enemy', 'other', 'ally']

function contractEncounter(skill: MatureSkillDefinition, contract: PublishedSkillContract) {
  let state = encounter()
  // Leave room for multiple hits/heals and full-cost repeats without a terminal battle or caps
  // obscuring an omitted effect. Low-HP Skills remain below their threshold after healing.
  state = {
    ...state,
    tactical: {
      ...state.tactical,
      battle: {
        ...state.tactical.battle,
        combatants: state.tactical.battle.combatants.map((unit) => ({
          ...unit,
          hp: 100,
          maxHp: 1000,
          mp: 40,
          maxMp: 100,
        })),
      },
      placements: state.tactical.placements.map((unit) => {
        if (unit.combatantId === 'enemy' && skill.target.minimumRange > 1)
          return { ...unit, position: { x: 1 + skill.target.minimumRange, y: 1 } }
        if (
          unit.combatantId === 'other' &&
          (skill.target.minimumRange === 2 ||
            (skill.id === 'ironfist.pressure-palm' && skill.contentVersion === 2))
        )
          return { ...unit, position: { x: 4, y: 1 } }
        return unit
      }),
    },
  }
  for (const requirement of skill.requirements) {
    if (requirement.kind === 'actor-status-present')
      state = withStatus(state, 'actor', requirement.statusId)
    if (requirement.kind === 'target-status-present')
      state = withStatus(state, 'enemy', requirement.statusId)
    if (requirement.kind === 'target-tag-present')
      state = withStatus(
        state,
        'enemy',
        requirement.tag === 'Bleeding' ? 'bleed' : requirement.tag.toLowerCase(),
      )
  }
  for (const [owner, statuses] of Object.entries(contract.removed ?? {})) {
    // An unrelated beneficial status must survive a named cleanse/dispelling effect.
    for (const status of [...statuses, 'airborne']) state = withStatus(state, owner, status)
  }
  if (skill.id === 'chronist.rewind-step')
    state = executePv1fMovement(state, [
      { x: 1, y: 1 },
      { x: 0, y: 1 },
    ]).state
  const selection: CombatTargetSelection =
    skill.target.kind === 'ground-tile'
      ? { kind: 'tile', position: { x: 2, y: 1 } }
      : skill.target.kind === 'self'
        ? { kind: 'self' }
        : {
            kind: 'unit',
            combatantId:
              skill.target.teamPolicy === 'ally'
                ? 'ally'
                : skill.target.shape.kind === 'line'
                  ? 'other'
                  : 'enemy',
          }
  return { state: preparePv1fTurnEconomy(state), selection }
}

function assertContractUse(
  state: StatDrivenCombatEncounterState,
  skill: MatureSkillDefinition,
  contract: PublishedSkillContract,
  selection: CombatTargetSelection,
  context: MatureSkillCombatContext,
  use: 0 | 1,
) {
  const serialized = JSON.stringify(state)
  const preview = evaluatePv1fMatureSkill(state, skill, selection, context)
  const ap = context === 'pvp' ? (contract.cost[2] ?? contract.cost[0]) : contract.cost[0]
  expect(preview.repeatPenaltyApplied).toBe(use === 1)
  expect(preview.evaluation.legal, JSON.stringify(preview.evaluation.issues)).toBe(true)
  expect(preview.cost).toBe(ap)
  expect(preview.evaluation.mpCost).toBe(contract.cost[1])
  expect(JSON.stringify(state)).toBe(serialized)
  const result = executePv1fMatureSkill(JSON.parse(serialized), skill, selection, context)
  expect(JSON.stringify(state)).toBe(serialized)
  expect(readPv1fActionEconomy(result.state, 'actor')?.current).toBe(
    readPv1fActionEconomy(state, 'actor')!.current - ap,
  )
  expect(result.events).toContainEqual(
    expect.objectContaining({ event: 'action_economy_spent', combatantId: 'actor', amount: ap }),
  )
  expect(result.events).not.toContainEqual(
    expect.objectContaining({ event: 'skill_cooldown_started' }),
  )
  for (const id of contractCombatants) {
    const before = state.tactical.battle.combatants.find((unit) => unit.id === id)!
    const after = result.state.tactical.battle.combatants.find((unit) => unit.id === id)!
    const hpDelta = contract.hp?.[id]?.[use] ?? 0
    const mpDelta = contract.mp?.[id]?.[use] ?? 0
    expect(after.hp - before.hp, `${id} HP`).toBe(hpDelta)
    expect(after.mp - before.mp, `${id} MP`).toBe(mpDelta - (id === 'actor' ? contract.cost[1] : 0))
    const projected = preview.evaluation.projectedEffects.filter(
      (effect) => effect.combatantId === id,
    )
    const projectedDelta = (types: readonly string[]) =>
      projected
        .filter((effect) => types.includes(effect.effectType))
        .reduce((sum, effect) => sum + Number(effect.after) - Number(effect.before), 0)
    expect(projectedDelta(['damage', 'healing']), `${id} HP forecast`).toBe(hpDelta)
    expect(projectedDelta(['resource-change']), `${id} MP forecast`).toBe(mpDelta)

    const added = use === 0 ? (contract.applied?.[id] ?? []) : []
    const removed = (use === 0 ? contract.removed?.[id] : contract.repeatRemoved?.[id]) ?? []
    const oldStatuses = state.statusState.find((row) => row.combatantId === id)!.statuses
    const expectedStatuses = [
      ...oldStatuses.filter(
        (status) => !removed.includes(status.statusId) && !added.includes(status.statusId),
      ),
      ...added.map((statusId) => ({
        statusId,
        statusVersion: 1,
        stacks: 1,
        sourceCombatantId: 'actor',
        remainingOwnerTurnStarts:
          statusId === 'bleed' ? 3 : statusId === 'poison' ? 4 : statusId === 'displaced' ? 1 : 2,
      })),
    ].sort((left, right) => left.statusId.localeCompare(right.statusId))
    expect(
      result.state.statusState.find((row) => row.combatantId === id)!.statuses,
      `${id} statuses`,
    ).toEqual(expectedStatuses)
    const position = state.tactical.placements.find((unit) => unit.combatantId === id)!.position
    expect(
      result.state.tactical.placements.find((unit) => unit.combatantId === id)!.position,
    ).toEqual(use === 0 ? (contract.positions?.[id] ?? position) : position)
  }
  if (use === 1) {
    expect(result.events).not.toContainEqual(expect.objectContaining({ event: 'status_applied' }))
    expect(result.events).not.toContainEqual(
      expect.objectContaining({ event: 'combatant_displaced' }),
    )
    expect(result.events).not.toContainEqual(
      expect.objectContaining({ event: 'combatant_rewound' }),
    )
    expect(result.state.terrainOverlays).toEqual(state.terrainOverlays)
  } else {
    const expectedTerrain = (contract.frozenTiles ?? []).map((position) => ({
      position,
      kind: 'frozen',
      remainingRoundBoundaries: 2,
    }))
    expect(
      (result.state.terrainOverlays ?? []).map(({ position, kind, remainingRoundBoundaries }) => ({
        position,
        kind,
        remainingRoundBoundaries,
      })),
    ).toEqual(expectedTerrain)
  }
  return result.state
}

describe('Every published Technique and Essence executes its authored recipient contract', () => {
  it('covers exactly the 136 current regular Skills and 17 current Essences', () => {
    expect(latestEnabledMatureSkills()).toHaveLength(136)
    expect(publishedSkills).toHaveLength(153)
    expect(PUBLISHED_SKILL_CONTRACTS.map((contract) => contract.id).sort()).toEqual(
      publishedSkills.map((skill) => skill.id).sort(),
    )
    expect(HISTORICAL_SKILL_CONTRACTS.map((contract) => contract.id).sort()).toEqual(
      latestEnabledMatureSkills()
        .filter((skill) => skill.contentVersion === 2 && skill.id !== 'vanguard.forceful-strike')
        .map((skill) => skill.id)
        .sort(),
    )
  })
  for (const context of ['pve', 'pvp'] as const) {
    it.each([...PUBLISHED_SKILL_CONTRACTS, ...HISTORICAL_SKILL_CONTRACTS])(
      `${context}: $id ($contentVersion) commits exact effects and a saved-state consecutive use`,
      (contract) => {
        const skill = contract.contentVersion
          ? resolveMatureSkillVersion(contract.id, contract.contentVersion)!
          : publishedSkills.find((candidate) => candidate.id === contract.id)!
        expect(validateMatureSkillDefinition(skill)).toEqual([])
        const { state, selection } = contractEncounter(skill, contract)
        let next = assertContractUse(state, skill, contract, selection, context, 0)
        const ap = context === 'pvp' ? (contract.cost[2] ?? contract.cost[0]) : contract.cost[0]
        if (readPv1fActionEconomy(next, 'actor')!.current < ap) {
          do {
            next = finishPv1fTurn(next, 'west').state
          } while (next.tactical.battle.currentTurn?.combatantId !== 'actor')
        }
        next = JSON.parse(JSON.stringify(next))
        if (contract.repeatBlocked) {
          const before = JSON.stringify(next)
          const repeat = evaluatePv1fMatureSkill(next, skill, selection, context)
          expect(repeat.repeatPenaltyApplied).toBe(true)
          expect(repeat.evaluation.issues).toContainEqual(
            expect.objectContaining({ code: contract.repeatBlocked }),
          )
          expect(() => executePv1fMatureSkill(next, skill, selection, context)).toThrow()
          expect(JSON.stringify(next)).toBe(before)
        } else {
          assertContractUse(next, skill, contract, selection, context, 1)
        }

        const unaffordable = {
          ...state,
          tactical: {
            ...state.tactical,
            battle: {
              ...state.tactical.battle,
              combatants: state.tactical.battle.combatants.map((unit) =>
                unit.id !== 'actor'
                  ? unit
                  : {
                      ...unit,
                      temporaryResources: unit.temporaryResources.map((resource) =>
                        resource.key === PV1F_ACTION_ECONOMY_RESOURCE_KEY
                          ? { ...resource, current: ap - 1 }
                          : resource,
                      ),
                    },
              ),
            },
          },
        }
        const before = JSON.stringify(unaffordable)
        expect(() => executePv1fMatureSkill(unaffordable, skill, selection, context)).toThrow(
          /Action Economy/,
        )
        expect(JSON.stringify(unaffordable)).toBe(before)
        if (contract.cost[1] > 0) {
          const insufficientMp = {
            ...state,
            tactical: {
              ...state.tactical,
              battle: {
                ...state.tactical.battle,
                combatants: state.tactical.battle.combatants.map((unit) =>
                  unit.id === 'actor' ? { ...unit, mp: contract.cost[1] - 1 } : unit,
                ),
              },
            },
          }
          expect(
            evaluatePv1fMatureSkill(insufficientMp, skill, selection, context).evaluation.issues,
          ).toContainEqual(expect.objectContaining({ code: 'insufficient-mp' }))
          const saved = JSON.stringify(insufficientMp)
          expect(() => executePv1fMatureSkill(insufficientMp, skill, selection, context)).toThrow()
          expect(JSON.stringify(insufficientMp)).toBe(saved)
        }
        for (const requirement of skill.requirements) {
          let unmet = state
          if (requirement.kind === 'actor-status-absent') {
            unmet = withStatus(state, 'actor', requirement.statusId)
          } else if (requirement.kind === 'actor-hp-at-most') {
            unmet = {
              ...state,
              tactical: {
                ...state.tactical,
                battle: {
                  ...state.tactical.battle,
                  combatants: state.tactical.battle.combatants.map((unit) =>
                    unit.id === 'actor' ? { ...unit, hp: unit.maxHp } : unit,
                  ),
                },
              },
            }
          } else {
            const owner = requirement.kind.startsWith('actor-') ? 'actor' : 'enemy'
            unmet = {
              ...state,
              statusState: state.statusState.map((row) =>
                row.combatantId === owner ? { ...row, statuses: [] } : row,
              ),
            }
          }
          const before = JSON.stringify(unmet)
          expect(
            evaluatePv1fMatureSkill(unmet, skill, selection, context).evaluation.issues,
          ).toContainEqual(expect.objectContaining({ code: 'requirement-not-met' }))
          expect(() => executePv1fMatureSkill(unmet, skill, selection, context)).toThrow()
          expect(JSON.stringify(unmet)).toBe(before)
        }
      },
    )
  }
})

describe('Phase 4 cross-library Resonance conversions', () => {
  for (const combatContext of ['pve', 'pvp'] as const) {
    it.each(P35_REPRESENTATIVE_RESONANCES)(
      `${combatContext}: $id can arm and consume a legal cross-library payoff`,
      (resonance) => {
        const find = (matcher: typeof resonance.trigger.setup) =>
          latestEnabledMatureSkills().find(
            (skill) =>
              skill.enabled &&
              skill.sourceDisciplineId === matcher.sourceDisciplineId &&
              skill.requirements.length === 0 &&
              skill.target.kind !== 'ground-tile' &&
              matcher.requiredTags.every((tag) =>
                skill.tags.some((candidate) => candidate === tag),
              ),
          )!
        const setup = find(resonance.trigger.setup)
        const payoff = find(resonance.trigger.payoff)
        expect(setup).toBeDefined()
        expect(payoff).toBeDefined()
        const selection =
          setup.target.kind === 'self'
            ? { kind: 'self' as const }
            : {
                kind: 'unit' as const,
                combatantId:
                  setup.target.teamPolicy === 'ally'
                    ? 'ally'
                    : setup.target.minimumRange > 1
                      ? 'other'
                      : 'enemy',
              }
        const armed = executePv1fMatureSkillWithResonance({
          state: encounter(),
          resonance,
          resonanceState: createResonanceCombatState(resonance),
          skill: setup,
          combatContext,
          selection,
        })
        expect(armed.resonanceState.armedByActionId).toBe(setup.id)
        let state = armed.state
        for (let i = 0; i < 4; i++) state = finishPv1fTurn(state, 'west').state
        if (payoff.target.minimumRange > 1)
          state = executePv1fMovement(state, [
            { x: 1, y: 1 },
            { x: 0, y: 1 },
          ]).state
        const result = executePv1fMatureSkillWithResonance({
          state,
          resonance,
          resonanceState: JSON.parse(JSON.stringify(armed.resonanceState)),
          skill: payoff,
          combatContext,
          selection: target,
        })
        expect(result.resonanceState.armedByActionId).toBeNull()
        expect(result.events).toContainEqual(
          expect.objectContaining({ event: 'resonance_activated', resonanceId: resonance.id }),
        )
      },
    )
  }
})

describe('Phase 4 defense and terminal-state regression coverage', () => {
  it('uses each recipient’s correct armor or ward without borrowing the selected target’s defense', () => {
    const base = encounter()
    const state = {
      ...base,
      statBridge: {
        ...base.statBridge,
        combatants: base.statBridge.combatants.map((unit) => ({
          ...unit,
          armor: unit.combatantId === 'enemy' ? 100 : 0,
          ward: unit.combatantId === 'other' ? 100 : 0,
        })),
      },
    }
    const physical = ADVANCED_DISCIPLINE_SKILLS.find((skill) => skill.id === 'bastion.shield-line')!
    const mystic = ADVANCED_DISCIPLINE_SKILLS.find(
      (skill) => skill.id === 'cinderweaver.flame-burst',
    )!
    expect(
      evaluatePv1fMatureSkill(state, physical, {
        kind: 'unit',
        combatantId: 'other',
      }).evaluation.projectedEffects.map((effect) => effect.after),
    ).toEqual([22, 18])
    expect(
      evaluatePv1fMatureSkill(state, mystic, target).evaluation.projectedEffects.map(
        (effect) => effect.after,
      ),
    ).toEqual([17, 21])
  })
  it('a lethal periodic tick ends the battle with the surviving team and no dead current actor', () => {
    let state = withStatus(encounter(), 'actor', 'burn', 'enemy')
    state = {
      ...state,
      tactical: {
        ...state.tactical,
        battle: {
          ...state.tactical.battle,
          combatants: state.tactical.battle.combatants.map((unit) =>
            unit.id === 'actor'
              ? { ...unit, hp: 3 }
              : unit.id === 'ally'
                ? { ...unit, hp: 0 }
                : unit,
          ),
        },
      },
    }
    const result = finishPv1fTurn(state, 'east')
    expect(result.state.tactical.battle.lifecycle).toBe('completed')
    expect(result.state.tactical.battle.currentTurn).toBeNull()
    expect(result.events).toContainEqual({ event: 'battle_completed', winningTeamId: 'enemies' })
  })
  it('Burn expires after exactly two affected turn ends and stays deterministic across reload', () => {
    let state = withStatus(encounter(), 'actor', 'burn', 'enemy')
    state = finishPv1fTurn(state, 'east').state
    expect(state.tactical.battle.combatants[0]?.hp).toBe(21)
    for (let i = 0; i < 3; i++) state = finishPv1fTurn(state, 'west').state
    state = finishPv1fTurn(JSON.parse(JSON.stringify(state)), 'east').state
    expect(state.tactical.battle.combatants[0]?.hp).toBe(17)
    expect(state.statusState.find((row) => row.combatantId === 'actor')?.statuses).toHaveLength(0)
  })
})

it('forecasts resource restoration after paying the same authored MP cost as the commit', () => {
  const essence = ADVANCED_DISCIPLINE_ESSENCES.find(
    (definition) => definition.sourceDisciplineId === 'runeblade',
  )!.skill
  const state = encounter()
  const preview = evaluatePv1fMatureSkill(state, essence, target)
  const projection = preview.evaluation.projectedEffects.find(
    (effect) => effect.effectType === 'resource-change',
  )!
  expect(preview.evaluation.mpCost).toBe(4)
  expect(projection.before).toBe(6)
  expect(projection.after).toBe(12)
  expect(
    executePv1fMatureSkill(state, essence, target).state.tactical.battle.combatants[0]?.mp,
  ).toBe(12)
})

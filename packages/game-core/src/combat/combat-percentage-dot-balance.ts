import { buildPhase4BalanceHarness } from './phase4-balance-harness'
import {
  createCombatEncounterState,
  type CombatTargetSelection,
  type CombatResolutionEvent,
} from './actions'
import { createPendingBattle, startBattle } from './battle-state'
import { createTacticalBattleState } from './board'
import { defaultCombatEffectTimingPolicy } from './combat-effect-timing'
import { calculateDerivedStats } from '../character/derived-stats'
import type { CharacterAttributes } from '../character/creation'
import {
  validateAttributeAllocation,
  foundationDisciplineAttributePolicy,
} from '../character/attribute-allocation'
import {
  createCharacterDerivedCombatProfile,
  createDuelBalancedCombatEncounterState,
  type StatDrivenCombatEncounterState,
} from './stat-driven-combat'
import {
  latestEnabledMatureSkills,
  resolveMatureSkillVersion,
  type MatureSkillDefinition,
} from './mature-skills'
import { resolveEssenceForBuild, executePv1fEssenceSkill } from './essence'
import {
  calculatePv1fBasicAttackDamage,
  createPv1fTemporaryResources,
  evaluatePv1fAction,
  evaluatePv1fMatureSkill,
  executePv1fAction,
  executePv1fMatureSkill,
  finishPv1fTurn,
  readPv1fActionEconomy,
  PV1F_BASIC_ATTACK_ID,
} from './pv1f-action-economy'

const disciplines = ['ravager', 'edgedancer', 'wildwarden', 'cinderweaver'] as const
const dotSkillIds = [
  'ravager.gash',
  'edgedancer.severing-cut',
  'wildwarden.venom-shot',
  'cinderweaver.cinder-bolt',
  'cinderweaver.flame-burst',
  'cinderweaver.ember-line',
  'cinderweaver.blistering-heat',
  'essence.ravager.red-tempest',
  'essence.cinderweaver.phoenix-wake',
] as const

function encounter(
  discipline: string,
  attributes: CharacterAttributes,
  seed: number,
  area = false,
  lowHp = false,
  distance = 1,
): StatDrivenCombatEncounterState {
  const stats = calculateDerivedStats({ attributes, level: 100 })
  const ids = area ? ['a', 'b', 'c'] : ['a', 'b']
  const battle = startBattle(
    createPendingBattle({
      battleId: 'percentage-dot-balance',
      rulesVersion: 1,
      contentVersion: 1,
      rngSeed: seed,
      combatants: ids.map((id, index) => ({
        id,
        teamId: id === 'a' ? 'a' : 'b',
        initiative: stats.stats.initiative.value + ids.length - index,
        baseMovementBudget: stats.stats.movement.value,
        hp: lowHp && id !== 'a' ? 3 : stats.stats.maxHp.value,
        maxHp: stats.stats.maxHp.value,
        mp: stats.stats.maxMp.value,
        maxMp: stats.stats.maxMp.value,
        temporaryResources: createPv1fTemporaryResources(
          calculatePv1fBasicAttackDamage({ physicalPower: stats.stats.physicalPower.value }),
        ),
      })),
    }),
  ).state
  const base = createCombatEncounterState(
    createTacticalBattleState({
      battle,
      width: 8,
      height: 3,
      terrains: [{ id: 'ground', traversalCost: 1 }],
      tiles: Array.from({ length: 24 }, (_, i) => ({
        position: { x: i % 8, y: Math.floor(i / 8) },
        terrainId: 'ground',
        elevation: 0,
      })),
      movementProfiles: [
        { id: 'ground', maxElevationStep: stats.stats.jump.value, terrainCostOverrides: [] },
      ],
      placements: ids.map((combatantId, index) => ({
        combatantId,
        position: { x: index === 0 ? 1 : index + distance, y: 1 },
        facing: index === 0 ? 'east' : 'west',
        movementProfileId: 'ground',
      })),
    }),
  )
  return createDuelBalancedCombatEncounterState(
    {
      ...base,
      percentageDotPolicyVersion: 1,
      dotTriggerPolicyVersion: 2,
      groundEffectPolicyVersion: 1,
      effectStackingPolicyVersion: 1,
      effectTimingPolicy: defaultCombatEffectTimingPolicy(),
    },
    ids.map((id) => createCharacterDerivedCombatProfile(id, `${discipline}:${id}`, 100, stats)),
  )
}

function skillSelection(
  state: StatDrivenCombatEncounterState,
  skill: MatureSkillDefinition,
  opponent: string,
): CombatTargetSelection {
  if (skill.target.geometryVersion === 2) {
    if (skill.target.shape.kind === 'circle' || skill.target.shape.kind === 'all')
      return { kind: 'activate' }
    if (skill.target.shape.kind === 'line') {
      const from = state.tactical.placements.find(
        (row) => row.combatantId === state.tactical.battle.currentTurn!.combatantId,
      )!.position
      const to = state.tactical.placements.find((row) => row.combatantId === opponent)!.position
      return {
        kind: 'direction',
        direction:
          to.x > from.x ? 'east' : to.x < from.x ? 'west' : to.y > from.y ? 'south' : 'north',
      }
    }
  }
  if (skill.target.kind === 'self') return { kind: 'self' }
  if (skill.target.kind === 'ground-tile' || skill.target.kind === 'empty-tile')
    return {
      kind: 'tile',
      position: state.tactical.placements.find((row) => row.combatantId === opponent)!.position,
    }
  return { kind: 'unit', combatantId: opponent }
}

function mirrorRounds(
  discipline: string,
  attributes: CharacterAttributes,
  skills: readonly MatureSkillDefinition[],
  seed: number,
): number {
  let state = encounter(discipline, attributes, seed)
  for (let turn = 0; turn < 200; turn++) {
    const actor = state.tactical.battle.currentTurn?.combatantId
    if (!actor) return state.tactical.battle.round
    const selection = { kind: 'unit' as const, combatantId: actor === 'a' ? 'b' : 'a' }
    for (const skill of skills) {
      const skillTarget = skillSelection(state, skill, selection.combatantId)
      const preview = evaluatePv1fMatureSkill(state, skill, skillTarget)
      if (
        !preview.evaluation.legal ||
        !preview.prepared ||
        preview.cost > (readPv1fActionEconomy(preview.prepared, actor)?.current ?? 0)
      )
        continue
      state = executePv1fMatureSkill(state, skill, skillTarget).state
      if (state.tactical.battle.lifecycle !== 'active') return state.tactical.battle.round
    }
    while (evaluatePv1fAction(state, PV1F_BASIC_ATTACK_ID, selection).evaluation.legal) {
      state = executePv1fAction(state, PV1F_BASIC_ATTACK_ID, selection).state
      if (state.tactical.battle.lifecycle !== 'active') return state.tactical.battle.round
    }
    state = finishPv1fTurn(state, actor === 'a' ? 'east' : 'west').state
  }
  throw new Error('Percentage DoT mirror exceeded one hundred rounds.')
}

function measureSkill(
  skill: MatureSkillDefinition,
  attributes: CharacterAttributes,
  lowHp: boolean,
) {
  let directHp = 0
  let tickHp = 0
  let hits = 0
  let resisted = 0
  const area = skill.target.shape.kind !== 'single'
  const seeds = 20
  for (let i = 0; i < seeds; i++) {
    let state = encounter(
      skill.sourceDisciplineId,
      attributes,
      901001 + i * 7919,
      area,
      lowHp,
      Math.max(1, skill.target.minimumRange),
    )
    if (area && skill.target.geometryVersion === 2 && skill.target.shape.kind === 'circle') {
      state = {
        ...state,
        tactical: {
          ...state.tactical,
          placements: state.tactical.placements.map((row) =>
            row.combatantId === 'c' ? { ...row, position: { x: 2, y: 2 } } : row,
          ),
        },
      }
    }
    const selection = skillSelection(state, skill, 'b')
    const essence = skill.id.startsWith('essence.')
      ? resolveEssenceForBuild(skill.sourceDisciplineId, null)!
      : null
    const cast = essence
      ? executePv1fEssenceSkill({
          state,
          essence,
          primaryDisciplineId: skill.sourceDisciplineId,
          secondaryDisciplineId: null,
          combatContext: 'pve',
          selection,
        })
      : executePv1fMatureSkill(state, skill, selection)
    const castEvents = cast.events as readonly CombatResolutionEvent[]
    const receipts = castEvents.filter(
      (event) =>
        event.event === 'damage_applied' &&
        event.sourceCombatantId === 'a' &&
        event.actionId === skill.id,
    )
    directHp += receipts.reduce(
      (sum, event) => sum + (event.event === 'damage_applied' ? event.amount : 0),
      0,
    )
    hits += receipts.length
    resisted += castEvents.filter(
      (event) => event.event === 'combat_status_resistance_resolved' && event.resisted,
    ).length
    state = cast.state
    for (let turn = 0; turn < 20 && state.tactical.battle.lifecycle === 'active'; turn++) {
      const actor = state.tactical.battle.currentTurn!.combatantId
      const ended = finishPv1fTurn(state, actor === 'a' ? 'east' : 'west')
      tickHp += (ended.events as readonly CombatResolutionEvent[]).reduce(
        (sum, event) =>
          sum +
          (event.event === 'damage_applied' &&
          event.sourceActionId === skill.id &&
          event.sourceCombatantId === 'a'
            ? event.amount
            : 0),
        0,
      )
      state = ended.state
      if (!(
        state.pendingEffects?.length ||
        state.effectState?.burn.length ||
        state.effectState?.bleed.length ||
        state.effectState?.poison.length
      ))
        break
    }
  }
  return {
    seeds,
    targets: area ? 2 : 1,
    directHp: directHp / seeds,
    tickHp: tickHp / seeds,
    successfulDamageReceipts: hits,
    resistedRecipients: resisted,
  }
}

export function buildPercentageDotBalanceReport(seedCount = 30) {
  if (!Number.isSafeInteger(seedCount) || seedCount < 1 || seedCount > 100)
    throw new RangeError('Balance seed count must be from one to one hundred.')
  const reference = buildPhase4BalanceHarness()
  const attributesByDiscipline = new Map(
    disciplines.map((discipline) => {
      const attributes = reference.disciplines
        .find((row) => row.disciplineId === discipline)!
        .scenarios.find((row) => row.level === 100 && row.allocation === 'offensive')!.attributes
      if (
        validateAttributeAllocation({
          attributes,
          level: 100,
          policy: foundationDisciplineAttributePolicy(discipline),
          requireFullPool: true,
        }).length
      )
        throw new Error('Balance allocation must be a legal full-pool build.')
      return [discipline, attributes] as const
    }),
  )
  const builds = disciplines.map((discipline) => {
    const available = latestEnabledMatureSkills().filter(
      (skill) => skill.sourceDisciplineId === discipline,
    )
    const preferred = dotSkillIds.filter((id) => id.startsWith(`${discipline}.`))
    const candidates = [
      ...preferred.map((id) => resolveMatureSkillVersion(id)!),
      ...available.filter(
        (skill) =>
          skill.requirements.length === 0 &&
          skill.effects.some((effect) => effect.type === 'damage') &&
          !preferred.includes(skill.id as (typeof preferred)[number]),
      ),
      ...available,
    ]
    const skills = [...new Map(candidates.map((skill) => [skill.id, skill])).values()].slice(0, 4)
    if (skills.length !== 4) throw new Error('Balance needs four selected Skills.')
    const attributes = attributesByDiscipline.get(discipline)!
    const rounds = Array.from({ length: seedCount }, (_, i) =>
      mirrorRounds(discipline, attributes, skills, 801001 + i * 7919),
    )
    return {
      discipline,
      attributes,
      skills: skills.map((skill) => skill.id),
      rounds,
      meanRounds: rounds.reduce((sum, round) => sum + round, 0) / seedCount,
      minimumRounds: Math.min(...rounds),
      maximumRounds: Math.max(...rounds),
    }
  })
  const skills = dotSkillIds.map((id) => {
    const skill = id.startsWith('essence.')
      ? resolveEssenceForBuild(id.split('.')[1]!, null)!.skill
      : resolveMatureSkillVersion(id)!
    const attributes = attributesByDiscipline.get(
      skill.sourceDisciplineId as (typeof disciplines)[number],
    )!
    const highHp = measureSkill(skill, attributes, false)
    const lowHp = measureSkill(skill, attributes, true)
    return {
      id,
      version: skill.contentVersion,
      apCost: skill.apCost,
      cooldownOwnerTurns: skill.cooldown?.ownerTurns ?? null,
      highHp,
      lowHp,
      totalHpPer100Ap: ((highHp.directHp + highHp.tickHp) * 100) / skill.apCost,
    }
  })
  return {
    builds,
    skills,
    assumptions:
      'Legal Level100 offensive full-pool allocations; four current Skills; same-build mirrors with Basic Attack fallback; seeded accuracy, crit, resistance, AP and cooldowns. Skill rows include all scheduled ticks against one or two recipients; no movement bonus, healing, reactive buffs or human playtest.',
  }
}

import { describe, expect, it } from 'vitest'
import { executePv1fMatureSkillWithResonance } from './pv1f-resonance'
import { createResonanceCombatState } from './resonance'
import { createCombatEncounterState } from './actions'
import { createPendingBattle, startBattle } from './battle-state'
import { createTacticalBattleState } from './board'
import {
  P33_REPRESENTATIVE_DISCIPLINE_SKILLS,
  latestEnabledMatureSkills,
  validateMatureSkillDefinition,
} from './mature-skills'
import {
  P36_REPRESENTATIVE_ESSENCES,
  validateEssenceDefinition,
} from './essence'
import {
  P35_REPRESENTATIVE_RESONANCES,
  validateResonanceDefinition,
} from './resonance'
import { IRONFIST_SKILLS, IRONFIST_ESSENCE } from './ironfist-content'
import {
  createPv1fTemporaryResources,
  finishPv1fTurn,
  executePv1fMatureSkill,
  evaluatePv1fMatureSkill,
  readPv1fActionEconomy,
} from './pv1f-action-economy'
import {
  createStatDrivenCombatEncounterState,
  type StatDrivenCombatEncounterState,
  type StatDrivenCombatProfile,
} from './stat-driven-combat'
function profile(combatantId: string): StatDrivenCombatProfile {
  return {
    combatantId,
    provenance: {
      kind: combatantId === 'player' ? 'character-derived' : 'scenario',
      sourceId: combatantId === 'player' ? 'character:p35-player' : 'scenario:p35-recruit',
      sourceRulesVersion: 1,
    },
    accuracy: 10_000,
    evasion: 0,
    armor: 0,
    ward: 0,
    jump: 1,
  }
}

function encounter(): StatDrivenCombatEncounterState {
  const playerProfile = profile('player')
  const recruitProfile = profile('recruit')
  const battle = startBattle(
    createPendingBattle({
      battleId: 'battle:p3.5-pv1f-resonance',
      rulesVersion: 1,
      contentVersion: 1,
      rngSeed: 54321,
      combatants: [
        {
          id: 'player',
          teamId: 'players',
          initiative: 20,
          baseMovementBudget: 4,
          hp: 20,
          maxHp: 50,
          mp: 20,
          maxMp: 20,
          temporaryResources: createPv1fTemporaryResources(16),
        },
        {
          id: 'recruit',
          teamId: 'opponents',
          initiative: 10,
          baseMovementBudget: 4,
          hp: 50,
          maxHp: 50,
          mp: 20,
          maxMp: 20,
          temporaryResources: createPv1fTemporaryResources(16),
        },
      ],
    }),
  ).state
  const tactical = createTacticalBattleState({
    battle,
    width: 2,
    height: 1,
    terrains: [{ id: 'open-ground', traversalCost: 1 }],
    tiles: [
      { position: { x: 0, y: 0 }, elevation: 0, terrainId: 'open-ground' },
      { position: { x: 1, y: 0 }, elevation: 0, terrainId: 'open-ground' },
    ],
    movementProfiles: [
      { id: 'player-ground', maxElevationStep: 1, terrainCostOverrides: [] },
      { id: 'recruit-ground', maxElevationStep: 1, terrainCostOverrides: [] },
    ],
    placements: [
      {
        combatantId: 'player',
        position: { x: 0, y: 0 },
        facing: 'east',
        movementProfileId: 'player-ground',
      },
      {
        combatantId: 'recruit',
        position: { x: 1, y: 0 },
        facing: 'west',
        movementProfileId: 'recruit-ground',
      },
    ],
  })

  return createStatDrivenCombatEncounterState(createCombatEncounterState(tactical), [
    playerProfile,
    recruitProfile,
  ])
}

function nextPlayerTurn(state: StatDrivenCombatEncounterState): StatDrivenCombatEncounterState {
  const recruitTurn = finishPv1fTurn(state, 'east').state
  return finishPv1fTurn(recruitTurn, 'west').state
}

const roster = [
  'aetherist',
  'farstrider',
  'ironfist',
  'lifebinder',
  'shadehand',
  'vanguard',
  'bastion',
  'ravager',
  'edgedancer',
  'wildwarden',
  'runeblade',
  'dawnshield',
  'cinderweaver',
  'frostweaver',
  'stormsinger',
  'tidecaller',
  'chronist',
]
const skills = latestEnabledMatureSkills(P33_REPRESENTATIVE_DISCIPLINE_SKILLS).filter(
  (skill) => skill.enabled,
)
const phase4Essences = P36_REPRESENTATIVE_ESSENCES.filter(
  (definition, index, definitions) =>
    definition.enabled &&
    !definitions.some(
      (candidate, candidateIndex) =>
        candidateIndex !== index &&
        candidate.essenceId === definition.essenceId &&
        candidate.contentVersion > definition.contentVersion,
    ),
)
const phase4Skill = (id: string) => skills.find((skill) => skill.id === id)!
const phase4Essence = (disciplineId: string) =>
  phase4Essences.find((definition) => definition.sourceDisciplineId === disciplineId) ?? null
const phase4Resonance = (first: string, second: string) => {
  const pair = [first, second].sort()
  return (
    P35_REPRESENTATIVE_RESONANCES.find(
      (definition) =>
        definition.disciplinePair[0] === pair[0] && definition.disciplinePair[1] === pair[1],
    ) ?? null
  )
}

describe('Phase 4 seventeen-Discipline acceptance matrix', () => {
  it.each(roster)('%s has eight valid Skills and an exclusive pure Essence', (discipline) => {
    const library = skills.filter((skill) => skill.sourceDisciplineId === discipline)
    expect(library).toHaveLength(8)
    for (const skill of library) {
      expect(validateMatureSkillDefinition(skill)).toEqual([])
      expect(skill.ai.enabled).toBe(true)
      expect(skill.media.iconKey).toBeTruthy()
      expect(skill.media.audioCueKey).toBeTruthy()
      expect(skill.media.vfxKey).toBeTruthy()
    }
    const essence = phase4Essence(discipline)
    expect(essence).not.toBeNull()
    expect(validateEssenceDefinition(essence!)).toEqual([])
    for (const secondary of roster.filter((id) => id !== discipline)) {
      expect(secondary).not.toBe(discipline)
    }
  })

  it('has one current Essence per Discipline and one unordered Resonance per pair', () => {
    expect(
      new Set(P36_REPRESENTATIVE_ESSENCES.map((definition) => definition.essenceId)).size,
    ).toBe(17)
    expect(
      new Set(P36_REPRESENTATIVE_ESSENCES.map((definition) => definition.sourceDisciplineId)),
    ).toEqual(new Set(roster))
    expect(roster.map((discipline) => phase4Essence(discipline))).toHaveLength(17)
    expect(roster.map((discipline) => phase4Essence(discipline)?.sourceDisciplineId)).toEqual(
      roster,
    )
    expect(P35_REPRESENTATIVE_RESONANCES).toHaveLength(136)
    for (const resonance of P35_REPRESENTATIVE_RESONANCES) {
      expect(validateResonanceDefinition(resonance)).toEqual([])
      const [left, right] = resonance.disciplinePair
      expect(phase4Resonance(left, right)).toBe(resonance)
      expect(phase4Resonance(right, left)).toBe(resonance)
      for (const matcher of [resonance.trigger.setup, resonance.trigger.payoff]) {
        expect(
          skills.some(
            (skill) =>
              skill.sourceDisciplineId === matcher.sourceDisciplineId &&
              matcher.requiredTags.every((tag) =>
                skill.tags.some((candidate) => candidate === tag),
              ),
          ),
        ).toBe(true)
      }
    }
  })

  for (const context of ['pve', 'pvp'] as const) {
    it.each([...IRONFIST_SKILLS, IRONFIST_ESSENCE.skill])(
      `${context}: $id executes with server AP and requirements`,
      (skill) => {
        let state = encounter()
        for (const requirement of skill.requirements) {
          if (requirement.kind === 'actor-status-present') {
            state = executePv1fMatureSkill(
              state,
              phase4Skill('ironfist.breakfall'),
              { kind: 'self' },
              context,
            ).state
          }
          if (requirement.kind === 'target-status-present') {
            state = executePv1fMatureSkill(
              state,
              phase4Skill('ironfist.rising-fist'),
              { kind: 'unit', combatantId: 'recruit' },
              context,
            ).state
          }
        }
        const selection =
          skill.target.kind === 'self'
            ? { kind: 'self' as const }
            : { kind: 'unit' as const, combatantId: 'recruit' }
        const evaluated = evaluatePv1fMatureSkill(state, skill, selection, context)
        expect(evaluated.evaluation.legal).toBe(true)
        const before = readPv1fActionEconomy(evaluated.prepared, 'player')!.current
        const result = executePv1fMatureSkill(state, skill, selection, context)
        expect(readPv1fActionEconomy(result.state, 'player')!.current).toBe(before - evaluated.cost)
        expect(result.events).not.toContainEqual(
          expect.objectContaining({ event: 'skill_cooldown_started' }),
        )
        const reconnected = JSON.parse(
          JSON.stringify(result.state),
        ) as StatDrivenCombatEncounterState
        const repeat = evaluatePv1fMatureSkill(reconnected, skill, selection, context)
        expect(repeat.repeatPenaltyApplied).toBe(true)
        expect(repeat.cost).toBe(evaluated.cost)
        expect(repeat.action.effects.filter((effect) => effect.type === 'apply-status')).toEqual([])
      },
    )
  }

  it('rejects guarded/exposed payoff Skills before their prerequisites, without mutating the encounter', () => {
    const state = encounter()
    const serialized = JSON.stringify(state)
    for (const id of ['ironfist.counter-palm', 'ironfist.hammer-knuckle']) {
      const skill = phase4Skill(id)
      expect(
        evaluatePv1fMatureSkill(state, skill, { kind: 'unit', combatantId: 'recruit' }).evaluation
          .legal,
      ).toBe(false)
      expect(() =>
        executePv1fMatureSkill(state, skill, { kind: 'unit', combatantId: 'recruit' }),
      ).toThrow()
      expect(JSON.stringify(state)).toBe(serialized)
    }
  })

  it('preserves the repeat chain across turn end and halves quantitative effects', () => {
    const skill = phase4Skill('ironfist.focus-breath')
    const first = executePv1fMatureSkill(encounter(), skill, { kind: 'self' })
    const next = nextPlayerTurn(first.state)
    const repeated = evaluatePv1fMatureSkill(next, skill, { kind: 'self' })
    expect(repeated.repeatPenaltyApplied).toBe(true)
    expect(repeated.action.effects).toEqual([
      { type: 'healing', recipient: 'actor', amount: 3 },
      { type: 'resource-change', recipient: 'actor', resource: 'mp', delta: 2 },
    ])
    const second = executePv1fMatureSkill(next, skill, { kind: 'self' })
    expect(second.events).toContainEqual(
      expect.objectContaining({
        event: 'skill_repeat_penalty_applied',
        effectivenessBasisPoints: 5000,
      }),
    )
  })
})

describe('Ironfist mixed pair execution', () => {
  const pairs = [
    ['aetherist', 'ironfist.rising-fist', 'aetherist.arc-bolt'],
    ['farstrider', 'farstrider.scouts-mark', 'ironfist.rising-fist'],
    ['lifebinder', 'lifebinder.mending-light', 'ironfist.rising-fist'],
    ['shadehand', 'ironfist.rising-fist', 'shadehand.backstab'],
    ['vanguard', 'ironfist.breakfall', 'vanguard.forceful-strike'],
  ] as const
  it.each(pairs)('%s pair arms and consumes its bounded payoff', (other, setupId, payoffId) => {
    const resonance = phase4Resonance('ironfist', other)!
    const setup = phase4Skill(setupId)
    const payoff = phase4Skill(payoffId)
    const armed = executePv1fMatureSkillWithResonance({
      state: encounter(),
      resonance,
      resonanceState: createResonanceCombatState(resonance),
      skill: setup,
      combatContext: 'pve',
      selection:
        setup.target.kind === 'self' ? { kind: 'self' } : { kind: 'unit', combatantId: 'recruit' },
    })
    expect(armed.resonanceState.armedByActionId).toBe(setupId)
    const activated = executePv1fMatureSkillWithResonance({
      state: armed.state,
      resonance,
      resonanceState: armed.resonanceState,
      skill: payoff,
      combatContext: 'pve',
      selection: { kind: 'unit', combatantId: 'recruit' },
    })
    expect(activated.events).toContainEqual(
      expect.objectContaining({ event: 'resonance_activated', resonanceId: resonance.id }),
    )
    expect(activated.resonanceState.armedByActionId).toBeNull()
  })
})

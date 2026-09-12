import { describe, expect, it } from 'vitest'
import {
  createCombatEncounterState,
  createBasicAttackDefinition,
  P2_3_UNARMED_ATTACK_PROFILE,
  validateCombatEncounterState,
  type CombatTargetSelection,
} from './actions'
import { createPendingBattle, startBattle } from './battle-state'
import { createTacticalBattleState } from './board'
import { attachCombatBuildBridge, type CombatBuildSnapshot } from './build-snapshot'
import {
  createPv1fTemporaryResources,
  PV1F_COMBAT_CONTENT,
  evaluatePv1fMatureSkill,
  executePv1fMatureSkill,
  finishPv1fTurn,
  evaluatePv1fMovement,
  readPv1fActionEconomy,
} from './pv1f-action-economy'
import { createPvpQualityResources } from './pvp-quality'
import {
  createStatDrivenCombatEncounterState,
  type StatDrivenCombatEncounterState,
} from './stat-driven-combat'
import {
  latestEnabledMatureSkills,
  resolveMatureSkillVersion,
  type MatureSkillDefinition,
} from './mature-skills'
import {
  P36_REPRESENTATIVE_ESSENCES,
  essenceSnapshotReference,
  resolveEssenceForBuild,
} from './essence'
import { resolveResonanceForPair, resonanceSnapshotReference } from './resonance'
import { hasGameplayTag } from './gameplay-tags'
import { validateDamageModifiers } from './damage-modifiers'
import {
  chooseBuildAwareRecruitAiDecision,
  committedMatureSkills,
  executeBuildAwareRecruitAiAction,
} from './recruit-ai-build'

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
        hp: 100,
        maxHp: 120,
        mp: 20,
        maxMp: 20,
        temporaryResources: [
          ...createPv1fTemporaryResources(10),
          ...createPvpQualityResources(),
        ].sort((a, b) => a.key.localeCompare(b.key)),
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
const enemy = { kind: 'unit', combatantId: 'enemy' } as const
const skill = (id: string, version?: number) => resolveMatureSkillVersion(id, version)!
const reload = (state: StatDrivenCombatEncounterState): StatDrivenCombatEncounterState =>
  JSON.parse(JSON.stringify(state))
function build(
  state: StatDrivenCombatEncounterState,
  ids: readonly string[],
  version?: number,
): StatDrivenCombatEncounterState {
  const definitions = ids.map((id) => skill(id, version))
  const sources = [...new Set(definitions.map((definition) => definition.sourceDisciplineId))]
  if (sources.length > 2) throw new Error('A build has at most two Disciplines')
  const primary = sources[0]!
  const secondary = sources[1] ?? null
  const essence = resolveEssenceForBuild(primary, secondary)
  const resonance = resolveResonanceForPair(primary, secondary)
  const snapshot: CombatBuildSnapshot = {
    schemaVersion: 1,
    sourceBuildSchemaVersion: 3,
    sourceBuildVersion: 1,
    fingerprint: `sha256:${'a'.repeat(64)}`,
    primary: { disciplineId: primary, definitionVersion: 1, profileVersion: 1 },
    secondary: secondary ? { disciplineId: secondary, definitionVersion: 1 } : null,
    disciplineSkills: definitions.map((definition, i) => ({
      slotIndex: i + 1,
      skillId: definition.id,
      contentVersion: definition.contentVersion,
      sourceDisciplineId: definition.sourceDisciplineId,
    })),
    extensions: {
      essence: essence ? essenceSnapshotReference(essence) : null,
      resonance: resonance ? resonanceSnapshotReference(resonance) : null,
      equipmentSkills: [],
      supernatural: null,
      prestige: null,
    },
  }
  return attachCombatBuildBridge(state, [
    { combatantId: 'actor', characterId: '00000000-0000-4000-8000-000000004202', snapshot },
  ])
}
function cast(
  state: StatDrivenCombatEncounterState,
  definition: MatureSkillDefinition,
  selection: CombatTargetSelection = enemy,
  context: 'pve' | 'pvp' = 'pve',
) {
  const before = JSON.stringify(state)
  const preview = evaluatePv1fMatureSkill(state, definition, selection, context)
  expect(preview.evaluation.legal, JSON.stringify(preview.evaluation.issues)).toBe(true)
  const result = executePv1fMatureSkill(reload(state), definition, selection, context)
  expect(JSON.stringify(state)).toBe(before)
  for (const event of preview.evaluation.projectedEvents)
    expect(result.events).toContainEqual(event)
  expect(readPv1fActionEconomy(result.state, 'actor')!.current).toBe(
    readPv1fActionEconomy(preview.prepared, 'actor')!.current - preview.cost,
  )
  validateCombatEncounterState(reload(result.state))
  return result
}
function next(state: StatDrivenCombatEncounterState) {
  for (let i = 0; i < 4; i++) state = finishPv1fTurn(state, 'west').state
  return state
}
function hp(state: StatDrivenCombatEncounterState, id = 'enemy') {
  return state.tactical.battle.combatants.find((unit) => unit.id === id)!.hp
}
function tag(
  state: StatDrivenCombatEncounterState,
  id: string,
  name: Parameters<typeof hasGameplayTag>[2],
) {
  return hasGameplayTag(state, id, name, PV1F_COMBAT_CONTENT)
}

describe('Versioned Phase 4 published interactions', () => {
  const changed = latestEnabledMatureSkills().filter(
    (definition) => definition.contentVersion === 2 && !definition.id.startsWith('vanguard.'),
  )
  it('selects 136 unique current Skills while retaining every changed v1', () => {
    expect(latestEnabledMatureSkills()).toHaveLength(136)
    expect(changed).toHaveLength(20)
    for (const definition of changed) {
      expect(skill(definition.id, 1).contentVersion).toBe(1)
      expect(skill(definition.id)).toBe(definition)
      expect(latestEnabledMatureSkills([definition, skill(definition.id, 1)])).toEqual([definition])
    }
  })
  for (const context of ['pve', 'pvp'] as const) {
    it(`${context}: real water and storm Skills produce Wet, consume Conductive, and preserve explicit old versions`, () => {
      let state = build(encounter(), [
        'tidecaller.water-lance',
        'stormsinger.arc-spark',
        'stormsinger.static-drain',
        'stormsinger.conductive-bolt',
      ])
      state = cast(state, skill('tidecaller.water-lance'), enemy, context).state
      expect(tag(state, 'enemy', 'Wet')).toBe(true)
      const before = hp(state)
      state = cast(state, skill('stormsinger.arc-spark'), enemy, context).state
      expect(before - hp(state)).toBe(12)
      state = next(state)
      state = cast(state, skill('stormsinger.static-drain'), enemy, context).state
      expect(tag(state, 'enemy', 'Conductive')).toBe(true)
      state = cast(state, skill('stormsinger.conductive-bolt'), enemy, context).state
      expect(tag(state, 'enemy', 'Conductive')).toBe(false)
      const old = build(encounter(), ['tidecaller.water-lance'], 1)
      expect(
        committedMatureSkills(old, 'actor').find(
          (definition) => definition.id === 'tidecaller.water-lance',
        )!.contentVersion,
      ).toBe(1)
      expect(
        tag(cast(old, skill('tidecaller.water-lance', 1), enemy, context).state, 'enemy', 'Wet'),
      ).toBe(false)
    })
    it(`${context}: Frozen ground and fire convert empty tiles without consuming unit Resonance`, () => {
      let state = build(encounter(), [
        'frostweaver.chilling-mist',
        'cinderweaver.flame-burst',
        'cinderweaver.cinder-bolt',
      ])
      const tile = { kind: 'tile', position: { x: 3, y: 2 } } as const
      state = cast(state, skill('frostweaver.chilling-mist'), tile, context).state
      expect(state.terrainOverlays!.every((overlay) => overlay.kind === 'frozen')).toBe(true)
      const result = cast(state, skill('cinderweaver.flame-burst'), tile, context)
      expect(result.state.terrainOverlays!.every((overlay) => overlay.kind === 'steam')).toBe(true)
      expect(result.events).not.toContainEqual(
        expect.objectContaining({ event: 'resonance_activated' }),
      )
    })
    it(`${context}: spirit protection is dispelled and Hexed reduces real support healing`, () => {
      let state = build(encounter(), [
        'runeblade.sigil-brand',
        'runeblade.aether-cut',
        'wildwarden.renewing-herbs',
      ])
      // Support may target the caster; reusing enemy placement lets actual opposing turns author protection.
      state = cast(
        state,
        skill('wildwarden.renewing-herbs'),
        { kind: 'unit', combatantId: 'actor' },
        context,
      ).state
      expect(tag(state, 'actor', 'Summoned')).toBe(true)
      const branded = cast(state, skill('runeblade.sigil-brand'), enemy, context).state
      expect(tag(branded, 'enemy', 'Hexed')).toBe(true)
      // The enemy's legal support action now demonstrates the healing penalty on itself.
      const enemyTurn = finishPv1fTurn(branded, 'west').state
      const healing = executePv1fMatureSkill(
        enemyTurn,
        skill('dawnshield.sacred-guard'),
        enemy,
        context,
      )
      expect(hp(healing.state) - hp(enemyTurn)).toBe(3)
      const dispelled = executePv1fMatureSkill(
        enemyTurn,
        skill('runeblade.aether-cut'),
        { kind: 'unit', combatantId: 'actor' },
        context,
      ).state
      expect(tag(dispelled, 'actor', 'Summoned')).toBe(false)
    })
    it(`${context}: concealment blocks selection and breaks on an authored attack`, () => {
      let state = build(encounter(), ['shadehand.smoke-vial', 'shadehand.backstab'])
      state = cast(state, skill('shadehand.smoke-vial'), { kind: 'self' }, context).state
      expect(tag(state, 'actor', 'Invisible')).toBe(true)
      const enemyTurn = finishPv1fTurn(state, 'west').state
      expect(
        evaluatePv1fMatureSkill(
          enemyTurn,
          skill('tidecaller.water-lance'),
          { kind: 'unit', combatantId: 'actor' },
          context,
        ).evaluation.legal,
      ).toBe(false)
      state = cast(state, skill('shadehand.backstab'), enemy, context).state
      expect(tag(state, 'actor', 'Invisible')).toBe(false)
    })
    it(`${context}: Breakfall crosses Frozen for ordinary AP and Pressure Palm records displacement`, () => {
      let state = build(encounter(), [
        'ironfist.breakfall',
        'ironfist.pressure-palm',
        'frostweaver.chilling-mist',
      ])
      state = cast(
        state,
        skill('frostweaver.chilling-mist'),
        { kind: 'tile', position: { x: 0, y: 1 } },
        context,
      ).state
      const path = [
        { x: 1, y: 1 },
        { x: 0, y: 1 },
      ]
      const cost = evaluatePv1fMovement(state, path).economyCost
      state = cast(state, skill('ironfist.breakfall'), { kind: 'self' }, context).state
      expect(evaluatePv1fMovement(state, path).economyCost).toBe(cost - 10)
      state = next(state)
      // Free the push destination without changing the target or action budget.
      state = {
        ...state,
        tactical: {
          ...state.tactical,
          placements: state.tactical.placements.map((unit) =>
            unit.combatantId === 'other' ? { ...unit, position: { x: 4, y: 3 } } : unit,
          ),
        },
      }
      state = cast(state, skill('ironfist.pressure-palm'), enemy, context).state
      expect(tag(state, 'enemy', 'Displaced')).toBe(true)
      expect(
        state.tactical.placements.find((unit) => unit.combatantId === 'enemy')!.position,
      ).toEqual({ x: 3, y: 1 })
    })
    it(`${context}: Sacred Guard inspires a real guarded Judgment payoff`, () => {
      let state = build(encounter(), ['dawnshield.sacred-guard', 'dawnshield.judgment'])
      state = cast(
        state,
        skill('dawnshield.sacred-guard'),
        { kind: 'unit', combatantId: 'actor' },
        context,
      ).state
      expect(tag(state, 'actor', 'Inspired')).toBe(true)
      const before = hp(state)
      state = cast(state, skill('dawnshield.judgment'), enemy, context).state
      expect(before - hp(state)).toBe(17)
    })
    it.each(P36_REPRESENTATIVE_ESSENCES)(
      `${context}: $essenceId forecasts, executes and reloads its actual pure build`,
      (essence) => {
        const library = latestEnabledMatureSkills()
          .filter((definition) => definition.sourceDisciplineId === essence.sourceDisciplineId)
          .slice(0, 4)
        let state = build(
          encounter(),
          library.map((definition) => definition.id),
        )
        if (essence.skill.target.minimumRange > 1)
          state = {
            ...state,
            tactical: {
              ...state.tactical,
              placements: state.tactical.placements.map((unit) =>
                unit.combatantId === 'enemy' ? { ...unit, position: { x: 1, y: 3 } } : unit,
              ),
            },
          }
        const selection: CombatTargetSelection =
          essence.skill.target.kind === 'self'
            ? { kind: 'self' }
            : essence.skill.target.teamPolicy === 'ally'
              ? { kind: 'unit', combatantId: 'ally' }
              : enemy
        const result = cast(state, essence.skill, selection, context)
        expect(result.events.length).toBeGreaterThan(0)
        expect(
          committedMatureSkills(reload(result.state), 'actor').find(
            (definition) => definition.id === essence.skill.id,
          ),
        ).toEqual(essence.skill)
      },
    )
  }
  it('keeps Skill facing, basic facing and conditional modifier bounds distinct', () => {
    const opening = resolveEssenceForBuild('shadehand', null)!.skill
    const damage = opening.effects[0]!
    if (damage.type !== 'damage') throw new Error('Expected Perfect Opening damage')
    expect(damage.facingModifiersBasisPoints!.rear).toBe(22000)
    expect(() =>
      evaluatePv1fMatureSkill(
        encounter(),
        {
          ...opening,
          effects: [
            { ...damage, facingModifiersBasisPoints: { front: 10000, side: 10000, rear: 22001 } },
          ],
        },
        enemy,
      ),
    ).toThrow()
    expect(() =>
      createBasicAttackDefinition({
        ...P2_3_UNARMED_ATTACK_PROFILE,
        facingModifiersBasisPoints: { front: 10000, side: 10000, rear: 20001 },
      }),
    ).toThrow()
    expect(() =>
      validateDamageModifiers([
        { direction: 'outgoing', multiplierBasisPoints: 20001, condition: { kind: 'always' } },
      ]),
    ).toThrow()
  })
  it('Recruit AI chooses and executes published Frozen ground when enemies are beyond melee reach', () => {
    let state = build(encounter(), ['frostweaver.chilling-mist', 'shadehand.backstab'])
    state = {
      ...state,
      tactical: {
        ...state.tactical,
        placements: state.tactical.placements.map((unit) =>
          unit.combatantId === 'enemy'
            ? { ...unit, position: { x: 4, y: 1 } }
            : unit.combatantId === 'other'
              ? { ...unit, position: { x: 4, y: 2 } }
              : unit,
        ),
      },
    }
    const decision = chooseBuildAwareRecruitAiDecision({ state: reload(state), tieBreakSeed: 7 })
    expect(decision.intent).toMatchObject({
      kind: 'action',
      actionId: 'frostweaver.chilling-mist',
      target: { kind: 'tile' },
    })
    if (decision.intent.kind !== 'action') throw new Error('Expected ground Skill')
    const result = executeBuildAwareRecruitAiAction(
      state,
      decision.intent.actionId,
      decision.intent.target,
    )
    expect(result.state.terrainOverlays!.some((overlay) => overlay.kind === 'frozen')).toBe(true)
  })
  it('Recruit AI executes a published storm payoff when Conductive makes it legal', () => {
    let state = build(encounter(), ['stormsinger.static-drain', 'stormsinger.conductive-bolt'])
    state = cast(state, skill('stormsinger.static-drain')).state
    // Essence is unaffordable after setup; a ready Conductive payoff is the strongest legal command.
    const decision = chooseBuildAwareRecruitAiDecision({ state: reload(state), tieBreakSeed: 7 })
    expect(decision.intent).toEqual({
      kind: 'action',
      actionId: 'stormsinger.conductive-bolt',
      target: enemy,
    })
    if (decision.intent.kind !== 'action') throw new Error('Expected Skill')
    const result = executeBuildAwareRecruitAiAction(
      state,
      decision.intent.actionId,
      decision.intent.target,
    )
    expect(tag(result.state, 'enemy', 'Conductive')).toBe(false)
  })
})

import { describe, expect, it } from 'vitest'

import { createCombatEncounterState, evaluateCombatAction, executeCombatAction } from './actions'
import { createPendingBattle, startBattle } from './battle-state'
import { createTacticalBattleState } from './board'
import {
  P33_REPRESENTATIVE_DISCIPLINE_SKILLS,
  resolveMatureSkillForContext,
  resolveMatureSkillVersion,
  toCombatActionDefinition,
  validateMatureSkillDefinition,
} from './mature-skills'
import {
  advanceSkillCooldownsAtOwnerTurnStart,
  applySkillCooldown,
  readSkillCooldown,
} from './skill-cooldowns'

function encounter() {
  const battle = startBattle(
    createPendingBattle({
      battleId: 'battle:p3.3-mature-skill',
      rulesVersion: 1,
      contentVersion: 1,
      rngSeed: 12345,
      combatants: [
        {
          id: 'player',
          teamId: 'players',
          initiative: 20,
          baseMovementBudget: 4,
          hp: 30,
          maxHp: 50,
          mp: 20,
          maxMp: 20,
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
        },
      ],
    }),
  ).state
  return createCombatEncounterState(
    createTacticalBattleState({
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
    }),
  )
}

describe('P3.3 mature Skill schema', () => {
  it('keeps representative Discipline Skills fully data-defined and valid', () => {
    for (const definition of P33_REPRESENTATIVE_DISCIPLINE_SKILLS) {
      expect(validateMatureSkillDefinition(definition)).toEqual([])
      expect(definition.cooldown.ownerTurns).toBeGreaterThan(0)
      expect(definition.sourceDisciplineId).toMatch(/^[a-z0-9.-]+$/)
    }
  })

  it('fails closed for stale or disabled versions and resolves the latest enabled version', () => {
    expect(resolveMatureSkillVersion('vanguard.forceful-strike', 1)).toBeNull()
    expect(resolveMatureSkillVersion('vanguard.forceful-strike', 999)).toBeNull()
    expect(resolveMatureSkillVersion('vanguard.forceful-strike')?.contentVersion).toBe(2)
  })

  it('uses existing combat target, requirement, and effect authority instead of a parallel engine', () => {
    const definition = resolveMatureSkillVersion('lifebinder.mending-light', 1)
    if (!definition) throw new Error('Expected representative Lifebinder Skill.')
    const action = toCombatActionDefinition(definition, 'pve')
    const state = encounter()
    const evaluation = evaluateCombatAction(state, action, { kind: 'self' }, { statuses: [] })

    expect(evaluation.legal).toBe(true)
    expect(action.sourceType).toBe('discipline-skill')
    const resolved = executeCombatAction(state, action, { kind: 'self' }, { statuses: [] })
    expect(resolved.state.tactical.battle.combatants.find((row) => row.id === 'player')?.hp).toBe(
      46,
    )
    const actor = resolved.state.tactical.battle.combatants.find((row) => row.id === 'player')
    if (!actor) throw new Error('Expected player combatant after Skill use.')
    expect(readSkillCooldown(actor, definition.cooldown)).toMatchObject({
      active: true,
      ownerTurns: 2,
      ticksRemaining: 3,
    })
    const blocked = evaluateCombatAction(resolved.state, action, { kind: 'self' }, { statuses: [] })
    expect(blocked.legal).toBe(false)
    expect(blocked.issues).toContainEqual(expect.objectContaining({ code: 'cooldown-active' }))
  })

  it('applies deterministic PvE/PvP override hooks without mutating the source definition', () => {
    const definition = resolveMatureSkillVersion('vanguard.forceful-strike', 2)
    if (!definition) throw new Error('Expected representative Vanguard Skill.')
    const pve = resolveMatureSkillForContext(definition, 'pve')
    const pvp = resolveMatureSkillForContext(definition, 'pvp')

    expect(pve.apCost).toBe(40)
    expect(pvp.apCost).toBe(45)
    expect(definition.apCost).toBe(40)
  })
})

describe('P3.3 generic owner-turn cooldown clock', () => {
  it('persists through serialization and becomes ready only after the configured locked owner turns', () => {
    const definition = resolveMatureSkillVersion('lifebinder.mending-light', 1)
    if (!definition) throw new Error('Expected representative Lifebinder Skill.')
    const player = encounter().tactical.battle.combatants.find((row) => row.id === 'player')
    if (!player) throw new Error('Expected player combatant.')

    const started = applySkillCooldown(player, definition.cooldown, {
      actionId: definition.id,
      definitionVersion: definition.contentVersion,
    })
    const reconnected = JSON.parse(JSON.stringify(started.combatant)) as typeof started.combatant
    expect(readSkillCooldown(reconnected, definition.cooldown)).toMatchObject({
      active: true,
      ownerTurns: 2,
      ticksRemaining: 3,
    })

    const firstLockedTurn = advanceSkillCooldownsAtOwnerTurnStart(reconnected)
    const secondLockedTurn = advanceSkillCooldownsAtOwnerTurnStart(firstLockedTurn.combatant)
    expect(readSkillCooldown(secondLockedTurn.combatant, definition.cooldown).active).toBe(true)

    const readyTurn = advanceSkillCooldownsAtOwnerTurnStart(secondLockedTurn.combatant)
    expect(readSkillCooldown(readyTurn.combatant, definition.cooldown).active).toBe(false)
    expect(readyTurn.events).toContainEqual(
      expect.objectContaining({
        event: 'skill_cooldown_ready',
        cooldownKey: definition.cooldown.key,
      }),
    )
  })
})

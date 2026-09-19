import { describe, expect, it } from 'vitest'

import { createBattleRngState } from './battle-state'
import {
  commitCombatSkillCopy,
  copiedSkillApCost,
  copiedSkillCommandId,
  eligibleCombatSkillCopies,
  parseCopiedSkillCommandId,
  previewCombatSkillCopy,
} from './combat-skill-copy'
import { validateCombatTemporarySkillState } from './combat-effect-state'
import { resolveMatureSkillVersion, type MatureSkillDefinition } from './mature-skills'
import type { StatDrivenCombatEncounterState } from './stat-driven-combat'

const ACTOR = 'combatant:actor'
const SOURCE = 'combatant:source'

function skill(id: string, version?: number): MatureSkillDefinition {
  const definition = resolveMatureSkillVersion(id, version)
  if (!definition) throw new Error(`Missing Skill fixture ${id}@${String(version)}.`)
  return definition
}

function state(seed = 0x1234_5678): StatDrivenCombatEncounterState {
  return {
    tactical: {
      battle: {
        lifecycle: 'active',
        currentTurn: { combatantId: ACTOR },
        combatants: [
          { id: ACTOR, hp: 100 },
          { id: SOURCE, hp: 100 },
        ],
        rng: createBattleRngState(seed),
      },
    },
    effectState: {
      ongoingRecovery: [],
      poison: [],
      bleed: [],
      burn: [],
      temporarySkills: [],
      damageHistory: [],
    },
  } as unknown as StatDrivenCombatEncounterState
}

describe('random temporary Skill Copy', () => {
  it('builds a stable eligible pool from committed regular Skills without consuming RNG', () => {
    const before = state()
    before.effectState!.temporarySkills.push({
      combatantId: ACTOR,
      skillId: 'vanguard.cleave',
      contentVersion: 1,
      sourceCombatantId: SOURCE,
    })
    const sourceSkills = [
      skill('vanguard.guard-break', 1),
      skill('vanguard.forceful-strike', 2),
      skill('vanguard.cleave', 1),
    ]

    const preview = previewCombatSkillCopy({
      state: before,
      actorCombatantId: ACTOR,
      sourceCombatantId: SOURCE,
      sourceSkills,
      actorCommittedSkills: [skill('vanguard.forceful-strike', 2)],
    })

    expect(preview).toEqual({
      sourceCombatantId: SOURCE,
      random: true,
      eligibleSkills: [{ skillId: 'vanguard.guard-break', contentVersion: 1 }],
      issues: [],
    })
    expect(before.tactical.battle.rng.draws).toBe(0)
  })

  it('selects deterministically, consumes exactly one RNG draw, and persists the pinned grant', () => {
    const sourceSkills = [skill('vanguard.cleave', 1), skill('vanguard.guard-break', 1)]
    const first = commitCombatSkillCopy({
      state: state(),
      actorCombatantId: ACTOR,
      sourceCombatantId: SOURCE,
      sourceSkills,
    })
    const repeated = commitCombatSkillCopy({
      state: state(),
      actorCombatantId: ACTOR,
      sourceCombatantId: SOURCE,
      sourceSkills,
    })

    expect(first.definition.id).toBe(repeated.definition.id)
    expect(first.definition.contentVersion).toBe(repeated.definition.contentVersion)
    expect(first.state.tactical.battle.rng.draws).toBe(1)
    expect(first.event).toEqual({
      event: 'temporary_skill_copied',
      combatantId: ACTOR,
      sourceCombatantId: SOURCE,
      skillId: first.definition.id,
      contentVersion: first.definition.contentVersion,
    })
    expect(first.state.effectState?.temporarySkills).toContainEqual({
      combatantId: ACTOR,
      sourceCombatantId: SOURCE,
      skillId: first.definition.id,
      contentVersion: first.definition.contentVersion,
    })
  })

  it('excludes duplicate pinned identities and rejects an exhausted source pool', () => {
    const before = state()
    before.effectState!.temporarySkills.push({
      combatantId: ACTOR,
      skillId: 'vanguard.cleave',
      contentVersion: 1,
      sourceCombatantId: SOURCE,
    })

    expect(
      eligibleCombatSkillCopies({
        state: before,
        actorCombatantId: ACTOR,
        sourceCombatantId: SOURCE,
        sourceSkills: [skill('vanguard.cleave', 1)],
      }),
    ).toEqual([])
    expect(
      previewCombatSkillCopy({
        state: before,
        actorCombatantId: ACTOR,
        sourceCombatantId: SOURCE,
        sourceSkills: [skill('vanguard.cleave', 1)],
      }).issues,
    ).toContainEqual(expect.objectContaining({ code: 'copy-pool-empty' }))
    expect(() =>
      commitCombatSkillCopy({
        state: before,
        actorCombatantId: ACTOR,
        sourceCombatantId: SOURCE,
        sourceSkills: [skill('vanguard.cleave', 1)],
      }),
    ).toThrow(/no eligible/u)
    expect(before.tactical.battle.rng.draws).toBe(0)
  })

  it('round-trips the pinned copied command identity and rejects malformed presentation IDs', () => {
    const commandId = copiedSkillCommandId('vanguard.forceful-strike', 2)
    expect(commandId).toBe('temporary.copy.vanguard.forceful-strike.v2')
    expect(parseCopiedSkillCommandId(commandId)).toEqual({
      skillId: 'vanguard.forceful-strike',
      contentVersion: 2,
    })
    expect(parseCopiedSkillCommandId('temporary.copy...v2')).toBeNull()
    expect(parseCopiedSkillCommandId('temporary.copy.vanguard.forceful-strike.v0')).toBeNull()
    expect(parseCopiedSkillCommandId('../../vanguard.forceful-strike')).toBeNull()
  })

  it('halves only AP with ceiling semantics', () => {
    const definition = { ...skill('vanguard.forceful-strike', 2), apCost: 25 }
    expect(copiedSkillApCost(definition, 'pve')).toBe(13)
  })

  it('fails closed on malformed or duplicate persisted temporary Skill grants', () => {
    const malformed = state()
    malformed.effectState!.temporarySkills.push(
      {
        combatantId: ACTOR,
        skillId: 'vanguard.cleave',
        contentVersion: 1,
        sourceCombatantId: SOURCE,
      },
      {
        combatantId: ACTOR,
        skillId: 'vanguard.cleave',
        contentVersion: 1,
        sourceCombatantId: SOURCE,
      },
    )

    expect(validateCombatTemporarySkillState(malformed)).toContainEqual(
      expect.objectContaining({
        field: 'effectState.temporarySkills.1',
        message: expect.stringContaining('unique'),
      }),
    )
  })
})

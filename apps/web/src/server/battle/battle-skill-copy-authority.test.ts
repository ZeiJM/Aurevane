import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { copiedSkillCommandId } from '@aurevane/game-core/combat/combat-skill-copy'
import type { StatDrivenCombatEncounterState } from '@aurevane/game-core/combat/stat-driven-combat'

import {
  battleTemporarySkillGrantForCommand,
  resolveBattleSkillCopyContext,
} from './battle-skill-copy-authority'

describe('battle temporary Skill Copy authority', () => {
  it('maps only the holder pinned grant to its synthetic command id', () => {
    const state = {
      effectState: {
        ongoingRecovery: [],
        poison: [],
        bleed: [],
        burn: [],
        damageHistory: [],
        temporarySkills: [
          {
            combatantId: 'actor',
            sourceCombatantId: 'source',
            skillId: 'vanguard.forceful-strike',
            contentVersion: 2,
          },
        ],
      },
    } as unknown as StatDrivenCombatEncounterState

    const commandId = copiedSkillCommandId('vanguard.forceful-strike', 2)
    expect(battleTemporarySkillGrantForCommand(state, 'actor', commandId)).toMatchObject({
      skillId: 'vanguard.forceful-strike',
      contentVersion: 2,
    })
    expect(battleTemporarySkillGrantForCommand(state, 'other', commandId)).toBeNull()
  })

  it('returns an empty legal source pool when the selected combatant has no frozen regular build', async () => {
    const state = {
      buildAuthority: {
        schemaVersion: 1,
        catalogVersion: 2,
        combatContext: 'pve',
        combatants: [],
      },
    } as unknown as StatDrivenCombatEncounterState

    await expect(
      resolveBattleSkillCopyContext(state, 'actor', 'recruit', undefined),
    ).resolves.toEqual({
      sourceCombatantId: 'recruit',
      sourceSkills: [],
      actorCommittedSkills: [],
    })
  })
})

import { describe, expect, it } from 'vitest'

import type { CombatEncounterState, CombatStatusInstance } from './actions'
import { planCombatStatusCopies } from './combat-status-copy'
import {
  createCovertStatusDefinition,
  createRevealedStatusDefinition,
} from './covert-sensory-revealed'

const covert = createCovertStatusDefinition(3)
const revealed = createRevealedStatusDefinition(2)

function status(statusId: 'covert' | 'revealed', sourceCombatantId: string): CombatStatusInstance {
  const definition = statusId === 'covert' ? covert : revealed
  return {
    statusId,
    statusVersion: definition.version,
    stacks: 1,
    remainingOwnerTurnStarts: definition.durationOwnerTurnStarts,
    sourceCombatantId,
  }
}

function state(): CombatEncounterState {
  return {
    statusState: [
      { combatantId: 'actor', statuses: [status('revealed', 'target')] },
      { combatantId: 'target', statuses: [status('covert', 'target')] },
    ],
    effectState: undefined,
  } as unknown as CombatEncounterState
}

describe('CSR-1 status-copy exclusions', () => {
  it('never plans Covert for Amplify or Revealed for Curse', () => {
    const content = { statuses: [covert, revealed] }

    const amplify = planCombatStatusCopies(
      state(),
      'actor',
      'target',
      { type: 'copy-statuses', recipient: 'primary-unit', mode: 'amplify' },
      content,
    )
    const curse = planCombatStatusCopies(
      state(),
      'actor',
      'target',
      { type: 'copy-statuses', recipient: 'primary-unit', mode: 'curse' },
      content,
    )

    expect(amplify.receiverId).toBe('actor')
    expect(amplify.copies).toEqual([])
    expect(curse.receiverId).toBe('target')
    expect(curse.copies).toEqual([])
  })
})

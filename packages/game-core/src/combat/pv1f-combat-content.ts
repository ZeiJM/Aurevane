import type { CombatContentCatalog, CombatStatusDefinition } from './actions'
import { PHASE4_STATUSES } from './status-content'
import {
  createCovertStatusDefinition,
  createRevealedStatusDefinition,
} from './covert-sensory-revealed'

export const PV1F_STATUS_MAXIMUM_STACKS = 3 as const

export const PV1F_GUARDED_STATUS: CombatStatusDefinition = {
  id: 'guarded',
  version: 1,
  maximumStacks: PV1F_STATUS_MAXIMUM_STACKS,
  durationOwnerTurnStarts: 2,
  damageTakenMultiplierBasisPoints: 8_500,
  polarity: 'positive',
  amplifyCopyable: true,
  reactionClass: 'ordinary',
}

// Lowered Guard is a one-turn anti-timeout debuff. A combatant who times out again can receive
// a fresh application, but one application must never persist beyond the next owner-turn start.
export const PV1F_LOWERED_GUARD_STATUS: CombatStatusDefinition = {
  id: 'lowered-guard',
  version: 1,
  maximumStacks: PV1F_STATUS_MAXIMUM_STACKS,
  durationOwnerTurnStarts: 1,
  damageTakenMultiplierBasisPoints: 25_000,
  polarity: 'negative',
  curseCopyable: false,
  reactionClass: 'system',
}

export const PV1F_EXPOSED_STATUS: CombatStatusDefinition = {
  id: 'exposed',
  version: 1,
  maximumStacks: 1,
  durationOwnerTurnStarts: 2,
  damageTakenMultiplierBasisPoints: 11_500,
  polarity: 'negative',
  curseCopyable: true,
  reactionClass: 'ordinary',
}

export const PV1F_COVERT_STATUS = createCovertStatusDefinition(4)
export const PV1F_REVEALED_STATUS = createRevealedStatusDefinition(4)

export const PV1F_COMBAT_CONTENT: CombatContentCatalog = {
  statuses: [
    PV1F_GUARDED_STATUS,
    PV1F_LOWERED_GUARD_STATUS,
    PV1F_EXPOSED_STATUS,
    PV1F_COVERT_STATUS,
    PV1F_REVEALED_STATUS,
    ...PHASE4_STATUSES,
  ],
}

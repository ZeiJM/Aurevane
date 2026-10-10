import type { GridPosition } from './board'
import type { CombatEncounterState, CombatTargetSelection } from './actions'
import type { AbilityBehavior } from './combat-definition'
import type { CapturedCombatAbilitySource } from './combat-behavior-capture'
import type {
  AbilityRequirementContext,
  AbilityRequirementSubjectState,
  AbilityResource,
} from './combat-requirements'

/** Declared capabilities; actual dispatch must also have its native mutation producer. */
export const AUTOMATIC_ABILITY_EVENT_PHASES = Object.freeze({
  combat_action_used: ['before', 'after'],
  combat_action_interrupted: ['after'],
  damage_applied: ['after'],
  healing_applied: ['after'],
  resource_changed: ['after'],
  ap_spent: ['after'],
  mp_spent: ['after'],
  hp_spent: ['after'],
  status_applied: ['after'],
  status_removed: ['after'],
  status_expired: ['after'],
  persistent_effect_applied: ['after'],
  barrier_changed: ['after'],
  barrier_absorbed: ['after'],
  combatant_displaced: ['after'],
  combatant_rewound: ['after'],
  movement_spent: ['after'],
  action_spent: ['after'],
  battle_started: ['after'],
  round_started: ['after'],
  turn_started: ['after'],
  turn_ended: ['after'],
} as const)
for (const phases of Object.values(AUTOMATIC_ABILITY_EVENT_PHASES)) Object.freeze(phases)
export type AutomaticAbilityEventType = keyof typeof AUTOMATIC_ABILITY_EVENT_PHASES
export function automaticAbilityEventSupported(type: string, phase: 'before' | 'after'): boolean {
  return (
    Object.hasOwn(AUTOMATIC_ABILITY_EVENT_PHASES, type) &&
    (
      AUTOMATIC_ABILITY_EVENT_PHASES[type as AutomaticAbilityEventType] as readonly string[]
    ).includes(phase)
  )
}
export interface CombatAbilityEventFrame {
  readonly id: string
  readonly mutationOrdinal: number
  readonly events: readonly {
    readonly type: AutomaticAbilityEventType
    readonly phase: 'before' | 'after'
  }[]
  readonly subjects: readonly {
    readonly combatantId: string
    readonly before?: AbilityRequirementSubjectState
    readonly after: AbilityRequirementSubjectState
  }[]
  readonly actionFacts?: NonNullable<AbilityRequirementContext['event']>['action']
  readonly triggeringCombatantId?: string
  readonly selectedCombatantId?: string
  readonly affectedCombatantIds: readonly string[]
  readonly resourceMutations: readonly {
    readonly combatantId: string
    readonly resources: readonly AbilityResource[]
  }[]
  readonly placements: readonly {
    readonly combatantId: string
    readonly before?: GridPosition
    readonly after: GridPosition
  }[]
}
export type AutomaticAbilitySelectionResult =
  | { readonly selection: CombatTargetSelection }
  | {
      readonly suppression:
        | 'automatic-targeting-unsupported'
        | 'automatic-target-role-unavailable'
        | 'automatic-target-unit-unavailable'
    }

/** Resolve causal identities only; native command admission checks current complete geometry. */
export function resolveAutomaticAbilitySelection(
  state: CombatEncounterState,
  source: CapturedCombatAbilitySource,
  behavior: AbilityBehavior,
  frame: CombatAbilityEventFrame,
): AutomaticAbilitySelectionResult {
  const target = behavior.targeting
  if (
    !target ||
    behavior.activation !== 'automatic' ||
    behavior.mode !== 'action' ||
    target.shape.kind !== 'single' ||
    target.maximumSelections !== 1 ||
    !['self', 'unit'].includes(target.kind)
  )
    return { suppression: 'automatic-targeting-unsupported' }
  if (target.kind === 'self') return { selection: { kind: 'self' } }
  const subject = behavior.automaticTarget?.subject
  const id =
    subject === 'owner'
      ? source.ownerCombatantId
      : subject === 'triggering'
        ? frame.triggeringCombatantId
        : subject === 'selected'
          ? frame.selectedCombatantId
          : subject === 'affected' && frame.affectedCombatantIds.length === 1
            ? frame.affectedCombatantIds[0]
            : undefined
  if (!id) return { suppression: 'automatic-target-role-unavailable' }
  if (!state.tactical.battle.combatants.some((unit) => unit.id === id && unit.hp > 0))
    return { suppression: 'automatic-target-unit-unavailable' }
  return { selection: { kind: 'unit', combatantId: id } }
}

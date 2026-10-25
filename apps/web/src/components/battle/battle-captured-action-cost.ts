import type { PublicAbilityDefinition } from '@aurevane/game-core/combat/public-combat-presentation'
import type { AbilityBehavior } from '@aurevane/game-core/combat/combat-definition'
import { abilityCostDescription } from '@/lib/battle/ability-cost-presentation'
import { canAffordBattleCosts } from '@/lib/battle/battle-basic-actions'
import type { BattleCapturedActionTarget } from './battle-preview-selection'
import type {
  BattleRuntime,
  BattleSkillForecastPresentation,
  BattleTechniqueCategory,
} from './battle-runtime'

/** Canonical noncast groups retain their equipped slot and information access. */
export function battleSkillCastMode(skill: { definition?: { ability?: PublicAbilityDefinition } }) {
  const groups = skill.definition?.ability?.behaviors
  if (!groups || groups.some((group) => group.activation === 'manual' && group.mode === 'action'))
    return { canCast: true, kind: 'manual', label: 'Manual' }
  const kinds = [
    ...(groups.some((group) => group.activation === 'automatic') ? ['automatic'] : []),
    ...(groups.some((group) => group.activation === 'ongoing') ? ['ongoing'] : []),
    ...(groups.some((group) => group.activation === 'manual' && group.mode === 'modifier')
      ? ['modifier']
      : []),
  ]
  return {
    canCast: false,
    kind: kinds.join('-') || 'unavailable',
    label: kinds.map((kind) => kind[0]!.toUpperCase() + kind.slice(1)).join(' / ') || 'Unavailable',
  }
}

/** Read-only owned selection; this never returns a cast descriptor or an intent. */
export function battleNoncastAbilityInspection(
  runtime: BattleRuntime,
  captures: readonly BattleCapturedActionTarget[],
  actorId: string | null,
  id: string,
) {
  const skill =
    runtime.techniques?.find((item) => item.id === id) ??
    (runtime.essence?.id === id ? runtime.essence : undefined)
  if (skill) {
    const mode = battleSkillCastMode(skill)
    if (mode.canCast) return null
    const kind = runtime.essence?.id === id ? 'Essence' : 'Skill'
    const type = `${mode.kind === 'modifier' ? 'Modifier' : mode.kind === 'unavailable' ? 'Unavailable' : 'Passive'} ${kind}`
    return {
      id,
      name: skill.name,
      type,
      caption: `${type} · ${mode.label}`,
    }
  }
  const resonance = runtime.resonance
  if (
    !resonance ||
    runtime.essence ||
    resonance.id !== id ||
    battleCapturedSpecialAction(runtime, captures, actorId)
  )
    return null
  const mode = battleSkillCastMode(resonance)
  const unavailableManual = resonance.definition?.ability?.behaviors.some(
    (group) => group.activation === 'manual' && group.mode === 'action',
  )
  const type = unavailableManual ? 'Resonance' : 'Passive Resonance'
  const activation = unavailableManual ? 'Unavailable' : mode.canCast ? 'Automatic' : mode.label
  return {
    id,
    name: resonance.name,
    type,
    caption: `${type} · ${activation}`,
  }
}

/** Resonance actions come only from the controlled owner's authoritative Manual references. */
export function battleCapturedSpecialAction(
  runtime: BattleRuntime,
  captures: readonly BattleCapturedActionTarget[],
  actorId: string | null,
  elementalPolicy?: number,
  behaviorId?: string,
):
  | {
      kind: 'essence' | 'resonance'
      skill: BattleSkillForecastPresentation
      category: BattleTechniqueCategory
    }
  | undefined {
  if (runtime.essence) {
    const skill = runtime.essence
    if (!battleSkillCastMode(skill).canCast) return undefined
    return {
      kind: 'essence',
      category: 'attack',
      skill: {
        ...skill,
        groundIntentCapable:
          (elementalPolicy === 1 || elementalPolicy === 2) &&
          (skill.targetKind === 'unit' ||
            (elementalPolicy === 2 && skill.targetKind === 'ground-tile')) &&
          skill.targetTeamPolicy === 'enemy' &&
          skill.definition?.effects.some(
            (effect) => effect.type === 'damage' && effect.element === 'fire',
          ),
      },
    }
  }
  const resonance = runtime.resonance
  if (!resonance || !actorId) return undefined
  const choices = battleCapturedActionChoices(captures, resonance.id, actorId)
  const first = behaviorId ? choices.find((row) => row.behaviorId === behaviorId) : choices[0]
  if (!first) return undefined
  return {
    kind: 'resonance',
    category:
      first.classification === 'recovery'
        ? 'heal'
        : first.classification === 'utility'
          ? 'defense'
          : 'attack',
    skill: {
      id: resonance.id,
      name: resonance.name,
      target: first.target,
      targetKind: first.target.kind,
      targetTeamPolicy: first.target.teamPolicy,
      minimumRange: first.target.minimumRange,
      maximumRange: first.target.maximumRange,
      apCost: first.costs?.find((cost) => cost.resource === 'ap')?.amount ?? 0,
      mpCost: first.costs?.find((cost) => cost.resource === 'mp')?.amount ?? 0,
      tags: [],
      effectDescriptions: [],
      requirementDescriptions: [],
      groundIntentCapable: false,
    },
  }
}

/** An owner may control multiple units with the same ability; their groups remain separate. */
export function battleCapturedActionChoices(
  captures: readonly BattleCapturedActionTarget[],
  actionId: string,
  actorId: string | null,
) {
  return captures.filter(
    (row) =>
      row.actionId === actionId && (!row.ownerCombatantId || row.ownerCombatantId === actorId),
  )
}

/** Presentation only. A deliberate commit still pays through the versioned server authority. */
export function battleCapturedControlledAvailability(
  choices: readonly BattleCapturedActionTarget[],
  behaviorId?: string,
) {
  const selected = behaviorId
    ? choices.find((row) => row.behaviorId === behaviorId)
    : choices.length === 1
      ? choices[0]
      : undefined
  const selectedSpent = selected?.controlled?.phase === 'spent'
  return {
    controlledPrimed: choices.some((row) => row.controlled?.phase === 'primed'),
    controlledSpent:
      selectedSpent ||
      (!behaviorId &&
        choices.length > 0 &&
        choices.every((row) => row.controlled?.phase === 'spent')),
    chooseAction: selectedSpent && choices.some((row) => row.controlled?.phase !== 'spent'),
  }
}

/** Definition price stays independent of current command availability. */
export function battleCapturedActionCost(
  choices: readonly BattleCapturedActionTarget[],
  fallbackCosts: AbilityBehavior['costs'],
  resources: { ap: number; mp: number; hp: number },
  behaviorId?: string,
) {
  const selected = behaviorId
    ? choices.find((row) => row.behaviorId === behaviorId)
    : choices.length === 1
      ? choices[0]
      : undefined
  const costs = selected
    ? (selected.costs ?? fallbackCosts)
    : !choices.length && !behaviorId
      ? fallbackCosts
      : undefined
  const cooldown = selected?.cooldown
  return {
    ...battleCapturedControlledAvailability(choices, behaviorId),
    report: selected ? selected.report : choices.length || behaviorId ? null : undefined,
    costLabel: costs ? abilityCostDescription(costs) : behaviorId ? 'Unavailable' : 'Choose action',
    cooldownLabel: selected
      ? cooldown === undefined
        ? undefined
        : cooldown === null
          ? 'None'
          : `${cooldown.ownerTurns} ${cooldown.ownerTurns === 1 ? 'turn' : 'turns'}`
      : choices.length
        ? behaviorId
          ? 'Unavailable'
          : 'Choose action'
        : undefined,
    affordable: costs
      ? canAffordBattleCosts(costs, resources)
      : !behaviorId &&
        choices.some((row) => row.costs && canAffordBattleCosts(row.costs, resources)),
  }
}

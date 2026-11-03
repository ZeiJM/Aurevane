import 'server-only'
import { equipmentActionId } from '@aurevane/game-core/combat/combat-equipment'
import {
  combatAbilityRemainingUses,
  prepareCombatAbilityCommand,
} from '@aurevane/game-core/combat/combat-ability-command'
import {
  combatAbilityBehavior,
  combatAbilityCommandContext,
  combatControlledAbilityAvailability,
} from '@aurevane/game-core/combat/combat-behavior-runtime'
import {
  canonicalAbilityTargetSpec,
  enumerateCombatTargetSelections,
} from '@aurevane/game-core/combat/combat-targeting-shapes'
import { combatAbilityCooldown } from '@aurevane/game-core/combat/skill-cooldowns'
import { combatCanonicalModifierRootFacts } from '@aurevane/game-core/combat/combat-modifier-compatibility'
import { PV1F_COMBAT_CONTENT } from '@aurevane/game-core/combat/pv1f-action-economy'
import type { StatDrivenCombatEncounterState } from '@aurevane/game-core/combat/stat-driven-combat'
import type { BattleViewerEntitlement } from './battle-viewer-entitlement'
import type { BattleItemPresentation } from '@/lib/battle/battle-item-presentation'
import { presentItem } from '@/lib/items/item-presentation'
import { abilityBehaviorInformation } from '@/components/character/ability-detail-presentation'
import { contentArtworkKey } from '@aurevane/game-core/combat/content-media'

export function projectBattleItems(
  state: StatDrivenCombatEncounterState,
  viewer: BattleViewerEntitlement,
): readonly BattleItemPresentation[] {
  if (viewer.kind !== 'participant') return []
  return (state.capturedAbilitySources ?? [])
    .filter(
      (source) =>
        source.equipment &&
        viewer.controlledCombatantIds.has(source.ownerCombatantId) &&
        state.abilityRuntime?.activeSourceIds.includes(source.sourceInstanceId),
    )
    .flatMap((source) => {
      const { unit, roles } = source.equipment!
      const item = presentItem(unit.item, { timingPolicy: state.effectTimingPolicy ?? null })
      return (['attack', 'support', 'use'] as const)
        .filter((role) => roles[role] !== undefined)
        .map((role) => {
          const behavior = combatAbilityBehavior(source, roles[role], state.effectTimingPolicy)
          const controlled = combatControlledAbilityAvailability({
            state,
            actorId: source.ownerCombatantId,
            sourceInstanceId: source.sourceInstanceId,
            behaviorId: behavior.id,
            content: PV1F_COMBAT_CONTENT,
          })
          // Preparation is a distinct command. An unprimed action must remain reachable
          // even though an ordinary release quote would reject it as not yet primed.
          const selections =
            controlled && controlled.phase !== 'primed'
              ? []
              : controlled?.releaseTarget
                ? [controlled.releaseTarget]
                : enumerateCombatTargetSelections(
                    state,
                    source.ownerCombatantId,
                    canonicalAbilityTargetSpec(behavior.targeting!),
                  )
          let unavailableReason: string | null =
            controlled && controlled.phase !== 'primed'
              ? 'This Controlled action cannot be prepared now.'
              : 'No legal target is available.'
          for (const [index, selection] of selections.entries()) {
            const evaluation = prepareCombatAbilityCommand({
              state,
              actorId: source.ownerCombatantId,
              root: { kind: 'canonical', source, behaviorId: behavior.id },
              selection,
              content: PV1F_COMBAT_CONTENT,
              context: combatAbilityCommandContext(state, source),
              manualModifiers: controlled?.manualModifiers,
            }).evaluation
            if (evaluation.legal) {
              unavailableReason = null
              break
            }
            if (index === 0) unavailableReason = evaluation.issues[0]?.message ?? unavailableReason
          }
          // Keep the existing prime/cancel controls accessible, including a primed
          // action whose bound release currently has no legal recipient or payment.
          if (controlled?.canPrime || controlled?.canCancel) unavailableReason = null
          return {
            ownerCombatantId: source.ownerCombatantId,
            actionId: equipmentActionId(unit, role),
            contentVersion: unit.item.contentVersion,
            role,
            position: unit.position,
            behaviorId: behavior.id,
            name: unit.item.name,
            description: unit.item.description,
            enabled: true,
            iconKey: contentArtworkKey({ ...unit.item.media, iconKey: unit.item.media.artworkId }),
            artworkSrc: item.artworkSrc,
            item,
            maximumUsesPerBattle: behavior.maximumUsesPerBattle ?? null,
            remainingUses: combatAbilityRemainingUses(state, source, behavior),
            unavailableReason,
            behaviors: [
              {
                behaviorId: behavior.id,
                classification: behavior.classification,
                modifierRoot: combatCanonicalModifierRootFacts(behavior),
                costs: behavior.costs.map((cost) => ({ ...cost })),
                cooldown: combatAbilityCooldown(state, source, behavior.cooldown),
                target: structuredClone(canonicalAbilityTargetSpec(behavior.targeting!)),
                ...abilityBehaviorInformation(behavior, {
                  timingPolicy: state.effectTimingPolicy ?? null,
                  tagPresentation: source.definition.tagPresentation,
                }),
              },
            ],
          }
        })
    })
}

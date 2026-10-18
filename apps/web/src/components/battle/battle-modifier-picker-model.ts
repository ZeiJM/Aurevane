import type { AbilityBehavior } from '@aurevane/game-core/combat/combat-definition'
import type { ManualCombatModifierSelection } from '@aurevane/game-core/combat/combat-ability-command'
import {
  combatModifierFactsCompatible,
  type CombatModifierCompatibilityFacts,
} from '@aurevane/game-core/combat/combat-modifier-compatibility'
import type { BattleAbilityBehaviorReport } from '@/lib/battle/battle-basic-actions'
import type { BattleSessionView } from '@/server/battle/battle-session-service'
import { battleSkillTargetSpec, type BattlePreviewSkill } from './battle-preview-selection'
import {
  prepareBattleModifierDraft,
  type BattleModifierDraft,
  type BattleModifierContext,
  type BattleModifierPinnedSelection,
} from './battle-modifier-draft'

export interface BattleModifierActionChoice {
  readonly key: string
  readonly label: string
  readonly context: BattleModifierContext
  readonly descriptor: BattlePreviewSkill
}
export interface BattleModifierChoice {
  readonly reference: ManualCombatModifierSelection
  readonly pin: BattleModifierPinnedSelection | null
  readonly label: string
  readonly report: BattleAbilityBehaviorReport | null
  readonly costs: AbilityBehavior['costs'] | null
  readonly cooldown:
    (NonNullable<AbilityBehavior['cooldown']> & { readonly ticksRemaining: number }) | null
  readonly compatibility: CombatModifierCompatibilityFacts | null
  readonly ownerEligible: boolean
  readonly blockedReasons: readonly string[]
}
export interface BattleModifierPublicName {
  readonly id: string
  readonly contentVersion: number | null
  readonly name: string
}
type OwnerChoice = NonNullable<BattleSessionView['snapshot']['manualModifierAvailability']>[number]
export function battleModifierContextForAction(
  battleSessionId: string,
  battleVersion: number,
  actorId: string,
  descriptor: BattlePreviewSkill,
  rootContentVersion: number | null,
): BattleModifierContext {
  return {
    battleSessionId,
    battleVersion,
    actorId,
    actionId: descriptor.id,
    ...(descriptor.behaviorId ? { behaviorId: descriptor.behaviorId } : {}),
    rootContentVersion,
    rootFingerprint: JSON.stringify([
      battleSkillTargetSpec(descriptor),
      descriptor.classification,
      descriptor.modifierRoot,
      descriptor.costs,
    ]),
  }
}
export function battleModifierChoices(
  rows: readonly OwnerChoice[],
  actorId: string | null,
  names: readonly BattleModifierPublicName[],
  selectedPins: readonly BattleModifierPinnedSelection[] = [],
  selectedReferences: readonly ManualCombatModifierSelection[] = [],
): BattleModifierChoice[] {
  const choices = rows
    .filter((row) => row.ownerCombatantId === actorId)
    .map((row): BattleModifierChoice => {
      const valid =
        typeof row.abilityId === 'string' &&
        row.abilityId.trim().length > 0 &&
        Number.isSafeInteger(row.contentVersion) &&
        row.contentVersion! > 0 &&
        row.report &&
        row.compatibility &&
        typeof row.compatibility.payloadsSupported === 'boolean' &&
        typeof row.compatibility.requiresExplicitUnit === 'boolean'
      const pin = valid
        ? {
            sourceInstanceId: row.sourceInstanceId,
            behaviorId: row.behaviorId,
            abilityId: row.abilityId!,
            contentVersion: row.contentVersion!,
            fingerprint: JSON.stringify([
              row.abilityId,
              row.contentVersion,
              row.behaviorId,
              row.costs,
              row.cooldown ? { key: row.cooldown.key, ownerTurns: row.cooldown.ownerTurns } : null,
              row.compatibility,
              row.report,
            ]),
          }
        : null
      const saved = selectedPins.find(
        (pin) => pin.sourceInstanceId === row.sourceInstanceId && pin.behaviorId === row.behaviorId,
      )
      const name =
        names.find(
          (name) => name.id === row.abilityId && name.contentVersion === row.contentVersion,
        )?.name ?? 'Modifier'
      return {
        reference: { sourceInstanceId: row.sourceInstanceId, behaviorId: row.behaviorId },
        pin: pin ?? saved ?? null,
        label: `${name} · ${row.name}`,
        report: row.report ?? null,
        costs: valid ? row.costs : null,
        cooldown: row.cooldown,
        compatibility: valid ? row.compatibility! : null,
        ownerEligible: !!valid && row.ownerEligible,
        blockedReasons: valid ? row.blockedReasons : ['metadata-unavailable'],
      }
    })
  for (const reference of selectedReferences) {
    if (
      choices.some(
        (choice) =>
          choice.reference.sourceInstanceId === reference.sourceInstanceId &&
          choice.reference.behaviorId === reference.behaviorId,
      )
    )
      continue
    choices.push({
      reference,
      pin:
        selectedPins.find(
          (pin) =>
            pin.sourceInstanceId === reference.sourceInstanceId &&
            pin.behaviorId === reference.behaviorId,
        ) ?? null,
      label: 'Unavailable modifier',
      report: null,
      costs: null,
      cooldown: null,
      compatibility: null,
      ownerEligible: false,
      blockedReasons: ['metadata-unavailable'],
    })
  }
  return choices.sort((a, b) =>
    a.reference.sourceInstanceId < b.reference.sourceInstanceId
      ? -1
      : a.reference.sourceInstanceId > b.reference.sourceInstanceId
        ? 1
        : a.reference.behaviorId < b.reference.behaviorId
          ? -1
          : a.reference.behaviorId > b.reference.behaviorId
            ? 1
            : 0,
  )
}
export function battleModifierCanToggle(
  choice: BattleModifierChoice,
  selected: boolean,
  root: BattleModifierActionChoice | null,
  locked: boolean,
  readOnly: boolean,
): boolean {
  if (locked || readOnly || !root) return false
  if (selected) return true
  if (
    !choice.pin ||
    !choice.compatibility ||
    !root.descriptor.modifierRoot ||
    root.descriptor.unavailable ||
    !combatModifierFactsCompatible(choice.compatibility, root.descriptor.modifierRoot)
  )
    return false
  return root.descriptor.controlled?.canPrime === true || choice.ownerEligible
}
export function battleModifierActionMode(
  descriptor: BattlePreviewSkill,
): 'attack' | 'guard' | 'recover' | 'move' {
  return descriptor.id === 'basic.move'
    ? 'move'
    : descriptor.classification === 'recovery'
      ? 'recover'
      : descriptor.classification === 'utility'
        ? 'guard'
        : 'attack'
}

/** Local read/preparation context; Controlled availability alone owns locked attachments. */
export function prepareBattleModifierActionDraft(
  current: BattleModifierDraft | null,
  choice: BattleModifierActionChoice,
): BattleModifierDraft {
  return choice.descriptor.controlled && choice.descriptor.controlled.phase !== 'unprimed'
    ? prepareBattleModifierDraft(choice.context)
    : current && JSON.stringify(current.context) === JSON.stringify(choice.context)
      ? current
      : prepareBattleModifierDraft(choice.context)
}

/** Resolve recovery independently of the immutable catalogue's first-group category. */
export function battleRecoveryActionId(
  preferredId: string,
  menuActionIds: readonly string[],
  selectedOwnedGroup: { actionId: string; classification: string } | null,
): string {
  if (
    selectedOwnedGroup?.actionId === preferredId &&
    selectedOwnedGroup.classification === 'recovery'
  )
    return preferredId
  return menuActionIds.find((id) => id === preferredId) ?? menuActionIds[0] ?? ''
}

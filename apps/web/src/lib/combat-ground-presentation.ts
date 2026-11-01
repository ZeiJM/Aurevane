import type {
  CombatActionDefinition,
  CombatEffectDefinition,
  CombatTargetSpec,
} from '@aurevane/game-core/combat/actions'
import type { MatureSkillEffectDefinition } from '@aurevane/game-core/combat/mature-skills'
import type { CombatGroundAreaDefinition } from '@aurevane/game-core/combat/combat-ground-areas'
import type { CombatEffectTimingPolicy } from '@aurevane/game-core/combat/combat-effect-timing'
import { planCombatGroundContacts } from '@aurevane/game-core/combat/combat-ground-contact'
import { nativeCombatTagPayload } from '@aurevane/game-core/combat/combat-tag-registry'
import type { AbilityBehavior, AbilityEffect } from '@aurevane/game-core/combat/combat-definition'
import { canonicalAbilityTargetSpec } from '@aurevane/game-core/combat/combat-targeting-shapes'

interface GroundPresentationSource {
  readonly effects: readonly MatureSkillEffectDefinition[]
  readonly target?: CombatTargetSpec
  readonly groundArea?: CombatGroundAreaDefinition
  readonly effectDescriptions?: readonly (string | null)[]
  readonly effectTimingModes?: CombatActionDefinition['effectTimingModes']
}

/** A detached display view of the exact packets selected by the encounter's runtime policy. */
export function currentGroundPresentation<T extends GroundPresentationSource>(
  source: T,
  policy: 1 | null | undefined,
  timingPolicy?: CombatEffectTimingPolicy | null,
): { view: T; sourceOrdinals: readonly number[]; fieldOrdinals: ReadonlySet<number> } {
  const originalOrdinals = source.effects.map((_, ordinal) => ordinal)
  const unchanged = {
    view: source,
    sourceOrdinals: originalOrdinals,
    fieldOrdinals: new Set<number>(),
  }
  if (policy !== 1 || !source.target) return unchanged
  const action: CombatActionDefinition = {
    id: 'presentation.ground',
    version: 1,
    sourceType: 'test',
    tags: [],
    cost: { spendsAction: false, mp: 0 },
    requirements: [],
    target: source.target,
    effects: source.effects as readonly CombatEffectDefinition[],
    groundArea: source.groundArea,
    effectTimingModes: source.effectTimingModes,
  }
  const plan = planCombatGroundContacts(action, 1, timingPolicy ?? undefined)
  if (!plan.fields.length && !plan.suppressedSourceOrdinals.length) return unchanged
  const packets = new Map<number, MatureSkillEffectDefinition>(
    plan.directSourceOrdinals.map((ordinal) => [ordinal, source.effects[ordinal]!]),
  )
  const fieldOrdinals = new Set<number>()
  for (const field of plan.fields)
    field.sourceEffectOrdinals.forEach((ordinal, index) => {
      packets.set(ordinal, { ...field.action.effects[index]!, target: 'ground' })
      fieldOrdinals.add(ordinal)
    })
  const sourceOrdinals = originalOrdinals.filter((ordinal) => packets.has(ordinal))
  return {
    sourceOrdinals,
    fieldOrdinals,
    view: {
      ...source,
      effects: sourceOrdinals.map((ordinal) => packets.get(ordinal)!),
      ...(plan.fields.length === 1
        ? {
            groundArea: {
              ...plan.fields[0]!.action.groundArea!,
              contactPolicyVersion: 1 as const,
              entryEffectOrdinals: sourceOrdinals.flatMap((ordinal, index) =>
                fieldOrdinals.has(ordinal) ? [index] : [],
              ),
            },
          }
        : {}),
      ...(source.effectDescriptions
        ? {
            effectDescriptions: sourceOrdinals.map((ordinal) =>
              source.effects[ordinal]!.type === 'create-terrain' || fieldOrdinals.has(ordinal)
                ? currentGroundNote(source.effectDescriptions?.[ordinal], source.effects[ordinal])
                : (source.effectDescriptions?.[ordinal] ?? null),
            ),
          }
        : {}),
    },
  }
}

/** Generated obsolete terrain mechanics must not override this encounter's field rules. */
export function currentGroundNote(
  note: string | null | undefined,
  effect?: { readonly type: string; readonly statusId?: string },
): string | null {
  if (!note || /(?:frozen|freeze)\s*ground/iu.test(note)) return null
  const invalidCost =
    effect?.type === 'apply-status' && effect.statusId === 'slow'
      ? /\bSkill\s+AP\b|\bAP\s+per\s+Skill\b/iu
      : /surcharge|\b(?:skill|movement)\s+AP\b|\bAP\s+(?:per|more)\b/iu
  return invalidCost.test(note) ? null : note
}

export function currentGroundBehaviorPresentation(
  behavior: AbilityBehavior,
  policy: 1 | null | undefined,
  timingPolicy?: CombatEffectTimingPolicy | null,
): {
  view: AbilityBehavior
  sourceOrdinals: readonly number[]
  fieldOrdinals: ReadonlySet<number>
} {
  const source = {
    target: behavior.targeting ? canonicalAbilityTargetSpec(behavior.targeting) : undefined,
    effects: behavior.effects.map(({ payload }) =>
      ['move', 'damage-bonus', 'summon', 'reversal'].includes(payload.type)
        ? (payload as unknown as MatureSkillEffectDefinition)
        : nativeCombatTagPayload(payload),
    ),
    effectTimingModes: behavior.effects.map(
      ({ timing }) => timing,
    ) as CombatActionDefinition['effectTimingModes'],
    groundArea: behavior.groundArea
      ? {
          ...behavior.groundArea,
          entryEffectOrdinals: behavior.groundArea.entryEffectIds.map((id) =>
            behavior.effects.findIndex((effect) => effect.id === id),
          ),
        }
      : undefined,
  }
  const projected = currentGroundPresentation(source, policy, timingPolicy)
  if (projected.view === source) return { ...projected, view: behavior }
  return {
    ...projected,
    view: {
      ...behavior,
      effects: projected.sourceOrdinals.map((ordinal, index): AbilityEffect => {
        const original = behavior.effects[ordinal]!
        if (!projected.fieldOrdinals.has(ordinal)) return original
        const packet = projected.view.effects[index]!
        return {
          ...original,
          payload:
            original.payload.type === 'create-terrain'
              ? (packet as AbilityEffect['payload'])
              : ({
                  ...original.payload,
                  recipient: packet.recipient,
                  target: 'ground',
                  ...('applicationOrigin' in packet
                    ? { applicationOrigin: packet.applicationOrigin }
                    : {}),
                } as AbilityEffect['payload']),
        }
      }),
      ...(projected.view.groundArea
        ? {
            groundArea: {
              ...projected.view.groundArea,
              entryEffectIds: projected.view.groundArea.entryEffectOrdinals.map(
                (index) => behavior.effects[projected.sourceOrdinals[index]!]!.id,
              ),
            },
          }
        : {}),
    },
  }
}

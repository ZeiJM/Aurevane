import type { CombatGroundAreaDefinition } from '@aurevane/game-core/combat/combat-ground-areas'
import {
  combatTargetSupportsGroundArea,
  isCombatGroundEntryEffect,
  validateCombatGroundAreaDefinition,
} from '@aurevane/game-core/combat/combat-ground-areas'
import type { CombatTargetSpec } from '@aurevane/game-core/combat/actions'
import type { CombatEffectTarget } from '@aurevane/game-core/combat/combat-effect-recipients'
import type { AbilityBehavior } from '@aurevane/game-core/combat/combat-definition'
import { canonicalAbilityTargetSpec } from '@aurevane/game-core/combat/combat-targeting-shapes'
import { nativeCombatTagPayload } from '@aurevane/game-core/combat/combat-tag-registry'
import { retireAuthoredFrozenGround, hasSharedGroundAim } from './combat-effect-dependencies'

interface GroundEntryEffect {
  readonly type: string
  readonly recipient: string
  readonly target?: CombatEffectTarget
}
interface NativeGroundAuthoring {
  readonly target: CombatTargetSpec
  readonly effects: readonly GroundEntryEffect[]
  readonly groundArea?: CombatGroundAreaDefinition
}
function supportedGroundProfile(
  value: unknown,
  entryKey: 'entryEffectIds' | 'entryEffectOrdinals',
): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const profile = value as Record<string, unknown>
  return (
    Array.isArray(profile[entryKey]) &&
    Object.keys(profile).every((key) =>
      [
        entryKey,
        'durationRounds',
        'visualPresetId',
        'timing',
        'contactPolicyVersion',
        'placementTimingVersion',
        'targetTeams',
      ].includes(key),
    )
  )
}

/** A stale saved profile cannot make ordinary unit effects appear Ground-targeted. */
export function hasGroundAuthoringEffects(
  target: CombatTargetSpec,
  effects: readonly GroundEntryEffect[],
): boolean {
  return effects.some(
    (effect) =>
      isCombatGroundEntryEffect(effect) &&
      (effect.target === 'ground' ||
        (effect.target === undefined && combatTargetSupportsGroundArea(target))),
  )
}

/** Preserve the old team/friendly-fire intersection when making the scope explicit. */
export function groundTargetTeams(
  target: CombatTargetSpec,
): CombatGroundAreaDefinition['targetTeams'] {
  const team = target.teamPolicy
  const fire = target.friendlyFire
  const self = team !== 'enemy' && fire !== 'enemies-only' && fire !== 'all-except-actor'
  const allies = (team === 'ally' || team === 'any') && fire !== 'enemies-only'
  const enemies = (team === 'enemy' || team === 'any') && fire !== 'allies-only'
  return self && allies && enemies
    ? 'all'
    : !self && allies && enemies
      ? 'all-except-self'
      : self && allies
        ? 'allies'
        : allies
          ? 'allies-except-self'
          : enemies
            ? 'enemies'
            : self
              ? 'self'
              : undefined
}

/** Derive new entries without turning independently targeted unit packets into field effects. */
export function groundAreaForEffects<T extends GroundEntryEffect>(
  effects: readonly T[],
  current?: CombatGroundAreaDefinition,
  target?: CombatTargetSpec,
): CombatGroundAreaDefinition | undefined {
  const entryEffectOrdinals = effects.flatMap((effect, index) =>
    isCombatGroundEntryEffect(effect) &&
    (effect.target === undefined ||
      effect.target === 'ground' ||
      (Array.isArray(current?.entryEffectOrdinals) && current.entryEffectOrdinals.includes(index)))
      ? [index]
      : [],
  )
  return entryEffectOrdinals.length
    ? {
        ...current,
        durationRounds: current?.durationRounds ?? 2,
        visualPresetId: current?.visualPresetId ?? 'arcane-pulse',
        contactPolicyVersion: 1,
        placementTimingVersion: 1,
        ...(current?.targetTeams === undefined && target && groundTargetTeams(target)
          ? { targetTeams: groundTargetTeams(target) }
          : {}),
        entryEffectOrdinals,
      }
    : undefined
}

/** Explicit current edits/save create persistence; historical readers never call this helper. */
export function withCurrentSkillGroundArea<T extends NativeGroundAuthoring>(
  previous: T,
  next: T = previous,
): T & { groundArea?: CombatGroundAreaDefinition } {
  const hasGround = hasGroundAuthoringEffects(next.target, next.effects)
  if (!hasGround) {
    if (
      hasGroundAuthoringEffects(previous.target, previous.effects) &&
      next !== previous &&
      next.groundArea
    ) {
      const { groundArea: _removed, ...rest } = next
      void _removed
      return rest as T
    }
    return next
  }
  if (
    !combatTargetSupportsGroundArea(next.target) ||
    next.target.categories?.some((category) => category !== 'ground')
  )
    return next
  try {
    let current = next.groundArea
    if (current !== undefined) {
      if (!supportedGroundProfile(current, 'entryEffectOrdinals')) return next
      if (next !== previous) {
        const retained = current.entryEffectOrdinals.filter((index) => {
          const effect = next.effects[index]
          if (!effect || effect.target === undefined || effect.target === 'ground') return true
          const prior =
            previous.effects.find((row) => row === effect) ??
            (previous.effects.length === next.effects.length ? previous.effects[index] : undefined)
          return prior?.target !== 'ground'
        })
        if (retained.length !== current.entryEffectOrdinals.length)
          current = { ...current, entryEffectOrdinals: retained }
      }
      if (current.entryEffectOrdinals.length || !next.groundArea?.entryEffectOrdinals.length)
        validateCombatGroundAreaDefinition({ ...next, groundArea: current })
    }
    const proposed = groundAreaForEffects(next.effects, current, next.target)
    if (!proposed) return next
    const area = current
      ? {
          ...proposed,
          entryEffectOrdinals: [
            ...current.entryEffectOrdinals,
            ...proposed.entryEffectOrdinals.filter(
              (index) =>
                next.effects[index]?.target === 'ground' &&
                !current!.entryEffectOrdinals.includes(index),
            ),
          ],
        }
      : proposed
    const normalized = { ...next, groundArea: area }
    validateCombatGroundAreaDefinition(normalized)
    return JSON.stringify(next.groundArea) === JSON.stringify(area) ? next : normalized
  } catch {
    return next
  }
}

export function withCurrentAbilityGroundArea(
  previous: AbilityBehavior,
  next: AbilityBehavior = previous,
): AbilityBehavior {
  if (!next.targeting || next.mode !== 'action') return next
  try {
    if (next.groundArea !== undefined && !supportedGroundProfile(next.groundArea, 'entryEffectIds'))
      return next
    const entries = next.effects.filter(
      (effect) => !['move', 'summon', 'damage-bonus'].includes(effect.payload.type),
    )
    const effects = entries.map((effect) => nativeCombatTagPayload(effect.payload))
    const target = canonicalAbilityTargetSpec(next.targeting)
    const previousEntries = previous.effects.filter(
      (effect) => !['move', 'summon', 'damage-bonus'].includes(effect.payload.type),
    )
    const previousTarget = previous.targeting
      ? canonicalAbilityTargetSpec(previous.targeting)
      : target
    if (!hasGroundAuthoringEffects(target, effects)) {
      if (
        next !== previous &&
        hasGroundAuthoringEffects(
          previousTarget,
          previousEntries.map((effect) => nativeCombatTagPayload(effect.payload)),
        ) &&
        next.groundArea
      ) {
        const { groundArea: _removed, ...rest } = next
        void _removed
        return rest
      }
      return next
    }
    if (
      next.targeting.categories?.some((category) => category !== 'ground') ||
      next.effects.some((effect) => effect.timing === 'controlled')
    )
      return next
    let nativeArea: CombatGroundAreaDefinition | undefined
    if (next.groundArea) {
      const { entryEffectIds, ...savedProfile } = next.groundArea
      nativeArea = {
        ...savedProfile,
        entryEffectOrdinals: entryEffectIds.map((id) =>
          entries.findIndex((effect) => effect.id === id),
        ),
      }
    }
    const native = {
      target,
      effects,
      ...(nativeArea ? { groundArea: nativeArea } : {}),
    }
    const priorNative =
      previous === next
        ? native
        : {
            ...native,
            effects: entries.map((entry) => {
              const prior = previous.effects.find((effect) => effect.id === entry.id)
              return prior
                ? nativeCombatTagPayload(prior.payload)
                : nativeCombatTagPayload(entry.payload)
            }),
          }
    const normalized = withCurrentSkillGroundArea(priorNative, native)
    if (normalized === native || !normalized.groundArea) return next
    const { entryEffectOrdinals, ...profile } = normalized.groundArea
    return {
      ...next,
      groundArea: {
        ...profile,
        entryEffectIds: entryEffectOrdinals.map((index) => entries[index]!.id),
      },
    }
  } catch {
    return next
  }
}
interface EntryEffect {
  readonly type: string
  readonly authoringLink?: string
  readonly statusId?: string
}
/** Retain entry references across insertions, moves and removals in the native editor. */
export function withRemappedGroundEntries<
  T extends {
    readonly effects: readonly EntryEffect[]
    readonly groundArea?: CombatGroundAreaDefinition
    readonly target?: unknown
  },
>(previous: T, next: T): T {
  if (
    !previous.groundArea ||
    next.groundArea !== previous.groundArea ||
    next.effects === previous.effects
  )
    return next
  const retired = retireAuthoredFrozenGround(previous.effects, {
    inheritedGround: hasSharedGroundAim(previous.target),
  })
  const replacements = retired.replacements
  const entryEffectOrdinals = [
    ...new Set(
      previous.groundArea.entryEffectOrdinals.flatMap((ordinal) => {
        const source = previous.effects[ordinal]
        if (!source) return []
        const replacement = replacements.get(source)
        let index = next.effects.findIndex(
          (row) =>
            row === source ||
            row === replacement ||
            (replacement &&
              row.type === replacement.type &&
              row.authoringLink === replacement.authoringLink &&
              (replacement.authoringLink !== undefined || next.effects[ordinal] === row)) ||
            (source.authoringLink &&
              row.authoringLink === source.authoringLink &&
              row.type === source.type),
        )
        if (
          index < 0 &&
          previous.effects.length === next.effects.length &&
          next.effects[ordinal]?.type === source.type
        )
          index = ordinal
        const projected = retired.effects.indexOf(replacement ?? source)
        if (
          index < 0 &&
          projected >= 0 &&
          next.effects.length === retired.effects.length &&
          next.effects[projected]?.type === (replacement ?? source).type
        )
          index = projected
        return index < 0 ? [] : [index]
      }),
    ),
  ]
  if (entryEffectOrdinals.length)
    return {
      ...next,
      groundArea: {
        ...previous.groundArea,
        entryEffectOrdinals,
        ...(replacements.size ? { contactPolicyVersion: 1 as const } : {}),
      },
    }
  const { groundArea: removed, ...rest } = next
  void removed
  return rest as T
}

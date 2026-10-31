import { combatStatusTuning, type CombatStatusTuning } from './combat-status-tuning'
import type {
  AttackPercentageDotProfile,
  CapturedPercentageDotDamage,
} from './combat-percentage-dots'
import { CURRENT_BURN_DAMAGE_BY_STAGE } from './combat-dots'
import { COMBAT_TERRAIN_OVERLAY_DETAILS } from './terrain-overlays'
import type { CombatEffectDefinition, CombatEncounterState, CombatStatusInstance } from './actions'
import { PHASE4_STATUSES } from './status-content'
import { isRetiredCombatStatusId } from './retired-combat-statuses'
import { barrierGrantAmount } from './combat-barrier'
import { BLINDSIDE_DEBUFF_STATUS_ID } from './combat-blindside'

export const COMBAT_EFFECT_TIMING_TAGS = [
  ...new Set([
    'damage',
    'reversal',
    'healing',
    'mp-recovery',
    'mp-drain',
    'create-terrain',
    'ground-area',
    'displace',
    'push',
    'pull',
    'poison',
    'burn',
    'bleed',
    'barrier-change',
    'return-to-turn-start',
    'remove-status',
    'copy-statuses',
    'sensory',
    'summon',
    'guarded',
    'lowered-guard',
    'exposed',
    'covert',
    'revealed',
    ...PHASE4_STATUSES.map((status) => status.id).filter((id) => id !== BLINDSIDE_DEBUFF_STATUS_ID),
  ]),
] as readonly string[]
export const CONTROLLED_COMBAT_TIMING_TAGS = COMBAT_EFFECT_TIMING_TAGS.filter(
  (tag) => tag !== 'summon' && tag !== 'ground-area',
) as readonly string[]
export type CombatEffectTimingMode = 'instant' | 'next-round' | 'delayed' | 'controlled'
export function combatEffectTimingRoundOffset(mode: CombatEffectTimingMode): 0 | 1 | 2 {
  if (mode === 'controlled')
    throw new TypeError('Controlled requires a captured Manual release, not a round offset.')
  return mode === 'instant' ? 0 : mode === 'next-round' ? 1 : 2
}
export interface CombatEffectTimingPolicy {
  version: number
  modes: Readonly<Record<string, CombatEffectTimingMode>>
  /** New captures use Master tag timing exclusively; omitted preserves historical packet timing. */
  tagAuthority?: 'global'
}
export function parseCombatEffectTimingPolicy(value: unknown): CombatEffectTimingPolicy {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new TypeError('Timing policy must be an object.')
  const candidate = value as CombatEffectTimingPolicy
  if (
    Object.keys(candidate).some((key) => !['version', 'modes', 'tagAuthority'].includes(key)) ||
    (candidate.tagAuthority !== undefined && candidate.tagAuthority !== 'global') ||
    !Number.isSafeInteger(candidate.version) ||
    candidate.version < 1 ||
    !candidate.modes ||
    typeof candidate.modes !== 'object' ||
    Array.isArray(candidate.modes)
  )
    throw new TypeError('Timing policy version and modes are required.')
  for (const [tag, mode] of Object.entries(candidate.modes)) {
    if (
      !COMBAT_EFFECT_TIMING_TAGS.includes(tag) ||
      (tag === 'reversal' && mode !== 'controlled') ||
      (mode !== 'instant' &&
        mode !== 'next-round' &&
        mode !== 'delayed' &&
        mode !== 'controlled') ||
      (mode === 'controlled' && !CONTROLLED_COMBAT_TIMING_TAGS.includes(tag))
    )
      throw new TypeError('Unknown timing tag or mode.')
  }
  return {
    version: candidate.version,
    modes: { ...candidate.modes },
    ...(candidate.tagAuthority === 'global' ? { tagAuthority: 'global' as const } : {}),
  }
}
export function defaultCombatEffectTimingPolicy(): CombatEffectTimingPolicy {
  return { version: 1, modes: {} }
}
/** Retired timing overrides are inert metadata, not authority to restore retired effects. */
export function parseStoredCombatEffectTimingPolicy(value: unknown): CombatEffectTimingPolicy {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return parseCombatEffectTimingPolicy(value)
  const candidate = value as CombatEffectTimingPolicy
  if (!candidate.modes || typeof candidate.modes !== 'object' || Array.isArray(candidate.modes))
    return parseCombatEffectTimingPolicy(value)
  const entries = Object.entries(candidate.modes)
  for (const [, mode] of entries) {
    if (mode !== 'instant' && mode !== 'next-round' && mode !== 'delayed' && mode !== 'controlled')
      throw new TypeError('Unknown timing mode.')
  }
  const modes = Object.fromEntries(
    entries.filter(([tag]) => tag !== 'copy' && !isRetiredCombatStatusId(tag)),
  )
  return parseCombatEffectTimingPolicy({ ...candidate, modes })
}
export function combatEffectTimingTag(effect: CombatEffectDefinition): string {
  if (effect.type === 'percentage-recovery')
    return effect.resource === 'hp' ? 'healing' : 'mp-recovery'
  if (effect.type === 'apply-status')
    return effect.statusId === BLINDSIDE_DEBUFF_STATUS_ID ? 'blindside' : effect.statusId
  if (effect.type === 'resource-change') return effect.delta >= 0 ? 'mp-recovery' : 'mp-drain'
  return effect.type
}
export function currentCombatEffectTimingTag(effect: CombatEffectDefinition): string {
  return effect.type === 'displace'
    ? effect.direction === 'pull'
      ? 'pull'
      : 'push'
    : combatEffectTimingTag(effect)
}
export function combatActionEffectTimingTag(
  state: Pick<CombatEncounterState, 'displacementPolicyVersion'>,
  effect: CombatEffectDefinition,
  authoredTag?: string,
): string {
  return state.displacementPolicyVersion === 1 &&
    effect.type === 'displace' &&
    (!authoredTag || authoredTag === 'displace')
    ? currentCombatEffectTimingTag(effect)
    : (authoredTag ?? combatEffectTimingTag(effect))
}
export function combatEffectTimingMode(
  policy: CombatEffectTimingPolicy | undefined,
  tag: string,
): CombatEffectTimingMode {
  if (!policy) return 'instant'
  return (
    policy.modes[tag] ??
    (tag === 'push' || tag === 'pull' ? policy.modes.displace : undefined) ??
    (['damage', 'healing', 'mp-recovery', 'blindside', 'endure'].includes(tag)
      ? 'instant'
      : 'next-round')
  )
}
export type CombatRecoveryPresentation =
  | { basis: 'flat'; resource: 'hp' | 'mp'; amountPerApplication: number }
  | {
      basis: 'percentage'
      resource: 'hp' | 'mp'
      percent: number
      capture?: { maximumAtCast: number; amountPerApplication: number }
    }

export type CombatEffectPresentationStatus = CombatStatusInstance & {
  recoveryApplications?: number
  recovery?: CombatRecoveryPresentation
  recoverySkipsCurrentTurnEnd?: true
  barrier?: { kind: 'grant' | 'remaining'; amount: number }
  dotTriggerPolicyVersion?: 1 | 2
  burnBacklashBasisPoints?: number
  percentageDamage?: CapturedPercentageDotDamage
  percentageDotProfile?: AttackPercentageDotProfile
  percentageDotStage?: number
}

/** Presentation only: pending payloads never enter engine status rows. */
export function pendingCombatStatusRows(
  state: Pick<
    CombatEncounterState,
    'pendingEffects' | 'pendingSummons' | 'tactical' | 'dotTriggerPolicyVersion'
  >,
): { combatantId: string; status: CombatEffectPresentationStatus }[] {
  const pendingRows = (state.pendingEffects ?? []).flatMap((pending) => {
    const effect = pending.effect
    const statusId =
      effect.type === 'apply-status'
        ? effect.statusId
        : effect.type === 'barrier-change'
          ? 'barrier'
          : effect.type === 'displace' &&
              (pending.timingTag === 'push' || pending.timingTag === 'pull')
            ? pending.timingTag
            : combatEffectTimingTag(effect)
    const definition = pending.content.statuses.find((status) => status.id === statusId)
    const tuning = effect as typeof effect &
      CombatStatusTuning & {
        durationTurns?: number
        ticks?: number
        potencyBasisPoints?: number
      }
    const remaining =
      (effect.type === 'percentage-recovery' ? (effect.ticks ?? 1) : undefined) ??
      tuning.durationTurns ??
      tuning.ticks ??
      (effect.type === 'burn' ? CURRENT_BURN_DAMAGE_BY_STAGE.length : undefined) ??
      Math.max(1, (definition?.durationOwnerTurnStarts ?? 2) - 1)
    const durationScope =
      (effect.type === 'apply-status' ||
        effect.type === 'endure' ||
        (effect.type === 'barrier-change' && effect.durationTurns !== undefined)) &&
      pending.statusDurationScope === 'rounds'
        ? ('rounds' as const)
        : effect.type === 'poison' && tuning.durationTurns === undefined
          ? ('until-removed' as const)
          : effect.type === 'create-terrain'
            ? ('rounds' as const)
            : [
                  'damage',
                  'healing',
                  'percentage-recovery',
                  'resource-change',
                  'create-terrain',
                  'displace',
                  'return-to-turn-start',
                  'remove-status',
                  'copy-statuses',
                  'sensory',
                ].includes(effect.type)
              ? ('instant' as const)
              : effect.type === 'barrier-change'
                ? ('until-spent' as const)
                : undefined
    const recipients =
      effect.type === 'create-terrain' ||
      (effect.type === 'copy-statuses' && effect.mode === 'amplify')
        ? [pending.actorId]
        : pending.recipientIds
    return recipients.map((combatantId) => {
      const capturedRecovery = pending.percentageRecoveryByRecipient?.[combatantId]
      const recovery: CombatRecoveryPresentation | undefined =
        effect.type === 'percentage-recovery'
          ? {
              basis: 'percentage',
              resource: effect.resource,
              percent: effect.percent,
              ...(capturedRecovery
                ? {
                    capture: {
                      maximumAtCast: capturedRecovery.maximumAtCast,
                      amountPerApplication: capturedRecovery.amountPerApplication,
                    },
                  }
                : {}),
            }
          : effect.type === 'healing'
            ? { basis: 'flat', resource: 'hp', amountPerApplication: effect.amount }
            : effect.type === 'resource-change' && effect.delta >= 0
              ? { basis: 'flat', resource: 'mp', amountPerApplication: effect.delta }
              : undefined
      return {
        combatantId,
        status: {
          statusId,
          ...(state.dotTriggerPolicyVersion !== undefined
            ? { dotTriggerPolicyVersion: state.dotTriggerPolicyVersion }
            : {}),
          ...(effect.type === 'burn' && effect.backlashBasisPoints !== undefined
            ? { burnBacklashBasisPoints: effect.backlashBasisPoints }
            : {}),
          ...((effect.type === 'burn' || effect.type === 'poison' || effect.type === 'bleed') &&
          effect.damageProfile
            ? { percentageDotProfile: { ...effect.damageProfile } }
            : {}),
          statusVersion: definition?.version ?? 1,
          ...(effect.type === 'endure'
            ? {
                endure: {
                  releaseBasisPoints: effect.releaseBasisPoints,
                  radiusTiles: effect.radiusTiles,
                  targetTeams: effect.targetTeams,
                },
              }
            : {}),
          stacks: effect.type === 'apply-status' ? effect.stacks : 1,
          ...(effect.type === 'apply-status' ? combatStatusTuning(tuning) : {}),
          ...(effect.type === 'apply-status' && effect.counter
            ? { counter: { ...effect.counter } }
            : {}),
          ...(effect.type === 'apply-status' && effect.blindsideModifiersBasisPoints !== undefined
            ? { blindsideModifiersBasisPoints: { ...effect.blindsideModifiersBasisPoints } }
            : {}),
          ...(effect.type === 'apply-status' && tuning.potencyBasisPoints !== undefined
            ? { potencyBasisPoints: tuning.potencyBasisPoints }
            : {}),
          sourceCombatantId: pending.actorId,
          remainingOwnerTurnStarts: remaining,
          ...(recovery
            ? { recovery, recoveryApplications: (effect as { ticks?: number }).ticks ?? 1 }
            : {}),
          ...(effect.type === 'barrier-change'
            ? {
                barrier: {
                  kind: 'grant' as const,
                  amount: barrierGrantAmount(state, combatantId, effect),
                },
              }
            : {}),
          ...(durationScope
            ? {
                durationScope,
                ...(effect.type === 'apply-status' ||
                (effect.type === 'barrier-change' && durationScope === 'rounds')
                  ? { remainingRoundBoundaries: remaining, remainingOwnerTurnEnds: remaining }
                  : {}),
                ...(effect.type === 'create-terrain'
                  ? {
                      remainingRoundBoundaries:
                        COMBAT_TERRAIN_OVERLAY_DETAILS[effect.terrain].roundBoundaries,
                    }
                  : {}),
              }
            : { remainingOwnerTurnEnds: remaining }),
          activationRound: pending.activationRound,
          timingState: 'pending' as const,
        },
      }
    })
  })
  return [
    ...pendingRows,
    ...(state.pendingSummons ?? []).map((row) => ({
      combatantId: row.input.ownerCombatantId,
      status: {
        statusId: 'summon',
        statusVersion: 1,
        stacks: 1,
        sourceCombatantId: row.input.ownerCombatantId,
        remainingOwnerTurnStarts: row.input.profile.lifetimeTurns,
        remainingOwnerTurnEnds: row.input.profile.lifetimeTurns,
        activationRound: row.activationRound,
        timingState: 'pending' as const,
      },
    })),
  ]
}

/** Active persistent identities come from committed instances, never the latest authored catalog. */
export function activePersistentCombatStatusRows(
  state: Pick<
    CombatEncounterState,
    'effectState' | 'tactical' | 'terrainOverlays' | 'dotTriggerPolicyVersion'
  >,
): { combatantId: string; status: CombatEffectPresentationStatus }[] {
  const effects = state.effectState
  // Tile effects retain their round lifetime on the source's presentation row.
  const terrainRows = (state.terrainOverlays ?? []).map((overlay) => ({
    combatantId: overlay.sourceCombatantId,
    status: {
      statusId: 'create-terrain',
      statusVersion: 1,
      stacks: 1,
      sourceCombatantId: overlay.sourceCombatantId,
      timingState: 'active' as const,
      durationScope: 'rounds' as const,
      remainingOwnerTurnStarts: 1,
      remainingRoundBoundaries: overlay.remainingRoundBoundaries,
    },
  }))
  if (!effects) return terrainRows
  const rows: { combatantId: string; status: CombatEffectPresentationStatus }[] = []
  function append(
    combatantId: string,
    statusId: string,
    sourceCombatantId: string,
    remaining?: number,
    durationScope?: CombatStatusInstance['durationScope'],
    percentageDamage?: CapturedPercentageDotDamage,
    percentageDotStage?: number,
    burnBacklashBasisPoints?: number,
    recoveryApplications?: number,
    amounts: Pick<
      CombatEffectPresentationStatus,
      'recovery' | 'recoverySkipsCurrentTurnEnd' | 'barrier'
    > = {},
  ) {
    if (!state.tactical.battle.combatants.some((unit) => unit.id === combatantId && unit.hp > 0))
      return
    rows.push({
      combatantId,
      status: {
        statusId,
        ...(state.dotTriggerPolicyVersion !== undefined
          ? { dotTriggerPolicyVersion: state.dotTriggerPolicyVersion }
          : {}),
        ...(burnBacklashBasisPoints !== undefined ? { burnBacklashBasisPoints } : {}),
        statusVersion: 1,
        stacks: 1,
        sourceCombatantId,
        timingState: 'active',
        ...(recoveryApplications !== undefined ? { recoveryApplications } : {}),
        ...amounts,
        ...(percentageDamage
          ? {
              percentageDamage: { ...percentageDamage, profile: { ...percentageDamage.profile } },
              ...(percentageDotStage === undefined ? {} : { percentageDotStage }),
            }
          : {}),
        remainingOwnerTurnStarts: remaining ?? 1,
        ...(remaining === undefined
          ? { durationScope: durationScope ?? 'until-removed' }
          : {
              remainingOwnerTurnEnds: remaining,
              ...(durationScope === 'rounds'
                ? { durationScope, remainingRoundBoundaries: remaining }
                : {}),
            }),
      },
    })
  }
  for (const effect of effects.poison)
    append(
      effect.targetCombatantId,
      'poison',
      effect.sourceCombatantId,
      effect.remainingTicks,
      undefined,
      effect.percentageDamage,
    )
  for (const effect of effects.burn)
    append(
      effect.targetCombatantId,
      'burn',
      effect.sourceCombatantId,
      effect.remainingTicks ?? CURRENT_BURN_DAMAGE_BY_STAGE.length - effect.stage,
      undefined,
      effect.percentageDamage,
      effect.stage,
      effect.backlashBasisPoints,
    )
  for (const effect of effects.bleed)
    append(
      effect.targetCombatantId,
      'bleed',
      effect.sourceCombatantId,
      effect.remainingTicks,
      undefined,
      effect.percentageDamage,
    )
  for (const effect of effects.ongoingRecovery)
    append(
      effect.targetCombatantId,
      effect.kind === 'hp' ? 'healing' : 'mp-recovery',
      effect.sourceCombatantId,
      effect.remainingFutureTicks,
      undefined,
      undefined,
      undefined,
      undefined,
      effect.remainingFutureTicks,
      {
        recovery: effect.percentageRecovery
          ? {
              basis: 'percentage',
              resource: effect.kind,
              percent: effect.percentageRecovery.percent,
              capture: {
                maximumAtCast: effect.percentageRecovery.maximumAtCast,
                amountPerApplication: effect.amountPerTick,
              },
            }
          : { basis: 'flat', resource: effect.kind, amountPerApplication: effect.amountPerTick },
        ...(effect.skipCurrentOwnerTurnEnd ? { recoverySkipsCurrentTurnEnd: true as const } : {}),
      },
    )
  for (const effect of effects.barriers ?? [])
    if (effect.amount > 0)
      append(
        effect.targetCombatantId,
        'barrier',
        effect.sourceCombatantId,
        effect.remainingRoundBoundaries ?? effect.remainingOwnerTurnEnds,
        effect.remainingRoundBoundaries !== undefined
          ? 'rounds'
          : effect.remainingOwnerTurnEnds === undefined
            ? 'until-spent'
            : undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        { barrier: { kind: 'remaining', amount: effect.amount } },
      )
  for (const summon of effects.summons ?? [])
    append(
      summon.combatantId,
      'summon',
      summon.ownerCombatantId,
      summon.profile.lifetimeTurns - summon.turnsCompleted,
    )
  return [...rows, ...terrainRows]
}

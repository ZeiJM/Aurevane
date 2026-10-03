import { CURRENT_BURN_DAMAGE_BY_STAGE } from './combat-dots'
import { COMBAT_TERRAIN_OVERLAY_DETAILS } from './terrain-overlays'
import type { CombatEffectDefinition, CombatEncounterState, CombatStatusInstance } from './actions'
import { PHASE4_STATUSES } from './status-content'

export const COMBAT_EFFECT_TIMING_TAGS = [
  ...new Set([
    'damage',
    'healing',
    'mp-recovery',
    'mp-drain',
    'create-terrain',
    'displace',
    'poison',
    'burn',
    'bleed',
    'barrier-change',
    'return-to-turn-start',
    'remove-status',
    'copy-statuses',
    'copy',
    'sensory',
    'summon',
    'guarded',
    'lowered-guard',
    'exposed',
    'covert',
    'revealed',
    ...PHASE4_STATUSES.map((status) => status.id),
  ]),
] as readonly string[]
export type CombatEffectTimingMode = 'instant' | 'next-round'
export interface CombatEffectTimingPolicy {
  version: number
  modes: Readonly<Record<string, CombatEffectTimingMode>>
}
export function parseCombatEffectTimingPolicy(value: unknown): CombatEffectTimingPolicy {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new TypeError('Timing policy must be an object.')
  const candidate = value as CombatEffectTimingPolicy
  if (
    Object.keys(candidate).some((key) => !['version', 'modes'].includes(key)) ||
    !Number.isSafeInteger(candidate.version) ||
    candidate.version < 1 ||
    !candidate.modes ||
    typeof candidate.modes !== 'object' ||
    Array.isArray(candidate.modes)
  )
    throw new TypeError('Timing policy version and modes are required.')
  for (const [tag, mode] of Object.entries(candidate.modes)) {
    if (!COMBAT_EFFECT_TIMING_TAGS.includes(tag) || (mode !== 'instant' && mode !== 'next-round'))
      throw new TypeError('Unknown timing tag or mode.')
  }
  return { version: candidate.version, modes: { ...candidate.modes } }
}
export function defaultCombatEffectTimingPolicy(): CombatEffectTimingPolicy {
  return { version: 1, modes: {} }
}
export function combatEffectTimingTag(effect: CombatEffectDefinition): string {
  if (effect.type === 'apply-status') return effect.statusId
  if (effect.type === 'resource-change') return effect.delta >= 0 ? 'mp-recovery' : 'mp-drain'
  return effect.type
}
export function combatEffectTimingMode(
  policy: CombatEffectTimingPolicy | undefined,
  tag: string,
): CombatEffectTimingMode {
  if (!policy) return 'instant'
  return (
    policy.modes[tag] ??
    (['damage', 'healing', 'mp-recovery'].includes(tag) ? 'instant' : 'next-round')
  )
}
/** Presentation only: pending payloads never enter engine status rows. */
export function pendingCombatStatusRows(
  state: Pick<
    CombatEncounterState,
    'pendingEffects' | 'pendingSummons' | 'pendingSkillGrants' | 'tactical'
  >,
): { combatantId: string; status: CombatStatusInstance }[] {
  const pendingRows = (state.pendingEffects ?? []).flatMap((pending) => {
    const effect = pending.effect
    const statusId =
      effect.type === 'copy-statuses' && effect.beneficialEffects === true
        ? 'beneficial-copy'
        : effect.type === 'apply-status'
          ? effect.statusId
          : effect.type === 'barrier-change'
            ? 'barrier'
            : combatEffectTimingTag(effect)
    const definition = pending.content.statuses.find((status) => status.id === statusId)
    const tuning = effect as typeof effect & {
      durationTurns?: number
      ticks?: number
      potencyBasisPoints?: number
    }
    const remaining =
      tuning.durationTurns ??
      tuning.ticks ??
      (effect.type === 'burn' ? CURRENT_BURN_DAMAGE_BY_STAGE.length : undefined) ??
      Math.max(1, (definition?.durationOwnerTurnStarts ?? 2) - 1)
    const durationScope =
      effect.type === 'poison' && tuning.durationTurns === undefined
        ? ('until-removed' as const)
        : effect.type === 'create-terrain'
          ? ('rounds' as const)
          : [
                'damage',
                'healing',
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
    return recipients.map((combatantId) => ({
      combatantId,
      status: {
        statusId,
        statusVersion: definition?.version ?? 1,
        stacks: effect.type === 'apply-status' ? effect.stacks : 1,
        ...(effect.type === 'apply-status' && tuning.potencyBasisPoints !== undefined
          ? { potencyBasisPoints: tuning.potencyBasisPoints }
          : {}),
        sourceCombatantId: pending.actorId,
        remainingOwnerTurnStarts: remaining,
        ...(durationScope
          ? {
              durationScope,
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
    }))
  })
  return [
    ...pendingRows,
    ...(state.pendingSkillGrants ?? []).map((row) => ({
      combatantId: row.grant.combatantId,
      status: {
        statusId: 'copy',
        durationScope: 'battle' as const,
        statusVersion: 1,
        stacks: 1,
        sourceCombatantId: row.grant.sourceCombatantId,
        remainingOwnerTurnStarts: 1,
        activationRound: row.activationRound,
        timingState: 'pending' as const,
      },
    })),
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
  state: Pick<CombatEncounterState, 'effectState' | 'tactical' | 'terrainOverlays'>,
): { combatantId: string; status: CombatStatusInstance }[] {
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
  const rows: { combatantId: string; status: CombatStatusInstance }[] = []
  function append(
    combatantId: string,
    statusId: string,
    sourceCombatantId: string,
    remaining?: number,
    durationScope?: CombatStatusInstance['durationScope'],
  ) {
    if (!state.tactical.battle.combatants.some((unit) => unit.id === combatantId && unit.hp > 0))
      return
    rows.push({
      combatantId,
      status: {
        statusId,
        statusVersion: 1,
        stacks: 1,
        sourceCombatantId,
        timingState: 'active',
        remainingOwnerTurnStarts: remaining ?? 1,
        ...(remaining === undefined
          ? { durationScope: durationScope ?? 'until-removed' }
          : { remainingOwnerTurnEnds: remaining }),
      },
    })
  }
  for (const effect of effects.poison)
    append(effect.targetCombatantId, 'poison', effect.sourceCombatantId, effect.remainingTicks)
  for (const effect of effects.burn)
    append(
      effect.targetCombatantId,
      'burn',
      effect.sourceCombatantId,
      effect.remainingTicks ?? CURRENT_BURN_DAMAGE_BY_STAGE.length - effect.stage,
    )
  for (const effect of effects.bleed)
    append(effect.targetCombatantId, 'bleed', effect.sourceCombatantId, effect.remainingTicks)
  for (const effect of effects.ongoingRecovery)
    append(
      effect.targetCombatantId,
      effect.kind === 'hp' ? 'healing' : 'mp-recovery',
      effect.sourceCombatantId,
      effect.remainingFutureTicks,
    )
  for (const effect of effects.barriers ?? [])
    if (effect.amount > 0)
      append(
        effect.targetCombatantId,
        'barrier',
        effect.sourceCombatantId,
        undefined,
        'until-spent',
      )
  for (const grant of effects.temporarySkills)
    append(grant.combatantId, 'copy', grant.sourceCombatantId, undefined, 'battle')
  for (const summon of effects.summons ?? [])
    append(
      summon.combatantId,
      'summon',
      summon.ownerCombatantId,
      summon.profile.lifetimeTurns - summon.turnsCompleted,
    )
  return [...rows, ...terrainRows]
}

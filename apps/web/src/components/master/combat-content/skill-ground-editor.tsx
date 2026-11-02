'use client'
import { CURRENT_EFFECT_DURATION_MAXIMUM_TURNS } from '@aurevane/game-core/combat/combat-effect-duration'
import type { CombatTargetSpec } from '@aurevane/game-core/combat/actions'
import type { AbilityBehavior } from '@aurevane/game-core/combat/combat-definition'
import { canonicalAbilityTargetSpec } from '@aurevane/game-core/combat/combat-targeting-shapes'
import { nativeCombatTagPayload } from '@aurevane/game-core/combat/combat-tag-registry'
import type {
  MatureSkillDefinition,
  MatureSkillEffectDefinition,
} from '@aurevane/game-core/combat/mature-skills'
import {
  combatTargetSupportsGroundArea,
  type CombatGroundAreaDefinition,
} from '@aurevane/game-core/combat/combat-ground-areas'
import {
  groundAreaForEffects,
  groundTargetTeams,
  hasGroundAuthoringEffects,
} from '@/lib/combat-ground-entry-authoring'
export { groundAreaForEffects } from '@/lib/combat-ground-entry-authoring'
import {
  COMBAT_GROUND_VISUAL_PRESETS,
  type GroundVisualPresetId,
} from '@aurevane/game-core/combat/combat-ground-visuals'
import { BattleGroundAreaLayer } from '../../battle/battle-ground-area-layer'
import styles from './combat-content-editor.module.css'

export function SkillGroundEditor({
  target,
  effects,
  value: saved,
  onChange,
  disabled = false,
}: {
  target: CombatTargetSpec
  effects: readonly MatureSkillEffectDefinition[]
  value?: CombatGroundAreaDefinition
  disabled?: boolean
  onChange: (value: CombatGroundAreaDefinition | undefined) => void
}) {
  const available = groundAreaForEffects(effects, saved, target)
  const hasGround = hasGroundAuthoringEffects(target, effects)
  if (hasGround && target.categories?.some((category) => category !== 'ground'))
    return (
      <p role="alert">
        Ground effects need a Ground-only target group. Move independently targeted unit effects
        into a separate group or Skill.
      </p>
    )
  const canEnable = hasGround && combatTargetSupportsGroundArea(target) && Boolean(available)
  if (!canEnable)
    return saved ? (
      <div role="alert">
        Saved Ground settings need a supported Ground-targeted effect. Restore its target or{' '}
        <button type="button" disabled={disabled} onClick={() => onChange(undefined)}>
          remove obsolete Ground settings
        </button>
        .
      </div>
    ) : null
  const value = saved ?? available!
  const scope = value.targetTeams ?? groundTargetTeams(target)
  return (
    <fieldset className={styles.typedGroup} disabled={disabled}>
      <legend>Ground</legend>
      {value ? (
        <>
          <div className={styles.typedGrid}>
            <label className={styles.field}>
              <span>Affects</span>
              <select
                aria-label="Ground affects"
                value={scope ?? ''}
                onChange={(event) =>
                  onChange({
                    ...value,
                    targetTeams: event.currentTarget.value as NonNullable<
                      CombatGroundAreaDefinition['targetTeams']
                    >,
                  })
                }
              >
                {!scope ? (
                  <option value="" disabled>
                    Choose affected units
                  </option>
                ) : null}
                <option value="all">Everyone</option>
                <option value="all-except-self">Everyone except caster</option>
                <option value="enemies">Enemies</option>
                <option value="allies">Allies (including caster)</option>
                <option value="allies-except-self">Allies except caster</option>
                <option value="self">Caster only</option>
              </select>
            </label>
            <label className={styles.field}>
              <span>Duration (rounds)</span>
              <input
                type="number"
                min={1}
                max={CURRENT_EFFECT_DURATION_MAXIMUM_TURNS}
                step={1}
                aria-label="Ground duration (rounds)"
                value={value.durationRounds}
                onChange={(event) => {
                  const n = Number(event.currentTarget.value)
                  if (
                    Number.isSafeInteger(n) &&
                    n >= 1 &&
                    n <= CURRENT_EFFECT_DURATION_MAXIMUM_TURNS
                  )
                    onChange({ ...value, durationRounds: n })
                }}
              />
            </label>
            <label className={styles.field}>
              <span>Animation</span>
              <select
                aria-label="Ground animation"
                value={value.visualPresetId}
                onChange={(event) =>
                  onChange({
                    ...value,
                    visualPresetId: event.currentTarget.value as GroundVisualPresetId,
                  })
                }
              >
                {COMBAT_GROUND_VISUAL_PRESETS.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div
            style={{
              position: 'relative',
              width: 112,
              height: 72,
              borderRadius: 8,
              background: '#101a20',
            }}
            aria-label="Ground animation preview"
          >
            <BattleGroundAreaLayer
              areas={[
                {
                  id: 'master.preview',
                  tiles: [{ x: 0, y: 0 }],
                  activationRound: 1,
                  expiresAtRound: 1 + value.durationRounds,
                  visualPresetId: value.visualPresetId,
                },
              ]}
              round={1}
              position={{ x: 0, y: 0 }}
            />
          </div>
          <p className={styles.fieldHint}>
            {value.timing && value.timing !== 'instant'
              ? 'The field follows its authored placement timing.'
              : 'The field starts when cast.'}{' '}
            Active tiles apply their effects on contact. Each character can receive each effect type
            once during its own turn cycle, including overlapping fields. Source-only effects keep
            their ordinary targets.
          </p>
        </>
      ) : null}
    </fieldset>
  )
}

/** Canonical groups reuse the native controls; only the stable-ID/ordinal boundary differs. */
export function AbilityGroundEditor({
  value,
  onChange,
  disabled = false,
}: {
  value: AbilityBehavior
  disabled?: boolean
  onChange: (value: AbilityBehavior) => void
}) {
  if (!value.targeting || value.mode !== 'action') {
    if (!value.groundArea) return null
    return (
      <fieldset className={styles.typedGroup} disabled={disabled}>
        <legend>Persistent ground effect</legend>
        <p role="alert">
          Ground areas need action targeting. Disable this area or restore its action target.
        </p>
        <button
          type="button"
          onClick={() => {
            const next = { ...value }
            delete next.groundArea
            onChange(next)
          }}
        >
          Disable persistent ground effect
        </button>
      </fieldset>
    )
  }
  const target = canonicalAbilityTargetSpec(value.targeting)
  if (!combatTargetSupportsGroundArea(target) && !value.groundArea) return null
  const entries = value.effects.filter(
    (effect) => !['move', 'summon', 'damage-bonus'].includes(effect.payload.type),
  )
  const effects = entries.map((effect) => nativeCombatTagPayload(effect.payload))
  const area = value.groundArea
  return (
    <SkillGroundEditor
      disabled={disabled}
      target={target}
      effects={effects}
      value={
        area
          ? {
              durationRounds: area.durationRounds,
              visualPresetId: area.visualPresetId,
              ...(area.timing ? { timing: area.timing } : {}),
              ...(area.contactPolicyVersion
                ? { contactPolicyVersion: area.contactPolicyVersion }
                : {}),
              ...(area.placementTimingVersion
                ? { placementTimingVersion: area.placementTimingVersion }
                : {}),
              ...(area.targetTeams ? { targetTeams: area.targetTeams } : {}),
              entryEffectOrdinals: area.entryEffectIds.map((id) =>
                entries.findIndex((effect) => effect.id === id),
              ),
            }
          : undefined
      }
      onChange={(ground) => {
        const next = { ...value }
        if (ground)
          next.groundArea = {
            ...area,
            durationRounds: ground.durationRounds,
            visualPresetId: ground.visualPresetId,
            ...(ground.timing ? { timing: ground.timing } : {}),
            contactPolicyVersion: area?.contactPolicyVersion ?? 1,
            placementTimingVersion: area?.placementTimingVersion ?? 1,
            ...(ground.targetTeams ? { targetTeams: ground.targetTeams } : {}),
            entryEffectIds: ground.entryEffectOrdinals.flatMap((ordinal, index) =>
              entries[ordinal]
                ? [entries[ordinal]!.id]
                : area?.entryEffectIds[index]
                  ? [area.entryEffectIds[index]!]
                  : [],
            ),
          }
        else delete next.groundArea
        onChange(next)
      }}
    />
  )
}

export function withSkillGroundArea(
  skill: MatureSkillDefinition,
  value: CombatGroundAreaDefinition | undefined,
): MatureSkillDefinition {
  const next = {
    ...skill,
    authoring: {
      ...skill.authoring,
      validationTags: skill.authoring.validationTags.filter(
        (tag) => tag !== 'persistent-ground-areas',
      ),
    },
  }
  if (value) {
    next.groundArea = value
    next.authoring.validationTags.push('persistent-ground-areas')
  } else delete next.groundArea
  return next
}

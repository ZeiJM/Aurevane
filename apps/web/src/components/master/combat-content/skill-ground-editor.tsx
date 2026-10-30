'use client'
import type { CombatTargetSpec } from '@aurevane/game-core/combat/actions'
import type { AbilityBehavior } from '@aurevane/game-core/combat/combat-definition'
import { canonicalAbilityTargetSpec } from '@aurevane/game-core/combat/combat-targeting-shapes'
import { nativeCombatTagPayload } from '@aurevane/game-core/combat/combat-tag-registry'
import type {
  MatureSkillDefinition,
  MatureSkillEffectDefinition,
} from '@aurevane/game-core/combat/mature-skills'
import {
  isCombatGroundEntryEffect,
  combatTargetSupportsGroundArea,
  type CombatGroundAreaDefinition,
} from '@aurevane/game-core/combat/combat-ground-areas'
import {
  COMBAT_GROUND_VISUAL_PRESETS,
  type GroundVisualPresetId,
} from '@aurevane/game-core/combat/combat-ground-visuals'
import { BattleGroundAreaLayer } from '../../battle/battle-ground-area-layer'
import styles from './combat-content-editor.module.css'

/** Keep effect edits aligned; actor-only buffs and terrain/summon operations never repeat on entry. */
export function groundAreaForEffects(
  effects: readonly MatureSkillEffectDefinition[],
  current?: CombatGroundAreaDefinition,
): CombatGroundAreaDefinition | undefined {
  const entryEffectOrdinals = effects.flatMap((effect, index) =>
    isCombatGroundEntryEffect(effect) ? [index] : [],
  )
  return entryEffectOrdinals.length
    ? {
        durationRounds: current?.durationRounds ?? 2,
        visualPresetId: current?.visualPresetId ?? 'arcane-pulse',
        ...(current?.timing ? { timing: current.timing } : {}),
        entryEffectOrdinals,
      }
    : undefined
}
export function SkillGroundEditor({
  target,
  effects,
  value,
  onChange,
  disabled = false,
}: {
  target: CombatTargetSpec
  effects: readonly MatureSkillEffectDefinition[]
  value?: CombatGroundAreaDefinition
  disabled?: boolean
  onChange: (value: CombatGroundAreaDefinition | undefined) => void
}) {
  const available = groundAreaForEffects(effects, value)
  const canEnable = combatTargetSupportsGroundArea(target) && Boolean(available)
  if (!canEnable && !value) return null
  return (
    <fieldset className={styles.typedGroup} disabled={disabled}>
      <legend>Persistent ground effect</legend>
      {!canEnable ? (
        <p role="alert">
          Ground areas need Ground targeting and a supported unit effect. Disable this area or
          restore its target and effects.
        </p>
      ) : null}
      <label className={styles.field}>
        <span>Apply effects when units enter the affected tiles</span>
        <input
          type="checkbox"
          aria-label="Persistent ground effect"
          checked={Boolean(value)}
          onChange={(event) =>
            onChange(event.currentTarget.checked && canEnable ? available : undefined)
          }
        />
      </label>
      {value ? (
        <>
          <div className={styles.typedGrid}>
            <label className={styles.field}>
              <span>Duration (rounds)</span>
              <input
                type="number"
                min={1}
                max={4}
                step={1}
                aria-label="Ground duration (rounds)"
                value={value.durationRounds}
                onChange={(event) => {
                  const n = Number(event.currentTarget.value)
                  if (Number.isSafeInteger(n) && n >= 1 && n <= 4)
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
            The cast affects units on the selected tiles. Each area can apply its unit effects once
            per character’s turn when that character enters it. Caster buffs, summons and terrain
            creation are not repeated.
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
    (effect) => !['move', 'summon', 'damage-bonus', 'pierce'].includes(effect.payload.type),
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
            durationRounds: ground.durationRounds,
            visualPresetId: ground.visualPresetId,
            ...(ground.timing ? { timing: ground.timing } : {}),
            entryEffectIds: ground.entryEffectOrdinals.flatMap((ordinal) =>
              entries[ordinal] ? [entries[ordinal]!.id] : [],
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

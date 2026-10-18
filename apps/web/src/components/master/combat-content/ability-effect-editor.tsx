'use client'

import type { AbilityBehavior, AbilityEffect } from '@aurevane/game-core/combat/combat-definition'
import {
  combatTagDefinition,
  nativeCombatTagPayload,
  type CombatTagPayload,
} from '@aurevane/game-core/combat/combat-tag-registry'
import { latestEnabledMatureSkills } from '@aurevane/game-core/combat/mature-skills'
import { createDefaultCombatEffect } from './skill-effect-list-editor'
import { SkillEffectEditor } from './skill-effect-editor'
import { SummonProfileEditor } from './summon-profile-editor'
import { AbilityNumber, AbilitySelect } from './ability-editor-fields'
import { AbilityRequirementEditor } from './ability-requirement-editor'
import styles from './combat-content-editor.module.css'

/** Authoring templates, never inferred from prose or sent directly as combat actions. */
export function defaultAbilityPayload(type: CombatTagPayload['type']): CombatTagPayload {
  if (type === 'move') return { type, recipient: 'actor', maximumTiles: 1 }
  if (type === 'damage-bonus') return { type, recipient: 'actor', multiplierBasisPoints: 11250 }
  if (type === 'pierce')
    return { type, recipient: 'primary-unit', amount: 1, armorIgnoredBasisPoints: 2500 }
  if (type === 'summon') {
    const profile = latestEnabledMatureSkills().find((skill) => skill.summonProfile)?.summonProfile
    if (!profile) throw new Error('No supported Summon template is available.')
    return { type, recipient: 'selected-tile', profile: structuredClone(profile) }
  }
  const effect = createDefaultCombatEffect(type)
  if (effect.type === 'percentage-recovery') {
    const { percent, ...rest } = effect
    return { ...rest, percentageBasisPoints: percent * 100 }
  }
  if (effect.type === 'damage' || effect.type === 'healing') return { ...effect, amount: 1 }
  return effect
}

export function AbilityEffectEditor({
  value,
  behavior,
  onChange,
}: {
  value: AbilityEffect
  behavior: AbilityBehavior
  onChange: (value: AbilityEffect) => void
}) {
  const payload = value.payload
  const tag = combatTagDefinition(payload.type)
  const timing = tag?.timing.filter(
    (mode) =>
      mode !== 'controlled' ||
      (behavior.activation === 'manual' &&
        behavior.mode === 'action' &&
        !behavior.effects.some((effect) => effect.payload.type === 'summon')),
  )
  const update = (next: CombatTagPayload) => onChange({ ...value, payload: next })
  let controls
  if (payload.type === 'move') {
    controls = (
      <>
        <AbilityNumber
          label="Move maximum tiles"
          value={payload.maximumTiles}
          min={1}
          max={20}
          onChange={(maximumTiles) => update({ ...payload, maximumTiles })}
        />
        <p className={styles.fieldHint}>
          Attached Move is included in the Skill cost. Legal terrain, remaining Movement, Jump,
          occupancy and Root still apply. Basic Move retains its own execution price.
        </p>
      </>
    )
  } else if (payload.type === 'damage-bonus') {
    controls = (
      <AbilityNumber
        label="Outgoing damage bonus (%)"
        value={(payload.multiplierBasisPoints - 10000) / 100}
        step={0.01}
        onChange={(percent) =>
          update({ ...payload, multiplierBasisPoints: 10000 + Math.round(percent * 100) })
        }
      />
    )
  } else if (payload.type === 'summon') {
    controls = (
      <SummonProfileEditor
        canonical
        value={payload.profile}
        onChange={(profile) => update({ ...payload, profile })}
      />
    )
  } else {
    const native = nativeCombatTagPayload(payload)
    controls = (
      <>
        {payload.type === 'pierce' ? (
          <AbilityNumber
            label="Equipment Armor ignored (%)"
            value={payload.armorIgnoredBasisPoints / 100}
            max={100}
            step={0.01}
            onChange={(percent) =>
              update({ ...payload, armorIgnoredBasisPoints: Math.round(percent * 100) })
            }
          />
        ) : null}
        <SkillEffectEditor
          value={native}
          canonicalDamage={
            payload.type === 'damage' || payload.type === 'pierce' ? payload.type : undefined
          }
          onChange={(next) => {
            if (next.type === 'percentage-recovery') {
              const { percent, ...rest } = next
              update({ ...rest, percentageBasisPoints: percent * 100 })
            } else if (payload.type === 'pierce' && next.type === 'damage') {
              const { piercing: _piercing, vengeance: _vengeance, ...rest } = next
              void _piercing
              void _vengeance
              update({
                ...rest,
                type: 'pierce',
                armorIgnoredBasisPoints: payload.armorIgnoredBasisPoints,
              })
            } else if (next.type === 'damage') {
              const { piercing: _piercing, ...rest } = next
              void _piercing
              update(rest)
            } else update(next)
          }}
        />
      </>
    )
  }
  return (
    <div className={styles.effectList}>
      <AbilitySelect
        label="Effect timing"
        value={value.timing ?? 'default'}
        options={['default', ...(timing ?? [])]}
        onChange={(mode) => {
          const next = { ...value }
          if (mode === 'default') delete next.timing
          else next.timing = mode
          onChange(next)
        }}
      />
      {controls}
      <AbilityRequirementEditor
        label="Effect condition"
        value={value.requirements ?? null}
        onChange={(requirements) => onChange({ ...value, requirements })}
      />
      <p className={styles.fieldHint}>{tag?.fullExplanation}</p>
    </div>
  )
}

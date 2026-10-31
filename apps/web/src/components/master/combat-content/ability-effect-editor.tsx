'use client'

import type { AbilityBehavior, AbilityEffect } from '@aurevane/game-core/combat/combat-definition'
import {
  nativeCombatTagPayload,
  type CombatTagPayload,
} from '@aurevane/game-core/combat/combat-tag-registry'
import { latestEnabledMatureSkills } from '@aurevane/game-core/combat/mature-skills'
import { createDefaultCombatEffect } from './skill-effect-list-editor'
import { SkillEffectEditor } from './skill-effect-editor'
import { currentTagForAuthoring } from '@/lib/combat-current-tag-authoring'
import { SummonProfileEditor } from './summon-profile-editor'
import { AbilityNumber } from './ability-editor-fields'
import { EffectTargetEditor } from './effect-target-editor'
import { withAuthoredEffectTarget } from '@aurevane/game-core/combat/combat-effect-target-authoring'
import styles from './combat-content-editor.module.css'

/** Authoring templates, never inferred from prose or sent directly as combat actions. */
export function defaultAbilityPayload(
  type: CombatTagPayload['type'] | 'conditional-cleanse',
): CombatTagPayload {
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
  onChange,
  behavior,
}: {
  value: AbilityEffect
  behavior?: AbilityBehavior
  onChange: (value: AbilityEffect) => void
}) {
  const payload = currentTagForAuthoring(value.payload)
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
      </>
    )
  } else if (payload.type === 'damage-bonus') {
    controls = (
      <AbilityNumber
        label="Damage Up (%)"
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
          hideTarget
          value={native}
          canonicalDamage={
            payload.type === 'damage' || payload.type === 'pierce' ? payload.type : undefined
          }
          onChange={(next) => {
            if (next.type === 'percentage-recovery') {
              const { percent, ...rest } = next
              update({ ...rest, percentageBasisPoints: percent * 100 })
            } else if (payload.type === 'pierce' && next.type === 'damage') {
              const {
                piercing: _piercing,
                vengeance: _vengeance,
                shattersBarrier: _barrier,
                element: _element,
                ...rest
              } = next
              void _piercing
              void _vengeance
              void _barrier
              void _element
              update({
                ...rest,
                type: 'pierce',
                armorIgnoredBasisPoints: payload.armorIgnoredBasisPoints,
              })
            } else if (next.type === 'damage') {
              const { piercing: _piercing, shattersBarrier: _barrier, ...rest } = next
              void _piercing
              void _barrier
              update(rest)
            } else update(next)
          }}
        />
      </>
    )
  }
  return (
    <div className={styles.effectParameters}>
      {!['weak-point', 'spike', 'ruin', 'endure', 'reversal'].includes(payload.type) ? (
        <EffectTargetEditor
          value={payload}
          aim={behavior?.targeting ?? undefined}
          siblings={behavior?.effects.map((row) => row.payload)}
          onChange={(target) => update(withAuthoredEffectTarget(payload, target))}
        />
      ) : null}
      {controls}
    </div>
  )
}

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
import { AbilityNumber } from './ability-editor-fields'
import { AbilityRequirementEditor } from './ability-requirement-editor'
import {
  createSimpleRequirement,
  readSimpleRequirement,
  simpleEffectRequirementSubjects,
} from '@aurevane/game-core/combat/combat-simple-requirements'
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

/** Keep the visible Target bound to an executable child-geometry role after retargeting. */
export function rebindSimpleEffectRequirement(
  value: AbilityEffect,
  behavior?: AbilityBehavior,
): AbilityEffect {
  const selection = readSimpleRequirement(value.requirements ?? null)
  const allowed = effectSubjects(value.payload, behavior)
  if (!selection || selection.tagId === 'none' || allowed.includes(selection.subject)) return value
  return {
    ...value,
    requirements: allowed.length
      ? createSimpleRequirement(
          selection.tagId,
          allowed.find((subject) => subject !== 'owner') ?? 'owner',
          selection.percent ?? 50,
        )
      : null,
  }
}
function effectSubjects(payload: CombatTagPayload, behavior?: AbilityBehavior) {
  return behavior
    ? simpleEffectRequirementSubjects(behavior, payload)
    : payload.recipient === 'affected-units'
      ? (['owner', 'affected'] as const)
      : payload.recipient === 'actor' || payload.recipient === 'primary-unit'
        ? (['owner', 'selected'] as const)
        : (['owner'] as const)
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
  const payload = value.payload
  const tag = combatTagDefinition(payload.type)
  const allowedSubjects = effectSubjects(payload, behavior)
  const update = (next: CombatTagPayload) =>
    onChange(rebindSimpleEffectRequirement({ ...value, payload: next }, behavior))
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
              const {
                piercing: _piercing,
                vengeance: _vengeance,
                shattersBarrier: _barrier,
                ...rest
              } = next
              void _piercing
              void _vengeance
              void _barrier
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
    <div className={styles.effectList}>
      {controls}
      {allowedSubjects.length ? (
        <AbilityRequirementEditor
          label="Effect condition"
          simple={readSimpleRequirement(value.requirements ?? null) !== null}
          allowedSubjects={allowedSubjects}
          value={value.requirements ?? null}
          onChange={(requirements) => onChange({ ...value, requirements })}
        />
      ) : (
        <p className={styles.fieldHint}>
          This tile effect has no separate condition. Use the group Requirement.
        </p>
      )}
      <p className={styles.fieldHint}>{tag?.fullExplanation}</p>
    </div>
  )
}

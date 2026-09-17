'use client'

import type { CombatEffectDefinition } from '@aurevane/game-core/combat/actions'
import { useState } from 'react'

import styles from './combat-content-editor.module.css'
import { SkillEffectEditor } from './skill-effect-editor'

export type CombatEffectType = CombatEffectDefinition['type']

const EFFECT_TYPES: readonly { value: CombatEffectType; label: string }[] = [
  { value: 'damage', label: 'Damage' },
  { value: 'healing', label: 'Healing' },
  { value: 'resource-change', label: 'MP change' },
  { value: 'apply-status', label: 'Apply status' },
  { value: 'remove-status', label: 'Remove status' },
  { value: 'return-to-turn-start', label: 'Return to turn start' },
  { value: 'create-terrain', label: 'Create Frozen terrain' },
  { value: 'displace', label: 'Displace' },
  { value: 'poison', label: 'Poison' },
  { value: 'bleed', label: 'Bleed' },
  { value: 'burn', label: 'Burn' },
  { value: 'barrier-change', label: 'Barrier' },
  { value: 'copy-statuses', label: 'Amplify / Curse status copy' },
  { value: 'sensory', label: 'Sensory / Revealed' },
]

function assertNever(value: never): never {
  throw new TypeError(`Unsupported combat effect type: ${String(value)}`)
}

export function createDefaultCombatEffect(type: CombatEffectType): CombatEffectDefinition {
  switch (type) {
    case 'damage':
      return { type, recipient: 'primary-unit', amount: 0 }
    case 'healing':
      return { type, recipient: 'actor', amount: 0, ticks: 1 }
    case 'resource-change':
      return { type, recipient: 'actor', resource: 'mp', delta: 0, ticks: 1 }
    case 'apply-status':
      return { type, recipient: 'primary-unit', statusId: 'guarded', stacks: 1 }
    case 'remove-status':
      return { type, recipient: 'primary-unit', statusIds: ['burn'] }
    case 'return-to-turn-start':
      return { type, recipient: 'actor' }
    case 'create-terrain':
      return { type, recipient: 'affected-tiles', terrain: 'frozen' }
    case 'displace':
      return { type, recipient: 'primary-unit', direction: 'push', distance: 1 }
    case 'poison':
      return { type, recipient: 'primary-unit' }
    case 'bleed':
      return { type, recipient: 'primary-unit', damagePerTick: 1, ticks: 1 }
    case 'burn':
      return { type, recipient: 'primary-unit' }
    case 'barrier-change':
      return { type, recipient: 'actor', amount: 1 }
    case 'copy-statuses':
      return { type, recipient: 'primary-unit', mode: 'amplify' }
    case 'sensory':
      return { type, recipient: 'primary-unit', revealedDurationOwnerTurnStarts: 2 }
    default:
      return assertNever(type)
  }
}

export function appendCombatEffect(
  effects: readonly CombatEffectDefinition[],
  type: CombatEffectType,
): readonly CombatEffectDefinition[] {
  return [...effects, createDefaultCombatEffect(type)]
}

export function removeCombatEffect(
  effects: readonly CombatEffectDefinition[],
  index: number,
): readonly CombatEffectDefinition[] {
  return effects.filter((_, effectIndex) => effectIndex !== index)
}

export function moveCombatEffect(
  effects: readonly CombatEffectDefinition[],
  index: number,
  direction: 'up' | 'down',
): readonly CombatEffectDefinition[] {
  const nextIndex = direction === 'up' ? index - 1 : index + 1
  if (index < 0 || index >= effects.length || nextIndex < 0 || nextIndex >= effects.length) {
    return [...effects]
  }
  const next = [...effects]
  const current = next[index]!
  next[index] = next[nextIndex]!
  next[nextIndex] = current
  return next
}

export interface SkillEffectListEditorProps {
  readonly value: readonly CombatEffectDefinition[]
  readonly onChange: (next: readonly CombatEffectDefinition[]) => void
}

export function SkillEffectListEditor({ value, onChange }: SkillEffectListEditorProps) {
  const [newEffectType, setNewEffectType] = useState<CombatEffectType>('damage')

  return (
    <fieldset className={styles.typedGroup}>
      <legend>Ordered effects</legend>

      <div
        className={styles.effectList}
        data-effect-sequence={value.map((effect) => effect.type).join('|')}
      >
        {value.map((effect, index) => (
          <article className={styles.effectCard} key={`${index}:${effect.type}`}>
            <header className={styles.effectHeader}>
              <div>
                <span className={styles.effectOrdinal}>Effect {index + 1}</span>
                <strong>{EFFECT_TYPES.find((entry) => entry.value === effect.type)?.label}</strong>
              </div>
              <div className={styles.effectActions}>
                <button
                  type="button"
                  disabled={index === 0}
                  onClick={() => onChange(moveCombatEffect(value, index, 'up'))}
                >
                  ↑ Up
                </button>
                <button
                  type="button"
                  disabled={index === value.length - 1}
                  onClick={() => onChange(moveCombatEffect(value, index, 'down'))}
                >
                  ↓ Down
                </button>
                <button type="button" onClick={() => onChange(removeCombatEffect(value, index))}>
                  Remove
                </button>
              </div>
            </header>
            <SkillEffectEditor
              value={effect}
              onChange={(nextEffect) =>
                onChange(value.map((candidate, effectIndex) => (effectIndex === index ? nextEffect : candidate)))
              }
            />
          </article>
        ))}
      </div>

      <div className={styles.effectAdd}>
        <label className={styles.field}>
          <span>New effect type</span>
          <select
            aria-label="New effect type"
            value={newEffectType}
            onChange={(event) => setNewEffectType(event.currentTarget.value as CombatEffectType)}
          >
            {EFFECT_TYPES.map((entry) => (
              <option key={entry.value} value={entry.value}>
                {entry.label}
              </option>
            ))}
          </select>
        </label>
        <button type="button" onClick={() => onChange(appendCombatEffect(value, newEffectType))}>
          Add effect
        </button>
      </div>

      <p className={styles.effectNote}>
        Effect order is authoritative. Validation catches composition rules such as status Copy
        placement, Sensory targeting, and Rewind self-only requirements.
      </p>
    </fieldset>
  )
}

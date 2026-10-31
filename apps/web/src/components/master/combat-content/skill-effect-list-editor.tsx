'use client'

import type { CombatEffectDefinition, CombatTargetSpec } from '@aurevane/game-core/combat/actions'
import { useState } from 'react'
import {
  reconcileAuthoredEffectDependencies,
  authoredReversalCombinationIssue,
} from '@/lib/combat-effect-dependencies'
import { reconcileEffectRowIdentity, type EffectRowIdentity } from './effect-row-identity'
import { currentTagForAuthoring } from '@/lib/combat-current-tag-authoring'
import { withAuthoredAreaRecipients } from '@aurevane/game-core/combat/combat-effect-target-authoring'
import { nativeCombatTagPayload } from '@aurevane/game-core/combat/combat-tag-registry'
import {
  effectAuthoringTag,
  createAuthorableEffectPayload,
} from '@aurevane/game-core/combat/combat-effect-authoring'
import { EffectTagPicker } from './effect-tag-picker'

import { inheritedEffectTargetLabel } from './effect-target-editor'
import styles from './combat-content-editor.module.css'
import { SkillEffectEditor } from './skill-effect-editor'

export type CombatEffectType =
  | CombatEffectDefinition['type']
  | 'push'
  | 'pull'
  | 'blindside'
  | 'cleanse-chilled'
  | 'conditional-cleanse'

function assertNever(value: never): never {
  throw new TypeError(`Unsupported combat effect type: ${String(value)}`)
}

export function createDefaultCombatEffect(type: CombatEffectType): CombatEffectDefinition {
  switch (type) {
    case 'blindside':
      return {
        type: 'apply-status',
        recipient: 'actor',
        statusId: 'blindside',
        stacks: 1,
        durationTurns: 1,
      }
    case 'reversal':
      return {
        type,
        recipient: 'actor',
        target: 'self',
        version: 1,
        family: 'physical',
        reflectionBasisPoints: 10000,
        attackerMaxHpCapBasisPoints: 2000,
        defenderMaxHpCapBasisPoints: 2500,
      }
    case 'endure':
      return {
        type,
        recipient: 'actor',
        target: 'self',
        durationTurns: 2,
        releaseBasisPoints: 15000,
        radiusTiles: 3,
        targetTeams: 'enemies',
      }
    case 'weak-point':
      return { type, recipient: 'actor', debuffThreshold: 2 }
    case 'spike':
      return { type, recipient: 'actor' }
    case 'ruin':
      return { type, recipient: 'actor', bonusPerDebuffBasisPoints: 1000 }
    case 'damage':
      return { type, recipient: 'primary-unit', amount: 0 }
    case 'percentage-recovery':
      return { type, recipient: 'actor', resource: 'hp', percent: 10, ticks: 1 }
    case 'healing':
      return { type, recipient: 'actor', amount: 0, ticks: 1 }
    case 'resource-change':
      return { type, recipient: 'actor', resource: 'mp', delta: 0, ticks: 1 }
    case 'apply-status':
      return { type, recipient: 'primary-unit', statusId: 'guarded', stacks: 1 }
    case 'cleanse-chilled':
      return { type: 'remove-status', recipient: 'actor', statusIds: ['frozen'] }
    case 'conditional-cleanse':
      return {
        type: 'remove-status',
        recipient: 'primary-unit',
        statusIds: ['burn'],
        removalMode: 'specified',
      }
    case 'remove-status':
      return nativeCombatTagPayload(createAuthorableEffectPayload('cleanse')!)
    case 'return-to-turn-start':
      return { type, recipient: 'actor', anchorMode: 'cast-position' }
    case 'create-terrain':
      return nativeCombatTagPayload(createAuthorableEffectPayload('freeze-ground')!)
    case 'push':
    case 'pull':
      return { type: 'displace', recipient: 'primary-unit', direction: type, distance: 1 }
    case 'displace':
      return { type, recipient: 'primary-unit', direction: 'push', distance: 1 }
    case 'poison':
      return {
        type,
        recipient: 'primary-unit',
        durationTurns: 4,
        damageProfile: { kind: 'attack-percentage', basisPoints: 1500 },
      }
    case 'bleed':
      return {
        type,
        recipient: 'primary-unit',
        ticks: 3,
        durationTurns: 3,
        damageProfile: { kind: 'attack-percentage', basisPoints: 2000 },
      }
    case 'burn':
      return {
        type,
        recipient: 'primary-unit',
        durationTurns: 3,
        damageProfile: {
          kind: 'attack-percentage',
          basisPoints: 2500,
          decayBasisPointsPerTick: 500,
        },
      }
    case 'barrier-change':
      return { type, recipient: 'actor', amount: 1, basis: 'maximum-hp-percent', durationTurns: 2 }
    case 'copy-statuses':
      return nativeCombatTagPayload(createAuthorableEffectPayload('copy-buffs')!)
    case 'sensory':
      return nativeCombatTagPayload(createAuthorableEffectPayload('reveal')!)
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

function alignedEffectDescriptions(
  effects: readonly CombatEffectDefinition[],
  descriptions: readonly (string | null)[] | undefined,
): (string | null)[] {
  return effects.map((_, index) => descriptions?.[index] ?? null)
}

export function moveCombatEffectDescription(
  descriptions: readonly (string | null)[],
  index: number,
  direction: 'up' | 'down',
): readonly (string | null)[] {
  const nextIndex = direction === 'up' ? index - 1 : index + 1
  if (
    index < 0 ||
    index >= descriptions.length ||
    nextIndex < 0 ||
    nextIndex >= descriptions.length
  ) {
    return [...descriptions]
  }
  const next = [...descriptions]
  const current = next[index] ?? null
  next[index] = next[nextIndex] ?? null
  next[nextIndex] = current
  return next
}

export interface SkillEffectListEditorProps {
  readonly aim?: CombatTargetSpec
  readonly canonicalDamage?: boolean
  readonly allowReversal?: boolean
  readonly value: readonly CombatEffectDefinition[]
  readonly effectDescriptions?: readonly (string | null)[]
  readonly maxEffects?: number
  readonly onChange: (
    nextEffects: readonly CombatEffectDefinition[],
    nextDescriptions: readonly (string | null)[],
  ) => void
}

export function SkillEffectListEditor({
  value,
  aim,
  effectDescriptions,
  maxEffects,
  canonicalDamage = false,
  allowReversal = false,
  onChange: update,
}: SkillEffectListEditorProps) {
  const onChange: SkillEffectListEditorProps['onChange'] = (proposed, notes) => {
    const sourceIndices = new Map(proposed.map((effect, index) => [effect, index]))
    const effects = reconcileAuthoredEffectDependencies(value, proposed, {
      onLinked: (source, linked) => {
        const index = sourceIndices.get(source)
        if (index !== undefined) sourceIndices.set(linked, index)
      },
    })
    update(
      effects,
      effects.map((effect) => {
        const index = sourceIndices.get(effect) ?? -1
        return index < 0 ? null : (notes[index] ?? null)
      }),
    )
  }
  const [rowIdentity, setRowIdentity] = useState<EffectRowIdentity<CombatEffectDefinition>>({
    value,
    keys: value.map((_, index) => index),
    next: value.length,
  })
  const rows =
    rowIdentity.value === value ? rowIdentity : reconcileEffectRowIdentity(rowIdentity, value)
  if (rows !== rowIdentity) setRowIdentity(rows)
  const alignedDescriptions = alignedEffectDescriptions(value, effectDescriptions)

  return (
    <fieldset className={styles.typedGroup}>
      <legend>Effects</legend>

      <div
        className={styles.effectList}
        data-effect-sequence={value.map((effect) => effect.type).join('|')}
      >
        {value.map((effect, index) => (
          <article className={styles.effectCard} key={rows.keys[index]}>
            <header className={styles.effectHeader}>
              <div>
                <span className={styles.effectOrdinal}>Effect {index + 1}</span>
                <strong>{effectAuthoringTag(currentTagForAuthoring(effect)).label}</strong>
                <span className={styles.effectTarget}>
                  [{inheritedEffectTargetLabel(effect, aim)}]
                </span>
              </div>
              <div className={styles.effectActions}>
                <button
                  type="button"
                  disabled={index === 0}
                  onClick={() =>
                    onChange(
                      moveCombatEffect(value, index, 'up'),
                      moveCombatEffectDescription(alignedDescriptions, index, 'up'),
                    )
                  }
                >
                  ↑ Up
                </button>
                <button
                  type="button"
                  disabled={index === value.length - 1}
                  onClick={() =>
                    onChange(
                      moveCombatEffect(value, index, 'down'),
                      moveCombatEffectDescription(alignedDescriptions, index, 'down'),
                    )
                  }
                >
                  ↓ Down
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onChange(
                      removeCombatEffect(value, index),
                      alignedDescriptions.filter(
                        (_, descriptionIndex) => descriptionIndex !== index,
                      ),
                    )
                  }
                >
                  Remove
                </button>
              </div>
            </header>
            <details className={styles.effectBody} data-effect-collapsible="true">
              <summary>Edit parameters</summary>
              <SkillEffectEditor
                aim={aim}
                siblings={value}
                canonicalDamage={canonicalDamage && effect.type === 'damage' ? 'damage' : undefined}
                value={effect}
                onChange={(nextEffect) =>
                  onChange(
                    value.map((candidate, effectIndex) =>
                      effectIndex === index ? nextEffect : candidate,
                    ),
                    alignedDescriptions,
                  )
                }
              />
            </details>
          </article>
        ))}
      </div>

      <EffectTagPicker
        nativeOnly
        additionalIssue={(id) => {
          if (id === 'reversal' && !allowReversal)
            return 'Reversal requires a modular Manual Action ability.'
          const payload = createAuthorableEffectPayload(id)
          const reversalIssue = authoredReversalCombinationIssue(value, payload?.type)
          if (reversalIssue) return reversalIssue
          if (maxEffects === undefined) return undefined
          if (!payload || ['move', 'summon', 'damage-bonus'].includes(payload.type))
            return undefined
          const proposed = reconcileAuthoredEffectDependencies(value, [
            ...value,
            nativeCombatTagPayload(payload),
          ])
          return proposed.length > maxEffects
            ? `This effect and its required tags exceed the ${maxEffects}-effect limit.`
            : undefined
        }}
        disabled={maxEffects !== undefined && value.length >= maxEffects}
        onAdd={(payload) =>
          onChange(
            [
              ...value,
              aim
                ? withAuthoredAreaRecipients(aim, [nativeCombatTagPayload(payload)])[0]!
                : nativeCombatTagPayload(payload),
            ],
            [...alignedDescriptions, null],
          )
        }
      />

      <p className={styles.effectNote}>
        Effects resolve in the order shown.
        {maxEffects === undefined ? '' : ` At most ${maxEffects} effects.`}
      </p>
    </fieldset>
  )
}

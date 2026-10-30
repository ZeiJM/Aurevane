'use client'

import type { CombatEffectDefinition, CombatTargetSpec } from '@aurevane/game-core/combat/actions'
import {
  combatStatusPresentationTag,
  type CombatElement,
} from '@aurevane/game-core/combat/gameplay-tags'
import { SIMPLE_REQUIREMENT_TAG_OPTIONS } from '@aurevane/game-core/combat/combat-simple-requirements'
import { PHASE4_STATUSES } from '@aurevane/game-core/combat/status-content'
import {
  CLEANSE_STATUS_IDS,
  isCleanseEffect,
  isCleanseChilledEffect,
} from '@aurevane/game-core/combat/combat-cleanse'
import {
  DEFAULT_BLINDSIDE_MODIFIERS,
  isBlindsideStatusId,
} from '@aurevane/game-core/combat/combat-blindside'

import { useId, useState } from 'react'
import {
  parsePercentageBasisPoints,
  percentageBasisPointsText,
  percentageDotSequence,
} from '@aurevane/game-core/combat/combat-percentage-dots'

import styles from './combat-content-editor.module.css'
import { EffectTargetEditor } from './effect-target-editor'
import {
  withAuthoredEffectTarget,
  type TargetedEffect,
} from '@aurevane/game-core/combat/combat-effect-target-authoring'
import { AbilityNumber } from './ability-editor-fields'

type DamageEffect = Extract<CombatEffectDefinition, { type: 'damage' }>

const PERCENTAGE_STATUS_IDS = new Set([
  'guarded',
  'exposed',
  'mark',
  'marked',
  'hexed',
  'wet',
  'conductive',
  'suppress',
  'inspired',
  'summoned',
  'warded',
  'reckless',
  'fortified',
  'challenged',
])

const REMOVAL_STATUS_IDS = [
  ...new Set([
    ...PHASE4_STATUSES.map((status) => status.id),
    'guarded',
    'exposed',
    'covert',
    'revealed',
    'lowered-guard',
  ]),
].filter((id) => SIMPLE_REQUIREMENT_TAG_OPTIONS.some((option) => option.id === id))

function integer(value: string, fallback: number): number {
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) ? parsed : fallback
}

function curseCopyableField(value: boolean | undefined, onChange: (next: boolean) => void) {
  return (
    <label className={styles.checkField}>
      <input
        aria-label="Curse-copyable"
        type="checkbox"
        checked={value === true}
        onChange={(event) => onChange(event.currentTarget.checked)}
      />
      <span>Curse-copyable</span>
    </label>
  )
}

function damageEditor(value: DamageEffect, onChange: (next: CombatEffectDefinition) => void) {
  const vengeance = value.vengeance

  return (
    <div className={styles.typedGrid}>
      <label className={styles.field}>
        <span>Damage amount</span>
        <input
          aria-label="Damage amount"
          type="number"
          min={1}
          max={20}
          step={1}
          value={value.amount}
          disabled={vengeance !== undefined}
          onChange={(event) =>
            onChange({ ...value, amount: integer(event.currentTarget.value, value.amount) })
          }
        />
      </label>

      <label className={styles.field}>
        <span>Element</span>
        <select
          aria-label="Element"
          value={value.element ?? ''}
          onChange={(event) => {
            const element = event.currentTarget.value
            const rest = { ...value }
            Reflect.deleteProperty(rest, 'element')
            onChange(element ? { ...rest, element: element as CombatElement } : rest)
          }}
        >
          <option value="">None</option>
          <option value="ice">Ice</option>
          <option value="water">Water</option>
          <option value="storm">Storm</option>
          <option value="fire">Fire</option>
        </select>
      </label>

      {vengeance ? (
        <>
          <AbilityNumber
            label="Vengeance conversion (%)"
            value={vengeance.conversionBasisPoints / 100}
            min={0.01}
            step={0.01}
            onChange={(percent) =>
              onChange({
                ...value,
                vengeance: { ...vengeance, conversionBasisPoints: Math.round(percent * 100) },
              })
            }
          />
          <label className={styles.field}>
            <span>Vengeance minimum damage</span>
            <input
              aria-label="Vengeance minimum damage"
              type="number"
              min={0}
              step={1}
              value={vengeance.minimumDamage ?? ''}
              placeholder="0"
              onChange={(event) => {
                if (event.currentTarget.value === '') {
                  const nextVengeance = { ...vengeance }
                  Reflect.deleteProperty(nextVengeance, 'minimumDamage')
                  onChange({ ...value, vengeance: nextVengeance })
                  return
                }
                onChange({
                  ...value,
                  vengeance: {
                    ...vengeance,
                    minimumDamage: integer(event.currentTarget.value, vengeance.minimumDamage ?? 0),
                  },
                })
              }}
            />
          </label>
          <label className={styles.field}>
            <span>Vengeance maximum damage</span>
            <input
              aria-label="Vengeance maximum damage"
              type="number"
              min={1}
              step={1}
              value={vengeance.maximumDamage}
              onChange={(event) =>
                onChange({
                  ...value,
                  vengeance: {
                    ...vengeance,
                    maximumDamage: integer(event.currentTarget.value, vengeance.maximumDamage),
                  },
                })
              }
            />
          </label>
        </>
      ) : null}
    </div>
  )
}

function PercentageInput({
  label,
  basisPoints,
  allowZero = false,
  onChange,
}: {
  label: string
  basisPoints: number
  allowZero?: boolean
  onChange: (value: number) => void
}) {
  const id = useId()
  const [draft, setDraft] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const display =
    draft ?? (Number.isSafeInteger(basisPoints) ? percentageBasisPointsText(basisPoints) : '')
  return (
    <label className={styles.field}>
      <span>{label}</span>
      <input
        aria-label={label}
        type="text"
        inputMode="decimal"
        value={display}
        aria-invalid={error !== null}
        aria-describedby={error ? id : undefined}
        onChange={(event) => {
          const text = event.currentTarget.value
          setDraft(text)
          try {
            onChange(parsePercentageBasisPoints(text, allowZero))
            setError(null)
          } catch {
            setError(
              'Enter ' + (allowZero ? '0' : '0.01') + '–100 with at most two decimal places.',
            )
            onChange(Number.NaN)
          }
        }}
        onBlur={() => {
          if (!error) setDraft(null)
        }}
      />
      {error ? (
        <span id={id} role="alert">
          {error}
        </span>
      ) : null}
    </label>
  )
}

type DotEffect = Extract<CombatEffectDefinition, { type: 'burn' | 'poison' | 'bleed' }>
function PercentageDotControls({
  value,
  onChange,
}: {
  value: DotEffect
  onChange: (value: CombatEffectDefinition) => void
}) {
  const profile = value.damageProfile ?? {
    kind: 'attack-percentage' as const,
    basisPoints: value.type === 'burn' ? 2500 : value.type === 'poison' ? 1500 : 2000,
    ...(value.type === 'burn' ? { decayBasisPointsPerTick: 500 } : {}),
  }
  const ticks =
    value.type === 'bleed'
      ? value.ticks
      : (value.durationTurns ?? (value.type === 'poison' ? 4 : 3))
  function changeProfile(next: typeof profile) {
    const rest = { ...value }
    delete rest.power
    if (rest.type === 'bleed') {
      const { damagePerTick, ...bleed } = rest
      void damagePerTick
      onChange({ ...bleed, damageProfile: next })
      return
    }
    onChange({ ...rest, durationTurns: ticks, damageProfile: next })
  }
  let sequence: string
  try {
    sequence = percentageDotSequence(profile, ticks)
  } catch {
    sequence = 'Every scheduled percentage must be positive.'
  }
  return (
    <div className={styles.typedGrid}>
      <PercentageInput
        label={
          value.type === 'burn'
            ? 'First tick (% of attack damage)'
            : 'Damage per tick (% of attack damage)'
        }
        basisPoints={profile.basisPoints}
        onChange={(basisPoints) => changeProfile({ ...profile, basisPoints })}
      />
      {value.type === 'burn' ? (
        <>
          <PercentageInput
            label="Decay per tick (percentage points)"
            basisPoints={profile.decayBasisPointsPerTick ?? 0}
            allowZero
            onChange={(decayBasisPointsPerTick) =>
              changeProfile({ ...profile, decayBasisPointsPerTick })
            }
          />
          <PercentageInput
            label="Backlash (% of burning unit’s hostile damage)"
            basisPoints={value.backlashBasisPoints ?? 1000}
            allowZero
            onChange={(backlashBasisPoints) => onChange({ ...value, backlashBasisPoints })}
          />
          <p className={styles.effectNote}>{sequence}. Backlash can trigger once per turn.</p>
        </>
      ) : null}
      {!value.damageProfile ? (
        <button type="button" onClick={() => changeProfile(profile)}>
          Convert to attack percentage
        </button>
      ) : null}
      {curseCopyableField(value.curseCopyable, (curseCopyable) =>
        onChange({ ...value, curseCopyable }),
      )}
      <p className={styles.effectNote}>
        Based on HP damage dealt by this attack. Add a direct Damage effect covering these
        recipients.
      </p>
    </div>
  )
}

function assertNever(value: never): never {
  throw new TypeError(`Unsupported combat effect editor variant: ${JSON.stringify(value)}`)
}

export interface SkillEffectEditorProps {
  readonly value: CombatEffectDefinition
  readonly aim?: CombatTargetSpec
  readonly siblings?: readonly TargetedEffect[]
  readonly hideTarget?: boolean
  readonly onChange: (next: CombatEffectDefinition) => void
  readonly canonicalDamage?: 'damage' | 'pierce'
}

export function SkillEffectEditor({
  value,
  onChange,
  aim,
  siblings,
  hideTarget = false,
}: SkillEffectEditorProps) {
  let controls

  switch (value.type) {
    case 'damage':
      controls = damageEditor(value, onChange)
      break

    case 'percentage-recovery':
      controls = (
        <div className={styles.typedGrid}>
          <label className={styles.field}>
            <span>Resource</span>
            <select
              aria-label="Recovery resource"
              value={value.resource}
              onChange={(event) =>
                onChange({ ...value, resource: event.currentTarget.value as 'hp' | 'mp' })
              }
            >
              <option value="hp">HP</option>
              <option value="mp">MP</option>
            </select>
          </label>
          <label className={styles.field}>
            <span>Percent of recipient maximum</span>
            <input
              aria-label="Recovery percent"
              type="number"
              min={1}
              max={100}
              step={1}
              value={value.percent}
              onChange={(event) =>
                onChange({ ...value, percent: integer(event.currentTarget.value, value.percent) })
              }
            />
          </label>
          <label className={styles.field}>
            <span>Applications</span>
            <input
              aria-label="Recovery applications"
              type="number"
              min={1}
              max={4}
              step={1}
              value={value.ticks ?? 1}
              onChange={(event) => {
                const ticks = integer(event.currentTarget.value, value.ticks ?? 1)
                onChange({ ...value, ticks, durationTurns: Math.max(0, ticks - 1) })
              }}
            />
          </label>
          <p className={styles.effectNote}>
            The recipient maximum and HP Hex adjustment are captured when cast; each application
            reuses that amount.
          </p>
        </div>
      )
      break

    case 'healing':
      controls = (
        <div className={styles.typedGrid}>
          <label className={styles.field}>
            <span>Healing amount</span>
            <input
              aria-label="Healing amount"
              type="number"
              min={1}
              max={20}
              step={1}
              value={value.amount}
              onChange={(event) =>
                onChange({ ...value, amount: integer(event.currentTarget.value, value.amount) })
              }
            />
          </label>
          <label className={styles.field}>
            <span>Healing ticks</span>
            <input
              aria-label="Healing ticks"
              type="number"
              min={1}
              max={4}
              step={1}
              value={value.ticks ?? ''}
              placeholder="Immediate"
              onChange={(event) => {
                if (event.currentTarget.value === '') {
                  const rest = { ...value }
                  Reflect.deleteProperty(rest, 'ticks')
                  onChange(rest)
                  return
                }
                onChange({
                  ...value,
                  ticks: integer(event.currentTarget.value, value.ticks ?? 1),
                })
              }}
            />
          </label>
        </div>
      )
      break

    case 'resource-change':
      controls = (
        <div className={styles.typedGrid}>
          <label className={styles.field}>
            <span>MP delta</span>
            <input
              aria-label="MP delta"
              type="number"
              min={-20}
              max={20}
              step={1}
              value={value.delta}
              onChange={(event) =>
                onChange({ ...value, delta: integer(event.currentTarget.value, value.delta) })
              }
            />
          </label>
          <label className={styles.field}>
            <span>MP ticks</span>
            <input
              aria-label="MP ticks"
              type="number"
              min={1}
              max={value.delta < 0 ? 1 : 4}
              step={1}
              value={value.ticks ?? ''}
              placeholder="Immediate"
              onChange={(event) => {
                if (event.currentTarget.value === '') {
                  const rest = { ...value }
                  Reflect.deleteProperty(rest, 'ticks')
                  onChange(rest)
                  return
                }
                onChange({
                  ...value,
                  ticks: integer(event.currentTarget.value, value.ticks ?? 1),
                })
              }}
            />
          </label>
          <div className={styles.effectStatic}>
            <span>Resource</span>
            <strong>MP</strong>
          </div>
        </div>
      )
      break

    case 'apply-status':
      controls = (
        <div className={styles.typedGrid}>
          <label className={styles.field}>
            <span>Status ID</span>
            <input
              aria-label="Status ID"
              type="text"
              value={value.statusId}
              onChange={(event) => {
                const next = { ...value, statusId: event.currentTarget.value }
                if (isBlindsideStatusId(next.statusId)) {
                  next.durationTurns = 1
                  delete next.potencyBasisPoints
                }
                if (next.statusId === 'suppress') {
                  next.stacks = 1
                  next.durationTurns ??= 2
                  next.potencyBasisPoints ??= 2500
                  delete next.power
                }
                if (!isBlindsideStatusId(next.statusId)) delete next.blindsideModifiersBasisPoints
                onChange(next)
              }}
            />
            <small className={styles.fieldHint}>
              Includes authored statuses such as Covert; Revealed is Reveal-owned.
            </small>
          </label>
          <label className={styles.field}>
            <span>Status stacks</span>
            <input
              aria-label="Status stacks"
              type="number"
              min={1}
              step={1}
              max={value.statusId === 'suppress' ? 1 : undefined}
              disabled={value.statusId === 'suppress'}
              value={value.statusId === 'suppress' ? 1 : value.stacks}
              onChange={(event) =>
                onChange({ ...value, stacks: integer(event.currentTarget.value, value.stacks) })
              }
            />
          </label>
          {isBlindsideStatusId(value.statusId) ? (
            <>
              {(['side', 'rear'] as const).map((direction) => (
                <label className={styles.field} key={direction}>
                  <span>{direction === 'side' ? 'Side' : 'Rear'} damage (%)</span>
                  <input
                    aria-label={`${direction === 'side' ? 'Side' : 'Rear'} damage (%)`}
                    type="number"
                    min={100}
                    step={0.01}
                    value={
                      (value.blindsideModifiersBasisPoints ?? DEFAULT_BLINDSIDE_MODIFIERS)[
                        direction
                      ] / 100
                    }
                    onChange={(event) => {
                      const percent = Number(event.currentTarget.value)
                      const points = Math.round(percent * 100)
                      onChange({
                        ...value,
                        blindsideModifiersBasisPoints: {
                          ...(value.blindsideModifiersBasisPoints ?? DEFAULT_BLINDSIDE_MODIFIERS),
                          [direction]:
                            event.currentTarget.value.trim() &&
                            Number.isFinite(percent) &&
                            Math.abs(percent * 100 - points) < 0.000001
                              ? points
                              : Number.NaN,
                        },
                      })
                    }}
                  />
                </label>
              ))}
              <small className={styles.fieldHint}>
                160% damage means a 60% increase. Front damage stays at 100%.
              </small>
            </>
          ) : null}
        </div>
      )
      break

    case 'remove-status':
      controls = (
        <div className={styles.typedGrid}>
          <label className={styles.field}>
            <span>Status removal mode</span>
            <select
              aria-label="Status removal mode"
              value={value.removalMode ?? 'standard'}
              onChange={(event) => {
                if (event.currentTarget.value === 'specified')
                  onChange({ ...value, removalMode: 'specified' })
                else {
                  const next = { ...value }
                  delete next.removalMode
                  onChange(next)
                }
              }}
            >
              <option value="standard">Cleanse / Dispel</option>
              <option value="specified">Conditional Cleanse / Dispel · only listed statuses</option>
            </select>
          </label>

          <label className={styles.field}>
            <span>{value.removalMode === 'specified' ? 'Listed statuses' : 'Status IDs'}</span>
            {value.removalMode === 'specified' ? (
              <select
                aria-label="Conditional Cleanse statuses"
                multiple
                size={8}
                value={[...value.statusIds]}
                onChange={(event) => {
                  const statusIds = Array.from(
                    event.currentTarget.selectedOptions,
                    (option) => option.value,
                  )
                  if (statusIds.length > 0 && statusIds.length <= 8)
                    onChange({ ...value, statusIds })
                }}
              >
                {[...new Set([...REMOVAL_STATUS_IDS, ...value.statusIds])].map((id) => (
                  <option
                    key={id}
                    value={id}
                    disabled={value.statusIds.length >= 8 && !value.statusIds.includes(id)}
                  >
                    {REMOVAL_STATUS_IDS.includes(id)
                      ? combatStatusPresentationTag(id)
                      : `${id} (unregistered)`}
                  </option>
                ))}
              </select>
            ) : (
              <input
                aria-label="Status IDs"
                type="text"
                value={value.statusIds.join(', ')}
                onChange={(event) =>
                  onChange({
                    ...value,
                    statusIds: event.currentTarget.value
                      .split(',')
                      .map((id) => id.trim())
                      .filter((id, index, all) => id.length > 0 && all.indexOf(id) === index)
                      .slice(0, 8),
                  })
                }
              />
            )}
            <small className={styles.fieldHint}>
              {value.removalMode === 'specified'
                ? 'Select one to eight statuses. Remove only the listed statuses. Other statuses remain, including Suppress unless explicitly listed.'
                : isCleanseChilledEffect(value)
                  ? 'Cleanse Chilled removes only Chilled from the authored recipient; other statuses remain.'
                  : 'Cleanse removes Burn, Bleed, Poison, Slow, Rooted, Vulnerable, Marked and Taunted. Dispel removes authored positive statuses.'}
            </small>
            {isCleanseEffect(value) ? (
              <button
                type="button"
                onClick={() => onChange({ ...value, statusIds: [...CLEANSE_STATUS_IDS] })}
              >
                Use standard Cleanse
              </button>
            ) : null}
          </label>
        </div>
      )
      break

    case 'return-to-turn-start':
      controls = (
        <div className={styles.effectStaticGrid}>
          <div className={styles.effectStatic}>
            <span>Effect</span>
            <strong>
              {value.anchorMode === 'cast-position'
                ? 'Return to captured cast tile'
                : 'Return to turn start'}
            </strong>
          </div>
          <div className={styles.effectStatic}>
            <span>Recipient</span>
            <strong>Actor only</strong>
          </div>
        </div>
      )
      break

    case 'create-terrain':
      controls = (
        <div className={styles.effectStaticGrid}>
          <div className={styles.effectStatic}>
            <span>Terrain</span>
            <strong>Frozen Ground</strong>
          </div>
          <div className={styles.effectStatic}>
            <span>Recipient</span>
            <strong>Affected tiles</strong>
          </div>
        </div>
      )
      break

    case 'displace':
      controls = (
        <div className={styles.typedGrid}>
          <label className={styles.field}>
            <span>Push or Pull</span>
            <select
              aria-label="Push or Pull"
              value={value.direction ?? ''}
              onChange={(event) => {
                const direction = event.currentTarget.value
                const rest = { ...value }
                Reflect.deleteProperty(rest, 'direction')
                onChange(direction ? { ...rest, direction: direction as 'push' | 'pull' } : rest)
              }}
            >
              <option value="">Engine default</option>
              <option value="push">Push</option>
              <option value="pull">Pull</option>
            </select>
          </label>
          <label className={styles.field}>
            <span>Tiles moved</span>
            <input
              aria-label="Tiles moved"
              type="number"
              min={1}
              step={1}
              value={value.distance}
              onChange={(event) =>
                onChange({
                  ...value,
                  distance: integer(event.currentTarget.value, value.distance),
                })
              }
            />
          </label>
        </div>
      )
      break

    case 'poison':
    case 'bleed':
    case 'burn':
      controls = <PercentageDotControls value={value} onChange={onChange} />
      break

    case 'barrier-change':
      controls = (
        <div className={styles.typedGrid}>
          <label className={styles.field}>
            <span>
              {value.basis === 'maximum-hp-percent' ? 'Barrier (% maximum HP)' : 'Barrier amount'}
            </span>
            <input
              aria-label={
                value.basis === 'maximum-hp-percent' ? 'Barrier (% maximum HP)' : 'Barrier amount'
              }
              type="number"
              min={1}
              max={value.basis === 'maximum-hp-percent' ? 100 : 20}
              step={1}
              value={value.amount}
              onChange={(event) =>
                onChange({ ...value, amount: integer(event.currentTarget.value, value.amount) })
              }
            />
          </label>
        </div>
      )
      break

    case 'copy-statuses':
      controls = (
        <div className={styles.typedGrid}>
          <label className={styles.field}>
            <span>Copy mode</span>
            <select
              aria-label="Copy mode"
              value={value.mode}
              onChange={(event) =>
                onChange({
                  ...value,
                  mode: event.currentTarget.value as 'amplify' | 'curse',
                })
              }
            >
              <option value="amplify">Copy Buffs</option>
              <option value="curse">Copy Debuffs</option>
            </select>
          </label>
          <label className={styles.checkField}>
            <input
              aria-label="Allow empty status copy"
              type="checkbox"
              checked={value.allowNoEligibleEffects === true}
              onChange={(event) =>
                onChange({ ...value, allowNoEligibleEffects: event.currentTarget.checked })
              }
            />
            <span>Allow empty status copy on composed command</span>
          </label>
          <p className={styles.effectNote}>
            Copy Buffs/Copy Debuffs clone their eligible active statuses.
          </p>
        </div>
      )
      break

    case 'sensory':
      controls = (
        <div className={styles.typedGrid}>
          <label className={styles.field}>
            <span>Revealed duration</span>
            <input
              aria-label="Revealed duration (owner-turn starts)"
              type="number"
              min={1}
              max={4}
              step={1}
              value={value.revealedDurationOwnerTurnStarts}
              onChange={(event) =>
                onChange({
                  ...value,
                  revealedDurationOwnerTurnStarts: integer(
                    event.currentTarget.value,
                    value.revealedDurationOwnerTurnStarts,
                  ),
                })
              }
            />
          </label>
          <p className={styles.effectNote}>
            Reveal conditionally purges eligible positive statuses, removes Covert, and applies
            Revealed only on a successful hit against a Covert target.
          </p>
        </div>
      )
      break

    default:
      controls = assertNever(value)
  }

  const fixedImmediate = [
    'damage',
    'remove-status',
    'return-to-turn-start',
    'displace',
    'copy-statuses',
    'sensory',
  ].includes(value.type)
  const fixedTerrain = value.type === 'create-terrain'
  const fixedBlindside = value.type === 'apply-status' && isBlindsideStatusId(value.statusId)
  const editableDuration =
    !fixedImmediate && !fixedTerrain && !fixedBlindside && value.type !== 'percentage-recovery'
  const hasPotency = value.type === 'apply-status' && PERCENTAGE_STATUS_IDS.has(value.statusId)
  const maximumDuration =
    value.type === 'healing' || (value.type === 'resource-change' && value.delta > 0) ? 3 : 4
  const minimumDuration = ['apply-status', 'bleed', 'burn', 'poison', 'barrier-change'].includes(
    value.type,
  )
    ? 1
    : 0
  const durationTurns =
    value.durationTurns ??
    (value.type === 'healing' || value.type === 'percentage-recovery'
      ? Math.max(0, (value.ticks ?? 1) - 1)
      : value.type === 'resource-change' && value.delta > 0
        ? Math.max(0, (value.ticks ?? 1) - 1)
        : value.type === 'bleed'
          ? value.ticks
          : value.type === 'burn'
            ? 3
            : value.type === 'poison'
              ? 4
              : value.type === 'create-terrain'
                ? 2
                : value.type === 'apply-status'
                  ? 2
                  : 0)

  function changeDuration(nextDuration: number) {
    const duration = Math.max(minimumDuration, Math.min(maximumDuration, nextDuration))
    if (value.type === 'healing') {
      onChange({ ...value, durationTurns: duration, ticks: duration + 1 })
      return
    }
    if (value.type === 'resource-change' && value.delta > 0) {
      onChange({ ...value, durationTurns: duration, ticks: duration + 1 })
      return
    }
    if (value.type === 'bleed') {
      onChange({ ...value, durationTurns: duration, ticks: Math.max(1, duration) })
      return
    }
    onChange({ ...value, durationTurns: duration })
  }

  return (
    <div className={styles.effectEditor} data-effect-type={value.type}>
      {!hideTarget ? (
        <EffectTargetEditor
          value={value}
          aim={aim}
          siblings={siblings}
          onChange={(target) => onChange(withAuthoredEffectTarget(value, target))}
        />
      ) : null}
      {controls}
      {fixedTerrain ? <p className={styles.effectNote}>Lasts 2 rounds.</p> : null}
      {fixedBlindside ? (
        <p className={styles.effectNote}>Expires at the end of the affected character’s turn.</p>
      ) : null}
      {editableDuration || hasPotency ? (
        <div className={styles.effectTuningGrid}>
          {editableDuration ? (
            <label className={styles.field}>
              <span>Effect duration (turns)</span>
              <input
                aria-label="Effect duration (turns)"
                type="number"
                min={minimumDuration}
                max={maximumDuration}
                step={1}
                value={
                  value.type === 'barrier-change' && value.durationTurns === undefined
                    ? ''
                    : durationTurns
                }
                placeholder={
                  value.type === 'barrier-change' ? 'Until depleted (historical)' : undefined
                }
                onChange={(event) =>
                  changeDuration(integer(event.currentTarget.value, durationTurns))
                }
              />
              <small className={styles.fieldHint}>
                {value.type === 'barrier-change'
                  ? 'Instant lasts for affected completed turns; Normal and Delayed last complete rounds after activation. Historical blank durations last until depleted.'
                  : 'Positive durations persist through that many future turns.'}
              </small>
            </label>
          ) : null}

          {value.type === 'apply-status' && PERCENTAGE_STATUS_IDS.has(value.statusId) ? (
            <label className={styles.field}>
              <span>Status potency (%)</span>
              <input
                aria-label="Status potency (percent)"
                type="number"
                min={1}
                max={value.statusId === 'suppress' ? 100 : 50}
                step={['suppress', 'wet', 'conductive'].includes(value.statusId) ? 0.01 : 1}
                value={
                  (value.potencyBasisPoints ??
                    (value.statusId === 'suppress'
                      ? 2500
                      : ['wet', 'conductive'].includes(value.statusId)
                        ? 2000
                        : 1500)) / 100
                }
                onChange={(event) =>
                  onChange({
                    ...value,
                    potencyBasisPoints: ['suppress', 'wet', 'conductive'].includes(value.statusId)
                      ? Math.round(Number(event.currentTarget.value) * 100)
                      : Math.max(1, Math.min(50, integer(event.currentTarget.value, 15))) * 100,
                  })
                }
              />
              <small className={styles.fieldHint}>
                {value.statusId === 'suppress'
                  ? 'Outgoing direct-damage reduction. Never stacks; retains the highest percentage and longest remaining duration. 25 = 25%.'
                  : ['wet', 'conductive'].includes(value.statusId)
                    ? 'Additional Storm damage captured on this explicit status tag. Default 20%. Matching elemental damage requires positive hostile actual HP loss after Barrier and a surviving recipient.'
                    : 'Used by percentage-based statuses such as Guard or Vulnerable. 15 = 15%.'}
              </small>
            </label>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

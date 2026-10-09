'use client'

import type {
  CombatEffectDefinition,
  CombatEffectRecipient,
} from '@aurevane/game-core/combat/actions'
import type { CombatElement } from '@aurevane/game-core/combat/gameplay-tags'
import { CLEANSE_STATUS_IDS, isCleanseEffect } from '@aurevane/game-core/combat/combat-cleanse'
import { DEFAULT_BLINDSIDE_MODIFIERS } from '@aurevane/game-core/combat/combat-blindside'

import { useId, useState } from 'react'
import {
  parsePercentageBasisPoints,
  percentageBasisPointsText,
  percentageDotSequence,
} from '@aurevane/game-core/combat/combat-percentage-dots'

import styles from './combat-content-editor.module.css'

type DamageEffect = Extract<CombatEffectDefinition, { type: 'damage' }>
type DisplaceEffect = Extract<CombatEffectDefinition, { type: 'displace' }>

const PERCENTAGE_STATUS_IDS = new Set([
  'guarded',
  'exposed',
  'mark',
  'marked',
  'hexed',
  'suppress',
  'inspired',
  'summoned',
  'warded',
  'reckless',
  'fortified',
  'challenged',
])

const RECIPIENTS: readonly { value: CombatEffectRecipient; label: string }[] = [
  { value: 'actor', label: 'Actor' },
  { value: 'primary-unit', label: 'Primary unit' },
  { value: 'affected-units', label: 'Affected units' },
]

function integer(value: string, fallback: number): number {
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) ? parsed : fallback
}

function recipientField(
  label: string,
  value: CombatEffectRecipient,
  onChange: (recipient: CombatEffectRecipient) => void,
  allowed: readonly CombatEffectRecipient[] = RECIPIENTS.map((entry) => entry.value),
) {
  return (
    <label className={styles.field}>
      <span>{label}</span>
      <select
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.currentTarget.value as CombatEffectRecipient)}
      >
        {RECIPIENTS.filter((entry) => allowed.includes(entry.value)).map((entry) => (
          <option key={entry.value} value={entry.value}>
            {entry.label}
          </option>
        ))}
      </select>
    </label>
  )
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
  const scaling = value.scaling
  const vengeance = value.vengeance
  const facing = value.facingModifiersBasisPoints

  return (
    <div className={styles.typedGrid}>
      {recipientField('Damage recipient', value.recipient, (recipient) =>
        onChange({ ...value, recipient }),
      )}

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
        <span>Defense kind</span>
        <select
          aria-label="Defense kind"
          value={value.defenseKind ?? ''}
          onChange={(event) => {
            const defenseKind = event.currentTarget.value
            const rest = { ...value }
            Reflect.deleteProperty(rest, 'defenseKind')
            onChange(defenseKind ? { ...rest, defenseKind: defenseKind as 'armor' | 'ward' } : rest)
          }}
        >
          <option value="">None</option>
          <option value="armor">Physical Defense</option>
          <option value="ward">Mystic Defense</option>
        </select>
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

      {value.element && ['ice', 'water', 'storm'].includes(value.element) ? (
        <label className={styles.field}>
          <span>Elemental debuff duration (turns)</span>
          <input
            aria-label="Elemental debuff duration (turns)"
            type="number"
            min={1}
            max={4}
            step={1}
            value={value.durationTurns || 2}
            onChange={(event) =>
              onChange({ ...value, durationTurns: integer(event.currentTarget.value, 2) })
            }
          />
        </label>
      ) : null}
      {value.element === 'water' || value.element === 'storm' ? (
        <label className={styles.field}>
          <span>
            {value.element === 'water' ? 'Drenched Storm bonus (%)' : 'Conductive Storm bonus (%)'}
          </span>
          <input
            aria-label={
              value.element === 'water' ? 'Drenched Storm bonus (%)' : 'Conductive Storm bonus (%)'
            }
            type="number"
            min={1}
            max={50}
            step={0.01}
            value={(value.potencyBasisPoints ?? 2000) / 100}
            onChange={(event) =>
              onChange({
                ...value,
                potencyBasisPoints: Math.round(Number(event.currentTarget.value) * 100),
              })
            }
          />
          <small>Additional Storm damage captured on the applied debuff. Default 20%.</small>
        </label>
      ) : null}
      <label className={styles.checkField}>
        <input
          aria-label="Piercing"
          type="checkbox"
          checked={value.piercing === true}
          onChange={(event) => onChange({ ...value, piercing: event.currentTarget.checked })}
        />
        <span>Piercing</span>
      </label>

      <label className={styles.checkField}>
        <input
          aria-label="Scaling enabled"
          type="checkbox"
          checked={scaling !== undefined}
          disabled={vengeance !== undefined}
          onChange={(event) => {
            if (event.currentTarget.checked) {
              onChange({
                ...value,
                scaling: { source: 'physical-power', coefficientBasisPoints: 10_000 },
              })
              return
            }
            const rest = { ...value }
            Reflect.deleteProperty(rest, 'scaling')
            onChange(rest)
          }}
        />
        <span>Offensive-stat scaling</span>
      </label>

      {scaling ? (
        <>
          <label className={styles.field}>
            <span>Scaling source</span>
            <select
              aria-label="Scaling source"
              value={scaling.source}
              onChange={(event) =>
                onChange({
                  ...value,
                  scaling: {
                    ...scaling,
                    source: event.currentTarget.value as 'physical-power' | 'mystic-power',
                  },
                })
              }
            >
              <option value="physical-power">Physical Power</option>
              <option value="mystic-power">Mystic Power</option>
            </select>
          </label>
          <label className={styles.field}>
            <span>Scaling coefficient (basis points)</span>
            <input
              aria-label="Scaling coefficient (basis points)"
              type="number"
              min={0}
              max={20_000}
              step={1}
              value={scaling.coefficientBasisPoints}
              onChange={(event) =>
                onChange({
                  ...value,
                  scaling: {
                    ...scaling,
                    coefficientBasisPoints: integer(
                      event.currentTarget.value,
                      scaling.coefficientBasisPoints,
                    ),
                  },
                })
              }
            />
          </label>
        </>
      ) : null}

      <label className={styles.checkField}>
        <input
          aria-label="Vengeance enabled"
          type="checkbox"
          checked={vengeance !== undefined}
          onChange={(event) => {
            if (event.currentTarget.checked) {
              const rest = { ...value }
              Reflect.deleteProperty(rest, 'scaling')
              onChange({
                ...rest,
                amount: 0,
                vengeance: { conversionBasisPoints: 5_000, maximumDamage: 80 },
              })
              return
            }
            const rest = { ...value }
            Reflect.deleteProperty(rest, 'vengeance')
            onChange(rest)
          }}
        />
        <span>Vengeance conversion</span>
      </label>

      {vengeance ? (
        <>
          <label className={styles.field}>
            <span>Vengeance conversion (basis points)</span>
            <input
              aria-label="Vengeance conversion (basis points)"
              type="number"
              min={1}
              step={1}
              value={vengeance.conversionBasisPoints}
              onChange={(event) =>
                onChange({
                  ...value,
                  vengeance: {
                    ...vengeance,
                    conversionBasisPoints: integer(
                      event.currentTarget.value,
                      vengeance.conversionBasisPoints,
                    ),
                  },
                })
              }
            />
          </label>
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

      <label className={styles.checkField}>
        <input
          aria-label="Facing modifiers enabled"
          type="checkbox"
          checked={facing !== undefined}
          onChange={(event) => {
            if (event.currentTarget.checked) {
              onChange({
                ...value,
                facingModifiersBasisPoints: { front: 10_000, side: 10_000, rear: 10_000 },
              })
              return
            }
            const rest = { ...value }
            Reflect.deleteProperty(rest, 'facingModifiersBasisPoints')
            onChange(rest)
          }}
        />
        <span>Facing modifiers</span>
      </label>

      {facing ? (
        <>
          {(['front', 'side', 'rear'] as const).map((direction) => (
            <label className={styles.field} key={direction}>
              <span>{direction} damage modifier</span>
              <input
                aria-label={`${direction[0]!.toUpperCase()}${direction.slice(1)} damage modifier (basis points)`}
                type="number"
                min={0}
                max={22_000}
                step={1}
                value={facing[direction]}
                onChange={(event) =>
                  onChange({
                    ...value,
                    facingModifiersBasisPoints: {
                      ...facing,
                      [direction]: integer(event.currentTarget.value, facing[direction]),
                    },
                  })
                }
              />
            </label>
          ))}
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
      {recipientField(
        value.type[0]!.toUpperCase() + value.type.slice(1) + ' recipient',
        value.recipient,
        (recipient) => onChange({ ...value, recipient }),
        ['primary-unit', 'affected-units'],
      )}
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
  readonly onChange: (next: CombatEffectDefinition) => void
}

export function SkillEffectEditor({ value, onChange }: SkillEffectEditorProps) {
  let controls

  switch (value.type) {
    case 'damage':
      controls = damageEditor(value, onChange)
      break

    case 'percentage-recovery':
      controls = (
        <div className={styles.typedGrid}>
          {recipientField('Recovery recipient', value.recipient, (recipient) =>
            onChange({ ...value, recipient }),
          )}
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
          {recipientField('Healing recipient', value.recipient, (recipient) =>
            onChange({ ...value, recipient }),
          )}
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
          {recipientField('MP recipient', value.recipient, (recipient) =>
            onChange({ ...value, recipient }),
          )}
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
          {recipientField('Status recipient', value.recipient, (recipient) =>
            onChange({ ...value, recipient }),
          )}
          <label className={styles.field}>
            <span>Status ID</span>
            <input
              aria-label="Status ID"
              type="text"
              value={value.statusId}
              onChange={(event) => {
                const next = { ...value, statusId: event.currentTarget.value }
                if (next.statusId === 'blindside') {
                  next.durationTurns = 1
                  delete next.potencyBasisPoints
                }
                if (next.statusId === 'suppress') {
                  next.stacks = 1
                  next.durationTurns ??= 2
                  next.potencyBasisPoints ??= 2500
                  delete next.power
                }
                if (next.statusId !== 'blindside') delete next.blindsideModifiersBasisPoints
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
          {value.statusId === 'blindside' ? (
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
          {recipientField('Status removal recipient', value.recipient, (recipient) =>
            onChange({ ...value, recipient }),
          )}
          <label className={styles.field}>
            <span>Status IDs</span>
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
            <small className={styles.fieldHint}>
              Cleanse removes Burn, Bleed, Poison, Slow, Rooted, Vulnerable, Marked and Taunted.
              Dispel removes authored positive statuses.
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
          {recipientField(
            `${value.direction === 'pull' ? 'Pull' : 'Push'} recipient`,
            value.recipient,
            (recipient) =>
              onChange({
                ...value,
                recipient: recipient as DisplaceEffect['recipient'],
              }),
            ['primary-unit', 'affected-units'],
          )}
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
          {recipientField('Barrier recipient', value.recipient, (recipient) =>
            onChange({ ...value, recipient }),
          )}
          <label className={styles.field}>
            <span>Barrier amount</span>
            <input
              aria-label="Barrier amount"
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
    'barrier-change',
    'copy-statuses',
    'sensory',
  ].includes(value.type)
  const fixedTerrain = value.type === 'create-terrain'
  const fixedBlindside = value.type === 'apply-status' && value.statusId === 'blindside'
  const maximumDuration = value.type === 'percentage-recovery' ? 3 : 4
  const minimumDuration = ['apply-status', 'bleed', 'burn', 'poison'].includes(value.type) ? 1 : 0
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
    if (value.type === 'healing' || value.type === 'percentage-recovery') {
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
      {controls}
      <div className={styles.effectTuningGrid}>
        {!(value.type === 'damage' && ['ice', 'water', 'storm'].includes(value.element ?? '')) ? (
          <label className={styles.field}>
            <span>Effect duration (turns)</span>
            <input
              aria-label="Effect duration (turns)"
              type="number"
              min={fixedBlindside ? 1 : fixedImmediate ? 0 : fixedTerrain ? 2 : minimumDuration}
              max={fixedBlindside ? 1 : fixedImmediate ? 0 : fixedTerrain ? 2 : maximumDuration}
              step={1}
              disabled={fixedImmediate || fixedTerrain || fixedBlindside}
              value={fixedBlindside ? 1 : fixedImmediate ? 0 : fixedTerrain ? 2 : durationTurns}
              onChange={(event) =>
                changeDuration(integer(event.currentTarget.value, durationTurns))
              }
            />
            <small className={styles.fieldHint}>
              {fixedImmediate
                ? 'Immediate effect; [0 Turns] is intentionally omitted in player-facing details.'
                : fixedTerrain
                  ? 'Frozen Ground uses the engine-owned two-round duration.'
                  : fixedBlindside
                    ? 'Expires at the end of the affected character’s turn.'
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
              step={value.statusId === 'suppress' ? 0.01 : 1}
              value={
                (value.potencyBasisPoints ?? (value.statusId === 'suppress' ? 2500 : 1500)) / 100
              }
              onChange={(event) =>
                onChange({
                  ...value,
                  potencyBasisPoints:
                    value.statusId === 'suppress'
                      ? Math.round(Number(event.currentTarget.value) * 100)
                      : Math.max(1, Math.min(50, integer(event.currentTarget.value, 15))) * 100,
                })
              }
            />
            <small className={styles.fieldHint}>
              {value.statusId === 'suppress'
                ? 'Outgoing direct-damage reduction. Never stacks; retains the highest percentage and longest remaining duration. 25 = 25%.'
                : 'Used by percentage-based statuses such as Guard or Vulnerable. 15 = 15%.'}
            </small>
          </label>
        ) : null}
      </div>
    </div>
  )
}

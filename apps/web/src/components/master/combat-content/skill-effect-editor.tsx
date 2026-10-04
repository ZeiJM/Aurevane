'use client'

import type {
  CombatEffectDefinition,
  CombatEffectRecipient,
} from '@aurevane/game-core/combat/actions'
import type { CombatElement } from '@aurevane/game-core/combat/gameplay-tags'

import styles from './combat-content-editor.module.css'

type DamageEffect = Extract<CombatEffectDefinition, { type: 'damage' }>
type DisplaceEffect = Extract<CombatEffectDefinition, { type: 'displace' }>

const PERCENTAGE_STATUS_IDS = new Set([
  'guarded',
  'exposed',
  'mark',
  'marked',
  'hexed',
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
          <option value="armor">Armor</option>
          <option value="ward">Ward</option>
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
          <option value="water">Water</option>
          <option value="storm">Storm</option>
          <option value="fire">Fire</option>
        </select>
      </label>

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
              onChange={(event) => onChange({ ...value, statusId: event.currentTarget.value })}
            />
            <small className={styles.fieldHint}>
              Includes authored statuses such as Covert; Revealed is Sensory-owned.
            </small>
          </label>
          <label className={styles.field}>
            <span>Status stacks</span>
            <input
              aria-label="Status stacks"
              type="number"
              min={1}
              step={1}
              value={value.stacks}
              onChange={(event) =>
                onChange({ ...value, stacks: integer(event.currentTarget.value, value.stacks) })
              }
            />
          </label>
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
              One to eight distinct status IDs. Use this for Cleanse/Dispel-style blocks.
            </small>
          </label>
        </div>
      )
      break

    case 'return-to-turn-start':
      controls = (
        <div className={styles.effectStaticGrid}>
          <div className={styles.effectStatic}>
            <span>Effect</span>
            <strong>Return to turn start</strong>
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
            <strong>Frozen terrain</strong>
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
            'Displacement recipient',
            value.recipient,
            (recipient) =>
              onChange({
                ...value,
                recipient: recipient as DisplaceEffect['recipient'],
              }),
            ['primary-unit', 'affected-units'],
          )}
          <label className={styles.field}>
            <span>Displacement direction</span>
            <select
              aria-label="Displacement direction"
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
            <span>Displacement distance</span>
            <input
              aria-label="Displacement distance"
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
      controls = (
        <div className={styles.typedGrid}>
          {recipientField('Poison recipient', value.recipient, (recipient) =>
            onChange({ ...value, recipient }),
          )}
          {curseCopyableField(value.curseCopyable, (curseCopyable) =>
            onChange({ ...value, curseCopyable }),
          )}
          <p className={styles.effectNote}>
            Uses the current engine-owned Poison movement profile.
          </p>
        </div>
      )
      break

    case 'bleed':
      controls = (
        <div className={styles.typedGrid}>
          {recipientField('Bleed recipient', value.recipient, (recipient) =>
            onChange({ ...value, recipient }),
          )}
          <label className={styles.field}>
            <span>Bleed damage per tick</span>
            <input
              aria-label="Bleed damage per tick"
              type="number"
              min={1}
              max={20}
              step={1}
              value={value.damagePerTick}
              onChange={(event) =>
                onChange({
                  ...value,
                  damagePerTick: integer(event.currentTarget.value, value.damagePerTick),
                })
              }
            />
          </label>
          <label className={styles.field}>
            <span>Bleed ticks</span>
            <input
              aria-label="Bleed ticks"
              type="number"
              min={1}
              max={4}
              step={1}
              value={value.ticks}
              onChange={(event) =>
                onChange({ ...value, ticks: integer(event.currentTarget.value, value.ticks) })
              }
            />
            <small className={styles.fieldHint}>
              Per-stack raw total may not exceed 10 damage.
            </small>
          </label>
          {curseCopyableField(value.curseCopyable, (curseCopyable) =>
            onChange({ ...value, curseCopyable }),
          )}
        </div>
      )
      break

    case 'burn':
      controls = (
        <div className={styles.typedGrid}>
          {recipientField('Burn recipient', value.recipient, (recipient) =>
            onChange({ ...value, recipient }),
          )}
          {curseCopyableField(value.curseCopyable, (curseCopyable) =>
            onChange({ ...value, curseCopyable }),
          )}
          <p className={styles.effectNote}>Uses the current engine-owned Burn stage profile.</p>
        </div>
      )
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
            <span>Status copy mode</span>
            <select
              aria-label="Status copy mode"
              value={value.mode}
              onChange={(event) =>
                onChange({
                  ...value,
                  mode: event.currentTarget.value as 'amplify' | 'curse',
                })
              }
            >
              <option value="amplify">Amplify</option>
              <option value="curse">Curse</option>
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
            Amplify/Curse clone their eligible active statuses. Copy transfers beneficial effect
            tags from the target to the user.
          </p>
        </div>
      )
      break

    case 'copy':
      controls = (
        <div className={styles.effectStaticGrid}>
          <div className={styles.effectStatic}>
            <span>Effect</span>
            <strong>Copy beneficial effect tags</strong>
          </div>
          <div className={styles.effectStatic}>
            <span>Source</span>
            <strong>Selected primary unit</strong>
          </div>
          <p className={styles.effectNote}>
            On a successful resolution, copies active beneficial effect tags from the selected unit
            onto the user. The target keeps its effects; remaining durations are preserved.
            Historical battles retain their recorded Copy behavior.
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
            Sensory conditionally purges eligible positive statuses, removes Covert, and applies
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
    'copy',
    'sensory',
  ].includes(value.type)
  const fixedTerrain = value.type === 'create-terrain'
  const minimumDuration = ['apply-status', 'bleed', 'burn', 'poison'].includes(value.type) ? 1 : 0
  const durationTurns =
    value.durationTurns ??
    (value.type === 'healing'
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
  const supportsGenericPower = value.type === 'burn' || value.type === 'poison'

  function changeDuration(nextDuration: number) {
    const duration = Math.max(minimumDuration, Math.min(4, nextDuration))
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
      {controls}
      <div className={styles.effectTuningGrid}>
        <label className={styles.field}>
          <span>Effect duration (turns)</span>
          <input
            aria-label="Effect duration (turns)"
            type="number"
            min={fixedImmediate ? 0 : fixedTerrain ? 2 : minimumDuration}
            max={fixedImmediate ? 0 : fixedTerrain ? 2 : 4}
            step={1}
            disabled={fixedImmediate || fixedTerrain}
            value={fixedImmediate ? 0 : fixedTerrain ? 2 : durationTurns}
            onChange={(event) => changeDuration(integer(event.currentTarget.value, durationTurns))}
          />
          <small className={styles.fieldHint}>
            {fixedImmediate
              ? 'Immediate effect; [0 Turns] is intentionally omitted in player-facing details.'
              : fixedTerrain
                ? 'Frozen terrain uses the engine-owned two-round duration.'
                : 'Positive durations persist through that many future turns.'}
          </small>
        </label>

        {supportsGenericPower ? (
          <label className={styles.field}>
            <span>Effect power</span>
            <input
              aria-label="Effect power"
              type="number"
              min={1}
              max={20}
              step={1}
              value={value.power ?? 1}
              onChange={(event) =>
                onChange({
                  ...value,
                  power: Math.max(1, Math.min(20, integer(event.currentTarget.value, 1))),
                })
              }
            />
            <small className={styles.fieldHint}>Bounded authored power: 1–20.</small>
          </label>
        ) : null}

        {value.type === 'apply-status' && PERCENTAGE_STATUS_IDS.has(value.statusId) ? (
          <label className={styles.field}>
            <span>Status potency (%)</span>
            <input
              aria-label="Status potency (percent)"
              type="number"
              min={1}
              max={50}
              step={1}
              value={(value.potencyBasisPoints ?? 1500) / 100}
              onChange={(event) =>
                onChange({
                  ...value,
                  potencyBasisPoints:
                    Math.max(1, Math.min(50, integer(event.currentTarget.value, 15))) * 100,
                })
              }
            />
            <small className={styles.fieldHint}>
              Used by percentage-based statuses such as Guarded or Exposed. 15 = 15%.
            </small>
          </label>
        ) : null}
      </div>
    </div>
  )
}

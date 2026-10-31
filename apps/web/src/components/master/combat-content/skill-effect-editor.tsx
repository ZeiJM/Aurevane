'use client'
import {
  selectableCombatStatusIds,
  combatStatusSelectionSummary,
  type StatusSelectionKind,
} from '@aurevane/game-core/combat/combat-status-selection'
import {
  AUTHORABLE_EFFECT_TAGS,
  effectAuthoringTag,
} from '@aurevane/game-core/combat/combat-effect-authoring'

import type { CombatEffectDefinition, CombatTargetSpec } from '@aurevane/game-core/combat/actions'
import {
  combatStatusPresentationTag,
  type CombatElement,
} from '@aurevane/game-core/combat/gameplay-tags'
import {
  DEFAULT_BLINDSIDE_MODIFIERS,
  isBlindsideStatusId,
} from '@aurevane/game-core/combat/combat-blindside'

import { useId, useState } from 'react'
import { currentTagForAuthoring } from '@/lib/combat-current-tag-authoring'
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

function StatusSelectionControls({
  kind,
  selected,
  verb,
  onChange,
}: {
  kind: StatusSelectionKind
  selected: readonly string[]
  verb: 'Copy' | 'Remove'
  onChange: (statusIds: readonly string[]) => void
}) {
  const allowed = selectableCombatStatusIds(kind)
  const all = allowed.every((id) => selected.includes(id))
  const allLabel = kind === 'buffs' || kind === 'copy-buffs' ? 'All Buffs' : 'All Debuffs'
  return (
    <fieldset className={styles.typedGrid}>
      <legend>
        {selected.length ? combatStatusSelectionSummary(selected, kind) : 'Choose statuses'}
      </legend>
      <label className={styles.checkField}>
        <input
          type="checkbox"
          aria-label={`${verb} ${allLabel}`}
          checked={all}
          onChange={(event) => onChange(event.currentTarget.checked ? [...allowed] : [])}
        />
        <span>{allLabel}</span>
      </label>
      {allowed.map((id) => (
        <label key={id} className={styles.checkField}>
          <input
            type="checkbox"
            value={id}
            aria-label={`${verb} ${combatStatusPresentationTag(id)}`}
            checked={selected.includes(id)}
            onChange={(event) =>
              onChange(
                event.currentTarget.checked
                  ? [...new Set([...selected, id])]
                  : selected.filter((selectedId) => selectedId !== id),
              )
            }
          />
          <span>{combatStatusPresentationTag(id)}</span>
        </label>
      ))}
    </fieldset>
  )
}

function integer(value: string, fallback: number): number {
  const parsed = Number(value)
  return value.trim() && Number.isSafeInteger(parsed) ? parsed : fallback
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

function damageEditor(
  value: DamageEffect,
  onChange: (next: CombatEffectDefinition) => void,
  nonElemental = false,
) {
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
          onChange={(event) =>
            onChange({
              ...value,
              amount: Math.max(1, integer(event.currentTarget.value, value.amount)),
            })
          }
        />
      </label>

      {!nonElemental ? (
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
      {value.type === 'poison'
        ? curseCopyableField(value.curseCopyable, (curseCopyable) =>
            onChange({ ...value, curseCopyable }),
          )
        : null}
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
  value: savedValue,
  onChange,
  aim,
  siblings,
  hideTarget = false,
  canonicalDamage,
}: SkillEffectEditorProps) {
  const value = currentTagForAuthoring(savedValue)
  let controls

  switch (value.type) {
    case 'reversal':
      controls = (
        <>
          <div className={styles.typedGrid}>
            <label className={styles.field}>
              <span>Reversal family</span>
              <select
                aria-label="Reversal family"
                value={value.family}
                onChange={(event) =>
                  onChange({ ...value, family: event.currentTarget.value as typeof value.family })
                }
              >
                <option value="physical">Physical Reversal</option>
                <option value="mystic">Mystic Reversal</option>
              </select>
            </label>
            <AbilityNumber
              label="Reflection potency (%)"
              value={value.reflectionBasisPoints / 100}
              max={1000}
              min={0.01}
              step={0.01}
              onChange={(percent) =>
                onChange({ ...value, reflectionBasisPoints: Math.round(percent * 100) })
              }
            />
            <AbilityNumber
              label="Attacker HP cap (%)"
              value={value.attackerMaxHpCapBasisPoints / 100}
              min={0.01}
              max={100}
              step={0.01}
              onChange={(percent) =>
                onChange({ ...value, attackerMaxHpCapBasisPoints: Math.round(percent * 100) })
              }
            />
            <AbilityNumber
              label="User HP cap (%)"
              value={value.defenderMaxHpCapBasisPoints / 100}
              min={0.01}
              max={100}
              step={0.01}
              onChange={(percent) =>
                onChange({ ...value, defenderMaxHpCapBasisPoints: Math.round(percent * 100) })
              }
            />
          </div>
          <p className={styles.effectNote}>
            The lower HP cap applies. One trigger; front and sides only. Armed until your next turn,
            followed by one complete turn of Reversal Strain. Other Controlled effects need a
            separate group.
          </p>
        </>
      )
      break
    case 'endure':
      controls = (
        <div className={styles.typedGrid}>
          <AbilityNumber
            label="Damage returned (%)"
            value={value.releaseBasisPoints / 100}
            min={0.01}
            step={0.01}
            onChange={(percent) =>
              onChange({ ...value, releaseBasisPoints: Math.round(percent * 100) })
            }
          />
          <AbilityNumber
            label="Burst range (tiles)"
            value={value.radiusTiles}
            min={1}
            max={20}
            onChange={(radiusTiles) => onChange({ ...value, radiusTiles })}
          />
          <label className={styles.field}>
            <span>Burst targets</span>
            <select
              aria-label="Endure burst targets"
              value={value.targetTeams}
              onChange={(event) =>
                onChange({
                  ...value,
                  targetTeams: event.currentTarget.value as typeof value.targetTeams,
                })
              }
            >
              <option value="enemies">Enemies</option>
              <option value="allies">Allies</option>
              <option value="all">All</option>
            </select>
          </label>
        </div>
      )
      break
    case 'weak-point':
      controls = (
        <AbilityNumber
          label="Debuff threshold"
          value={value.debuffThreshold}
          min={0}
          onChange={(debuffThreshold) => onChange({ ...value, debuffThreshold })}
        />
      )
      break
    case 'spike':
      controls = (
        <p className={styles.effectNote}>Critical hits deal twice their usual critical damage.</p>
      )
      break
    case 'ruin':
      controls = (
        <AbilityNumber
          label="Damage increase per debuff (%)"
          value={value.bonusPerDebuffBasisPoints / 100}
          min={0.01}
          step={0.01}
          onChange={(percent) =>
            onChange({ ...value, bonusPerDebuffBasisPoints: Math.round(percent * 100) })
          }
        />
      )
      break
    case 'damage':
      controls = damageEditor(
        value,
        onChange,
        canonicalDamage === 'pierce' || value.piercing === true || value.shattersBarrier === true,
      )
      break

    case 'percentage-recovery':
      controls = (
        <div className={styles.typedGrid}>
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
          <p className={styles.effectNote}>
            Restores the saved percentage of maximum {value.resource.toUpperCase()}. Healing Down
            reduces recovery.
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
                onChange({
                  ...value,
                  amount: Math.max(1, integer(event.currentTarget.value, value.amount)),
                })
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
      if (value.delta < 0) {
        const percentage = value.basis === 'maximum-mp-percent'
        controls = (
          <label className={styles.field}>
            <span>{percentage ? 'MP Drain potency (%)' : 'MP Drain amount'}</span>
            <input
              aria-label={percentage ? 'MP Drain potency (%)' : 'MP Drain amount'}
              type="number"
              min={1}
              max={percentage ? 100 : 20}
              step={1}
              value={Math.abs(value.delta)}
              onChange={(event) =>
                onChange({
                  ...value,
                  delta: -Math.abs(integer(event.currentTarget.value, Math.abs(value.delta))),
                })
              }
            />
          </label>
        )
        break
      }
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
      if (value.statusId === 'counter') {
        const counter = value.counter ?? { kind: 'full' as const, basisPoints: 10000 }
        controls = (
          <div className={styles.typedGrid}>
            <label className={styles.field}>
              <span>Type</span>
              <select
                aria-label="Counter type"
                value={counter.kind}
                onChange={(event) =>
                  onChange({
                    ...value,
                    counter: { ...counter, kind: event.currentTarget.value as typeof counter.kind },
                  })
                }
              >
                <option value="physical">Physical Counter</option>
                <option value="mystic">Mystical Counter</option>
                <option value="full">Full Counter</option>
              </select>
            </label>
            <AbilityNumber
              label="Counter potency (%)"
              value={counter.basisPoints / 100}
              min={0.01}
              step={0.01}
              onChange={(percent) =>
                onChange({
                  ...value,
                  counter: { ...counter, basisPoints: Math.round(percent * 100) },
                })
              }
            />
          </div>
        )
        break
      }
      controls = (
        <div className={styles.typedGrid}>
          {!['root', 'invisible', 'challenged'].includes(value.statusId) &&
          value.applicationOrigin !== 'frozen-ground' ? (
            <label className={styles.field}>
              <span>Status</span>
              <select
                aria-label="Status"
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
                  const fields = {
                    initiativeReductionBasisPoints: 'wet',
                    defenseIncreaseBasisPoints: 'fortified',
                    damageTakenMultiplierBasisPoints: 'lowered-guard',
                  }
                  for (const [key, status] of Object.entries(fields))
                    if (next.statusId !== status) Reflect.deleteProperty(next, key)
                  if (!['haste', 'slow'].includes(next.statusId))
                    Reflect.deleteProperty(next, 'movementApAdjustment')
                  if (next.statusId !== 'counter') Reflect.deleteProperty(next, 'counter')
                  else {
                    next.counter ??= { kind: 'full', basisPoints: 10000 }
                    next.stacks = 1
                  }
                  onChange(currentTagForAuthoring(next))
                }}
              >
                {!AUTHORABLE_EFFECT_TAGS.some((tag) => tag.statusId === value.statusId) ? (
                  <option value={value.statusId}>
                    {isBlindsideStatusId(value.statusId) ? 'Blindside' : 'Retained status'}
                  </option>
                ) : null}
                {AUTHORABLE_EFFECT_TAGS.flatMap((tag) =>
                  tag.opcode === 'apply-status' && tag.statusId
                    ? [
                        <option key={tag.id} value={tag.statusId}>
                          {tag.label}
                        </option>,
                      ]
                    : [],
                )}
              </select>
            </label>
          ) : null}
          {!['covert', 'invisible', 'mark', 'marked', 'root'].includes(value.statusId) ? (
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
          ) : null}
          {value.statusId === 'wet' ? (
            <AbilityNumber
              label="Initiative reduction (%)"
              value={(value.initiativeReductionBasisPoints ?? 1000) / 100}
              min={0}
              max={100}
              step={0.01}
              onChange={(percent) =>
                onChange({ ...value, initiativeReductionBasisPoints: Math.round(percent * 100) })
              }
            />
          ) : null}
          {value.statusId === 'fortified' ? (
            <AbilityNumber
              label="Defense increase / outgoing damage reduction (%)"
              value={(value.defenseIncreaseBasisPoints ?? value.potencyBasisPoints ?? 1500) / 100}
              min={0}
              max={100}
              step={0.01}
              onChange={(percent) =>
                onChange({ ...value, defenseIncreaseBasisPoints: Math.round(percent * 100) })
              }
            />
          ) : null}
          {value.statusId === 'lowered-guard' ? (
            <AbilityNumber
              label="Damage taken (%)"
              value={
                (value.damageTakenMultiplierBasisPoints ??
                  (value.potencyBasisPoints === undefined
                    ? 25000
                    : 10000 + value.potencyBasisPoints)) / 100
              }
              min={0}
              step={0.01}
              onChange={(percent) =>
                onChange({ ...value, damageTakenMultiplierBasisPoints: Math.round(percent * 100) })
              }
            />
          ) : null}
          {['haste', 'slow'].includes(value.statusId) ? (
            <AbilityNumber
              label={value.statusId === 'haste' ? 'Movement AP reduction' : 'Movement AP increase'}
              value={value.movementApAdjustment ?? 10}
              min={0}
              max={100}
              onChange={(movementApAdjustment) => onChange({ ...value, movementApAdjustment })}
            />
          ) : null}
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
            </>
          ) : null}
        </div>
      )
      break

    case 'remove-status': {
      const tag = effectAuthoringTag(value).id
      const kind = tag === 'dispel' ? 'buffs' : 'debuffs'
      controls =
        tag === 'cleanse' ? null : (
          <StatusSelectionControls
            kind={kind}
            selected={value.statusIds}
            verb="Remove"
            onChange={(statusIds) =>
              onChange({ ...value, statusIds, removalMode: 'specified', selectionKind: kind })
            }
          />
        )
      break
    }

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
            <strong>
              {value.target && value.target !== 'self' ? 'Each selected recipient' : 'Actor only'}
            </strong>
          </div>
        </div>
      )
      break

    case 'create-terrain':
      controls = (
        <div className={styles.effectStaticGrid}>
          <AbilityNumber
            label="Extra Skill AP cost"
            value={value.skillApSurcharge ?? 10}
            min={0}
            max={100}
            onChange={(skillApSurcharge) => onChange({ ...value, skillApSurcharge })}
          />
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
                onChange({
                  ...value,
                  amount: Math.max(1, integer(event.currentTarget.value, value.amount)),
                })
              }
            />
          </label>
        </div>
      )
      break

    case 'copy-statuses': {
      const kind = value.mode === 'amplify' ? 'copy-buffs' : 'copy-debuffs'
      controls = (
        <StatusSelectionControls
          kind={kind}
          selected={value.statusIds ?? selectableCombatStatusIds(kind)}
          verb="Copy"
          onChange={(statusIds) => onChange({ ...value, statusIds })}
        />
      )
      break
    }

    case 'sensory':
      controls = (
        <div className={styles.typedGrid}>
          <AbilityNumber
            label="Increased damage taken (%)"
            value={(value.increasedDamageTakenBasisPoints ?? 1500) / 100}
            min={0}
            step={0.01}
            onChange={(percent) =>
              onChange({ ...value, increasedDamageTakenBasisPoints: Math.round(percent * 100) })
            }
          />
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
            A hit against an Invisible or Covert target removes both and applies Revealed.
          </p>
        </div>
      )
      break

    default:
      controls = assertNever(value)
  }

  const fixedActor = ['weak-point', 'spike', 'ruin', 'endure', 'reversal'].includes(value.type)
  const fixedImmediate = [
    'weak-point',
    'spike',
    'ruin',
    'reversal',
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
  const hasPotency =
    value.type === 'apply-status' &&
    PERCENTAGE_STATUS_IDS.has(value.statusId) &&
    value.statusId !== 'fortified'
  const maximumDuration =
    value.type === 'healing' || (value.type === 'resource-change' && value.delta > 0) ? 3 : 4
  const minimumDuration = [
    'apply-status',
    'bleed',
    'burn',
    'poison',
    'barrier-change',
    'endure',
  ].includes(value.type)
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
      {!hideTarget && !fixedActor ? (
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
            <AbilityNumber
              label="Effect duration (turns)"
              value={
                value.type === 'barrier-change' && value.durationTurns === undefined
                  ? undefined
                  : durationTurns
              }
              min={minimumDuration}
              max={maximumDuration}
              placeholder={
                value.type === 'barrier-change' ? 'Until depleted (historical)' : undefined
              }
              onChange={changeDuration}
            />
          ) : null}
          {hasPotency && value.type === 'apply-status' ? (
            <AbilityNumber
              label={
                value.statusId === 'wet' ? 'Storm damage increase (%)' : 'Status potency (percent)'
              }
              displayLabel={
                value.statusId === 'wet' ? 'Storm damage increase (%)' : 'Status potency (%)'
              }
              value={
                (value.potencyBasisPoints ??
                  (value.statusId === 'suppress'
                    ? 2500
                    : ['wet', 'conductive'].includes(value.statusId)
                      ? 2000
                      : 1500)) / 100
              }
              min={1}
              max={value.statusId === 'suppress' ? 100 : 50}
              step={0.01}
              onChange={(percent) =>
                onChange({ ...value, potencyBasisPoints: Math.round(percent * 100) })
              }
            />
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

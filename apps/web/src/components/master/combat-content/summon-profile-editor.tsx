'use client'
import { combatPercentageEditIsWithinBounds } from '@/lib/combat-percentage-authoring'

import { useEffect, useMemo, useRef, useId } from 'react'
import type { CombatTargetSpec } from '@aurevane/game-core/combat/actions'
import {
  DEFAULT_SUMMON_CORE_ATTRIBUTES,
  withCurrentSummonCoreAttributes,
  type SummonAbilityDefinition,
  type SummonProfileDefinition,
} from '@aurevane/game-core/combat/summon-content'

import { currentSummonForAuthoring } from '@/lib/combat-current-tag-authoring'
import styles from './combat-content-editor.module.css'
import { SkillMediaEditor } from './skill-media-editor'
import { FinalizedMediaEditor } from './finalized-media-editor'
import { BattleFlavorTemplateHelp } from './battle-flavor-template-help'
import { CONTENT_TEXT_GUIDANCE } from './content-text-guidance'
import { MasterHelp } from '../master-help'
import { SkillEffectListEditor } from './skill-effect-list-editor'
import {
  deriveSharedEffectAim,
  withAuthoredAreaRecipients,
} from '@aurevane/game-core/combat/combat-effect-target-authoring'
import { SkillTargetingEditor } from './skill-targeting-editor'
import { SkillGroundEditor } from './skill-ground-editor'
import {
  withRemappedGroundEntries,
  withCurrentSkillGroundArea,
} from '@/lib/combat-ground-entry-authoring'
import {
  isNativeAuthoredElementalCompanion,
  withNativeElementalCompanions,
} from '@/lib/combat-elemental-authoring'

export interface SummonProfileEditorProps {
  readonly value: SummonProfileDefinition
  readonly onChange: (value: SummonProfileDefinition) => void
  readonly canonical?: boolean
}

function integer(value: string, fallback: number): number {
  if (!value.trim()) return fallback
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) ? parsed : fallback
}

function defaultAbility(index: number): SummonAbilityDefinition {
  return {
    id: `summon.ability-${index + 1}`,
    name: `Summon Skill ${index + 1}`,
    description: 'Describe this Skill.',
    apCost: 45,
    mpCost: 0,
    hpCost: 0,
    cooldownOwnerTurns: 0,
    tags: ['attack'],
    target: {
      kind: 'unit',
      teamPolicy: 'enemy',
      shape: { kind: 'single' },
      minimumRange: 1,
      maximumRange: 1,
      requiresLineOfSight: true,
      maximumElevationDifference: 0,
      friendlyFire: 'enemies-only',
    } satisfies CombatTargetSpec,
    requirements: [],
    effects: [{ type: 'damage', recipient: 'primary-unit', amount: 1, durationTurns: 0 }],
    ai: {
      baseUtility: 50,
      purposeTags: ['damage'],
    },
    media: {
      iconKey: null,
      audioCueKey: null,
      vfxKey: null,
    },
  }
}

export function SummonProfileEditor({
  value: captured,
  onChange,
  canonical = false,
}: SummonProfileEditorProps) {
  const textHintId = useId()
  const value = useMemo(() => currentSummonForAuthoring(captured), [captured])
  const latest = useRef(value)
  useEffect(() => {
    latest.current = value
  }, [value])
  function emit(next: SummonProfileDefinition) {
    if (!combatPercentageEditIsWithinBounds(latest.current, next)) return
    const authored = currentSummonForAuthoring(next)
    latest.current = authored
    onChange(authored)
  }
  function updateAbility(index: number, next: SummonAbilityDefinition) {
    const previous = latest.current.abilities[index]!
    next = withRemappedGroundEntries(previous, next)
    const effects = withNativeElementalCompanions(previous.effects, next.effects)
    next = withRemappedGroundEntries(next, {
      ...next,
      effects,
      target:
        next.effects !== previous.effects && next.target === previous.target
          ? deriveSharedEffectAim(
              next.target,
              effects.filter((effect) => !isNativeAuthoredElementalCompanion(effect)),
            )
          : next.target,
    })
    next = withCurrentSkillGroundArea(previous, next)
    emit({
      ...latest.current,
      abilities: latest.current.abilities.map((ability, abilityIndex) =>
        abilityIndex === index ? next : ability,
      ),
    })
  }

  return (
    <fieldset className={`${styles.typedGroup} ${styles.summonProfile}`} data-summon-profile-editor>
      <legend>Summon Profile</legend>
      <div className={styles.typedGrid}>
        <label className={styles.field}>
          <span>Summon name</span>
          <input
            aria-label="Summon name"
            value={value.name}
            onChange={(event) => emit({ ...value, name: event.currentTarget.value })}
          />
        </label>
        <label className={styles.field}>
          <span>Lifetime (summon turns)</span>
          <input
            aria-label="Summon lifetime turns"
            type="number"
            min={1}
            step={1}
            value={value.lifetimeTurns}
            onChange={(event) =>
              emit({
                ...value,
                lifetimeTurns: integer(event.currentTarget.value, value.lifetimeTurns),
              })
            }
          />
        </label>
        <label className={styles.field}>
          <span>Summon potency (%)</span>
          <input
            aria-label="Summon potency (%)"
            type="number"
            min={0}
            step={0.01}
            placeholder="Uncapped"
            value={value.potencyBasisPoints === undefined ? '' : value.potencyBasisPoints / 100}
            onChange={(event) => {
              const percent = Number(event.currentTarget.value)
              if (!event.currentTarget.value.trim()) {
                const next = { ...latest.current }
                delete next.potencyBasisPoints
                emit(next)
              } else if (percent >= 0 && Number.isSafeInteger(Math.round(percent * 100)))
                emit({ ...latest.current, potencyBasisPoints: Math.round(percent * 100) })
            }}
          />
          <small className={styles.fieldHint}>
            Scales a shared damage budget each round from the summoner’s and strongest living
            opponent’s damage potential at spawn. All hits, targets and damage-over-time ticks share
            it. Above 100% increases the budget; leave blank for uncapped damage.
          </small>
        </label>
        <label className={styles.summonCheckbox}>
          <input
            type="checkbox"
            checked={value.neverMoves ?? false}
            onChange={(event) => emit({ ...value, neverMoves: event.currentTarget.checked })}
          />
          <span>Never moves</span>
        </label>
      </div>
      <details className={styles.summonSection}>
        <summary>Summon portrait</summary>
        <FinalizedMediaEditor
          allowAudio={false}
          value={value.media ?? {}}
          onChange={(media) => {
            const next = { ...latest.current }
            if (media.artwork) next.media = { artwork: media.artwork }
            else delete next.media
            emit(next)
          }}
        />
      </details>
      <fieldset className={styles.typedGroup}>
        <legend>Core stats</legend>
        <div className={styles.summonCoreGrid}>
          {(
            [
              ['might', 'Might'],
              ['finesse', 'Finesse'],
              ['vitality', 'Vitality'],
              ['agility', 'Agility'],
              ['intellect', 'Intellect'],
              ['resolve', 'Resolve'],
            ] as const
          ).map(([key, label]) => {
            const attributes = value.coreAttributes ?? DEFAULT_SUMMON_CORE_ATTRIBUTES
            return (
              <label className={styles.field} key={key}>
                <span>{label}</span>
                <input
                  aria-label={`Summon ${label}`}
                  type="number"
                  min={1}
                  max={60}
                  step={1}
                  value={attributes[key]}
                  onChange={(event) =>
                    emit(
                      withCurrentSummonCoreAttributes(value, {
                        ...attributes,
                        [key]: Math.max(
                          1,
                          Math.min(60, integer(event.currentTarget.value, attributes[key])),
                        ),
                      }),
                    )
                  }
                />
              </label>
            )
          })}
        </div>
      </fieldset>

      <div className={styles.effectList}>
        {value.abilities.map((ability, index) => (
          <article className={styles.effectCard} key={ability.id}>
            <header className={styles.effectHeader}>
              <div>
                <span className={styles.effectOrdinal}>Skill {index + 1}</span>
                <strong>{ability.name}</strong>
              </div>
              <div className={styles.effectActions}>
                <button
                  type="button"
                  disabled={value.abilities.length <= 1}
                  onClick={() =>
                    emit({
                      ...value,
                      abilities: value.abilities.filter(
                        (_, abilityIndex) => abilityIndex !== index,
                      ),
                    })
                  }
                >
                  Remove
                </button>
              </div>
            </header>

            <div className={styles.summonSkillBody} data-summon-skill-body>
              <div className={styles.typedGrid}>
                <label className={styles.field}>
                  <span>Name</span>
                  <input
                    aria-label={`Summon ability ${index + 1} name`}
                    value={ability.name}
                    onChange={(event) =>
                      updateAbility(index, { ...ability, name: event.currentTarget.value })
                    }
                  />
                </label>
                <label className={styles.field}>
                  <span>AP cost</span>
                  <input
                    aria-label={`Summon ability ${index + 1} AP cost`}
                    type="number"
                    min={0}
                    value={ability.apCost}
                    onChange={(event) =>
                      updateAbility(index, {
                        ...ability,
                        apCost: integer(event.currentTarget.value, ability.apCost),
                      })
                    }
                  />
                </label>
                <label className={styles.field}>
                  <span>MP cost</span>
                  <input
                    aria-label={`Summon ability ${index + 1} MP cost`}
                    type="number"
                    min={0}
                    value={ability.mpCost}
                    onChange={(event) =>
                      updateAbility(index, {
                        ...ability,
                        mpCost: integer(event.currentTarget.value, ability.mpCost),
                      })
                    }
                  />
                </label>
                <label className={styles.field}>
                  <span>HP cost</span>
                  <input
                    aria-label={`Summon ability ${index + 1} HP cost`}
                    type="number"
                    min={0}
                    value={ability.hpCost ?? 0}
                    onChange={(event) =>
                      updateAbility(index, {
                        ...ability,
                        hpCost: integer(event.currentTarget.value, ability.hpCost ?? 0),
                      })
                    }
                  />
                </label>
                <label className={styles.field}>
                  <span>Cooldown (turns)</span>
                  <input
                    aria-label={`Summon ability ${index + 1} cooldown turns`}
                    type="number"
                    min={0}
                    value={ability.cooldownOwnerTurns ?? 0}
                    onChange={(event) =>
                      updateAbility(index, {
                        ...ability,
                        cooldownOwnerTurns: integer(
                          event.currentTarget.value,
                          ability.cooldownOwnerTurns ?? 0,
                        ),
                      })
                    }
                  />
                </label>
                {!ability.effects.some((effect) => effect.type === 'reversal') ? (
                  <>
                    <label className={styles.field}>
                      <span>Action type</span>
                      <select
                        aria-label={`Summon ability ${index + 1} action type`}
                        value={ability.tags.includes('attack') ? 'attack' : 'support'}
                        onChange={(event) =>
                          updateAbility(index, {
                            ...ability,
                            tags:
                              event.currentTarget.value === 'attack'
                                ? [...new Set([...ability.tags, 'attack'])]
                                : ability.tags.filter((tag) => tag !== 'attack'),
                          })
                        }
                      >
                        <option value="attack">Attack</option>
                        <option
                          value="support"
                          disabled={ability.effects.some(
                            (effect) => effect.type === 'damage' && effect.amount > 0,
                          )}
                        >
                          Support
                        </option>
                      </select>
                    </label>
                    <label className={styles.field}>
                      <span>Damage type</span>
                      <select
                        aria-label={`Summon ability ${index + 1} damage type`}
                        value={ability.tags.includes('mystic') ? 'mystic' : 'physical'}
                        onChange={(event) =>
                          updateAbility(index, {
                            ...ability,
                            tags: [
                              ...ability.tags.filter(
                                (tag) => !['physical', 'mystic'].includes(tag),
                              ),
                              event.currentTarget.value,
                            ],
                          })
                        }
                      >
                        <option value="physical">Physical</option>
                        <option value="mystic">Mystical</option>
                      </select>
                    </label>
                  </>
                ) : null}
                <label className={styles.field}>
                  <span>Action priority</span>
                  <input
                    aria-label={`Summon ability ${index + 1} action priority`}
                    type="number"
                    value={ability.ai.baseUtility}
                    onChange={(event) =>
                      updateAbility(index, {
                        ...ability,
                        ai: {
                          ...ability.ai,
                          baseUtility: Number(event.currentTarget.value) || 0,
                        },
                      })
                    }
                  />
                </label>
              </div>

              <label className={styles.field}>
                <span>Description</span>
                <input
                  aria-label={`Summon ability ${index + 1} description`}
                  aria-describedby={`${textHintId}-description-${index}`}
                  value={ability.description}
                  onChange={(event) =>
                    updateAbility(index, { ...ability, description: event.currentTarget.value })
                  }
                />
              </label>

              <MasterHelp label={`Summon ability ${index + 1} description`}>
                <p>{CONTENT_TEXT_GUIDANCE.summonDescription.hint}</p>
                <p>{CONTENT_TEXT_GUIDANCE.summonDescription.help}</p>
              </MasterHelp>
              <small id={`${textHintId}-description-${index}`}>
                {CONTENT_TEXT_GUIDANCE.summonDescription.hint}
              </small>

              <label className={styles.field}>
                <span>In-battle text</span>
                <input
                  aria-label={`Summon ability ${index + 1} in-battle text`}
                  aria-describedby={`${textHintId}-battle-text-${index}`}
                  maxLength={160}
                  placeholder="{actor} calls upon {ability}."
                  value={ability.battleText ?? ''}
                  onChange={(event) => {
                    const next = { ...ability }
                    if (event.currentTarget.value.trim())
                      next.battleText = event.currentTarget.value
                    else Reflect.deleteProperty(next, 'battleText')
                    updateAbility(index, next)
                  }}
                />
              </label>
              <BattleFlavorTemplateHelp
                label={`Summon ability ${index + 1} in-battle text tags`}
                guidance={CONTENT_TEXT_GUIDANCE.battleText}
                value={ability.battleText ?? ''}
                ability={ability.name}
                onChange={(battleText) => updateAbility(index, { ...ability, battleText })}
              />
              <small id={`${textHintId}-battle-text-${index}`}>
                {CONTENT_TEXT_GUIDANCE.battleText.hint}
              </small>
              <details className={styles.summonSection}>
                <summary>Effects</summary>
                <SkillEffectListEditor
                  allowReversal
                  canonicalDamage={canonical}
                  aim={ability.target}
                  groundSettings={
                    <SkillGroundEditor
                      target={ability.target}
                      effects={ability.effects}
                      value={ability.groundArea}
                      onChange={(groundArea) => {
                        const next = { ...ability }
                        if (groundArea) next.groundArea = groundArea
                        else delete next.groundArea
                        updateAbility(index, next)
                      }}
                    />
                  }
                  value={ability.effects}
                  onChange={(effects) => updateAbility(index, { ...ability, effects })}
                />
              </details>
              <details className={styles.summonSection}>
                <summary>Range &amp; Area</summary>
                <SkillTargetingEditor
                  value={ability.target}
                  effects={ability.effects}
                  v51Rules
                  onChange={(target) =>
                    updateAbility(index, {
                      ...ability,
                      target,
                      effects: withAuthoredAreaRecipients(target, ability.effects),
                    })
                  }
                />
              </details>
              <details className={styles.summonSection}>
                <summary>Artwork &amp; sound</summary>
                <SkillMediaEditor
                  contentId={ability.id}
                  value={ability.media}
                  onChange={(media) => updateAbility(index, { ...ability, media })}
                />
              </details>
            </div>
          </article>
        ))}
      </div>

      <div className={styles.effectAdd}>
        <button
          type="button"
          disabled={value.abilities.length >= 2}
          onClick={() =>
            emit({
              ...value,
              abilities: [
                ...value.abilities,
                defaultAbility(
                  Math.max(
                    0,
                    ...value.abilities.map((ability) =>
                      Number(ability.id.match(/^summon\.ability-(\d+)$/u)?.[1] ?? 0),
                    ),
                  ),
                ),
              ],
            })
          }
        >
          Add summon Skill
        </button>
        <small className={styles.fieldHint}>Summons can have one or two Skills.</small>
      </div>
    </fieldset>
  )
}

'use client'

import type { CombatTargetSpec } from '@aurevane/game-core/combat/actions'
import type {
  SummonAbilityDefinition,
  SummonProfileDefinition,
} from '@aurevane/game-core/combat/summon-content'

import styles from './combat-content-editor.module.css'
import { BattleFlavorTemplateHelp } from './battle-flavor-template-help'
import { SkillEffectListEditor } from './skill-effect-list-editor'
import { SkillTargetingEditor } from './skill-targeting-editor'

export interface SummonProfileEditorProps {
  readonly value: SummonProfileDefinition
  readonly onChange: (value: SummonProfileDefinition) => void
}

function integer(value: string, fallback: number): number {
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) ? parsed : fallback
}

function csv(value: string): readonly string[] {
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
}

function defaultAbility(index: number): SummonAbilityDefinition {
  return {
    id: `summon.ability-${index + 1}`,
    name: `Summon Ability ${index + 1}`,
    description: 'Describe what this summon ability does.',
    apCost: 45,
    mpCost: 0,
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

export function SummonProfileEditor({ value, onChange }: SummonProfileEditorProps) {
  function updateAbility(index: number, next: SummonAbilityDefinition) {
    onChange({
      ...value,
      abilities: value.abilities.map((ability, abilityIndex) =>
        abilityIndex === index ? next : ability,
      ),
    })
  }

  return (
    <fieldset className={styles.typedGroup} data-summon-profile-editor>
      <legend>Summon Profile</legend>
      <p className={styles.effectNote}>
        This profile is versioned with the parent Skill. Five turns is the standard, but each summon
        can use its own authored lifetime.
      </p>

      <div className={styles.typedGrid}>
        <label className={styles.field}>
          <span>Summon name</span>
          <input
            aria-label="Summon name"
            value={value.name}
            onChange={(event) => onChange({ ...value, name: event.currentTarget.value })}
          />
        </label>
        <label className={styles.field}>
          <span>Profile ID</span>
          <input
            aria-label="Summon profile ID"
            value={value.id}
            onChange={(event) => onChange({ ...value, id: event.currentTarget.value })}
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
              onChange({
                ...value,
                lifetimeTurns: integer(event.currentTarget.value, value.lifetimeTurns),
              })
            }
          />
          <small className={styles.fieldHint}>
            The summon expires after completing this many of its own turns. Standard is 5.
          </small>
        </label>
        <label className={styles.field}>
          <span>Portrait key</span>
          <input
            aria-label="Summon portrait key"
            value={value.portraitKey}
            onChange={(event) => onChange({ ...value, portraitKey: event.currentTarget.value })}
          />
        </label>
        <label className={styles.field}>
          <span>Tags</span>
          <input
            aria-label="Summon tags"
            value={value.tags.join(', ')}
            onChange={(event) => onChange({ ...value, tags: csv(event.currentTarget.value) })}
          />
        </label>
        <label className={styles.field}>
          <span>AI profile</span>
          <select
            aria-label="Summon AI profile"
            value={value.aiProfile}
            onChange={(event) =>
              onChange({
                ...value,
                aiProfile: event.currentTarget.value as SummonProfileDefinition['aiProfile'],
              })
            }
          >
            <option value="standard">Standard</option>
            <option value="high">High</option>
          </select>
        </label>
        <label className={styles.field}>
          <span>AI purpose tags</span>
          <input
            aria-label="Summon AI purpose tags"
            value={value.aiPurposeTags.join(', ')}
            onChange={(event) =>
              onChange({ ...value, aiPurposeTags: csv(event.currentTarget.value) })
            }
          />
        </label>
        <label className={styles.field}>
          <span>HP</span>
          <input
            aria-label="Summon max HP"
            type="number"
            min={1}
            value={value.maxHp}
            onChange={(event) =>
              onChange({ ...value, maxHp: integer(event.currentTarget.value, value.maxHp) })
            }
          />
        </label>
        <label className={styles.field}>
          <span>MP</span>
          <input
            aria-label="Summon max MP"
            type="number"
            min={0}
            value={value.maxMp}
            onChange={(event) =>
              onChange({ ...value, maxMp: integer(event.currentTarget.value, value.maxMp) })
            }
          />
        </label>
        <label className={styles.field}>
          <span>Initiative</span>
          <input
            aria-label="Summon initiative"
            type="number"
            min={0}
            value={value.initiative}
            onChange={(event) =>
              onChange({
                ...value,
                initiative: integer(event.currentTarget.value, value.initiative),
              })
            }
          />
        </label>
        <label className={styles.field}>
          <span>Movement</span>
          <input
            aria-label="Summon movement budget"
            type="number"
            min={1}
            value={value.movementBudget}
            onChange={(event) =>
              onChange({
                ...value,
                movementBudget: integer(event.currentTarget.value, value.movementBudget),
              })
            }
          />
        </label>
      </div>

      <label className={styles.field}>
        <span>Description</span>
        <input
          aria-label="Summon description"
          value={value.description}
          onChange={(event) => onChange({ ...value, description: event.currentTarget.value })}
        />
      </label>
      <label className={styles.field}>
        <span>Flavor line</span>
        <input
          aria-label="Summon flavor line"
          value={value.flavorLine}
          onChange={(event) => onChange({ ...value, flavorLine: event.currentTarget.value })}
        />
      </label>

      <div className={styles.typedGrid}>
        {(
          [
            ['accuracy', 'Accuracy'],
            ['evasion', 'Evasion'],
            ['armor', 'Armor'],
            ['ward', 'Ward'],
            ['jump', 'Jump'],
            ['physicalPower', 'Physical power'],
            ['mysticPower', 'Mystic power'],
          ] as const
        ).map(([key, label]) => (
          <label className={styles.field} key={key}>
            <span>{label}</span>
            <input
              aria-label={`Summon ${label}`}
              type="number"
              min={0}
              value={value.stats[key]}
              onChange={(event) =>
                onChange({
                  ...value,
                  stats: {
                    ...value.stats,
                    [key]: integer(event.currentTarget.value, value.stats[key]),
                  },
                })
              }
            />
          </label>
        ))}
      </div>

      <div className={styles.effectList}>
        {value.abilities.map((ability, index) => (
          <article className={styles.effectCard} key={ability.id}>
            <header className={styles.effectHeader}>
              <div>
                <span className={styles.effectOrdinal}>Ability {index + 1}</span>
                <strong>{ability.name}</strong>
              </div>
              <div className={styles.effectActions}>
                <button
                  type="button"
                  disabled={value.abilities.length <= 1}
                  onClick={() =>
                    onChange({
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
                <span>Ability ID</span>
                <input
                  aria-label={`Summon ability ${index + 1} ID`}
                  value={ability.id}
                  onChange={(event) =>
                    updateAbility(index, { ...ability, id: event.currentTarget.value })
                  }
                />
              </label>
              <label className={styles.field}>
                <span>AP cost</span>
                <input
                  aria-label={`Summon ability ${index + 1} AP cost`}
                  type="number"
                  min={1}
                  max={100}
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
                  max={20}
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
                <span>Tags</span>
                <input
                  aria-label={`Summon ability ${index + 1} tags`}
                  value={ability.tags.join(', ')}
                  onChange={(event) =>
                    updateAbility(index, { ...ability, tags: csv(event.currentTarget.value) })
                  }
                />
              </label>
              <label className={styles.field}>
                <span>AI utility</span>
                <input
                  aria-label={`Summon ability ${index + 1} AI utility`}
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
              <label className={styles.field}>
                <span>AI purpose tags</span>
                <input
                  aria-label={`Summon ability ${index + 1} AI purpose tags`}
                  value={ability.ai.purposeTags.join(', ')}
                  onChange={(event) =>
                    updateAbility(index, {
                      ...ability,
                      ai: { ...ability.ai, purposeTags: csv(event.currentTarget.value) },
                    })
                  }
                />
              </label>
              <label className={styles.field}>
                <span>Icon key</span>
                <input
                  aria-label={`Summon ability ${index + 1} icon key`}
                  value={ability.media.iconKey ?? ''}
                  onChange={(event) =>
                    updateAbility(index, {
                      ...ability,
                      media: { ...ability.media, iconKey: event.currentTarget.value || null },
                    })
                  }
                />
              </label>
            </div>

            <label className={styles.field}>
              <span>Description</span>
              <input
                aria-label={`Summon ability ${index + 1} description`}
                value={ability.description}
                onChange={(event) =>
                  updateAbility(index, { ...ability, description: event.currentTarget.value })
                }
              />
            </label>

            <label className={styles.field}>
              <span>In-battle text</span>
              <input
                aria-label={`Summon ability ${index + 1} in-battle text`}
                maxLength={160}
                placeholder="{actor} calls upon {ability}."
                value={ability.battleText ?? ''}
                onChange={(event) => {
                  const next = { ...ability }
                  if (event.currentTarget.value.trim()) next.battleText = event.currentTarget.value
                  else Reflect.deleteProperty(next, 'battleText')
                  updateAbility(index, next)
                }}
              />
            </label>
            <BattleFlavorTemplateHelp
              value={ability.battleText ?? ''}
              ability={ability.name}
              onChange={(battleText) => updateAbility(index, { ...ability, battleText })}
            />
            <SkillTargetingEditor
              value={ability.target}
              v51Rules
              onChange={(target) => updateAbility(index, { ...ability, target })}
            />

            <SkillEffectListEditor
              value={ability.effects}
              onChange={(effects) => updateAbility(index, { ...ability, effects })}
            />
          </article>
        ))}
      </div>

      <div className={styles.effectAdd}>
        <button
          type="button"
          disabled={value.abilities.length >= 2}
          onClick={() =>
            onChange({
              ...value,
              abilities: [...value.abilities, defaultAbility(value.abilities.length)],
            })
          }
        >
          Add summon ability
        </button>
        <small className={styles.fieldHint}>Summons can have one or two authored abilities.</small>
      </div>
    </fieldset>
  )
}

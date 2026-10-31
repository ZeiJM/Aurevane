'use client'

import { AreaRecipientRepair } from './area-recipient-repair'
import { readMechanicsBody, writeMechanicsBody } from './essence-editor-mechanics'
import { newResonanceAbility } from './new-resonance-ability'
import { TagWordingFields } from './tag-wording-fields'

import { useId, useState, type ReactNode } from 'react'
import type { CombatContentDefinition, CombatContentKind } from '@aurevane/db/combat-content'
import type {
  AuthoredDiscipline,
  AuthoredDisciplineUnlock,
  AuthoredItem,
  AuthoredTransformation,
} from '@aurevane/game-core/content/authored-content'
import type { BasicSkillDefinition } from '@aurevane/game-core/combat/combat-basic-actions'
import { BASIC_SKILL_IDS } from '@aurevane/game-core/combat/combat-basic-actions'
import type { MatureSkillDefinition } from '@aurevane/game-core/combat/mature-skills'
import type { AnyResonanceDefinition } from '@aurevane/game-core/combat/resonance'
import { defaultBasicSkills } from '@aurevane/game-core/combat/combat-basic-actions'
import type { AbilityDefinition } from '@aurevane/game-core/combat/combat-definition'
import type { RequirementNode } from '@aurevane/game-core/combat/combat-requirements'
import {
  AbilityEditorTabs,
  ABILITY_EDITOR_SECTIONS,
  type AbilityEditorSection,
} from './ability-editor-tabs'
import { AbilityDefinitionEditor } from './ability-definition-editor'
import { AbilityRequirementEditor } from './ability-requirement-editor'
import { AbilityNumber, AbilitySelect, AbilityText } from './ability-editor-fields'
import { BattleFlavorTemplateHelp } from './battle-flavor-template-help'
import { SkillMediaEditor } from './skill-media-editor'
import { FinalizedMediaEditor } from './finalized-media-editor'
import { SkillTargetingEditor } from './skill-targeting-editor'
import { SkillGroundEditor, withSkillGroundArea } from './skill-ground-editor'
import { SkillEconomyEditor } from './skill-economy-editor'
import {
  deriveSharedEffectAim,
  withAuthoredAreaRecipients,
  hasSelectedAimRequirement,
} from '@aurevane/game-core/combat/combat-effect-target-authoring'
import { SkillFormatUpgradeControl } from './skill-format-upgrade-control'
import { SkillEffectListEditor } from './skill-effect-list-editor'
import { withRemappedGroundEntries } from '@/lib/combat-ground-entry-authoring'
import { ResonanceMechanicsFields } from './resonance-mechanics-fields'
import { SummonProfileEditor } from './summon-profile-editor'
import { isMaterializedCombatEffect } from '@aurevane/game-core/combat/summon-content'
import styles from './game-content-workspace.module.css'
import { contentArtworkDefault } from '@/media/content-artwork-defaults'
import { disciplineSigilArtwork } from '@/media/discipline-sigil-art'
import { MasterHelp } from '../master-help'
import { contentRecordName } from './content-record-workflow'

export type ContentEditorTab =
  | 'Parameters'
  | 'Skills'
  | 'Resonances'
  | 'Text'
  | 'Media'
  | 'History'
  | 'Identity & Relations'
  | 'Usage & Balance'
export interface ContentReference {
  contentKey: string
  name: string
  contentKind: CombatContentKind
  sourceDisciplineId?: string
  disciplinePair?: readonly string[]
}
export function withContentIdentityText(
  kind: CombatContentKind,
  value: CombatContentDefinition,
  field: 'name' | 'description',
  text: string,
): CombatContentDefinition {
  return {
    ...value,
    [field]: text,
    ...(kind === 'essence' ? { skill: { ...objectValue(value.skill), [field]: text } } : {}),
  }
}
export const asDefinition = (value: object) => value as CombatContentDefinition
export const objectValue = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
const text = (value: unknown) => (typeof value === 'string' ? value : '')
function Toggle({
  label,
  value,
  onChange,
}: {
  label: string
  value: boolean
  onChange(value: boolean): void
}) {
  return (
    <label className={styles.toggle}>
      <input
        type="checkbox"
        checked={value}
        onChange={(event) => onChange(event.currentTarget.checked)}
      />
      {label}
    </label>
  )
}
export function ContentReferenceSelect({
  label,
  value,
  choices,
  kind,
  onChange,
  optional = false,
}: {
  label: string
  value: string
  choices: readonly ContentReference[]
  kind: CombatContentKind
  onChange(value: string): void
  optional?: boolean
}) {
  const entries = choices.filter((row) => row.contentKind === kind)
  return (
    <label>
      {label}
      <select
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
      >
        <option value="">{optional ? 'None' : 'Choose content'}</option>
        {value && !entries.some((row) => row.contentKey === value) ? (
          <option value={value}>{value}</option>
        ) : null}
        {entries.map((row) => (
          <option key={row.contentKey} value={row.contentKey}>
            {row.name}
          </option>
        ))}
      </select>
    </label>
  )
}
/** Lossless retained settings stay editable with explicit parse errors; validation remains server-owned. */
function JsonSettings({
  label,
  value,
  onChange,
}: {
  label: string
  value: unknown
  onChange(value: unknown): void
}) {
  const [error, setError] = useState('')
  return (
    <details>
      <summary>{label}</summary>
      <label>
        {label}
        <textarea
          aria-label={label}
          rows={8}
          defaultValue={JSON.stringify(value, null, 2)}
          key={JSON.stringify(value)}
          onBlur={(event) => {
            try {
              const parsed: unknown = JSON.parse(event.currentTarget.value)
              onChange(parsed)
              setError('')
            } catch (cause) {
              setError(
                cause instanceof Error
                  ? cause.message
                  : 'Enter valid JSON. Your saved content has not changed.',
              )
            }
          }}
        />
      </label>
      {error ? <p role="alert">{error}</p> : null}
    </details>
  )
}
export function flattenUnlockRules(
  rules: readonly AuthoredDisciplineUnlock[],
): AuthoredDisciplineUnlock[] {
  return rules.flatMap((rule) => (rule.kind === 'all' ? flattenUnlockRules(rule.rules) : [rule]))
}
function UnlockFields({
  value,
  onChange,
  choices,
  depth = 0,
}: {
  value: AuthoredDiscipline['unlock']
  onChange(value: AuthoredDiscipline['unlock']): void
  choices: readonly ContentReference[]
  depth?: number
}) {
  const rules = value.kind === 'all' ? flattenUnlockRules(value.rules) : []
  return (
    <fieldset>
      <legend>Unlock conditions</legend>
      <AbilitySelect
        label={`Unlock rule${depth ? ` ${depth}` : ''}`}
        value={value.kind}
        options={
          depth === 0
            ? (['always', 'mastery', 'rekindling', 'all', 'unavailable'] as const)
            : (['always', 'mastery', 'rekindling'] as const)
        }
        optionLabels={{
          always: 'No requirements',
          mastery: 'Discipline mastery',
          rekindling: 'Rekindling count',
          all: 'Meet all requirements',
          unavailable: 'Grant to player',
        }}
        onChange={(kind) =>
          onChange(
            kind === 'mastery'
              ? {
                  kind,
                  disciplineId:
                    choices.find((row) => row.contentKind === 'discipline')?.contentKey ??
                    'vanguard',
                  minimumStage: 1,
                }
              : kind === 'rekindling'
                ? { kind, minimumCount: 1 }
                : kind === 'all'
                  ? { kind, rules: [{ kind: 'always' }] }
                  : { kind },
          )
        }
      />
      {value.kind === 'mastery' ? (
        <>
          <ContentReferenceSelect
            label="Required Discipline"
            value={value.disciplineId}
            kind="discipline"
            choices={choices}
            onChange={(disciplineId) => onChange({ ...value, disciplineId })}
          />
          <AbilityNumber
            label="Required mastery stage"
            value={value.minimumStage}
            min={1}
            max={5}
            onChange={(minimumStage) =>
              onChange({ ...value, minimumStage: minimumStage as 1 | 2 | 3 | 4 | 5 })
            }
          />
        </>
      ) : null}
      {value.kind === 'rekindling' ? (
        <AbilityNumber
          label="Required Rekindlings"
          value={value.minimumCount}
          min={1}
          max={3}
          onChange={(minimumCount) =>
            onChange({ ...value, minimumCount: minimumCount as 1 | 2 | 3 })
          }
        />
      ) : null}
      {value.kind === 'unavailable' ? <p>Available through explicit player grants.</p> : null}
      {value.kind === 'all' ? (
        <>
          {rules.map((rule, index) => (
            <div key={index}>
              <UnlockFields
                value={rule}
                depth={depth + 1}
                choices={choices}
                onChange={(next) =>
                  onChange({
                    ...value,
                    rules: rules.map((old, i) =>
                      i === index ? (next as AuthoredDisciplineUnlock) : old,
                    ),
                  })
                }
              />
              <button
                type="button"
                onClick={() => onChange({ ...value, rules: rules.filter((_, i) => i !== index) })}
              >
                Remove condition {index + 1}
              </button>
            </div>
          ))}
          <button
            type="button"
            disabled={depth >= 7 || rules.length >= 32}
            onClick={() => onChange({ ...value, rules: [...rules, { kind: 'always' }] })}
          >
            Add condition
          </button>
        </>
      ) : null}
    </fieldset>
  )
}
function DisciplineFields({
  section = 'Parameters',
  value,
  onChange,
  choices,
}: {
  section?: ContentEditorTab
  value: AuthoredDiscipline
  onChange(value: AuthoredDiscipline): void
  choices: readonly ContentReference[]
}) {
  const atlas = value.atlas ?? {
    family: 'foundation' as const,
    band: 'foundation' as const,
    disclosure: 'open' as const,
    power: { reliability: 3, flexibility: 3, setup: 3, ruleAccess: 3, execution: 3 },
  }
  return (
    <>
      {section === 'Parameters' ? (
        <>
          <fieldset>
            <legend>Core attributes and availability</legend>
            <MasterHelp label="Core attributes">
              Core bases total 31. Choose 2–3 focus attributes.
            </MasterHelp>
            <div className={styles.coreAttributes}>
              {Object.entries(value.core).map(([key, amount]) => (
                <div key={key}>
                  <AbilityNumber
                    label={`${key} base`}
                    value={amount}
                    min={1}
                    max={26}
                    onChange={(next) =>
                      onChange({ ...value, core: { ...value.core, [key]: next } })
                    }
                  />
                  <Toggle
                    label={`${key} focus`}
                    value={value.focus.includes(key)}
                    onChange={(enabled) =>
                      onChange({
                        ...value,
                        focus: enabled
                          ? [...value.focus, key]
                          : value.focus.filter((old) => old !== key),
                      })
                    }
                  />
                </div>
              ))}
            </div>
            <Toggle
              label="Available as Primary"
              value={value.enabledForPrimary}
              onChange={(enabledForPrimary) => onChange({ ...value, enabledForPrimary })}
            />
            <Toggle
              label="Available as Secondary"
              value={value.enabledForSecondary}
              onChange={(enabledForSecondary) => onChange({ ...value, enabledForSecondary })}
            />
          </fieldset>
          <UnlockFields
            value={value.unlock}
            choices={choices.filter((row) => row.contentKey !== value.id)}
            onChange={(unlock) => onChange({ ...value, unlock })}
          />
          <fieldset>
            <legend>Classification</legend>
            <AbilitySelect
              label="Discipline family"
              value={atlas.family}
              options={['foundation', 'martial', 'hybrid', 'mage', 'support'] as const}
              onChange={(family) => onChange({ ...value, atlas: { ...atlas, family } })}
            />
          </fieldset>
        </>
      ) : null}
      {section === 'Skills' ? (
        <fieldset>
          <legend>Skill mastery requirements</legend>
          {value.linkedSkills.map((skillId) => (
            <AbilityNumber
              key={skillId}
              label={`Mastery stage for ${choices.find((row) => row.contentKey === skillId)?.name ?? skillId}`}
              min={1}
              max={5}
              value={value.skillStages?.find((row) => row.skillId === skillId)?.minimumStage ?? 1}
              onChange={(minimumStage) =>
                onChange({
                  ...value,
                  skillStages: value.linkedSkills.map((id) => ({
                    skillId: id,
                    minimumStage:
                      id === skillId
                        ? (minimumStage as 1 | 2 | 3 | 4 | 5)
                        : (value.skillStages?.find((row) => row.skillId === id)?.minimumStage ?? 1),
                  })),
                })
              }
            />
          ))}
        </fieldset>
      ) : null}
      {section === 'Resonances' ? (
        <fieldset>
          <legend>Essence and Resonances</legend>
          <ContentReferenceSelect
            label="Pure Discipline Essence"
            kind="essence"
            optional
            value={value.essenceId ?? ''}
            choices={choices}
            onChange={(essenceId) => onChange({ ...value, essenceId: essenceId || null })}
          />
          {(value.resonanceSelections ?? []).map((pair, index) => (
            <div className={styles.pairRow} key={index}>
              <ContentReferenceSelect
                label={`Partner Discipline ${index + 1}`}
                kind="discipline"
                value={pair.withDisciplineId}
                choices={choices.filter((row) => row.contentKey !== value.id)}
                onChange={(withDisciplineId) =>
                  onChange({
                    ...value,
                    resonanceSelections: value.resonanceSelections!.map((old, i) =>
                      i === index ? { ...pair, withDisciplineId } : old,
                    ),
                  })
                }
              />
              <ContentReferenceSelect
                label={`Pair Resonance ${index + 1}`}
                kind="resonance"
                value={pair.resonanceId}
                choices={choices}
                onChange={(resonanceId) =>
                  onChange({
                    ...value,
                    resonanceSelections: value.resonanceSelections!.map((old, i) =>
                      i === index ? { ...pair, resonanceId } : old,
                    ),
                  })
                }
              />
              <button
                type="button"
                onClick={() =>
                  onChange({
                    ...value,
                    resonanceSelections: value.resonanceSelections!.filter((_, i) => i !== index),
                  })
                }
              >
                Remove pair {index + 1}
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() =>
              onChange({
                ...value,
                resonanceSelections: [
                  ...(value.resonanceSelections ?? []),
                  { withDisciplineId: '', resonanceId: '' },
                ],
              })
            }
          >
            Add Resonance relationship
          </button>
        </fieldset>
      ) : null}
    </>
  )
}
function FixedCategoryControls({ passive = false }: { passive?: boolean }) {
  return (
    <div className={styles.fields}>
      <AbilitySelect
        label="Group activation"
        displayLabel="Activation"
        value={passive ? 'passive' : 'manual'}
        options={passive ? ['passive'] : ['manual']}
        optionLabels={{ passive: 'Passive', manual: 'Manual' }}
        disabled
        onChange={() => {}}
      />
      <AbilitySelect
        label="Group mode"
        displayLabel="Ability type"
        value={passive ? 'passive' : 'action'}
        options={passive ? ['passive'] : ['action']}
        optionLabels={{ passive: 'Passive modifier', action: 'Action' }}
        disabled
        onChange={() => {}}
      />
    </div>
  )
}
function SkillMechanics({
  value,
  onChange: update,
  section,
}: {
  section?: AbilityEditorSection
  value: MatureSkillDefinition
  onChange(value: MatureSkillDefinition): void
}) {
  const requiresSelectedUnit = hasSelectedAimRequirement(value.requirements)
  const onChange = (next: MatureSkillDefinition) => {
    next = withRemappedGroundEntries(value, next)
    if (
      !next.ability &&
      next.effects !== value.effects &&
      next.effects.some((effect) => ['burn', 'bleed', 'poison'].includes(effect.type))
    )
      next = {
        ...next,
        tags: [
          ...new Set([
            ...next.tags,
            'attack' as const,
            ...(!next.tags.some((tag) => tag === 'physical' || tag === 'mystic')
              ? ['physical' as const]
              : []),
          ]),
        ],
      }

    if (!next.ability && next.target !== value.target)
      next = {
        ...next,
        effects: withAuthoredAreaRecipients(next.target, next.effects, { requiresSelectedUnit }),
      }
    update({
      ...next,
      target:
        next.ability ||
        (next.target.maximumSelections ?? 1) > 1 ||
        (next.effects === value.effects && next.target === value.target)
          ? next.target
          : deriveSharedEffectAim(next.target, next.effects, {
              requiresSelectedUnit: hasSelectedAimRequirement(next.requirements),
            }),
    })
  }
  if (value.ability)
    return (
      <AbilityDefinitionEditor
        value={value.ability}
        category="manual"
        section={section}
        effectDescriptions={value.effectDescriptions}
        onChange={(ability, effectDescriptions) =>
          onChange({ ...value, ability, effectDescriptions })
        }
      />
    )
  return (
    <>
      {(!section || section === 'details') && <FixedCategoryControls />}
      <AreaRecipientRepair
        target={value.target}
        effects={value.effects}
        requiresSelectedUnit={requiresSelectedUnit}
        onChange={(effects) => onChange({ ...value, effects })}
      />
      {(!section || section === 'range') && (
        <>
          <SkillTargetingEditor
            value={value.target}
            effects={value.effects}
            requiresSelectedUnit={requiresSelectedUnit}
            v51Rules={value.authoring.validationTags.includes('owner-rebalance-v5-1')}
            onChange={(target) => onChange({ ...value, target })}
          />
          <SkillGroundEditor
            target={value.target}
            effects={value.effects}
            value={value.groundArea}
            onChange={(groundArea) => onChange(withSkillGroundArea(value, groundArea))}
          />
        </>
      )}
      {(!section || section === 'execution' || section === 'economy' || section === 'accuracy') && (
        <SkillEconomyEditor
          value={value}
          section={
            section === 'accuracy' ? 'accuracy' : section === 'economy' ? 'economy' : undefined
          }
          cooldownLockedByRequirement={value.requirements.length > 0}
          onChange={(economy) => onChange({ ...value, ...economy })}
        />
      )}
      {(!section || section === 'effects') && (
        <>
          <SkillFormatUpgradeControl value={value} onChange={onChange} />
          <SkillEffectListEditor
            aim={value.target}
            value={value.effects.filter(isMaterializedCombatEffect)}
            effectDescriptions={value.effectDescriptions?.filter(
              (_, index) => value.effects[index]?.type !== 'summon',
            )}
            onChange={(effects, effectDescriptions) =>
              onChange({
                ...value,
                effects: [
                  ...effects,
                  ...value.effects.filter((effect) => effect.type === 'summon'),
                ],
                effectDescriptions: [
                  ...effectDescriptions,
                  ...value.effects.flatMap((effect, index) =>
                    effect.type === 'summon' ? [value.effectDescriptions?.[index] ?? null] : [],
                  ),
                ],
              })
            }
          />
          {value.summonProfile ? (
            <SummonProfileEditor
              value={value.summonProfile}
              onChange={(summonProfile) => onChange({ ...value, summonProfile })}
            />
          ) : null}
        </>
      )}
      {(!section || section === 'details') && (
        <JsonSettings
          label="Retained Skill requirements"
          value={value.requirements}
          onChange={(requirements) =>
            onChange({
              ...value,
              requirements: requirements as MatureSkillDefinition['requirements'],
            })
          }
        />
      )}
    </>
  )
}
export function ContentDefinitionFields({
  kind,
  value,
  tab,
  onChange,
  choices = [],
  abilitySection,
  initialAbilitySection,
  onPendingMediaChange,
}: {
  kind: CombatContentKind
  value: CombatContentDefinition
  tab: ContentEditorTab
  abilitySection?: AbilityEditorSection
  initialAbilitySection?: AbilityEditorSection
  onPendingMediaChange?(pending: boolean): void
  onChange(value: CombatContentDefinition): void
  choices?: readonly ContentReference[]
}) {
  if (kind === 'tag' && tab === 'Parameters')
    return <TagWordingFields value={value} onChange={onChange} />
  const set = (patch: Record<string, unknown>) => onChange({ ...value, ...patch })
  const basic =
    kind === 'skill' && (BASIC_SKILL_IDS as readonly string[]).includes(String(value.id))
  const combat = kind === 'skill' || kind === 'essence' || kind === 'resonance'
  const body = readMechanicsBody(kind, value)
  const setBody = (next: CombatContentDefinition) => onChange(writeMechanicsBody(kind, value, next))
  const name = contentRecordName(value)
  if (tab === 'Parameters' && combat && !abilitySection)
    return (
      <AbilityEditorTabs
        key={String(value.id ?? value.essenceId ?? kind)}
        initialSection={initialAbilitySection}
        panels={
          Object.fromEntries(
            ABILITY_EDITOR_SECTIONS.map((section) => [
              section.id,
              <ContentDefinitionFields
                key={section.id}
                kind={kind}
                value={value}
                choices={choices}
                onChange={onChange}
                onPendingMediaChange={onPendingMediaChange}
                tab={section.id === 'media' ? 'Media' : 'Parameters'}
                abilitySection={section.id}
              />,
            ]),
          ) as Record<AbilityEditorSection, ReactNode>
        }
      />
    )
  const details = !combat || abilitySection === 'details'
  if (tab === 'Media') {
    if (kind === 'effect-profile' || kind === 'status')
      return <p>Media has no supported use for this category.</p>
    return combat ? (
      <SkillMediaEditor
        contentId={String(body.id ?? value.id ?? value.essenceId)}
        value={body.media as MatureSkillDefinition['media']}
        onChange={(media) => setBody({ ...body, media })}
        onPendingMediaChange={onPendingMediaChange}
      />
    ) : (
      <>
        <FinalizedMediaEditor
          value={objectValue(value.media)}
          allowAudio={false}
          showArtworkRemoval={kind !== 'discipline'}
          fallbackArtwork={
            kind === 'discipline'
              ? (disciplineSigilArtwork(String(value.id)) ?? undefined)
              : undefined
          }
          onChange={(media) => set({ media: { ...objectValue(value.media), ...media } })}
          onPendingMediaChange={onPendingMediaChange}
        />
        {kind === 'discipline' && (
          <button
            type="button"
            onClick={() => {
              const baseline = contentArtworkDefault(String(value.id))
              set({
                media: {
                  ...objectValue(value.media),
                  artwork: baseline.artwork,
                  artworkId: baseline.artworkId,
                },
              })
            }}
          >
            Restore default artwork
          </button>
        )}
      </>
    )
  }
  if (tab === 'Text')
    return (
      <ContentDescriptionFields kind={kind} value={value} choices={choices} onChange={onChange} />
    )
  if (kind === 'discipline' && (tab === 'Skills' || tab === 'Resonances'))
    return (
      <DisciplineFields
        section={tab}
        value={value as unknown as AuthoredDiscipline}
        choices={choices}
        onChange={(next) => onChange(asDefinition(next))}
      />
    )
  if (tab !== 'Parameters') return null
  if (kind === 'effect-profile')
    return (
      <p>This retained record is read-only: no supported authoring schema or runtime adapter.</p>
    )
  return (
    <>
      {details && (
        <fieldset className={styles.identityGroup}>
          <legend>Identity</legend>
          <AbilityText
            label="Name"
            value={name}
            maxLength={kind === 'discipline' ? 80 : 120}
            onChange={(name) => onChange(withContentIdentityText(kind, value, 'name', name))}
          />
          {kind !== 'status' ? (
            <Toggle
              label="Enabled"
              value={value.enabled !== false}
              onChange={(enabled) => set({ enabled })}
            />
          ) : null}
          {!combat && kind !== 'status' ? (
            <AbilityNumber
              label="Display order"
              min={0}
              max={1000000}
              value={Number(value.sortOrder ?? 0)}
              onChange={(sortOrder) => set({ sortOrder })}
            />
          ) : null}
          {kind === 'skill' && !basic ? (
            <ContentReferenceSelect
              label="Source Discipline"
              kind="discipline"
              value={text(value.sourceDisciplineId)}
              choices={choices}
              onChange={(sourceDisciplineId) => set({ sourceDisciplineId })}
            />
          ) : null}
        </fieldset>
      )}
      {details && !combat && (
        <ContentDescriptionFields kind={kind} value={value} choices={choices} onChange={onChange} />
      )}
      {!combat && kind !== 'discipline' && kind !== 'status' && kind !== 'tag' ? (
        <details className={styles.mediaSection}>
          <summary>Artwork</summary>
          <FinalizedMediaEditor
            value={objectValue(value.media)}
            allowAudio={false}
            onChange={(media) => set({ media: { ...objectValue(value.media), ...media } })}
            onPendingMediaChange={onPendingMediaChange}
          />
        </details>
      ) : null}
      {kind === 'status' ? (
        <fieldset>
          <legend>Status mechanics</legend>
          <AbilitySelect
            label="Presentation kind"
            value={text(value.kind) || 'Effect'}
            options={['Buff', 'Debuff', 'Effect'] as const}
            onChange={(kind) => set({ kind })}
          />
          <AbilityNumber
            label="Maximum stacks"
            value={Number(value.maximumStacks)}
            min={1}
            max={999}
            onChange={(maximumStacks) => set({ maximumStacks })}
          />
          <AbilityNumber
            label="Duration (owner turn starts)"
            value={Number(value.durationOwnerTurnStarts)}
            min={0}
            max={999}
            onChange={(durationOwnerTurnStarts) => set({ durationOwnerTurnStarts })}
          />
          <AbilityNumber
            label="Damage taken multiplier (%)"
            value={Number(value.damageTakenMultiplierBasisPoints) / 100}
            min={0}
            max={1000}
            step={0.01}
            onChange={(amount) =>
              set({ damageTakenMultiplierBasisPoints: Math.round(amount * 100) })
            }
          />
          <AbilitySelect
            label="Polarity"
            value={text(value.polarity) || 'neutral'}
            options={['positive', 'negative', 'neutral', 'mixed'] as const}
            onChange={(polarity) => set({ polarity })}
          />
          <AbilitySelect
            label="Reaction class"
            value={text(value.reactionClass) || (value.endOfTurn ? 'periodic' : 'ordinary')}
            options={['ordinary', 'periodic', 'reactive', 'self-cost', 'system'] as const}
            onChange={(reactionClass) => set({ reactionClass })}
          />
          <Toggle
            label="Amplify copyable"
            value={value.amplifyCopyable === true}
            onChange={(amplifyCopyable) => set({ amplifyCopyable })}
          />
          <Toggle
            label="Curse copyable"
            value={value.curseCopyable === true}
            onChange={(curseCopyable) => set({ curseCopyable })}
          />
          <JsonSettings
            label="Status modifiers and conditions"
            value={value.damageModifiers ?? []}
            onChange={(damageModifiers) => set({ damageModifiers })}
          />
          <JsonSettings
            label="Status gameplay Tags"
            value={value.gameplayTags ?? []}
            onChange={(gameplayTags) => set({ gameplayTags })}
          />
        </fieldset>
      ) : null}
      {kind === 'discipline' ? (
        <DisciplineFields
          value={value as unknown as AuthoredDiscipline}
          choices={choices}
          onChange={(next) => onChange(asDefinition(next))}
        />
      ) : null}
      {kind === 'skill' && basic
        ? (() => {
            const skill = value as unknown as BasicSkillDefinition
            return (
              <>
                {(!abilitySection ||
                  abilitySection ===
                    (skill.execution.kind === 'basic-move' ? 'economy' : 'effects') ||
                  (skill.execution.kind === 'basic-move' && abilitySection === 'execution')) && (
                  <>
                    <fieldset>
                      <legend>Native execution</legend>
                      {skill.execution.kind === 'basic-move' ? (
                        <AbilitySelect
                          label="Move cost basis"
                          value={skill.execution.costBasis}
                          options={['flat', 'per-terrain-point'] as const}
                          onChange={(costBasis) =>
                            set({ execution: { ...skill.execution, costBasis } })
                          }
                        />
                      ) : skill.execution.kind === 'basic-attack' ? (
                        <AbilityNumber
                          label="Higher Power scaling (%)"
                          value={skill.execution.scalingBasisPoints / 100}
                          min={0}
                          max={100}
                          step={0.01}
                          onChange={(amount) =>
                            set({
                              execution: {
                                ...skill.execution,
                                scalingBasisPoints: Math.round(amount * 100),
                              },
                            })
                          }
                        />
                      ) : (
                        <AbilitySelect
                          label="Recovery rounding"
                          value={skill.execution.recoveryRounding ?? 'floor'}
                          options={['nearest', 'floor'] as const}
                          onChange={(recoveryRounding) =>
                            set({ execution: { ...skill.execution, recoveryRounding } })
                          }
                        />
                      )}
                    </fieldset>
                  </>
                )}
                <AbilityDefinitionEditor
                  value={skill.ability}
                  section={abilitySection}
                  allowEffectDescriptions={false}
                  onChange={(ability) => set({ ability })}
                />
              </>
            )
          })()
        : null}
      {(kind === 'skill' && !basic) || kind === 'essence' ? (
        <SkillMechanics
          value={body as unknown as MatureSkillDefinition}
          section={abilitySection}
          onChange={(next) => setBody(asDefinition(next))}
        />
      ) : null}
      {kind === 'resonance' ? (
        <>
          {details && (
            <div className={styles.fields}>
              {(value.disciplinePair as string[]).map((id, index) => (
                <ContentReferenceSelect
                  key={index}
                  label={`Resonance Discipline ${index + 1}`}
                  kind="discipline"
                  value={id}
                  choices={choices}
                  onChange={(next) =>
                    set({
                      disciplinePair: (value.disciplinePair as string[]).map((old, i) =>
                        i === index ? next : old,
                      ),
                    })
                  }
                />
              ))}
            </div>
          )}
          {value.ability ? (
            <AbilityDefinitionEditor
              value={value.ability as AbilityDefinition}
              category="passive"
              section={abilitySection}
              allowEffectDescriptions={false}
              onChange={(ability) => set({ ability })}
            />
          ) : (
            <>
              {abilitySection === 'effects' && (
                <details>
                  <summary>Replace retained mechanics with the full editor</summary>
                  <p>
                    This replaces this draft’s older sequence trigger and effects with an editable
                    automatic Self Barrier starter. Configure its activation, requirements and
                    effects before saving. Saved versions stay intact.
                  </p>
                  <button type="button" onClick={() => set({ ability: newResonanceAbility() })}>
                    Start full Resonance editor
                  </button>
                </details>
              )}
              {details && <FixedCategoryControls passive />}
              <ResonanceMechanicsFields
                value={value as unknown as AnyResonanceDefinition}
                section={abilitySection}
                onChange={(next) => onChange(asDefinition(next))}
              />
            </>
          )}
        </>
      ) : null}
      {details && combat && (
        <ContentDescriptionFields kind={kind} value={value} choices={choices} onChange={onChange} />
      )}
      {kind === 'item' || kind === 'ascension' || kind === 'severence'
        ? (() => {
            const future = value as unknown as AuthoredItem | AuthoredTransformation
            return (
              <>
                {kind === 'item' ? (
                  <>
                    <AbilitySelect
                      label="Item class"
                      value={(future as AuthoredItem).itemClass}
                      options={
                        [
                          'weapon',
                          'armor',
                          'accessory',
                          'consumable',
                          'tool',
                          'material',
                          'relic',
                          'key',
                        ] as const
                      }
                      onChange={(itemClass) => set({ itemClass })}
                    />
                    <AbilitySelect
                      label="Usage intent"
                      value={(future as AuthoredItem).usage}
                      options={['active', 'passive', 'none'] as const}
                      onChange={(usage) => set({ usage })}
                    />
                    <AbilitySelect
                      label="Equipment intent"
                      value={(future as AuthoredItem).equipmentSlot ?? ''}
                      options={['', 'weapon', 'armor', 'accessory'] as const}
                      onChange={(equipmentSlot) => set({ equipmentSlot: equipmentSlot || null })}
                    />
                  </>
                ) : (
                  <>
                    <AbilityText
                      label="Form name"
                      value={(future as AuthoredTransformation).formName}
                      onChange={(formName) => set({ formName })}
                    />
                    <label>
                      Transformation description
                      <textarea
                        aria-label="Transformation description"
                        value={(future as AuthoredTransformation).transformation.description}
                        onChange={(event) =>
                          set({
                            transformation: {
                              ...(future as AuthoredTransformation).transformation,
                              description: event.currentTarget.value,
                            },
                          })
                        }
                      />
                    </label>
                  </>
                )}
                <AbilityRequirementEditor
                  value={future.requirements}
                  onChange={(requirements: RequirementNode | null) => set({ requirements })}
                />
                <Toggle
                  label="Define behavior groups"
                  value={future.ability !== null}
                  onChange={(enabled) =>
                    set({
                      ability: enabled
                        ? structuredClone(
                            defaultBasicSkills().find((row) => row.id === 'unarmed.basic')!.ability,
                          )
                        : null,
                    })
                  }
                />
                {future.ability ? (
                  <AbilityDefinitionEditor
                    value={future.ability}
                    onChange={(ability) => set({ ability })}
                  />
                ) : null}
              </>
            )
          })()
        : null}
    </>
  )
}

function ContentDescriptionFields({
  kind,
  value,
  onChange,
}: {
  kind: CombatContentKind
  value: CombatContentDefinition
  choices?: readonly ContentReference[]
  onChange(value: CombatContentDefinition): void
}) {
  const hintId = useId()
  const set = (patch: Record<string, unknown>) => onChange({ ...value, ...patch })
  const body = readMechanicsBody(kind, value)
  const setBody = (next: CombatContentDefinition) => onChange(writeMechanicsBody(kind, value, next))
  const name = contentRecordName(value)
  const basic =
    kind === 'skill' && (BASIC_SKILL_IDS as readonly string[]).includes(String(value.id))
  const combat = kind === 'skill' || kind === 'essence' || kind === 'resonance'
  return (
    <div className={styles.descriptionFields}>
      <div className={styles.descriptionField}>
        <label>
          <span>Description</span>
          <textarea
            aria-label="Description"
            aria-describedby={`${hintId}-description`}
            value={text(value.description)}
            onChange={(event) =>
              onChange(
                withContentIdentityText(kind, value, 'description', event.currentTarget.value),
              )
            }
          />
        </label>
        <small id={`${hintId}-description`}>
          {kind === 'resonance'
            ? 'Shown in Resonance details.'
            : kind === 'skill' || kind === 'essence'
              ? 'Shown in the full ability details.'
              : kind === 'discipline'
                ? 'Shown in Discipline details.'
                : 'Shown in this content’s details.'}
        </small>
      </div>
      {kind === 'tag' ? (
        <div className={styles.descriptionField}>
          <label>
            <span>Full Tag explanation</span>
            <textarea
              aria-label="Full Tag explanation"
              value={text(value.explanation)}
              onChange={(event) => set({ explanation: event.currentTarget.value })}
            />
          </label>
          <small>
            Compact wording: up to 240 characters. Full explanation: up to 2000 characters.
          </small>
        </div>
      ) : null}
      {combat ? (
        <>
          {!basic ? (
            <div className={styles.writingField}>
              <AbilityText
                label="Flavor line"
                value={text(value.flavorLine)}
                maxLength={160}
                onChange={(flavorLine) => set({ flavorLine })}
              />
              <BattleFlavorTemplateHelp
                label="Flavor line tags"
                value={text(value.flavorLine)}
                ability={name}
                onChange={(flavorLine) => set({ flavorLine })}
              />
              <small>Shown on the Skill card.</small>
            </div>
          ) : null}
          {kind !== 'resonance' ? (
            <div className={styles.writingField}>
              <AbilityText
                label="In-battle text"
                value={text(body.battleText)}
                maxLength={160}
                onChange={(battleText) => setBody({ ...body, battleText })}
              />
              <BattleFlavorTemplateHelp
                label="In-battle text tags"
                value={text(body.battleText)}
                ability={name}
                onChange={(battleText) => setBody({ ...body, battleText })}
              />
              <small>Shown in the battle log when this ability is used.</small>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  )
}

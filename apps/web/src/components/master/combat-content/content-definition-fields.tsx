'use client'

import { useMemo, useState } from 'react'
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
import { COMBAT_TAG_REGISTRY } from '@aurevane/game-core/combat/combat-tag-registry'
import { defaultBasicSkills } from '@aurevane/game-core/combat/combat-basic-actions'
import type { AbilityDefinition } from '@aurevane/game-core/combat/combat-definition'
import type { RequirementNode } from '@aurevane/game-core/combat/combat-requirements'
import { AbilityDefinitionEditor } from './ability-definition-editor'
import { AbilityRequirementEditor } from './ability-requirement-editor'
import { AbilityNumber, AbilitySelect, AbilityText } from './ability-editor-fields'
import { AbilityPresentationEditor } from './ability-presentation-editor'
import { BattleFlavorTemplateHelp } from './battle-flavor-template-help'
import { SkillMediaEditor } from './skill-media-editor'
import { FinalizedMediaEditor } from './finalized-media-editor'
import { SkillTargetingEditor } from './skill-targeting-editor'
import { SkillGroundEditor, withSkillGroundArea } from './skill-ground-editor'
import { SkillEconomyEditor } from './skill-economy-editor'
import { SkillEffectListEditor } from './skill-effect-list-editor'
import { ResonanceMechanicsFields } from './resonance-mechanics-fields'
import { SummonProfileEditor } from './summon-profile-editor'
import { isMaterializedCombatEffect } from '@aurevane/game-core/combat/summon-content'
import styles from './game-content-workspace.module.css'
import { phase4DisciplineSigil } from '@/components/battle/phase4-combat-art'
import { MasterHelp } from '../master-help'
import { contentRecordName, contentRecordCommand } from './content-record-workflow'

export type ContentEditorTab =
  'Parameters' | 'Skills' | 'Resonances' | 'Text' | 'Media' | 'History' | 'Identity & Relations'
export interface ContentReference {
  contentKey: string
  name: string
  contentKind: CombatContentKind
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
  const [query, setQuery] = useState(''),
    [results, setResults] = useState<ContentReference[]>([]),
    [cursor, setCursor] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('')
  const [appliedQuery, setAppliedQuery] = useState('')
  const entries = useMemo(
    () => [
      ...new Map(
        [...choices.filter((row) => row.contentKind === kind), ...results].map((row) => [
          row.contentKey,
          row,
        ]),
      ).values(),
    ],
    [choices, kind, results],
  )
  async function search(after?: string) {
    setBusy(true)
    setError('')
    try {
      const page = await contentRecordCommand<
        import('@aurevane/db/combat-content').CombatContentListPage
      >({
        action: 'list',
        kind,
        search: query,
        sort: 'name-asc',
        limit: 20,
        ...(after ? { after } : {}),
      })
      setResults((old) => [
        ...(after ? old : []),
        ...page.records.map((row) => ({ ...row, name: row.name ?? row.contentKey })),
      ])
      setCursor(page.nextCursor)
      setAppliedQuery(query)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to search references.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <div>
      <label>
        {label}
        <select
          aria-label={label}
          value={value}
          onChange={(event) => onChange(event.currentTarget.value)}
        >
          <option value="">{optional ? 'None' : 'Choose content'}</option>
          {value && !entries.some((row) => row.contentKey === value) ? (
            <option value={value}>{value} (linked)</option>
          ) : null}
          {entries.map((row) => (
            <option key={row.contentKey} value={row.contentKey}>
              {row.name}
            </option>
          ))}
        </select>
      </label>
      <details>
        <summary>Find {label}</summary>
        <label>
          Search {label}
          <input
            value={query}
            maxLength={160}
            onChange={(event) => setQuery(event.currentTarget.value)}
          />
        </label>
        <button type="button" disabled={busy} onClick={() => void search()}>
          Search references
        </button>
        <button
          type="button"
          disabled={busy || !cursor || query !== appliedQuery}
          onClick={() => void search(cursor!)}
        >
          More references
        </button>
        {error ? <p role="alert">{error}</p> : null}
      </details>
    </div>
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
  return (
    <fieldset>
      <legend>Unlock conditions</legend>
      <AbilitySelect
        label={`Unlock rule${depth ? ` ${depth}` : ''}`}
        value={value.kind}
        options={['always', 'mastery', 'rekindling', 'all', 'unavailable'] as const}
        optionLabels={{
          always: 'No requirements',
          mastery: 'Discipline mastery',
          rekindling: 'Rekindling count',
          all: 'Meet all requirements',
          unavailable: 'Unavailable',
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
      {value.kind === 'unavailable' ? (
        <p>Complete a supported prerequisite before publishing.</p>
      ) : null}
      {value.kind === 'all' ? (
        <>
          {value.rules.map((rule, index) => (
            <div key={index}>
              <UnlockFields
                value={rule}
                depth={depth + 1}
                choices={choices}
                onChange={(next) =>
                  onChange({
                    ...value,
                    rules: value.rules.map((old, i) =>
                      i === index ? (next as AuthoredDisciplineUnlock) : old,
                    ),
                  })
                }
              />
              <button
                type="button"
                onClick={() =>
                  onChange({ ...value, rules: value.rules.filter((_, i) => i !== index) })
                }
              >
                Remove condition {index + 1}
              </button>
            </div>
          ))}
          <button
            type="button"
            disabled={depth >= 7 || value.rules.length >= 32}
            onClick={() => onChange({ ...value, rules: [...value.rules, { kind: 'always' }] })}
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
            <div className={styles.fields}>
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
            <legend>Progression and public presentation</legend>
            <AbilitySelect
              label="Discipline family"
              value={atlas.family}
              options={['foundation', 'martial', 'hybrid', 'mage', 'support'] as const}
              onChange={(family) => onChange({ ...value, atlas: { ...atlas, family } })}
            />
            <AbilitySelect
              label="Progression band"
              value={atlas.band}
              options={
                [
                  'foundation',
                  'first-journey',
                  'rekindling-1',
                  'rekindling-2',
                  'rekindling-3',
                ] as const
              }
              onChange={(band) => onChange({ ...value, atlas: { ...atlas, band } })}
            />
            <p>Public disclosure: Open. Secret discovery is unavailable.</p>
            <div className={styles.fields}>
              {Object.entries(atlas.power).map(([key, amount]) => (
                <AbilityNumber
                  key={key}
                  label={`${key} presentation`}
                  min={1}
                  max={5}
                  value={amount}
                  onChange={(next) =>
                    onChange({
                      ...value,
                      atlas: { ...atlas, power: { ...atlas.power, [key]: next } },
                    })
                  }
                />
              ))}
            </div>
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
function SkillMechanics({
  value,
  onChange,
}: {
  value: MatureSkillDefinition
  onChange(value: MatureSkillDefinition): void
}) {
  if (value.ability)
    return (
      <AbilityDefinitionEditor
        value={value.ability}
        effectDescriptions={value.effectDescriptions}
        onChange={(ability, effectDescriptions) =>
          onChange({ ...value, ability, effectDescriptions })
        }
      />
    )
  return (
    <>
      <SkillTargetingEditor
        value={value.target}
        v51Rules={value.authoring.validationTags.includes('owner-rebalance-v5-1')}
        onChange={(target) => onChange({ ...value, target })}
      />
      <SkillGroundEditor
        target={value.target}
        effects={value.effects}
        value={value.groundArea}
        onChange={(groundArea) => onChange(withSkillGroundArea(value, groundArea))}
      />
      <SkillEconomyEditor
        value={value}
        cooldownLockedByRequirement={value.requirements.length > 0}
        onChange={(economy) => onChange({ ...value, ...economy })}
      />
      <SkillEffectListEditor
        value={value.effects.filter(isMaterializedCombatEffect)}
        effectDescriptions={value.effectDescriptions?.filter(
          (_, index) => value.effects[index]?.type !== 'summon',
        )}
        onChange={(effects, effectDescriptions) =>
          onChange({
            ...value,
            effects: [...effects, ...value.effects.filter((effect) => effect.type === 'summon')],
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
    </>
  )
}
export function ContentDefinitionFields({
  kind,
  value,
  tab,
  onChange,
  choices = [],
}: {
  kind: CombatContentKind
  value: CombatContentDefinition
  tab: ContentEditorTab
  onChange(value: CombatContentDefinition): void
  choices?: readonly ContentReference[]
}) {
  const set = (patch: Record<string, unknown>) => onChange({ ...value, ...patch })
  const basic =
    kind === 'skill' && (BASIC_SKILL_IDS as readonly string[]).includes(String(value.id))
  const combat = kind === 'skill' || kind === 'essence' || kind === 'resonance'
  const body = kind === 'essence' ? objectValue(value.skill) : value
  const setBody = (next: CombatContentDefinition) =>
    kind === 'essence' ? set({ skill: next }) : onChange(next)
  const name = contentRecordName(value)
  if (tab === 'Media') {
    if (kind === 'effect-profile' || kind === 'status')
      return <p>Media has no supported use for this category.</p>
    return combat ? (
      <SkillMediaEditor
        contentId={String(body.id ?? value.id ?? value.essenceId)}
        value={body.media as MatureSkillDefinition['media']}
        onChange={(media) => setBody({ ...body, media })}
      />
    ) : (
      <FinalizedMediaEditor
        value={objectValue(value.media)}
        allowAudio={false}
        onChange={(media) => set({ media: { ...objectValue(value.media), ...media } })}
      />
    )
  }
  if (tab === 'Text')
    return (
      <>
        <AbilityText
          label="Name"
          value={name}
          maxLength={kind === 'discipline' ? 80 : 120}
          onChange={(name) => set({ name })}
        />
        <label>
          Description
          <textarea
            aria-label="Description"
            value={text(value.description)}
            onChange={(event) => set({ description: event.currentTarget.value })}
          />
        </label>
        {kind === 'tag' ? (
          <>
            <label>
              Full Tag explanation
              <textarea
                aria-label="Full Tag explanation"
                value={text(value.explanation)}
                onChange={(event) => set({ explanation: event.currentTarget.value })}
              />
            </label>
            <p>
              Compact wording: description (240 characters for publication). Full explanation: 2000
              characters. Existing retained text is never truncated.
            </p>
          </>
        ) : null}
        {combat ? (
          <>
            {!basic ? (
              <>
                <AbilityText
                  label="Flavor line"
                  value={text(value.flavorLine)}
                  maxLength={160}
                  onChange={(flavorLine) => set({ flavorLine })}
                />
                <BattleFlavorTemplateHelp
                  value={text(value.flavorLine)}
                  ability={name}
                  onChange={(flavorLine) => set({ flavorLine })}
                />
              </>
            ) : null}
            {kind !== 'resonance' ? (
              <>
                <AbilityText
                  label="In-battle text"
                  value={text(body.battleText)}
                  maxLength={160}
                  onChange={(battleText) => setBody({ ...body, battleText })}
                />
                <BattleFlavorTemplateHelp
                  value={text(body.battleText)}
                  ability={name}
                  onChange={(battleText) => setBody({ ...body, battleText })}
                />
              </>
            ) : null}
            <AbilityPresentationEditor
              definition={body}
              name={name}
              value={body.presentation as MatureSkillDefinition['presentation']}
              onChange={(presentation) => setBody({ ...body, presentation })}
            />
          </>
        ) : null}
      </>
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
      <fieldset>
        <legend>Identity</legend>
        <AbilityText
          label="Name"
          value={name}
          maxLength={kind === 'discipline' ? 80 : 120}
          onChange={(name) => set({ name })}
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
        {(kind === 'skill' && !basic) || kind === 'essence' ? (
          <ContentReferenceSelect
            label="Source Discipline"
            kind="discipline"
            value={text(value.sourceDisciplineId)}
            choices={choices}
            onChange={(sourceDisciplineId) =>
              set(
                kind === 'essence'
                  ? { sourceDisciplineId, skill: { ...body, sourceDisciplineId } }
                  : { sourceDisciplineId },
              )
            }
          />
        ) : null}
        {kind === 'tag' ? (
          <AbilitySelect
            label="Canonical Tag"
            value={text(value.tagId)}
            options={COMBAT_TAG_REGISTRY.map((row) => row.id)}
            onChange={(tagId) => set({ tagId })}
          />
        ) : null}
      </fieldset>
      {kind !== 'status' && kind !== 'tag' ? (
        <details className={styles.mediaSection} open={kind === 'discipline'}>
          <summary>Artwork{combat ? ' and sound' : ''}</summary>
          {combat ? (
            <SkillMediaEditor
              contentId={String(body.id ?? value.id ?? value.essenceId)}
              value={body.media as MatureSkillDefinition['media']}
              onChange={(media) => setBody({ ...body, media })}
            />
          ) : (
            <FinalizedMediaEditor
              value={objectValue(value.media)}
              allowAudio={false}
              fallbackArtwork={
                kind === 'discipline'
                  ? (phase4DisciplineSigil(String(value.id)) ?? undefined)
                  : undefined
              }
              onChange={(media) => set({ media: { ...objectValue(value.media), ...media } })}
            />
          )}
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
                <AbilityDefinitionEditor
                  value={skill.ability}
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
          onChange={(next) => setBody(asDefinition(next))}
        />
      ) : null}
      {kind === 'resonance' ? (
        <>
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
          {value.ability ? (
            <AbilityDefinitionEditor
              value={value.ability as AbilityDefinition}
              allowEffectDescriptions={false}
              onChange={(ability) => set({ ability })}
            />
          ) : (
            <ResonanceMechanicsFields
              value={value as unknown as AnyResonanceDefinition}
              onChange={(next) => onChange(asDefinition(next))}
            />
          )}
        </>
      ) : null}
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

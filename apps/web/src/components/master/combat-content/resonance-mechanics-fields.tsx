'use client'
import type {
  AnyResonanceDefinition,
  ResonanceSkillMatcher,
} from '@aurevane/game-core/combat/resonance'
import {
  isResonanceDefinitionV2,
  normalizedResonanceMechanics,
  type NormalizedResonanceMechanics,
} from '@aurevane/game-core/combat/resonance-v2'
import type { AbilityEditorSection } from './ability-editor-tabs'
import { AbilityNumber, AbilitySelect } from './ability-editor-fields'
import { SkillEffectListEditor } from './skill-effect-list-editor'
export function ResonanceMechanicsFields({
  value,
  onChange,
  section,
}: {
  section?: AbilityEditorSection
  value: AnyResonanceDefinition
  onChange(value: AnyResonanceDefinition): void
}) {
  const mechanics = normalizedResonanceMechanics(value),
    v2 = isResonanceDefinitionV2(value)
  function update(patch: Partial<NormalizedResonanceMechanics>) {
    const next = { ...mechanics, ...patch }
    onChange(
      v2
        ? { ...value, trigger: { kind: 'skill-trigger-v2', ...next } }
        : {
            ...value,
            trigger: {
              kind: 'skill-sequence',
              setup: next.setup!,
              payoff: next.trigger,
              payoffEffects: next.resultEffects,
              aiSetupUtilityBonus: next.aiSetupUtilityBonus,
              aiPayoffUtilityBonus: next.aiTriggerUtilityBonus,
            },
          },
    )
  }
  function matcher(
    label: 'Setup' | 'Trigger',
    selected: ResonanceSkillMatcher,
    onSelect: (value: ResonanceSkillMatcher) => void,
  ) {
    return (
      <fieldset>
        <legend>{label}</legend>
        <AbilitySelect
          label={`Resonance ${label} Discipline`}
          value={selected.sourceDisciplineId}
          options={value.disciplinePair}
          onChange={(sourceDisciplineId) => onSelect({ ...selected, sourceDisciplineId })}
        />
        <label>
          Skill matching
          <select
            aria-label={`Resonance ${label} matching`}
            value={selected.matchMode ?? 'required-tags'}
            onChange={(event) =>
              onSelect(
                event.currentTarget.value === 'any-skill'
                  ? { ...selected, matchMode: 'any-skill', requiredTags: [] }
                  : {
                      ...selected,
                      matchMode: undefined,
                      requiredTags: selected.requiredTags.length
                        ? selected.requiredTags
                        : ['attack'],
                    },
              )
            }
          >
            <option value="required-tags">Require Skill tags</option>
            <option value="any-skill">Any Skill in this Discipline</option>
          </select>
        </label>
        <label>
          Required tags
          <input
            aria-label={`Resonance ${label} tags`}
            disabled={selected.matchMode === 'any-skill'}
            value={selected.requiredTags.join(', ')}
            onChange={(event) =>
              onSelect({
                ...selected,
                requiredTags: event.currentTarget.value
                  .split(',')
                  .map((tag) => tag.trim())
                  .filter(Boolean),
              })
            }
          />
        </label>
        <p>
          Use one or two supported tags, or Any Skill. Invalid combinations are explained on save.
        </p>
      </fieldset>
    )
  }
  return (
    <>
      {(!section || section === 'details') && (
        <>
          {v2 ? (
            <AbilitySelect
              label="Resonance mode"
              value={mechanics.mode}
              options={['sequence', 'immediate'] as const}
              onChange={(mode) =>
                update({
                  mode,
                  setup:
                    mode === 'immediate'
                      ? null
                      : (mechanics.setup ?? {
                          sourceDisciplineId: value.disciplinePair[0],
                          requiredTags: ['attack'],
                        }),
                  aiSetupUtilityBonus:
                    mode === 'immediate' ? 0 : mechanics.aiSetupUtilityBonus || 10,
                })
              }
            />
          ) : (
            <p>Historical sequence schema is preserved.</p>
          )}
          {mechanics.setup ? (
            matcher('Setup', mechanics.setup, (setup) => update({ setup }))
          ) : (
            <p>Setup: None. Immediate activation uses the matching Trigger.</p>
          )}
          {matcher('Trigger', mechanics.trigger, (trigger) => update({ trigger }))}
          <AbilityNumber
            label="Resonance AI setup utility"
            min={0}
            max={100}
            value={mechanics.aiSetupUtilityBonus}
            onChange={(aiSetupUtilityBonus) => update({ aiSetupUtilityBonus })}
          />
          <AbilityNumber
            label="Resonance AI trigger utility"
            min={0}
            max={100}
            value={mechanics.aiTriggerUtilityBonus}
            onChange={(aiTriggerUtilityBonus) => update({ aiTriggerUtilityBonus })}
          />
        </>
      )}
      {(!section || section === 'effects') && (
        <fieldset>
          <legend>Result</legend>
          <SkillEffectListEditor
            value={mechanics.resultEffects}
            maxEffects={v2 ? 2 : 8}
            onChange={(resultEffects) => update({ resultEffects })}
          />
        </fieldset>
      )}
      {section && ['range', 'economy', 'accuracy'].includes(section) && (
        <p>
          This Resonance uses its triggering Skill’s combat context and has no independent{' '}
          {section === 'range'
            ? 'range selection'
            : section === 'economy'
              ? 'resource payment'
              : 'accuracy roll'}
          .
        </p>
      )}
    </>
  )
}

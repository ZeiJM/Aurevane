'use client'
import { useState } from 'react'
import type { CombatContentDefinition, CombatContentKind } from '@aurevane/db/combat-content'
import type { AbilityDefinition } from '@aurevane/game-core/combat/combat-definition'
import type { AnyResonanceDefinition } from '@aurevane/game-core/combat/resonance'
import { normalizedResonanceMechanics } from '@aurevane/game-core/combat/resonance-v2'
import { latestEnabledMatureSkills } from '@aurevane/game-core/combat/mature-skills'
import {
  AbilityPreviewSelector,
  ModifierPreviewRootSelector,
  previewActionSelection,
  type ModifierPreviewRoot,
} from './ability-preview-selector'
import { CombatContentPreviewReport } from './combat-content-preview-report'
import {
  DEFAULT_COMBAT_CONTENT_EVENT_SAMPLE,
  type CombatContentPreviewSummary,
} from './combat-content-workflow'
import { postCombatContentAuthoring } from './combat-content-client'
const historicalSkills = latestEnabledMatureSkills().filter(
  (skill) => !Object.hasOwn(skill, 'ability'),
)
export function ContentNativeSample({
  kind,
  definition,
}: {
  kind: CombatContentKind
  definition: CombatContentDefinition
}) {
  const body = (kind === 'essence' ? definition.skill : definition) as {
    ability?: AbilityDefinition
    enabled?: boolean
  }
  const [group, setGroup] = useState<string | undefined>(),
    [root, setRoot] = useState<ModifierPreviewRoot>({ skillId: 'unarmed.basic' })
  const [setup, setSetup] = useState(''),
    [trigger, setTrigger] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<{ key: string; message: string } | null>(null)
  const [result, setResult] = useState<{
    key: string
    preview: CombatContentPreviewSummary
  } | null>(null)
  const selection = previewActionSelection(body, group)
  const selected = selection.groups.find((entry) => entry.id === selection.behaviorId)
  const automatic = selected?.activation === 'automatic'
  const reference = automatic || selected?.mode === 'modifier'
  const historical =
    kind === 'resonance' && !body.ability
      ? normalizedResonanceMechanics(definition as unknown as AnyResonanceDefinition)
      : null
  const key = JSON.stringify([kind, definition, selection.behaviorId, root, setup, trigger])
  async function run() {
    setBusy(true)
    setError(null)
    try {
      const response = await postCombatContentAuthoring<{ preview: CombatContentPreviewSummary }>({
        operation: 'preview',
        contentKind: kind === 'resonance' ? 'resonance' : 'skill',
        definition: kind === 'essence' ? definition.skill : definition,
        ...(historical
          ? {
              ...(historical.mode === 'sequence' ? { previewSetupSkillId: setup } : {}),
              previewRootSkillId: trigger,
            }
          : selection.behaviorId
            ? { behaviorId: selection.behaviorId }
            : {}),
        ...(reference
          ? {
              previewRootSkillId: root.skillId,
              ...(root.behaviorId ? { previewRootBehaviorId: root.behaviorId } : {}),
              ...(automatic
                ? { eventSample: root.eventSample ?? DEFAULT_COMBAT_CONTENT_EVENT_SAMPLE }
                : {}),
            }
          : {}),
      })
      setResult({ key, preview: response.preview })
    } catch (cause) {
      setError({ key, message: cause instanceof Error ? cause.message : 'Sample unavailable.' })
    } finally {
      setBusy(false)
    }
  }
  return (
    <details>
      <summary>Native sample</summary>
      <p>
        A deterministic server fixture uses this complete definition and selected current
        references. It does not change live battles or gate publication.
      </p>
      <AbilityPreviewSelector selection={selection} busy={busy} onChange={setGroup} />
      {reference ? (
        <ModifierPreviewRootSelector
          root={root}
          automatic={automatic}
          busy={busy}
          onChange={setRoot}
        />
      ) : null}
      {historical ? (
        <>
          {(historical.mode === 'sequence' ? ['setup', 'trigger'] : ['trigger']).map((field) => (
            <label key={field}>
              Sample {field} Skill
              <select
                aria-label={`Sample ${field} Skill`}
                value={field === 'setup' ? setup : trigger}
                onChange={(event) =>
                  (field === 'setup' ? setSetup : setTrigger)(event.currentTarget.value)
                }
              >
                <option value="">Choose current reference</option>
                {historicalSkills.map((skill) => (
                  <option key={skill.id} value={skill.id}>
                    {skill.id}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </>
      ) : null}
      <button
        disabled={
          busy ||
          definition.enabled === false ||
          !selection.available ||
          (!!historical && (!trigger || (historical.mode === 'sequence' && !setup)))
        }
        onClick={() => void run()}
      >
        Run native sample
      </button>
      {definition.enabled === false ? <p>Enable this local draft to run a sample.</p> : null}
      {!selection.available ? <p>{selection.message}</p> : null}
      {error?.key === key ? <p role="alert">{error.message}</p> : null}
      <CombatContentPreviewReport preview={result?.key === key ? result.preview : null} />
    </details>
  )
}

'use client'
import { useRef } from 'react'
import type { RuntimeItemDefinition, ItemActionBinding } from '@aurevane/game-core/content/items'
import type { AbilityBehavior } from '@aurevane/game-core/combat/combat-definition'
import { defaultBasicSkills } from '@aurevane/game-core/combat/combat-basic-actions'
import { AbilityDefinitionEditor } from './ability-definition-editor'
import { AbilityEditorTabs, ABILITY_EDITOR_SECTIONS } from './ability-editor-tabs'
import { AbilitySelect, AbilityText } from './ability-editor-fields'
import styles from './combat-content-editor.module.css'

export function ItemImbuedTechniqueEditor({
  value,
  onChange,
}: {
  value: RuntimeItemDefinition
  onChange(value: RuntimeItemDefinition): void
}) {
  const removed = useRef<{
    binding: ItemActionBinding
    behavior?: AbilityBehavior
    index: number
  } | null>(null)
  if (value.itemClass !== 'weapon') return null
  const support = value.actions?.support
  const groups = value.ability?.behaviors ?? []
  const attackId = value.actions?.attack?.behaviorId
  const manuals = groups.filter(
    (group) => group.activation === 'manual' && group.mode === 'action' && group.id !== attackId,
  )
  const selected = manuals.find((group) => group.id === support?.behaviorId)
  function choose(behaviorId: string) {
    onChange({
      ...value,
      actions: {
        ...value.actions,
        support: { behaviorId, name: support?.name ?? 'Imbued Technique' },
      },
    })
  }
  function toggle() {
    if (support) {
      const index = groups.findIndex((group) => group.id === support.behaviorId)
      const behavior = groups[index]
      const shared = Object.entries(value.actions ?? {}).some(
        ([role, action]) => role !== 'support' && action?.behaviorId === support.behaviorId,
      )
      removed.current = {
        binding: support,
        ...(!shared && behavior?.activation === 'manual' && behavior.mode === 'action'
          ? { behavior }
          : {}),
        index,
      }
      const actions = { ...value.actions }
      delete actions.support
      onChange({
        ...value,
        actions,
        ability: value.ability
          ? {
              ...value.ability,
              behaviors: groups.filter((group) => group.id !== removed.current?.behavior?.id),
            }
          : null,
      })
      return
    }
    const cached = removed.current
    if (cached && (!cached.behavior || !groups.some((group) => group.id === cached.behavior!.id))) {
      const behaviors = [...groups]
      if (cached.behavior) behaviors.splice(Math.max(0, cached.index), 0, cached.behavior)
      onChange({
        ...value,
        ability: { ...(value.ability ?? { schemaVersion: 1 as const }), behaviors },
        actions: { ...value.actions, support: cached.binding },
      })
      return
    }
    if (manuals.length) {
      choose(manuals[0]!.id)
      return
    }
    createTechnique()
  }
  function createTechnique() {
    let id = 'imbued-technique'
    for (let suffix = 2; groups.some((group) => group.id === id); suffix++)
      id = `imbued-technique-${suffix}`
    const behavior = {
      ...structuredClone(
        defaultBasicSkills().find((skill) => skill.id === 'basic.recover')!.ability!.behaviors[0]!,
      ),
      id,
    }
    onChange({
      ...value,
      ability: {
        ...(value.ability ?? { schemaVersion: 1 as const }),
        behaviors: [...groups, behavior],
      },
      actions: {
        ...value.actions,
        support: { behaviorId: id, name: support?.name ?? 'Imbued Technique' },
      },
    })
  }
  return (
    <section aria-label="Imbued Technique" className={styles.effectList}>
      <label>
        <input type="checkbox" checked={!!support} onChange={toggle} /> Enable imbued technique
      </label>
      <p className={styles.fieldHint}>
        An equipped weapon offers its technique as a Support choice in Skill Manager. Unequipping it
        restores the previous Basic Support choice.
      </p>
      <p className={styles.fieldHint}>
        Disabling removes the technique when you Commit. Re-enable while this Item stays open to
        undo before committing.
      </p>
      {support ? (
        <>
          <AbilityText
            label="Technique name"
            value={support.name}
            onChange={(name) =>
              onChange({ ...value, actions: { ...value.actions, support: { ...support, name } } })
            }
          />
          <AbilitySelect
            label="Technique action"
            value={support.behaviorId}
            options={manuals.map((group) => group.id)}
            optionLabels={Object.fromEntries([
              ...manuals.map((group, index) => [
                group.id,
                `${group.classification[0]!.toUpperCase() + group.classification.slice(1)} action ${index + 1}`,
              ]),
              ...(!selected
                ? [[support.behaviorId, 'Unavailable action — choose a replacement']]
                : []),
            ])}
            onChange={choose}
          />
          {selected ? (
            <AbilityEditorTabs
              key={selected.id}
              panels={Object.fromEntries(
                ABILITY_EDITOR_SECTIONS.map((section) => [
                  section.id,
                  section.id === 'media' ? (
                    <p>The technique uses this Item’s artwork.</p>
                  ) : (
                    <AbilityDefinitionEditor
                      value={{
                        ...(value.ability ?? { schemaVersion: 1 as const }),
                        behaviors: [selected],
                      }}
                      contentId={value.id}
                      category="manual"
                      section={section.id}
                      onChange={(ability) => {
                        const behavior = ability.behaviors[0]
                        if (behavior)
                          onChange({
                            ...value,
                            ability: {
                              ...value.ability!,
                              behaviors: groups.map((group) =>
                                group.id === selected.id ? behavior : group,
                              ),
                            },
                          })
                      }}
                    />
                  ),
                ]),
              )}
            />
          ) : (
            <>
              <p role="status">
                Choose a Manual action to edit this technique. Basic Attack stays separate.
              </p>
              {!manuals.length ? (
                <button type="button" onClick={createTechnique}>
                  Create technique action
                </button>
              ) : null}
            </>
          )}
        </>
      ) : null}
    </section>
  )
}

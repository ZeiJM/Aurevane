import type { ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { defaultBasicSkills } from '@aurevane/game-core/combat/combat-basic-actions'
import {
  parseAbilityDefinition,
  validateAbilityDefinition,
  type AbilityDefinition,
} from '@aurevane/game-core/combat/combat-definition'
import { AbilityDefinitionEditor } from './ability-definition-editor'
import { AbilitySelect } from './ability-editor-fields'
import { abilityBehaviorInformation } from '../../character/ability-detail-presentation'
import { AbilityParameters } from '../../character/ability-parameters'

// Expand the actual stateless production controls; invoke their real event callbacks.
function controls(value: unknown): ReactElement<Record<string, unknown>>[] {
  if (!value || typeof value !== 'object' || !('props' in value)) return []
  const element = value as ReactElement<Record<string, unknown>>
  if (
    typeof element.type === 'function' &&
    [
      'AbilityDefinitionEditor',
      'AbilityGroupEditor',
      'AbilityRequirementEditor',
      'SimpleAbilityRequirementEditor',
      'AbilityEffectEditor',
      'EffectTargetEditor',
      'AbilityTargetingEditor',
      'SkillTargetingEditor',
    ].includes(element.type.name)
  )
    return [element, ...controls((element.type as (props: unknown) => ReactElement)(element.props))]
  return [element, ...[element.props.children].flat(Infinity).flatMap(controls)]
}

it.each(['owner', 'selected'] as const)(
  'keeps the first-tab %s requirement whole-ability through geometry edits and saved readers',
  (generalSubject) => {
    let draft: AbilityDefinition = parseAbilityDefinition({
      schemaVersion: 1,
      behaviors: [
        {
          ...defaultBasicSkills().find((row) => row.id === 'unarmed.basic')!.ability.behaviors[0],
          id: 'simple-browser',
          requirementMode: 'simple',
          requirements: null,
          effects: [
            {
              id: 'hit',
              payload: { type: 'healing', recipient: 'primary-unit', amount: 1, ticks: 1 },
            },
          ],
        },
      ],
    })
    function change(label: string, value: string, index = 0) {
      const tree = (
        <AbilityDefinitionEditor
          value={draft}
          onChange={(next) => {
            draft = next
          }}
        />
      )
      const matches = controls(tree).filter((element) =>
        element.type === AbilitySelect
          ? element.props.label === label
          : element.type === 'select' && element.props['aria-label'] === label,
      )
      const control = matches[index]!
      expect(control, `${label} control ${index}`).toBeDefined()
      const onChange = control.props.onChange as (value: unknown) => void
      onChange(control.type === AbilitySelect ? value : { currentTarget: { value } })
    }
    change('Requirement tag', 'wet')
    change('Requirement target', 'selected')
    change('Target', 'enemy')
    change('Requirement target', 'owner')
    for (const shape of ['circle', 'line']) {
      change('Shape', shape)
      expect(draft.behaviors[0]!.requirements).toMatchObject({ subject: 'owner' })
      expect(draft.behaviors[0]!.effects[0]!.requirements).toBeUndefined()
      expect(validateAbilityDefinition(draft)).toEqual([])
    }
    change('Shape', 'single')
    change('Target', 'all')
    change('Target', 'enemy')
    change('Requirement target', generalSubject)
    change('Target', 'self')
    expect(draft.behaviors[0]!.requirements).toMatchObject({ subject: generalSubject })
    expect(draft.behaviors[0]!.effects[0]!.requirements).toBeUndefined()
    const saved = parseAbilityDefinition(JSON.parse(JSON.stringify(draft)))
    const group = saved.behaviors[0]!
    expect(group.targeting!.kind).toBe(generalSubject === 'selected' ? 'unit' : 'self')
    expect(group.effects[0]!.payload.recipient).toBe('actor')
    expect(group.requirements).toEqual({
      kind: 'status-presence',
      subject: generalSubject,
      statusId: 'wet',
      present: true,
    })
    expect(group.effects[0]!.requirements).toBeUndefined()
    const report = abilityBehaviorInformation(group)
    const subjectLabel = generalSubject === 'owner' ? 'Self' : 'Target'
    expect(Object.fromEntries(report.rows).Requirements).toBe(`Drenched [${subjectLabel}]`)
    expect(report.effectDescriptions[0]).not.toContain('Applies only when')
    const html = renderToStaticMarkup(<AbilityParameters report={report} />)
    const effectNotes = html.slice(html.indexOf('aria-label="Effect explanations"'))
    expect(effectNotes.replace(/<[^>]*>/gu, '')).not.toContain('Applies only when')
    expect(validateAbilityDefinition(saved)).toEqual([])
  },
)

import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { defaultBasicSkills } from '@aurevane/game-core/combat/combat-basic-actions'
import { ContentDefinitionFields } from './content-definition-fields'
import { ContentRecordPreview } from './content-record-preview'
it.each(defaultBasicSkills())(
  'exposes independent $id Parameters, Text and Media without changing command identity',
  (definition) => {
    for (const tab of ['Parameters', 'Text', 'Media'] as const) {
      const html = renderToStaticMarkup(
        <ContentDefinitionFields
          kind="skill"
          value={{ ...definition }}
          tab={tab}
          onChange={() => {}}
        />,
      )
      expect(html).toContain(
        tab === 'Parameters'
          ? 'Group activation'
          : tab === 'Text'
            ? 'Description'
            : 'Upload content media',
      )
    }
    expect(definition.id).toBeTruthy()
  },
)
it('shows changed Basic mechanics in shared reports while removing hidden Accuracy recursively', () => {
  const original = defaultBasicSkills().find((row) => row.id === 'unarmed.basic')!
  const definition = {
    ...original,
    ability: {
      ...original.ability,
      behaviors: original.ability.behaviors.map((row) => ({
        ...row,
        costs: [{ resource: 'ap' as const, amount: 29 }],
        accuracy: { kind: 'fixed' as const, chanceBasisPoints: 4500 },
      })),
    },
  }
  const html = renderToStaticMarkup(
    <ContentRecordPreview
      kind="skill"
      working={definition}
      current={{ ...original }}
      saved={null}
    />,
  )
  expect(html).toContain('29 AP')
  expect(html).not.toContain('45%')
  expect(html).not.toContain('Fixed hit chance')
  expect(html).toContain('Draft / Published comparison')
  expect(html).toContain('Sample messages')
})
it('identifies plural authored groups instead of merging their reports', () => {
  const original = defaultBasicSkills().find((row) => row.id === 'basic.guard')!
  const definition = {
    ...original,
    ability: {
      ...original.ability,
      behaviors: [
        original.ability.behaviors[0]!,
        {
          ...original.ability.behaviors[0]!,
          id: 'second-guard',
          costs: [{ resource: 'ap' as const, amount: 31 }],
        },
      ],
    },
  }
  const html = renderToStaticMarkup(
    <ContentRecordPreview kind="skill" working={definition} current={null} saved={null} />,
  )
  expect(html).toContain('second-guard')
  expect(html).toContain('31 AP')
  expect(html).toContain('Preview action group')
})
it('keeps Basic Move cost controls in the merged Execution Characteristics section', () => {
  const basic = defaultBasicSkills().find((row) => row.execution.kind === 'basic-move')!
  const html = renderToStaticMarkup(
    <ContentDefinitionFields
      kind="skill"
      value={{ ...basic }}
      tab="Parameters"
      initialAbilitySection="execution"
      onChange={() => {}}
    />,
  )
  expect(html).toContain('aria-label="Move cost basis"')
})

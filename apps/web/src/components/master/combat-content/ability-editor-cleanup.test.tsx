import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
import { defaultBasicSkills } from '@aurevane/game-core/combat/combat-basic-actions'
import { AbilityDefinitionEditor } from './ability-definition-editor'

it.each(['range', 'execution', 'effects'] as const)(
  'keeps %s controls without repeating the behavior disclosure or draft repair',
  (section) => {
    const original = defaultBasicSkills().find((skill) => skill.id === 'unarmed.basic')!.ability
    const first = original.behaviors[0]!
    const value = {
      ...original,
      behaviors: [first, { ...first, id: 'retained-second' }].map((group) => ({
        ...group,
        effects: [
          {
            id: 'ice',
            payload: {
              type: 'damage' as const,
              recipient: 'primary-unit' as const,
              amount: 1,
              element: 'ice' as const,
            },
          },
        ],
      })),
    }
    const before = structuredClone(value)
    const onChange = vi.fn()
    const html = renderToStaticMarkup(
      <AbilityDefinitionEditor value={value} section={section} onChange={onChange} />,
    )
    expect(html).not.toMatch(/<summary>Behavior/)
    expect(html).not.toContain('This recovered draft needs')
    expect(html).not.toContain('Add required elemental tags')
    expect(html).toContain('data-ability-group="retained-second"')
    if (section === 'range') {
      expect(html).toContain('aria-label="Maximum target range"')
      expect(html).not.toContain('<legend>Range')
      expect(html).not.toContain('About Range availability')
    }
    if (section === 'effects') expect(html).toContain('aria-label="Damage amount"')
    if (section === 'execution') expect(html).toContain('aria-label="AP cost"')
    expect(value).toEqual(before)
    expect(onChange).not.toHaveBeenCalled()
  },
)

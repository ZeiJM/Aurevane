import type { ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { defaultBasicSkills } from '@aurevane/game-core/combat/combat-basic-actions'
import type { AbilityDefinition } from '@aurevane/game-core/combat/combat-definition'
import { AbilityDefinitionEditor } from './ability-definition-editor'
import { newResonanceAbility } from './new-resonance-ability'

function controls(value: unknown): ReactElement<Record<string, unknown>>[] {
  if (!value || typeof value !== 'object' || !('props' in value)) return []
  const node = value as ReactElement<Record<string, unknown>>
  if (node.type === AbilityDefinitionEditor)
    return [node, ...controls((node.type as (props: unknown) => ReactElement)(node.props))]
  return [node, ...[node.props.children].flat(Infinity).flatMap(controls)]
}

it.each(['manual', 'passive'] as const)(
  'locks visible category controls for %s and uses that category for added groups',
  (category) => {
    let value: AbilityDefinition =
      category === 'manual'
        ? defaultBasicSkills().find((skill) => skill.id === 'unarmed.basic')!.ability
        : newResonanceAbility()
    const original = structuredClone(value)
    const tree = () => (
      <AbilityDefinitionEditor
        value={value}
        category={category}
        section="details"
        onChange={(next) => {
          value = next
        }}
      />
    )
    const html = renderToStaticMarkup(tree())
    expect(html).toMatch(/aria-label="Group activation"[^>]*disabled/)
    expect(html).toMatch(/aria-label="Group mode"[^>]*disabled/)
    expect(html).toContain(category === 'manual' ? '>Manual</option>' : '>Passive</option>')
    expect(value).toEqual(original)
    const add = controls(tree()).find(
      (node) => node.type === 'button' && node.props['aria-label'] === 'Add behavior group',
    )!
    ;(add.props.onClick as () => void)()
    expect(value.behaviors[1]!.activation).toBe(category === 'manual' ? 'manual' : 'automatic')
    expect(value.behaviors[1]!.mode).toBe('action')
    expect(value.behaviors[0]).toEqual(original.behaviors[0])
  },
)

it('preserves ongoing and triggered Resonance behavior while locking both controls', () => {
  const value = newResonanceAbility()
  const ongoing = {
    ...value.behaviors[0]!,
    id: 'ongoing',
    activation: 'ongoing' as const,
    mode: 'modifier' as const,
    targeting: null,
  }
  delete ongoing.automaticTarget
  delete ongoing.automaticTrigger
  const combined = { ...value, behaviors: [...value.behaviors, ongoing] }
  const before = structuredClone(combined)
  const html = renderToStaticMarkup(
    <AbilityDefinitionEditor
      value={combined}
      category="passive"
      section="details"
      onChange={() => {}}
    />,
  )
  expect(html.match(/aria-label="Group activation"[^>]*disabled/g)).toHaveLength(2)
  expect(html).toContain('Passive modifier')
  expect(combined).toEqual(before)
})

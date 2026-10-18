import { readFileSync } from 'node:fs'
import type { MatureSkillDefinition } from '@aurevane/game-core/combat/mature-skills'
import type { AbilityBehavior } from '@aurevane/game-core/combat/combat-definition'
import { createElement, isValidElement, type ComponentProps } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { resolveMatureSkillVersion } from '@aurevane/game-core/combat/mature-skills'
import { SkillGroundEditor, AbilityGroundEditor, groundAreaForEffects } from './skill-ground-editor'

describe('Master persistent Ground controls', () => {
  it('edits duration, timing and only registered animations', () => {
    const skill = resolveMatureSkillVersion('cinderweaver.flame-burst')!
    const html = renderToStaticMarkup(
      createElement(SkillGroundEditor, {
        target: skill.target,
        effects: skill.effects,
        value: skill.groundArea,
        onChange: vi.fn(),
      }),
    )
    expect(html).toContain('aria-label="Ground duration (rounds)"')
    expect(html).toContain('value="3"')
    expect(html).toContain('aria-label="Ground animation"')
    expect(html).toContain('Embers')
    expect(html).toContain('Frost')
    expect(html).toContain('Arcane pulse')
    expect(html).toContain('aria-label="Ground activation"')
    expect(html).not.toContain('textarea')
  })
  it('keeps a registered preset while synchronizing only legal entry payloads', () => {
    const skill = resolveMatureSkillVersion('frostweaver.chilling-mist')!
    expect(groundAreaForEffects(skill.effects, skill.groundArea)).toMatchObject({
      durationRounds: 2,
      visualPresetId: 'frost',
      entryEffectOrdinals: [1, 2],
    })
    expect(
      groundAreaForEffects([{ type: 'healing', recipient: 'actor', amount: 1 }], skill.groundArea),
    ).toBeUndefined()
  })
  it('offers no persistent entries for unit targeting or pure terrain', () => {
    const skill = resolveMatureSkillVersion('vanguard.forceful-strike')!
    expect(
      renderToStaticMarkup(
        createElement(SkillGroundEditor, {
          target: skill.target,
          effects: skill.effects,
          onChange: vi.fn(),
        }),
      ),
    ).toBe('')
    expect(
      groundAreaForEffects([
        { type: 'create-terrain', recipient: 'affected-tiles', terrain: 'frozen' },
      ]),
    ).toBeUndefined()
  })
})

const proposed: { id: string; after: MatureSkillDefinition }[] = JSON.parse(
  readFileSync(
    new URL(
      '../../../../../../docs/superpowers/specs/2026-10-10-roster-rebalance-proposals.json',
      import.meta.url,
    ),
    'utf8',
  ),
).records
it.each(['wildwarden.venom-shot', 'cinderweaver.flame-burst', 'frostweaver.chilling-mist'])(
  '%s edits its actual canonical lifetime/entry order without touching cast-only payloads',
  (id) => {
    const definition = proposed.find((row) => row.id === id)!.after
    const group = definition.ability!.behaviors[0]!
    const before = JSON.stringify(group)
    let updated: AbilityBehavior | undefined
    const editor = AbilityGroundEditor({
      value: group,
      onChange: (value) => {
        updated = value
      },
    })
    if (!isValidElement<ComponentProps<typeof SkillGroundEditor>>(editor))
      throw new Error('Expected shared Ground editor.')
    expect(editor.type).toBe(SkillGroundEditor)
    expect(editor.props.value?.entryEffectOrdinals).toEqual(
      definition.groundArea!.entryEffectOrdinals,
    )
    editor.props.onChange({
      ...editor.props.value!,
      durationRounds: 1,
      entryEffectOrdinals: [...editor.props.value!.entryEffectOrdinals].reverse(),
    })
    expect(updated!.groundArea).toMatchObject({
      durationRounds: 1,
      entryEffectIds: [...group.groundArea!.entryEffectIds].reverse(),
    })
    expect(updated!.effects).toEqual(group.effects)
    expect(JSON.stringify(group)).toBe(before)
  },
)

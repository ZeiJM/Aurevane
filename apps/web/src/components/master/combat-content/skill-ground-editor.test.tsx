import { readFileSync } from 'node:fs'
import type { MatureSkillDefinition } from '@aurevane/game-core/combat/mature-skills'
import type { AbilityBehavior } from '@aurevane/game-core/combat/combat-definition'
import { createElement, isValidElement, type ComponentProps } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { resolveMatureSkillVersion } from '@aurevane/game-core/combat/mature-skills'
import { SkillGroundEditor, AbilityGroundEditor, groundAreaForEffects } from './skill-ground-editor'

describe('Master persistent Ground controls', () => {
  it('keeps independent unit targets out of newly derived fields and admits ordinary Ground defenses', () => {
    const effects = [
      {
        type: 'apply-status' as const,
        recipient: 'affected-units' as const,
        target: 'ground' as const,
        statusId: 'fortified',
        stacks: 1,
      },
      {
        type: 'apply-status' as const,
        recipient: 'affected-units' as const,
        target: 'ally' as const,
        statusId: 'reckless',
        stacks: 1,
      },
      {
        type: 'damage' as const,
        recipient: 'affected-units' as const,
        target: 'enemy' as const,
        amount: 7,
      },
    ]
    expect(groundAreaForEffects(effects)).toMatchObject({
      entryEffectOrdinals: [0],
      contactPolicyVersion: 1,
    })
    expect(
      groundAreaForEffects(effects, {
        durationRounds: 7,
        visualPresetId: 'frost',
        entryEffectOrdinals: [0, 2],
        timing: 'delayed',
      }),
    ).toMatchObject({ entryEffectOrdinals: [0, 2], durationRounds: 7, timing: 'delayed' })
  })
  it('shows one current Ground profile immediately without an opt-in checkbox or render mutation', () => {
    const original = resolveMatureSkillVersion('cinderweaver.flame-burst')!
    const onChange = vi.fn()
    const html = renderToStaticMarkup(
      createElement(SkillGroundEditor, {
        target: original.target,
        effects: original.effects,
        onChange,
      }),
    )
    expect(html).toContain('aria-label="Ground duration (rounds)"')
    expect(html).toContain('aria-label="Ground animation"')
    expect(html).toContain('aria-label="Ground affects"')
    expect(html).not.toContain('type="checkbox"')
    expect(onChange).not.toHaveBeenCalled()
  })
  it('hides obsolete Ground settings on non-Ground effects without rewriting the raw draft', () => {
    const original = resolveMatureSkillVersion('vanguard.forceful-strike')!
    const value = { durationRounds: 7, visualPresetId: 'frost' as const, entryEffectOrdinals: [0] }
    const onChange = vi.fn()
    const html = renderToStaticMarkup(
      createElement(SkillGroundEditor, {
        target: original.target,
        effects: original.effects,
        value,
        onChange,
      }),
    )
    for (const label of ['Ground duration (rounds)', 'Ground animation', 'Ground affects'])
      expect(html).not.toContain(`aria-label="${label}"`)
    expect(value).toEqual({ durationRounds: 7, visualPresetId: 'frost', entryEffectOrdinals: [0] })
    expect(onChange).not.toHaveBeenCalled()
  })
  it('maps canonical Pierce Ground entries through native conversion without dropping their stable ID', () => {
    const group = {
      id: 'main',
      mode: 'action',
      targeting: {
        kind: 'ground-tile',
        geometryVersion: 3,
        categories: ['ground'],
        teamPolicy: 'any',
        shape: { kind: 'single' },
        minimumRange: 0,
        maximumRange: 2,
        requiresLineOfSight: false,
        maximumElevationDifference: 2,
        friendlyFire: 'all-units',
      },
      effects: [
        {
          id: 'pierce',
          payload: {
            type: 'pierce',
            recipient: 'affected-units',
            target: 'ground',
            amount: 5,
            armorIgnoredBasisPoints: 2500,
          },
        },
      ],
      groundArea: {
        durationRounds: 2,
        visualPresetId: 'arcane-pulse',
        entryEffectIds: ['pierce'],
        contactPolicyVersion: 1,
      },
    } as unknown as AbilityBehavior
    let next: AbilityBehavior | undefined
    const editor = AbilityGroundEditor({
      value: group,
      onChange: (value) => {
        next = value
      },
    })
    if (!isValidElement<ComponentProps<typeof SkillGroundEditor>>(editor))
      throw new Error('Missing Ground editor')
    expect(editor.props.value?.entryEffectOrdinals).toEqual([0])
    editor.props.onChange({ ...editor.props.value!, durationRounds: 9 })
    expect(next!.groundArea).toMatchObject({
      entryEffectIds: ['pierce'],
      durationRounds: 9,
      contactPolicyVersion: 1,
    })
  })
  it('retains invalid canonical entry links and unknown raw settings when another control is edited', () => {
    const group = {
      id: 'main',
      mode: 'action',
      targeting: {
        kind: 'ground-tile',
        teamPolicy: 'any',
        friendlyFire: 'all-units',
        shape: { kind: 'single' },
        minimumRange: 0,
        maximumRange: 3,
      },
      effects: [
        {
          id: 'hit',
          payload: { type: 'damage', recipient: 'affected-units', target: 'ground', amount: 5 },
        },
      ],
      groundArea: {
        durationRounds: 2,
        visualPresetId: 'frost',
        entryEffectIds: ['missing'],
        unsupportedSetting: true,
      },
    } as unknown as AbilityBehavior
    let next: AbilityBehavior | undefined
    const editor = AbilityGroundEditor({
      value: group,
      onChange: (value) => {
        next = value
      },
    })
    if (!isValidElement<ComponentProps<typeof SkillGroundEditor>>(editor))
      throw new Error('Missing Ground editor')
    editor.props.onChange({ ...editor.props.value!, durationRounds: 9 })
    expect(next!.groundArea).toMatchObject({
      entryEffectIds: ['missing'],
      unsupportedSetting: true,
      durationRounds: 9,
    })
  })
  it('edits duration and registered animations while leaving activation to Master timing', () => {
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
    expect(html).not.toContain('aria-label="Ground activation"')
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

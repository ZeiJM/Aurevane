import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { SkillEffectEditor } from './skill-effect-editor'
import { previewEffect } from '../../character/skill-effect-preview'
import { BattleCombatantEffects } from '../../battle/battle-combatant-effects'
import { CombatEffectTimingEditor } from './combat-effect-timing-editor'

it.each(['range-up', 'range-down'])(
  'provides editable tile strength and duration and shared %s readers',
  (statusId) => {
    const effect = {
      type: 'apply-status' as const,
      recipient: 'primary-unit' as const,
      statusId,
      stacks: 1,
      rangeTiles: 3,
      durationTurns: 7,
    }
    const html = renderToStaticMarkup(
      createElement(SkillEffectEditor, { value: effect, onChange() {} }),
    )
    expect(html).toContain('Range strength (tiles)')
    expect(html).toContain('aria-label="Effect duration (turns)"')
    expect(html).not.toContain('aria-label="Status stacks"')
    expect(previewEffect(effect)).toMatchObject({
      label: statusId === 'range-up' ? 'Range Up' : 'Range Down',
      magnitude: `${statusId === 'range-up' ? '+' : '−'}3 tiles`,
    })
    expect(previewEffect(effect).explanation).toContain('3 tiles per application')
    const rail = renderToStaticMarkup(
      createElement(BattleCombatantEffects, {
        name: 'Actor',
        compact: true,
        statuses: [
          {
            statusId,
            statusVersion: 1,
            stacks: 1,
            rangeTiles: 3,
            remainingOwnerTurnStarts: 7,
            sourceCombatantId: 'enemy',
          },
        ],
      }),
    )
    expect(rail).toContain(`data-battle-effect-icon="${statusId}"`)
    expect(rail).toContain('3 tiles per application')
  },
)
it('places both tags in the global Delayed category and respects panel timing overrides', () => {
  for (const mode of ['delayed', 'instant', 'next-round'] as const) {
    const html = renderToStaticMarkup(
      createElement(CombatEffectTimingEditor, {
        initialPolicy: {
          version: 1,
          modes: mode === 'delayed' ? {} : { 'range-up': mode, 'range-down': mode },
        },
      }),
    )
    for (const id of ['range-up', 'range-down'])
      expect(html).toMatch(new RegExp(`id="timing-${id}"[^]*?<option value="${mode}" selected="">`))
  }
})

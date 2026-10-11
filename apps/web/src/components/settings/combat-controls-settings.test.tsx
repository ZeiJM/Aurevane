import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { DEFAULT_COMBAT_KEYBINDS } from '@aurevane/validation/player/combat-controls'
import { describe, expect, it } from 'vitest'
import { CombatControlsSettings } from './combat-controls-settings'
describe('account combat controls', () => {
  it('shows every cockpit slot and retains recovery, capture, reset and account save controls', () => {
    const markup = renderToStaticMarkup(
      createElement(CombatControlsSettings, { initialBindings: DEFAULT_COMBAT_KEYBINDS }),
    )
    for (const action of [
      'move',
      'basicAttack',
      'guard',
      'recover',
      'skill1',
      'skill2',
      'skill3',
      'skill4',
      'essence',
      'supernatural',
      'endTurn',
    ])
      expect(markup).toContain(`data-testid="keybind-${action}"`)
    for (const label of [
      'Change Discipline Skill 4 keybind',
      'Reset defaults',
      'Save Controls',
      'The server validates every action.',
    ])
      expect(markup).toContain(label)
    expect(markup).not.toContain('Movement Skill')
    expect(markup).not.toContain('Enter confirms a legal proposal')
  })
})

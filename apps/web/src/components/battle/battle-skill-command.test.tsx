import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { BattleSkillCommand } from './battle-skill-command'

describe('Battle Technique command information', () => {
  it('renders effect tags on the command itself while preserving its action label', () => {
    const markup = renderToStaticMarkup(
      createElement(BattleSkillCommand, {
        slot: 'guard',
        hotkey: '03',
        label: 'Chilling Mist',
        cost: '45 AP',
        artworkSrc: '/media/skills/guard.webp',
        active: false,
        disabled: false,
        onActivate: () => undefined,
        tags: ['Ground tile', 'Area · radius 1', 'Frozen terrain', 'Slow'],
      }),
    )
    expect(markup).toContain('aria-label="Chilling Mist, 45 AP"')
    expect(markup).toContain('data-battle-skill-tags=')
    for (const tag of ['Ground tile', 'Area · radius 1', 'Frozen terrain', 'Slow']) {
      expect(markup).toContain(`>${tag}</span>`)
    }
    expect(markup).toContain('aria-describedby=')
  })

  it('retains readable tags when the action is unavailable', () => {
    const markup = renderToStaticMarkup(
      createElement(BattleSkillCommand, {
        slot: 'attack',
        hotkey: '02',
        label: 'Water Lance',
        cost: '35 AP',
        artworkSrc: '/media/skills/guard.webp',
        active: false,
        disabled: true,
        onActivate: () => undefined,
        tags: ['Enemy', 'Single target', 'Damage', 'Wet'],
      }),
    )
    expect(markup).toContain('disabled=""')
    expect(markup).toContain('>Wet</span>')
    expect(markup).not.toContain('cockpit:')
  })
})

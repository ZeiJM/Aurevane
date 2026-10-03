import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { BattleSkillCommand } from './battle-skill-command'

describe('Battle Technique command information', () => {
  it('keeps facing controls inside End Turn with a reserved controls row', () => {
    const props = {
      slot: 'finish' as const,
      hotkey: 'Space',
      label: 'End Turn',
      cost: 'Choose facing',
      artworkSrc: '/media/skills/finish-turn.webp',
      active: false,
      disabled: false,
      onActivate: () => undefined,
    }
    const closed = renderToStaticMarkup(createElement(BattleSkillCommand, props))
    const open = renderToStaticMarkup(
      createElement(
        BattleSkillCommand,
        { ...props, active: true },
        createElement(
          'div',
          { 'data-unified-facing-pad': 'true' },
          ...['north', 'west', 'east', 'south'].map((facing) =>
            createElement('button', { key: facing, 'aria-label': `Face ${facing}` }, '↑'),
          ),
        ),
      ),
    )
    expect(closed).toContain('data-battle-command-extra-controls="true"')
    expect(open).toMatch(
      /data-command-card="finish"[\s\S]*data-battle-command-extra-controls="true"[\s\S]*data-unified-facing-pad="true"[\s\S]*<\/article>$/,
    )
    for (const facing of ['north', 'west', 'east', 'south']) {
      expect(open).toContain(`aria-label="Face ${facing}"`)
    }
  })
  it.each(['inspect', 'move', 'attack', 'guard', 'finish'] as const)(
    'places %s artwork, name, then readable information and hotkey in order',
    (slot) => {
      const markup = renderToStaticMarkup(
        createElement(BattleSkillCommand, {
          slot,
          hotkey: slot === 'finish' ? 'Space' : '1',
          label: slot === 'finish' ? 'End Turn' : 'Action name',
          cost: '30 AP',
          artworkSrc: '/media/skills/guard.webp',
          active: false,
          disabled: true,
          onActivate: () => undefined,
        }),
      )
      expect(markup).toMatch(
        /data-battle-command-artwork="static"[\s\S]*<strong>[^<]+<\/strong><\/button><div[^>]*data-battle-cockpit-controls="true"[^>]*><button[^>]*aria-label="About [^"]+"[^>]*>i<\/button><span[^>]*data-battle-command-hotkey="true"[^>]*>/,
      )
      expect(markup).not.toMatch(/data-battle-info-trigger="true"[^>]*disabled/)
    },
  )
  it('provides a separate information control without filling the action card with tags', () => {
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
    expect(markup).toContain('aria-label="About Chilling Mist"')
    expect(markup).toContain('aria-haspopup="dialog"')
    expect(markup).not.toContain('data-battle-skill-tags="command"')
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
    expect(markup).toContain('aria-label="About Water Lance"')
    expect(markup).not.toContain('cockpit:')
  })
})

describe('cooling Support Actions', () => {
  it('disables selection with an artwork countdown while retaining information', () => {
    const markup = renderToStaticMarkup(
      createElement(BattleSkillCommand, {
        slot: 'guard',
        hotkey: '3',
        label: 'Guard',
        cost: '30 AP',
        artworkSrc: '/guard.webp',
        active: false,
        disabled: false,
        cooldownTurns: 2,
        onActivate: () => undefined,
      }),
    )
    expect(markup).toMatch(/data-battle-command="guard"[^>]*disabled/)
    expect(markup).toContain('Cooldown: 2 turns remaining')
    expect(markup).toContain('data-battle-cooldown-countdown="true"')
    expect(markup).not.toMatch(/data-battle-info-trigger="true"[^>]*disabled/)
  })
})

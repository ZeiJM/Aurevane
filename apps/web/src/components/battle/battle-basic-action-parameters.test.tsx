import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { BattleSkillCommand } from './battle-skill-command'

vi.mock('./battle-info-popover', () => ({
  BattleInfoPopover: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))

describe('inherent action characteristics', () => {
  it.each([
    ['inspect', 'Inspect', '0 AP', 'Inspect visible'],
    ['finish', 'End Turn', '0 AP', 'Choose final facing'],
    ['move', 'Move', '20 AP', 'Movement'],
    ['attack', 'Basic Attack', '30 AP', '15% Physical Power'],
    ['guard', 'Guard', '30 AP', '15%'],
    ['guard', 'HP Recovery', '50 AP', '10%'],
    ['guard', 'MP Recovery', '50 AP', '10%'],
  ] as const)(
    'shows all characteristics for %s / %s without a selector',
    (slot, label, cost, effect) => {
      const markup = renderToStaticMarkup(
        <BattleSkillCommand
          slot={slot}
          hotkey="3"
          label={label}
          cost={cost}
          artworkSrc="/media/skills/guard.webp"
          active={false}
          disabled={false}
          onActivate={() => {}}
        />,
      )
      for (const name of [
        'Skill Type',
        'Cost',
        'Cooldown',
        'Requirements',
        'Effects',
        'Range',
        'Target',
        'Target Method',
        'Target Elevation',
        'Line of Sight',
      ]) {
        expect(markup).toContain(`<dt>${name}</dt>`)
      }
      expect(markup).toContain(effect)
      expect(markup).not.toContain('aria-haspopup="listbox"')
      if (slot === 'move' || slot === 'attack' || slot === 'guard') {
        expect(markup.match(/data-compact-skill-effect="true"/g)).toHaveLength(1)
        expect(markup.match(/data-compact-effect-magnitude="true"/g)).toHaveLength(1)
        if (label === 'Guard') {
          expect(markup.match(/data-compact-effect-duration="true"/g)).toHaveLength(1)
        } else {
          expect(markup).not.toContain('data-compact-effect-duration')
        }
        if (slot === 'move' || label === 'HP Recovery' || label === 'MP Recovery') {
          expect(markup).toContain('data-compact-effect-timing="true">[Instant]</span>')
        } else {
          expect(markup).not.toContain('data-compact-effect-timing')
        }
        expect(markup).toMatch(/<ul[^>]*aria-label="Effect explanations"[^>]*><li><strong>/)
      }
      if (slot === 'guard') {
        expect(markup).toContain('<dt>Cooldown</dt><dd>2 turns</dd>')
        expect(markup.match(/data-basic-action-effect-explanation="true"/g)).toHaveLength(1)
        if (label === 'Guard') {
          expect(markup).toContain('<span data-compact-effect-label="true">Guarded</span>')
          expect(markup).toContain('<span data-compact-effect-magnitude="true">[15%]</span>')
          expect(markup).toContain('<span data-compact-effect-duration="true">[2 Turns]</span>')
          expect(markup).toContain('Reduces incoming damage by 15% per stack, maximum 3 stacks.')
        } else {
          expect(markup).toContain('HP and MP Recovery share a cooldown.')
        }
      }
    },
  )
})

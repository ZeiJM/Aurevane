import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { BattleSkillCommand } from './battle-skill-command'

vi.mock('./battle-info-popover', () => ({
  BattleInfoPopover: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))

describe('inherent action characteristics', () => {
  it.each([
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
    },
  )
})

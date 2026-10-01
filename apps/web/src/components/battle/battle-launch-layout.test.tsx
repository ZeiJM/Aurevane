import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('@/components/media/aurevane-image', () => ({
  AurevaneImage: () => createElement('img', { alt: '' }),
}))
vi.mock('./pvp-lobby-modal', () => ({ PvpLobbyModal: () => null }))

import { BattleLaunch } from './battle-launch'

describe('Battle Hall concept composition', () => {
  it('orders clear battle destinations and omits the redundant AI arena banner', () => {
    const markup = renderToStaticMarkup(
      createElement(BattleLaunch, { characterId: 'character-1', characterName: 'Eira Vale' }),
    )
    const rail = markup.slice(
      markup.indexOf('aria-label="Battle Hall sections"'),
      markup.indexOf('</nav>'),
    )
    const labels = ['AI Battles', 'PVP - Direct', 'PVP - Matchmaking (coming soon)', 'Spectate']
    const positions = labels.map((label) => {
      expect(rail).toContain(label)
      return rail.indexOf(label)
    })
    expect(positions).toEqual([...positions].sort((a, b) => a - b))
    expect(markup).not.toContain('A classic proving ground for focused combat.')
    expect(markup).toContain('aria-label="AI sparring arena"')
  })

  it('offers the three standard arena widths with matching labels', () => {
    const markup = renderToStaticMarkup(
      createElement(BattleLaunch, { characterId: 'character-1', characterName: 'Eira Vale' }),
    )
    expect(markup).toMatch(/value="duel-yard"[^>]*>Duel Yard · 9×7<\/option>/)
    expect(markup).toMatch(/value="crossroads-court"[^>]*>Crossroads Court · 12×7<\/option>/)
    expect(markup).toMatch(/value="terraced-yard"[^>]*>Terraced Yard · 15×7<\/option>/)
  })

  it('renders three real workspaces with AI Sparring selected by default and no public matches', () => {
    const markup = renderToStaticMarkup(
      createElement(BattleLaunch, {
        characterId: 'character-1',
        characterName: 'Eira Vale',
      }),
    )
    expect(markup.match(/data-hall-workspace="/g)).toHaveLength(3)
    expect(markup).toContain('data-hall-scene="true"')
    expect(markup.match(/data-hall-scroll-body="true"/g)).toHaveLength(3)
    expect(markup.match(/data-hall-action-row="true"/g)).toHaveLength(3)
    expect(markup).toContain('AI Sparring')
    expect(markup).toContain('Create Battle Lobby')
    expect(markup).toContain('Join Battle Lobby')
    expect(markup).toContain('Spectate Battle')
    expect(markup).not.toContain('Witness a battle by key.')
    expect(markup).not.toContain('Watch a shared battle. Learn from every turn.')
    expect(markup).toContain('>Enter Battle<')
    expect(markup).not.toContain('Featured Matches')
    expect(markup).not.toContain('No battle selected.')
    expect(markup).toContain('Recommended for')
    expect(markup).toContain('Ideal for')
    expect(markup).toContain('For experienced')
    expect(markup).not.toContain('AI difficulty')
    expect(markup).not.toContain('Guided exercise')
    expect(markup).not.toContain('01 / AI Battles')
    expect(markup).not.toContain('02 / Challenge')
    expect(markup).not.toContain('03 / Spectate')
    expect(markup).not.toContain(
      'Practice, learn, and test your committed build against AI opponents.',
    )
    expect(markup).not.toContain(
      'Full duel arena with difficult ground, elevation, and flanking room.',
    )
  })

  it('separates lobby creation from key entry without losing either action', () => {
    const markup = renderToStaticMarkup(
      createElement(BattleLaunch, { characterId: 'character-1', characterName: 'Eira Vale' }),
    )
    expect(markup).toContain('aria-label="PvP lobby actions"')
    expect(markup).toContain('data-pvp-entry="create"')
    expect(markup).toMatch(/data-pvp-entry="join"[^>]*hidden=""/)
    expect(markup).toContain('>Join by Key<')
    expect(markup).toContain('Create Battle Lobby')
    expect(markup).toContain('Join Battle Lobby')
  })

  it('describes the selected PvP format outside the dropdown', () => {
    const markup = renderToStaticMarkup(
      createElement(BattleLaunch, { characterId: 'character-1', characterName: 'Eira Vale' }),
    )
    expect(markup).toContain('aria-describedby="pvp-format-description"')
    expect(markup).toMatch(
      /<p[^>]*id="pvp-format-description"[^>]*>Two combatants · one per side<\/p>/,
    )
  })
})

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
  it('offers AI-aligned Small, Medium and Large PvP sizes with Medium selected by default', () => {
    const markup = renderToStaticMarkup(
      createElement(BattleLaunch, {
        characterId: 'character-1',
        characterName: 'Eira Vale',
        initialPvpDialog: 'create',
      }),
    )
    const group =
      markup.match(/<fieldset[^>]*>[\s\S]*?<legend>Map size<\/legend>[\s\S]*?<\/fieldset>/)?.[0] ??
      ''
    for (const label of ['Small · 9×7', 'Medium · 12×7', 'Large · 15×7'])
      expect(group).toContain(label)
    expect(group).toMatch(/aria-pressed="true"[^>]*>Medium · 12×7<\/button>/)
  })
  it('orders clear battle destinations and omits the redundant AI arena banner', () => {
    const markup = renderToStaticMarkup(
      createElement(BattleLaunch, { characterId: 'character-1', characterName: 'Eira Vale' }),
    )
    const rail = markup.slice(
      markup.indexOf('aria-label="Battle Hall sections"'),
      markup.indexOf('</nav>'),
    )
    const labels = ['Sparring Yard', 'PVP', 'Arena Queue', 'Spectate']
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
    expect(markup.match(/data-hall-action-row="true"/g)).toHaveLength(2)
    expect(markup).toContain('AI Sparring')
    expect(markup).not.toContain('Create Battle Lobby')
    expect(markup).not.toContain('Join Battle Lobby')
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
    expect(markup).not.toContain('01 / Sparring Yard')
    expect(markup).not.toContain('02 / Challenge')
    expect(markup).not.toContain('03 / Spectate')
    expect(markup).not.toContain(
      'Practice, learn, and test your committed build against AI opponents.',
    )
    expect(markup).not.toContain(
      'Full duel arena with difficult ground, elevation, and flanking room.',
    )
  })

  it('offers Create Lobby and Join by Key as two choices that open popups', () => {
    const closed = renderToStaticMarkup(
      createElement(BattleLaunch, { characterId: 'character-1', characterName: 'Eira Vale' }),
    )
    expect(closed).toContain('aria-label="PvP lobby actions"')
    expect(closed).toContain('>Create Lobby<')
    expect(closed).toContain('>Join by Key<')
    expect(closed).not.toContain('role="dialog"')

    const create = renderToStaticMarkup(
      createElement(BattleLaunch, {
        characterId: 'character-1',
        characterName: 'Eira Vale',
        initialPvpDialog: 'create',
      }),
    )
    expect(create).toContain('data-pvp-dialog="create"')
    expect(create).toContain('Create Battle Lobby')
    expect(create).not.toContain('Join Battle Lobby')

    const join = renderToStaticMarkup(
      createElement(BattleLaunch, {
        characterId: 'character-1',
        characterName: 'Eira Vale',
        initialPvpDialog: 'join',
      }),
    )
    expect(join).toContain('data-pvp-dialog="join"')
    expect(join).toContain('Join Battle Lobby')
    expect(join).not.toContain('Create Battle Lobby')
  })

  it('describes the selected PvP format outside the dropdown', () => {
    const markup = renderToStaticMarkup(
      createElement(BattleLaunch, {
        characterId: 'character-1',
        characterName: 'Eira Vale',
        initialPvpDialog: 'create',
      }),
    )
    expect(markup).toContain('aria-describedby="pvp-format-description"')
    expect(markup).toMatch(
      /<p[^>]*id="pvp-format-description"[^>]*>Two combatants · one per side<\/p>/,
    )
  })
})

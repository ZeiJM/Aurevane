import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { BattleRoundBadge } from './battle-round-badge'
import { BattleChronicleHeading } from './battle-chronicle-heading'

describe('current battle round badge', () => {
  it.each([0, 1, 4, 120])('presents recorded round %i without inferring a turn', (round) => {
    const markup = renderToStaticMarkup(<BattleChronicleHeading round={round} />)
    expect(markup).toContain('role="status"')
    expect(markup).toContain(`aria-label="Current battle round ${round}"`)
    expect(markup).toContain(`data-battle-round="${round}"`)
    expect(markup).toContain('Battle Chronicle')
    expect(markup).not.toContain('<button')
  })

  it.each([undefined, null, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])(
    'keeps absent or invalid historical round %s unavailable',
    (round) => {
      const markup = renderToStaticMarkup(<BattleChronicleHeading round={round} />)
      expect(markup).toContain('aria-label="Current battle round unavailable"')
      expect(markup).toContain('data-battle-round="unavailable"')
      expect(markup).not.toContain('Current battle round 1')
    },
  )

  it('retains the historical badge component without using it in the preview', () => {
    expect(renderToStaticMarkup(<BattleRoundBadge round={1} />)).toContain(
      'data-battle-round-badge="true"',
    )
  })

  it('uses the same persisted snapshot round on playable PvE/PvP and spectators', () => {
    const here = dirname(fileURLToPath(import.meta.url))
    for (const name of ['battle-experience.tsx', 'pvp-spectator-experience.tsx']) {
      const source = readFileSync(join(here, name), 'utf8')
      expect(source).toContain('const battleState = tactical.battle')
      expect(source).toContain('<BattleChronicleHeading round={battleState.round} />')
    }
  })
})

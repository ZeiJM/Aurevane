import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
vi.mock('@/components/shell/account-menu', () => ({ AccountMenu: () => null }))
import { BattleRouteFrame } from './battle-route-frame'
describe('shared active battle frame', () => {
  it.each([false, true])(
    'keeps navigation outside active combat and spectation (%s)',
    (spectating) => {
      const markup = renderToStaticMarkup(
        <BattleRouteFrame sessionHref="/game/battle/test" spectating={spectating}>
          <main id="battlefield">Field</main>
        </BattleRouteFrame>,
      )
      expect(markup).not.toContain('data-av-game-rail')
      expect(markup).toContain('Skip to battlefield')
      expect(markup).toContain('aria-label="Reference"')
    },
  )
})

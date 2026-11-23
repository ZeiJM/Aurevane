import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
vi.mock('@/components/shell/account-menu', () => ({
  AccountMenu: ({
    activeSessionHref,
    activeSessionLabel,
  }: {
    activeSessionHref: string
    activeSessionLabel: string
  }) => <a href={activeSessionHref}>{activeSessionLabel}</a>,
}))
import { BattleRouteFrame } from './battle-route-frame'
import { battleSessionHref } from './battle-return-navigation'
describe('shared active battle frame', () => {
  it('retains a validated participant return preference in the brand and active-session links', () => {
    const markup = renderToStaticMarkup(
      <BattleRouteFrame sessionHref={battleSessionHref('session', 'world')}>
        <main id="battlefield">Field</main>
      </BattleRouteFrame>,
    )
    expect(markup.match(/href="\/game\/battle\/session\?returnTo=world"/g)).toHaveLength(2)
  })
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
      expect(markup).toContain('data-av-site-header="true"')
      expect(markup).toContain('class="brand"')
      expect(markup).toContain(
        spectating ? 'Return to Spectated Battle' : 'Return to Active Battle',
      )
      expect(markup.match(/<main\b/g)).toHaveLength(1)
    },
  )
})

import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { BattleActionTimeline } from './battle-action-timeline'
import type { PresentedBattleLogAction } from './battle-log-presentation'

const action = (version: number): PresentedBattleLogAction => ({
  key: `action:${version}`,
  battleVersion: version,
  round: 1,
  turnNumber: 1,
  occurredAt: '',
  kind: 'offense',
  tone: 'damage',
  significance: 'standard',
  primary: [{ text: `Result ${version}`, tone: 'damage' }],
  secondary: null,
  details: [],
  ariaLabel: `Action ${version}`,
})
const rounds = [{ key: 'round:1', round: 1, occurredAt: '', actions: [action(1), action(2)] }]

describe('fixed inline Battle Log reader', () => {
  it('puts the recorded outcome ahead of long attribution while retaining narration', () => {
    const latest = {
      ...action(2),
      primary: [
        { text: 'Captain of the Thousand Oaths', role: 'actor' as const },
        { text: ' strikes ' },
        { text: 'Eastern Recruit', role: 'target' as const },
        { text: ' — ' },
        { text: '14 damage', role: 'outcome' as const, tone: 'damage' as const },
      ],
    }
    const markup = renderToStaticMarkup(
      <BattleActionTimeline rounds={[{ ...rounds[0]!, actions: [latest] }]} entries={[]} />,
    )
    expect(markup).toMatch(/data-reader-part="Result"[^]*?<p>14 damage/)
    expect(markup).toContain('Captain of the Thousand Oaths strikes Eastern Recruit — 14 damage')
  })
  it('opens the latest action result inline without a dialog', () => {
    const markup = renderToStaticMarkup(<BattleActionTimeline rounds={rounds} entries={[]} />)
    expect(markup).toContain('aria-label="Recorded action result"')
    expect(markup).toContain('Result 2')
    expect(markup.match(/data-reader-part="([^"]+)"/)?.[1]).toBe('Result')
    expect(markup).toContain('aria-pressed="true"')
    expect(markup).not.toContain('<dialog')
  })
  it('reads one selected text action without activating effect popup renderers', () => {
    const guarded = {
      ...action(2),
      secondary: [{ text: 'Guarded', role: 'outcome' as const, tone: 'benefit' as const }],
    }
    const markup = renderToStaticMarkup(
      <BattleActionTimeline
        rounds={[{ ...rounds[0]!, actions: [action(1), guarded] }]}
        entries={[]}
        view="text"
      />,
    )
    expect(markup).toContain('Battle action transcript')
    expect(markup).toContain('Result 2')
    expect(markup).not.toContain('Result 1')
    expect(markup).toContain('Guarded')
    expect(markup).not.toContain('data-battle-effect-name')
  })
})

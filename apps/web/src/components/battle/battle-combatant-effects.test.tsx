import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { CombatStatusInstance } from '@aurevane/game-core/combat/actions'
import { PHASE4_STATUSES } from '@aurevane/game-core/combat/status-content'
import { BattleCombatantEffects } from './battle-combatant-effects'

function render(statusId?: string, stacks = 1) {
  const statuses: CombatStatusInstance[] = statusId
    ? [
        {
          statusId,
          statusVersion: 1,
          stacks,
          remainingOwnerTurnStarts: 2,
          sourceCombatantId: 'opponent',
        },
      ]
    : []
  return renderToStaticMarkup(<BattleCombatantEffects name="Archer" statuses={statuses} />)
}
describe('combatant effect presentation', () => {
  it('shows both the advantage and drawback of a mixed effect', () => {
    const markup = render('fortified')
    expect(markup).toContain('Damage received')
    expect(markup).toContain('−30%')
    expect(markup).toContain('Damage dealt')
    expect(markup).toContain('−20%')
    expect(markup).toContain('data-tone="positive"')
    expect(markup).toContain('data-tone="negative"')
    expect(markup).toContain('data-battle-effect-kind="Effect"')
  })
  it('labels conditional values and preserves the explanation and remaining duration', () => {
    const markup = render('marked')
    expect(markup).toContain('conditional')
    expect(markup).toContain('+20%')
    expect(markup).toContain('from the unit that applied Mark')
    expect(markup).toContain('2 affected-unit turn starts remaining')
  })
  it('shows compounded Guarded stacks without inventing an outgoing bonus', () => {
    const markup = render('guarded', 2)
    expect(markup).toContain('−27.8%')
    expect(markup).not.toContain('Damage dealt')
  })
  it('keeps every compact effect reachable by focus, hover or touch instead of truncating the card', () => {
    const statuses = ['guarded', 'marked', 'fortified'].map((statusId) => ({
      statusId,
      statusVersion: 1,
      stacks: 1,
      remainingOwnerTurnStarts: 2,
      sourceCombatantId: 'opponent',
    }))
    const markup = renderToStaticMarkup(
      <BattleCombatantEffects compact name="Archer" statuses={statuses} />,
    )
    expect(markup.match(/aria-haspopup="dialog"/g)).toHaveLength(3)
    expect(markup).toContain('Explain Guard')
    expect(markup).toContain('Explain Mark')
    expect(markup).toContain('Explain Fortified')
    expect(markup).not.toContain('All 3')
  })
  it('keeps duration visible inside a stacked icon and identifies each effect', () => {
    const statuses = ['guarded', 'regeneration', 'reckless', 'haste', 'hastened'].map(
      (statusId) => ({
        statusId,
        statusVersion: 1,
        stacks: 3,
        remainingOwnerTurnStarts: 2,
        sourceCombatantId: 'opponent',
      }),
    )
    const markup = renderToStaticMarkup(
      <BattleCombatantEffects compact name="Archer" statuses={statuses} />,
    )
    expect(markup.match(/data-effect-duration="true">2<\/small>/g)).toHaveLength(5)
    expect(markup).not.toContain('>×3</small>')
    for (const glyph of ['GUA', 'REG', 'REC', 'HST', 'HSN'])
      expect(markup).toContain(`>${glyph}</i>`)
  })
  it('retains every effect beyond the twenty visible slots with an overflow affordance', () => {
    const statuses = Array.from({ length: 23 }, (_, index) => ({
      statusId: `effect-${index}`,
      statusVersion: 1,
      stacks: 1,
      remainingOwnerTurnStarts: 2,
      sourceCombatantId: 'opponent',
    }))
    const markup = renderToStaticMarkup(
      <BattleCombatantEffects compact name="Archer" statuses={statuses} />,
    )
    expect(markup.match(/aria-haspopup="dialog"/g)).toHaveLength(23)
    expect(markup).toContain('Scroll for all 23 effects')
    expect(markup).toContain('Explain Effect 22')
  })
  it('identifies every published named and legacy status distinctly without losing catalog overflow', () => {
    const statuses = [
      ...PHASE4_STATUSES.map((status) => status.id),
      'guarded',
      'exposed',
      'lowered-guard',
    ].map((statusId) => ({
      statusId,
      statusVersion: 1,
      stacks: 1,
      remainingOwnerTurnStarts: 2,
      sourceCombatantId: 'opponent',
    }))
    const markup = renderToStaticMarkup(
      <BattleCombatantEffects compact name="Archer" statuses={statuses} />,
    )
    const glyphs = [...markup.matchAll(/<i aria-hidden="true">([^<]+)<\/i>/g)].map(
      (match) => match[1],
    )
    expect(glyphs).toHaveLength(statuses.length)
    expect(new Set(glyphs).size).toBe(statuses.length)
    expect(markup).toContain(`Scroll for all ${statuses.length} effects`)
  })
  it('uses affected-unit timing for periodic effects and explicit next-round timing for tempo effects', () => {
    expect(render('burn')).toContain('2 affected-turn-end ticks remaining')
    expect(render('hastened')).toContain('Until the next round starts')
    expect(render('root')).not.toContain('rounds remaining')
  })
  it('does not claim bonuses when no effect is active', () => {
    const markup = render()
    expect(markup).toContain('No active effects')
    expect(markup).not.toContain('%')
  })
})

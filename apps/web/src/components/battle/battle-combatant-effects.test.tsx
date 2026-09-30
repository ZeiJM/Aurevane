import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { CombatStatusInstance } from '@aurevane/game-core/combat/actions'
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
    expect(markup).toContain('2 turns remaining')
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
  it('does not claim bonuses when no effect is active', () => {
    const markup = render()
    expect(markup).toContain('No active effects')
    expect(markup).not.toContain('%')
  })
})

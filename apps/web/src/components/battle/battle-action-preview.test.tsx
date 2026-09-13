import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { BattleActionPreview as ActionPreview } from '@/server/battle/battle-preview-service'
import { BattleActionPreview } from './battle-action-preview'

const attack: ActionPreview = {
  kind: 'action',
  legal: true,
  actionId: 'basic.attack.unarmed.basic',
  actorId: 'you',
  primaryCombatantId: 'enemy',
  affectedTiles: [],
  affectedCombatantIds: ['enemy'],
  projectedEffects: [{ effectType: 'damage', combatantId: 'enemy', before: 100, after: 83 }],
  projectedStatuses: [],
  projectedEvents: [],
  mpCost: 0,
  actionEconomyCost: 30,
  actionEconomyBefore: 100,
  actionEconomyAfter: 70,
  hitChanceBasisPoints: 6900,
  defenseKind: 'armor',
  defenseRating: 5,
  mitigatedBaseDamage: 17,
  issues: [],
  spendsAction: true,
}
describe('current selection forecast', () => {
  it('renders server-projected accuracy, on-hit damage and AP together', () => {
    const markup = renderToStaticMarkup(<BattleActionPreview preview={attack} pending={false} />)
    for (const label of ['Hit 69%', 'On hit 17 dmg', '30 AP', '70 AP left'])
      expect(markup).toContain(label)
    expect(markup).toContain('aria-label="Forecast details"')
  })
  it('replaces a previous projection while a new target is pending', () => {
    const markup = renderToStaticMarkup(<BattleActionPreview preview={attack} pending />)
    expect(markup).toContain('Calculating preview')
    expect(markup).not.toContain('Hit 69%')
    expect(markup).not.toContain('17 dmg')
  })
  it('does not advertise damage or success for a blocked action', () => {
    const markup = renderToStaticMarkup(
      <BattleActionPreview
        preview={{
          ...attack,
          legal: false,
          issues: [{ code: 'out-of-range', message: 'Target is out of range.' }],
        }}
        pending={false}
      />,
    )
    expect(markup).toContain('Blocked')
    expect(markup).not.toContain('17 dmg')
    expect(markup).not.toContain('Hit 69%')
  })
})

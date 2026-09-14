import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { BattleActionPreview as ActionPreview } from '@/server/battle/battle-preview-service'
import { BattleActionPreview } from './battle-action-preview'
import type { BattleSkillForecastPresentation } from './battle-runtime'

const barrier: BattleSkillForecastPresentation = {
  id: 'lifebinder.barrier',
  name: 'Barrier',
  apCost: 40,
  mpCost: 0,
  targetKind: 'unit',
  targetTeamPolicy: 'ally',
  minimumRange: 1,
  maximumRange: 3,
  tags: ['Ally', 'Single target', 'Guarded'],
  effectDescriptions: ['Apply Guarded to the selected ally.'],
  requirementDescriptions: [],
}

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
  it('shows the authored Discipline skill context before a target without inventing an outcome', () => {
    const markup = renderToStaticMarkup(
      <BattleActionPreview preview={null} pending={false} skill={barrier} />,
    )
    for (const label of ['40 AP', 'Ally', '1–3 tiles', 'Guarded', 'Skill details'])
      expect(markup).toContain(label)
    expect(markup).not.toContain('Success 100%')
    expect(markup).not.toContain('Forecast details')
  })
  it('never presents the previous skill projection after switching Discipline choices', () => {
    const markup = renderToStaticMarkup(
      <BattleActionPreview preview={attack} pending={false} skill={barrier} />,
    )
    expect(markup).toContain('40 AP')
    expect(markup).not.toContain('Hit 69%')
    expect(markup).not.toContain('17 dmg')
  })
  it('shows authoritative Discipline effects once the selected target has a forecast', () => {
    const markup = renderToStaticMarkup(
      <BattleActionPreview
        preview={{
          ...attack,
          actionId: barrier.id,
          actionEconomyCost: 40,
          actionEconomyAfter: 60,
          hitChanceBasisPoints: null,
          mitigatedBaseDamage: null,
          projectedEffects: [
            { effectType: 'apply-status', combatantId: 'ally', before: '', after: 'guarded' },
          ],
        }}
        pending={false}
        skill={barrier}
      />,
    )
    expect(markup).toContain('Guard')
    expect(markup).not.toContain('Guarded')
    expect(markup).toContain('Success 100%')
    expect(markup).toContain('Forecast details')
    expect(markup).not.toContain('Skill details')
  })
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

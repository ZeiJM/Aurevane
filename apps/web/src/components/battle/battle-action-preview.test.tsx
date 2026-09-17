import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { BattleActionPreview as ActionPreview } from '@/server/battle/battle-preview-service'
import { BattleActionPreview } from './battle-action-preview'
import { previewChips } from './battle-preview-content'
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

  it(
    'renders authoritative copied ordinary, Poison, Burn and Bleed status forecasts without machine encodings',
    () => {
      const cases: Array<{
        effect: ActionPreview['projectedEffects'][number]
        label: string
        machineText: string
      }> = [
        {
          effect: {
            effectType: 'copy-statuses',
            combatantId: 'you',
            before: 'none',
            after: 'status.guard:1:3',
          },
          label: 'Copied Guard · 1 stack · 3 turns',
          machineText: 'status.guard:1:3',
        },
        {
          effect: {
            effectType: 'copy-statuses',
            combatantId: 'enemy',
            before: 'none',
            after: 'poison:3',
          },
          label: 'Copied Poison (Poisoned) · movement progress 3',
          machineText: 'poison:3',
        },
        {
          effect: {
            effectType: 'copy-statuses',
            combatantId: 'enemy',
            before: 'burn:2',
            after: 'burn:0',
          },
          label: 'Copied Burn (Scorched) · stage 2→0',
          machineText: 'burn:2',
        },
        {
          effect: {
            effectType: 'copy-statuses',
            combatantId: 'enemy',
            before: 'bleed:1:1',
            after: 'bleed:3:2',
          },
          label: 'Copied Bleed (Bleeding) · 1 dmg × 1 tick → 3 dmg × 2 ticks',
          machineText: 'bleed:1:1',
        },
      ]

      for (const { effect, label, machineText } of cases) {
        const markup = renderToStaticMarkup(
          <BattleActionPreview
            preview={{
              ...attack,
              actionId: 'test.copy-statuses',
              hitChanceBasisPoints: null,
              defenseKind: null,
              defenseRating: null,
              mitigatedBaseDamage: null,
              projectedEffects: [effect],
            }}
            pending={false}
          />,
        )
        expect(markup).toContain(label)
        expect(markup).not.toContain(machineText)
      }
    },
  )

  it(
    'keeps the compact forecast bounded while preserving every mixed projection for Forecast details',
    () => {
      const mixedPreview: ActionPreview = {
        ...attack,
        actionId: 'test.copy-statuses.mixed',
        hitChanceBasisPoints: null,
        defenseKind: null,
        defenseRating: null,
        mitigatedBaseDamage: null,
        projectedEffects: [
          {
            effectType: 'copy-statuses',
            combatantId: 'you',
            before: 'none',
            after: 'status.inspired:1:2',
          },
          { effectType: 'damage', combatantId: 'enemy', before: 40, after: 33 },
          { effectType: 'healing', combatantId: 'you', before: 20, after: 25 },
          { effectType: 'resource-change', combatantId: 'you', before: 4, after: 6 },
        ],
      }
      const markup = renderToStaticMarkup(
        <BattleActionPreview preview={mixedPreview} pending={false} />,
      )

      for (const label of ['Copied Inspire · 1 stack · 2 turns', '7 dmg', 'Heal +5']) {
        expect(markup).toContain(label)
      }
      expect(markup).toContain('aria-label="Forecast details"')
      expect(markup).not.toContain('status.inspired:1:2')

      const detailLabels = previewChips(mixedPreview).map((chip) => chip.label)
      for (const label of [
        'Copied Inspire · 1 stack · 2 turns',
        '7 dmg',
        'Heal +5',
        'Resource +2',
      ]) {
        expect(detailLabels).toContain(label)
      }
    },
  )

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

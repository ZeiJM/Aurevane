import { describe, expect, it } from 'vitest'
import type { BattleActionPreview } from '@/server/battle/battle-preview-service'
import { previewChips } from './battle-preview-content'

function actionPreview(
  projectedEffects: BattleActionPreview['projectedEffects'] = [],
  overrides: Partial<BattleActionPreview> = {},
): BattleActionPreview {
  return {
    kind: 'action',
    legal: true,
    actionId: 'test.skill',
    actorId: 'actor',
    primaryCombatantId: 'target',
    affectedTiles: [],
    affectedCombatantIds: ['target'],
    projectedEffects,
    projectedStatuses: [],
    projectedEvents: [],
    mpCost: 0,
    actionEconomyCost: 30,
    actionEconomyBefore: 100,
    actionEconomyAfter: 70,
    hitChanceBasisPoints: null,
    defenseKind: null,
    defenseRating: null,
    mitigatedBaseDamage: null,
    issues: [],
    spendsAction: true,
    ...overrides,
  }
}

function labels(preview: BattleActionPreview): string[] {
  return previewChips(preview).map((chip) => chip.label)
}

describe('copy-statuses player forecast presentation', () => {
  it('humanizes an ordinary copied status from an empty receiver', () => {
    const result = labels(
      actionPreview([
        {
          effectType: 'copy-statuses',
          combatantId: 'actor',
          before: 'none',
          after: 'status.guard:1:3',
        },
      ]),
    )

    expect(result).toContain('Copied Guard · 1 stack · 3 turns')
    expect(result.join(' ')).not.toContain('status.guard:1:3')
  })

  it('uses the authoritative before and after values when an ordinary status merges', () => {
    const result = labels(
      actionPreview([
        {
          effectType: 'copy-statuses',
          combatantId: 'actor',
          before: 'status.guard:1:2',
          after: 'status.guard:2:3',
        },
      ]),
    )

    expect(result).toContain('Copied Guard · 1→2 stacks · 2→3 turns')
  })

  it('humanizes copied Poison movement progress without leaking the machine encoding', () => {
    const result = labels(
      actionPreview([
        {
          effectType: 'copy-statuses',
          combatantId: 'target',
          before: 'none',
          after: 'poison:3',
        },
      ]),
    )

    expect(result).toContain('Copied Poison (Poisoned) · movement progress 3')
    expect(result.join(' ')).not.toContain('poison:3')
  })

  it('humanizes copied Burn stage and reflects server-projected replacement', () => {
    const newBurn = labels(
      actionPreview([
        {
          effectType: 'copy-statuses',
          combatantId: 'target',
          before: 'none',
          after: 'burn:2',
        },
      ]),
    )
    const replacedBurn = labels(
      actionPreview([
        {
          effectType: 'copy-statuses',
          combatantId: 'target',
          before: 'burn:2',
          after: 'burn:0',
        },
      ]),
    )

    expect(newBurn).toContain('Copied Burn (Scorched) · stage 2')
    expect(replacedBurn).toContain('Copied Burn (Scorched) · stage 2→0')
  })

  it('preserves authoritative Bleed projection order and exposes damage and remaining ticks', () => {
    const result = labels(
      actionPreview([
        {
          effectType: 'copy-statuses',
          combatantId: 'target',
          before: 'none',
          after: 'bleed:2:4',
        },
        {
          effectType: 'copy-statuses',
          combatantId: 'target',
          before: 'bleed:1:1',
          after: 'bleed:3:2',
        },
      ]),
    ).filter((label) => label.startsWith('Copied Bleed'))

    expect(result).toEqual([
      'Copied Bleed (Bleeding) · 2 dmg × 4 ticks',
      'Copied Bleed (Bleeding) · 1 dmg × 1 tick → 3 dmg × 2 ticks',
    ])
  })

  it('keeps clone and later damage forecasts visible together', () => {
    const result = labels(
      actionPreview([
        {
          effectType: 'copy-statuses',
          combatantId: 'target',
          before: 'none',
          after: 'status.hexed:1:2',
        },
        { effectType: 'damage', combatantId: 'target', before: 40, after: 33 },
      ]),
    )

    expect(result).toContain('Copied Hexed · 1 stack · 2 turns')
    expect(result).toContain('7 dmg')
  })

  it('keeps clone, healing and resource forecasts visible together', () => {
    const result = labels(
      actionPreview([
        {
          effectType: 'copy-statuses',
          combatantId: 'actor',
          before: 'none',
          after: 'status.inspired:1:2',
        },
        { effectType: 'healing', combatantId: 'actor', before: 20, after: 25 },
        { effectType: 'resource-change', combatantId: 'actor', before: 4, after: 6 },
      ]),
    )

    expect(result).toContain('Copied Inspire · 1 stack · 2 turns')
    expect(result).toContain('Heal +5')
    expect(result).toContain('Resource +2')
  })

  it('shows no fake clone forecast when an allowed empty clone block produced no projection', () => {
    const result = labels(
      actionPreview([{ effectType: 'damage', combatantId: 'target', before: 40, after: 34 }]),
    )

    expect(result.some((label) => label.startsWith('Copied '))).toBe(false)
    expect(result).toContain('6 dmg')
  })

  it('keeps blocked preview authority intact even if clone projections are supplied', () => {
    const result = labels(
      actionPreview(
        [
          {
            effectType: 'copy-statuses',
            combatantId: 'target',
            before: 'none',
            after: 'status.hexed:1:2',
          },
        ],
        { legal: false, issues: [{ code: 'blocked', message: 'Blocked.' }] },
      ),
    )

    expect(result).toEqual(['Blocked'])
  })

  it('keeps existing hit chance presentation without exposing random draws', () => {
    const result = labels(
      actionPreview(
        [
          {
            effectType: 'copy-statuses',
            combatantId: 'target',
            before: 'none',
            after: 'status.hexed:1:2',
          },
        ],
        { hitChanceBasisPoints: 6500 },
      ),
    )

    expect(result).toContain('Hit 65%')
    expect(result.join(' ')).not.toMatch(/roll|rng|random/i)
  })

  it('does not mutate the authoritative preview object while formatting clones', () => {
    const preview = actionPreview([
      {
        effectType: 'copy-statuses',
        combatantId: 'target',
        before: 'status.guard:1:2',
        after: 'status.guard:2:3',
      },
    ])
    const before = JSON.stringify(preview)

    previewChips(preview)

    expect(JSON.stringify(preview)).toBe(before)
  })

  it('fails closed on malformed clone projection strings instead of displaying machine text', () => {
    const result = labels(
      actionPreview([
        {
          effectType: 'copy-statuses',
          combatantId: 'target',
          before: 'none',
          after: 'bleed:not-a-number:4',
        },
      ]),
    )

    expect(result.some((label) => label.startsWith('Copied '))).toBe(false)
    expect(result.join(' ')).not.toContain('bleed:not-a-number:4')
  })

  it('leaves non-clone action preview chips unchanged', () => {
    const result = labels(
      actionPreview(
        [{ effectType: 'damage', combatantId: 'target', before: 100, after: 83 }],
        {
          actionEconomyCost: 30,
          actionEconomyAfter: 70,
          hitChanceBasisPoints: 6900,
          defenseKind: 'armor',
          defenseRating: 5,
          mitigatedBaseDamage: 17,
        },
      ),
    )

    expect(result).toEqual(['30 AP', '70 AP left', 'Hit 69%', 'On hit 17 dmg'])
  })
})

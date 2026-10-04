import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import type { BattleActionPreview as ActionPreview } from '@/server/battle/battle-preview-service'
import { BattleActionPreview } from './battle-action-preview'
import { previewChips } from './battle-preview-content'
import type { BattleSkillForecastPresentation } from './battle-runtime'
import { resolveMatureSkillVersion } from '@aurevane/game-core/combat/mature-skills'

vi.mock('./battle-info-popover', () => ({
  BattleInfoPopover: ({ trigger, children }: { trigger: ReactNode; children: ReactNode }) => (
    <>
      <button type="button">{trigger}</button>
      <aside>{children}</aside>
    </>
  ),
}))

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
  it('keeps automatic success inline for the primary target without inventing secondary chances', () => {
    const markup = renderToStaticMarkup(
      <BattleActionPreview
        preview={{
          ...attack,
          actionId: 'guard',
          primaryCombatantId: 'you',
          affectedCombatantIds: ['you', 'ally'],
          hitChanceBasisPoints: null,
          mitigatedBaseDamage: null,
          projectedEffects: [
            { effectType: 'apply-status', combatantId: 'you', before: '', after: 'guarded' },
            { effectType: 'apply-status', combatantId: 'ally', before: '', after: 'guarded' },
          ],
        }}
        pending={false}
      />,
    )
    const primary = markup.match(
      /<article[^>]*data-battle-range-forecast="you"[^>]*>(.*?)<\/article>/,
    )?.[1]
    const secondary = markup.match(
      /<article[^>]*data-battle-range-forecast="ally"[^>]*>(.*?)<\/article>/,
    )?.[1]
    expect(primary).toBeDefined()
    expect(primary).toContain('Success 100%')
    expect(secondary).toBeDefined()
    expect(secondary).not.toContain('Success')
    expect(secondary).not.toContain('Hit')
  })

  it.each(['unit', 'ground'])(
    'keeps the selected %s area scope and each actual outcome instead of substituting candidate casts',
    (targetKind) => {
      const area: ActionPreview = {
        ...attack,
        affectedCombatantIds: ['enemy', 'secondary-outside-primary-range'],
        affectedTiles: [
          { x: 1, y: 0 },
          { x: 2, y: 0 },
        ],
        projectedEffects: [
          { effectType: 'damage', combatantId: 'enemy', before: 100, after: 83 },
          {
            effectType: 'damage',
            combatantId: 'secondary-outside-primary-range',
            before: 70,
            after: 63,
          },
        ],
      }
      const markup = renderToStaticMarkup(
        <BattleActionPreview
          preview={area}
          pending={false}
          rangePreviewActionId={attack.actionId}
          rangePreviews={[
            {
              ...attack,
              projectedEffects: [
                { effectType: 'damage', combatantId: 'enemy', before: 100, after: 89 },
              ],
            },
            {
              ...attack,
              primaryCombatantId: 'unrelated-primary',
              affectedCombatantIds: ['unrelated-primary'],
              projectedEffects: [
                { effectType: 'damage', combatantId: 'unrelated-primary', before: 80, after: 71 },
              ],
            },
          ]}
          targetTile={
            targetKind === 'ground'
              ? { position: { x: 1, y: 0 }, terrainId: 'open', elevation: 0 }
              : undefined
          }
        />,
      )
      expect(markup).toContain('data-battle-range-forecast="enemy"')
      expect(markup).toContain('data-battle-range-forecast="secondary-outside-primary-range"')
      expect(markup).toContain('Hit 69% · On hit 17 dmg')
      expect(markup).toContain('>7 dmg</span>')
      expect(markup).toContain('Damage 7')
      expect(markup).not.toContain('data-battle-range-forecast="unrelated-primary"')
      expect(markup).toContain('data-battle-range-forecast-details="unrelated-primary"')
      expect(markup).not.toContain('data-battle-range-forecast-details="enemy"')
      expect(markup).not.toContain('On hit 11 dmg')
      const alternative = markup.slice(
        markup.indexOf('data-battle-range-forecast-details="unrelated-primary"'),
      )
      expect(alternative).toContain('data-battle-target-forecast="unrelated-primary"')
      expect(alternative).toContain('Damage 9')
      expect(alternative).not.toContain('secondary-outside-primary-range')
      expect(alternative).not.toContain('Damage 7')
    },
  )

  it('keeps a complete independent reader for the second automatic candidate and its own area recipients', () => {
    const markup = renderToStaticMarkup(
      <BattleActionPreview
        preview={null}
        pending={false}
        rangePreviewActionId={attack.actionId}
        rangePreviews={[
          attack,
          {
            ...attack,
            primaryCombatantId: 'second',
            affectedCombatantIds: ['second', 'second-area-only'],
            hitChanceBasisPoints: 4200,
            defenseKind: 'ward',
            defenseRating: 13,
            projectedEffects: [
              { effectType: 'damage', combatantId: 'second', before: 80, after: 71 },
              { effectType: 'healing', combatantId: 'second-area-only', before: 20, after: 25 },
            ],
            projectedTerrain: [
              {
                position: { x: 1, y: 2 },
                before: null,
                after: 'frozen',
                remainingRoundBoundaries: 2,
                activationRound: 3,
              },
            ],
          },
        ]}
      />,
    )
    const alternative = markup.slice(markup.indexOf('data-battle-range-forecast-details="second"'))
    expect(alternative).toContain('Hit 42%')
    expect(alternative).not.toContain('Hit 69%')
    expect(alternative).toContain('data-battle-target-forecast="second-area-only"')
    expect(alternative).toContain('Heal +5')
    expect(alternative).toContain('Ward 13')
    expect(alternative).toContain('Starts round 3')
    expect(alternative).toContain('Frozen at tile 2,3')
  })

  it('automatically shows every legal range forecast with its independent hit chance before selecting', () => {
    const markup = renderToStaticMarkup(
      <BattleActionPreview
        preview={null}
        pending={false}
        rangePreviewActionId={attack.actionId}
        rangePreviews={[
          attack,
          {
            ...attack,
            primaryCombatantId: 'second',
            affectedCombatantIds: ['second'],
            hitChanceBasisPoints: 4200,
            projectedEffects: [
              { effectType: 'damage', combatantId: 'second', before: 80, after: 71 },
            ],
          },
          { ...attack, legal: false, primaryCombatantId: 'blocked' },
        ]}
      />,
    )
    expect(markup).toContain('data-battle-preview-has-targets="true"')
    expect(markup).toContain('data-battle-range-forecast="enemy"')
    expect(markup).toContain('data-battle-range-forecast="second"')
    expect(markup).toContain('Hit 69% · On hit 17 dmg')
    expect(markup).toContain('Hit 42% · On hit 9 dmg')
    expect(markup).not.toContain('data-battle-range-forecast="blocked"')
    expect(markup).not.toContain('Success 100%')
  })

  it('hides previous automatic projections when their action changes or their range request is pending', () => {
    for (const props of [
      { rangePreviewActionId: barrier.id, rangePreviews: [attack] },
      { rangePreviewActionId: attack.actionId, rangePreviews: [], rangePreviewsPending: true },
    ]) {
      const markup = renderToStaticMarkup(
        <BattleActionPreview preview={null} pending={false} {...props} />,
      )
      expect(markup).not.toContain('Hit 69%')
      expect(markup).not.toContain('17 dmg')
      expect(markup).not.toContain('data-battle-range-forecast="enemy"')
    }
  })

  it('shows delayed terrain details from the canonical projection without a committed event', () => {
    const markup = renderToStaticMarkup(
      <BattleActionPreview
        preview={{
          ...attack,
          affectedCombatantIds: [],
          projectedEffects: [],
          projectedEvents: [],
          projectedTerrain: [
            {
              position: { x: 1, y: 2 },
              before: null,
              after: 'frozen',
              remainingRoundBoundaries: 2,
              activationRound: 3,
            },
          ],
        }}
        pending={false}
      />,
    )
    expect(markup).toContain('Starts round 3')
    expect(markup).toContain('Frozen at tile 2,3')
    expect(markup).toContain('2 round boundaries')
    expect(markup).toContain('either team')
  })

  it('names pending unit effects and their lifetime without presenting them as active', () => {
    const markup = renderToStaticMarkup(
      <BattleActionPreview
        preview={{
          ...attack,
          mitigatedBaseDamage: null,
          projectedEffects: [
            {
              effectType: 'apply-status',
              combatantId: 'enemy',
              before: '',
              after: 'pending',
              statusId: 'guarded',
              activationRound: 3,
              remainingOwnerTurnEnds: 1,
            },
            {
              effectType: 'summon',
              combatantId: 'you',
              before: '',
              after: 'pending',
              statusId: 'summon',
              activationRound: 3,
              remainingOwnerTurnEnds: 5,
            },
          ],
        }}
        pending={false}
      />,
    )
    expect(markup).toContain('Guard · Starts round 3 · 1 turn')
    expect(markup).toContain('Summon · Starts round 3 · 5 turns')
    expect(markup).not.toContain('>Pending</span>')
    expect(markup).not.toContain('Damage 17')
  })

  it('keeps all Nexus parameters beside the current server forecast without replacing its costs or outcomes', () => {
    const definition = resolveMatureSkillVersion('vanguard.forceful-strike', 2)!
    const skill = { ...barrier, definition, id: definition.id, apCost: 31, mpCost: 6 }
    const markup = renderToStaticMarkup(
      <BattleActionPreview
        preview={{ ...attack, actionId: skill.id }}
        skill={skill}
        pending={false}
      />,
    )
    expect(markup).toContain('<dt>Cost</dt><dd>31 AP / 6 MP</dd>')
    expect(markup).toContain('<dt>Skill Type</dt><dd>Attack</dd>')
    expect(markup).toContain('<dt>Line of Sight</dt><dd>Not required</dd>')
    for (const label of ['30 AP', '70 AP left', 'Hit 69%', 'On hit 17 dmg', 'Damage 17'])
      expect(markup).toContain(label)
    expect(markup).toContain('data-battle-preview-lane="parameters"')
    expect(markup).toContain('data-battle-preview-lane="outcomes"')
  })

  it('gives targets without portraits a framed identity and shows the selected ground terrain', () => {
    const markup = renderToStaticMarkup(
      <BattleActionPreview
        preview={attack}
        pending={false}
        targetTile={{ position: { x: 2, y: 3 }, terrainId: 'open', elevation: 1 }}
        targetOverlay="frozen"
      />,
    )
    expect(markup).toContain('data-battle-target-portrait-fallback="true"')
    expect(markup).toContain('data-battle-ground-target="true"')
    expect(markup).toContain('terrain-raised-ledge-v02.webp')
    expect(markup).toContain('Tile 3, 4')
    expect(markup).toContain('Elevated ground')
    expect(markup).toContain('Frozen')
    expect(markup).toContain('Damage 17')
  })
  it('shows the authored Discipline skill context before a target without inventing an outcome', () => {
    const markup = renderToStaticMarkup(
      <BattleActionPreview preview={null} pending={false} skill={barrier} />,
    )
    for (const label of ['Cost: 40 AP', '<dt>Target</dt><dd>Ally</dd>', 'Range: 3'])
      expect(markup).toContain(label)
    expect(markup).not.toContain('Legal range')
    expect(markup).not.toContain('Success 100%')
    expect(markup).not.toContain('Show forecast details')
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
    // The full Parameters panel preserves the authored effect; the outcome lane
    // must only display current server-projected status names.
    const outcomes = markup.slice(markup.indexOf('data-battle-preview-lane="outcomes"'))
    expect(outcomes).not.toContain('Guarded')
    expect(markup).toContain('<dt>Effects</dt><dd>Apply Guarded to the selected ally.</dd>')
    expect(markup).toContain('Success 100%')
    expect(markup).not.toContain('data-battle-info-trigger')
    expect(markup).not.toContain('Skill details')
  })

  it('renders server-projected accuracy, on-hit damage and AP together', () => {
    const markup = renderToStaticMarkup(<BattleActionPreview preview={attack} pending={false} />)
    for (const label of ['Hit 69%', 'On hit 17 dmg', '30 AP', '70 AP left'])
      expect(markup).toContain(label)
    expect(markup).not.toContain('data-battle-info-trigger')
  })

  it('renders authoritative copied ordinary, Poison, Burn and Bleed status forecasts without machine encodings', () => {
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
  })

  it('keeps the compact forecast bounded while preserving every mixed projection in its reading panel', () => {
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
    expect(markup).not.toContain('data-battle-info-trigger')
    expect(markup).not.toContain('status.inspired:1:2')

    const detailLabels = previewChips(mixedPreview).map((chip) => chip.label)
    for (const label of ['Copied Inspire · 1 stack · 2 turns', '7 dmg', 'Heal +5', 'Resource +2']) {
      expect(detailLabels).toContain(label)
    }
  })

  it('replaces a previous projection while a new target is pending', () => {
    const markup = renderToStaticMarkup(<BattleActionPreview preview={attack} pending />)
    expect(markup).toContain('Calculating preview')
    expect(markup).not.toContain('Hit 69%')
    expect(markup).not.toContain('17 dmg')
  })

  it('shows every affected target with its own projected outcome for an area cast', () => {
    const markup = renderToStaticMarkup(
      <BattleActionPreview
        pending={false}
        preview={{
          ...attack,
          affectedCombatantIds: ['enemy', 'second', 'you'],
          projectedEffects: [
            { effectType: 'damage', combatantId: 'enemy', before: 100, after: 83 },
            { effectType: 'damage', combatantId: 'second', before: 80, after: 71 },
            { effectType: 'healing', combatantId: 'you', before: 20, after: 25 },
          ],
        }}
      />,
    )
    for (const label of [
      'data-battle-target-forecast="enemy"',
      'data-battle-target-forecast="second"',
      'data-battle-target-forecast="you"',
      'Damage 17',
      'Damage 9',
      'Heal +5',
    ])
      expect(markup).toContain(label)
    expect(
      markup.split('data-battle-target-forecast="second"')[1]?.split('</article>')[0],
    ).not.toContain('Hit 69%')
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

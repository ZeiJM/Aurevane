import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { defaultBasicSkills } from '@aurevane/game-core/combat/combat-basic-actions'
import { abilityBehaviorInformation } from './ability-detail-presentation'
import { AbilityParameters } from './ability-parameters'
import { abilityManualInlineParts, plainManualInlineParts } from '@/content/manual-mechanic-text'

it('keeps explanatory limits below the table even when the effect has authored prose', () => {
  const base = defaultBasicSkills()[0]!.ability.behaviors[0]!
  const generated = abilityBehaviorInformation({
    ...base,
    effects: [
      {
        id: 'haste',
        payload: {
          type: 'apply-status',
          recipient: 'actor',
          statusId: 'haste',
          stacks: 1,
          durationTurns: 2,
        },
      },
    ],
  })
  const report = { ...generated, effectDescriptions: ['Movement costs less AP per tile.'] }
  const before = JSON.stringify(report)
  const html = renderToStaticMarkup(<AbilityParameters report={report} />)
  const table = html.slice(0, html.indexOf('</dl>'))
  expect(table).not.toContain('Minimum movement cost')
  expect(table).not.toContain('data-compact-effect-detail')
  expect(html.slice(html.indexOf('</dl>'))).toContain('Minimum movement cost: 10 AP')
  expect(Object.fromEntries(report.rows).Effects).not.toContain('Minimum movement cost')
  const manual = plainManualInlineParts(abilityManualInlineParts(report, 'Haste'))!
  expect(manual.indexOf('Minimum movement cost: 10 AP')).toBeGreaterThan(
    manual.indexOf('Line of Sight:'),
  )
  expect(JSON.stringify(report)).toBe(before)
})

import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import type { UsageBalanceReport } from '@/master/usage-balance'
import { UsageBalanceReportView } from './usage-balance-panel'
const report: UsageBalanceReport = {
  contentKey: 'vanguard',
  subjectKind: 'discipline',
  asOf: '2026-10-27T12:00:00Z',
  weekStartsAt: '2026-10-26T00:00:00Z',
  weekEndsAt: '2026-11-02T00:00:00Z',
  current: {
    primaryPlayers: 2,
    secondaryPlayers: 1,
    primaryCharacters: 3,
    secondaryCharacters: 1,
    totalPlayers: 4,
    totalCharacters: 6,
  },
  skills: [
    {
      skillId: 'vanguard.strike',
      name: 'Vanguard Strike',
      equippedPlayers: 2,
      equippedCharacters: 3,
      actualUses: 0,
      usedBattles: 0,
    },
  ],
  pairs: [],
  matchups: [],
  weekly: [
    { source: 'pvp', appearances: 4, wins: 2, losses: 1, draws: 1 },
    { source: 'pve-recruit', appearances: 0, wins: 0, losses: 0, draws: 0 },
  ],
  coverage: {
    legacyHistoryAvailable: false,
    rosterTruncated: false,
    battlesTruncated: false,
    collectedBattles: 2,
    collectionStartedAt: '2026-10-27T00:00:00Z',
  },
}
it('shows denominators and source-separated ratios; no-sample rates stay unavailable', () => {
  const html = renderToStaticMarkup(<UsageBalanceReportView report={report} />)
  expect(html).toContain('50% / 25% / 25%')
  expect(html).toContain('4 player appearances')
  expect(html).toContain('No completed sample')
  expect(html).toContain('Historical battles are unavailable')
  expect(html).toContain('Current players')
  expect(html).toContain('No recorded use this week')
  expect(html).not.toContain('100% / 0% / 0%')
})
it('does not turn missing collection into zero actual-use facts or underused claims', () => {
  const html = renderToStaticMarkup(
    <UsageBalanceReportView
      report={{
        ...report,
        coverage: { ...report.coverage, collectionStartedAt: null, collectedBattles: 0 },
        weekly: [],
      }}
    />,
  )
  expect(html).toContain('Awaiting eligible completed battles')
  expect(html).toContain('Actual-use data unavailable')
  expect(html).not.toContain('No recorded use this week')
})
it('shows skill equip/use without misleading Discipline-slot counts, and labels unsupported kinds honestly', () => {
  const skillHtml = renderToStaticMarkup(
    <UsageBalanceReportView
      report={{ ...report, contentKey: 'vanguard.strike', subjectKind: 'skill' }}
    />,
  )
  expect(skillHtml).not.toContain('Primary players')
  expect(skillHtml).not.toContain('Secondary players')
  expect(skillHtml).not.toContain('Common current pairs')
  expect(skillHtml).toContain('Equipped players')
  const unsupported = renderToStaticMarkup(
    <UsageBalanceReportView report={{ ...report, subjectKind: 'unsupported' }} />,
  )
  expect(unsupported).toContain('no supported usage receipts')
  expect(unsupported).not.toContain('0 wins')
})

it('accurately labels qualifying Skill receipts as manual or automatic use', () => {
  const html = renderToStaticMarkup(<UsageBalanceReportView report={report} />)
  expect(html).toContain('manual and automatic')
  expect(html).not.toContain('Automatic/passive triggers, Essence')
})

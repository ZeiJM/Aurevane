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
  expect(html).toContain('No recorded use selected week')
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
  expect(html).not.toContain('No recorded use selected week')
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

it('charts adoption against distinct current players and keeps Skill units on separate scales', () => {
  const html = renderToStaticMarkup(
    <UsageBalanceReportView
      report={{
        ...report,
        skills: [
          { ...report.skills[0]!, equippedPlayers: 2, actualUses: 10 },
          {
            ...report.skills[0]!,
            skillId: 'vanguard.guard',
            name: 'Guard',
            equippedPlayers: 4,
            actualUses: 20,
          },
        ],
      }}
    />,
  )
  expect(html).toContain('data-chart="adoption"')
  expect(html).toMatch(/aria-label="Primary players"[^>]*value="2"[^>]*min="0"[^>]*max="4"/)
  expect(html).toContain('Equipped players · current')
  expect(html).toContain('Uses · completed battles selected week')
  expect(html).toContain('data-chart="skills"')
  expect(html).toContain('<summary>Exact Skill counts</summary>')
})
it('shows source-specific outcome charts with draws in the denominator and no empty chart', () => {
  const html = renderToStaticMarkup(<UsageBalanceReportView report={report} />)
  expect(html.match(/data-chart="outcomes"/g)).toHaveLength(1)
  expect(html).toContain('width:50%')
  expect(html).toContain('width:25%')
  expect(html).toContain('<summary>How these numbers are counted</summary>')
  const empty = renderToStaticMarkup(
    <UsageBalanceReportView
      report={{
        ...report,
        current: { ...report.current, totalPlayers: 0, primaryPlayers: 0, secondaryPlayers: 0 },
        weekly: [],
      }}
    />,
  )
  expect(empty).not.toContain('<meter')
  expect(empty).toContain('No current player sample')
})
it('charts pair counts and matchup outcomes while retaining exact sample counts', () => {
  const html = renderToStaticMarkup(
    <UsageBalanceReportView
      report={{
        ...report,
        pairs: [{ primary: 'vanguard', secondary: 'ironfist', players: 2, characters: 3 }],
        matchups: [
          { source: 'pvp', opponent: 'ironfist', appearances: 4, wins: 1, losses: 2, draws: 1 },
        ],
      }}
    />,
  )
  expect(html).toContain('data-chart="pairs"')
  expect(html).toContain('2 players · 3 characters')
  expect(html.match(/data-chart="outcomes"/g)).toHaveLength(2)
  expect(html).toContain('4 opposing-player pairings')
})

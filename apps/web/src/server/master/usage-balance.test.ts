import { expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
import { createUsageBalanceService, parseUsageBalanceReport } from './usage-balance'
const report = {
  contentKey: 'vanguard',
  subjectKind: 'discipline',
  asOf: '2026-10-27T12:00:00Z',
  weekStartsAt: '2026-10-26T00:00:00Z',
  weekEndsAt: '2026-11-02T00:00:00Z',
  current: {
    primaryPlayers: 1,
    secondaryPlayers: 0,
    primaryCharacters: 1,
    secondaryCharacters: 0,
    totalPlayers: 1,
    totalCharacters: 1,
  },
  skills: [],
  pairs: [],
  matchups: [],
  weekly: [],
  coverage: {
    legacyHistoryAvailable: false,
    rosterTruncated: false,
    battlesTruncated: false,
    collectedBattles: 0,
    collectionStartedAt: null,
  },
}
it('checks live content-page permission before any data lookup', async () => {
  const requireCapability = vi.fn().mockRejectedValue(new Error('revoked'))
  const rpc = vi.fn()
  await expect(
    createUsageBalanceService({ requireCapability }, rpc).read('actor', 'vanguard'),
  ).rejects.toThrow('revoked')
  expect(rpc).not.toHaveBeenCalled()
})
it('rejects invalid keys and mismatched/malformed backend reports; returns only aggregate fields', async () => {
  const requireCapability = vi.fn().mockResolvedValue({})
  const rpc = vi.fn().mockResolvedValue(report)
  const service = createUsageBalanceService({ requireCapability }, rpc)
  expect(await service.read('actor', 'vanguard')).toEqual(report)
  expect(requireCapability).toHaveBeenCalledWith('actor', 'content.combat.author')
  await expect(service.read('actor', '../private')).rejects.toMatchObject({
    code: 'INVALID_REQUEST',
  })
  expect(() =>
    parseUsageBalanceReport(
      { ...report, current: { ...report.current, primaryPlayers: -1 } },
      'vanguard',
    ),
  ).toThrow()
  expect(() => parseUsageBalanceReport({ ...report, contentKey: 'other' }, 'vanguard')).toThrow()
  expect(
    parseUsageBalanceReport({ ...report, secretIdentity: 'hidden' }, 'vanguard'),
  ).not.toHaveProperty('secretIdentity')
})

it('forwards a valid week only through the authorized bounded reporting RPC', async () => {
  const rpc = vi.fn().mockResolvedValue({ ...report, availableWeeks: ['2026-10-26'] })
  const service = createUsageBalanceService(
    { requireCapability: vi.fn().mockResolvedValue({}) },
    rpc,
  )
  expect((await service.read('actor', 'vanguard', '2026-10-26')).availableWeeks).toEqual([
    '2026-10-26',
  ])
  expect(rpc).toHaveBeenCalledWith('read_master_usage_balance_week_v1', {
    p_actor_user_id: 'actor',
    p_content_key: 'vanguard',
    p_week_start: '2026-10-26',
  })
  for (const week of ['2026-10-27', 'bad', '2026-02-30'])
    await expect(service.read('actor', 'vanguard', week)).rejects.toMatchObject({
      code: 'INVALID_REQUEST',
    })
  expect(rpc).toHaveBeenCalledTimes(1)
})

it('projects current custom and renamed Discipline labels only after report authorization', async () => {
  const custom = 'discipline.f60c5dc7-abf2-4e03-8b10-428dee7fc4c2'
  const reportWithPairs = {
    ...report,
    pairs: [{ primary: custom, secondary: 'ironfist', players: 1, characters: 1 }],
    matchups: [{ source: 'pvp', opponent: custom, appearances: 1, wins: 1, losses: 0, draws: 0 }],
  }
  const names = vi.fn().mockResolvedValue({
    [custom]: 'Super Saiyan',
    ironfist: 'Iron Hand',
    privateDiscipline: 'Must not leak',
  })
  const service = createUsageBalanceService(
    { requireCapability: vi.fn().mockResolvedValue({}) },
    vi.fn().mockResolvedValue(reportWithPairs),
    names,
  )
  const result = await service.read('actor', 'vanguard')
  expect(result.disciplineNames).toEqual({ [custom]: 'Super Saiyan', ironfist: 'Iron Hand' })
  expect(names).toHaveBeenCalledWith([custom, 'ironfist'])
  expect(result.pairs).toEqual(reportWithPairs.pairs)
  expect(result.matchups).toEqual(reportWithPairs.matchups)
})
it('does not load Discipline names for revoked access or empty report references', async () => {
  const names = vi.fn()
  const denied = createUsageBalanceService(
    { requireCapability: vi.fn().mockRejectedValue(new Error('revoked')) },
    vi.fn(),
    names,
  )
  await expect(denied.read('actor', 'vanguard')).rejects.toThrow('revoked')
  await createUsageBalanceService(
    { requireCapability: vi.fn().mockResolvedValue({}) },
    vi.fn().mockResolvedValue(report),
    names,
  ).read('actor', 'vanguard')
  expect(names).not.toHaveBeenCalled()
})

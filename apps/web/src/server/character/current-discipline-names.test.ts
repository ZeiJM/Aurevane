import { beforeEach, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ rpc: vi.fn() }))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/admin', () => ({ createSupabaseAdminClient: () => ({ rpc: mocks.rpc }) }))
import { loadCurrentDisciplineNames } from './current-discipline-names'
beforeEach(() => vi.clearAllMocks())
it('projects only requested current names from the scalar catalogue without leaking authored content', async () => {
  mocks.rpc.mockResolvedValue({
    data: [
      {
        discipline_id: 'discipline.custom',
        name: 'Super Saiyan',
        authored_definition: { secret: 'private' },
        grants: ['private'],
      },
      { discipline_id: 'ironfist', name: 'Iron Hand' },
      { discipline_id: 'not-requested', name: 'Secret' },
    ],
    error: null,
  })
  expect(await loadCurrentDisciplineNames(['discipline.custom', 'ironfist'])).toEqual({
    'discipline.custom': 'Super Saiyan',
    ironfist: 'Iron Hand',
  })
  expect(mocks.rpc).toHaveBeenCalledWith('get_current_discipline_catalog_v1')
})
it('degrades only missing names on an unavailable catalogue and skips empty requests', async () => {
  expect(await loadCurrentDisciplineNames([])).toEqual({})
  expect(mocks.rpc).not.toHaveBeenCalled()
  mocks.rpc.mockRejectedValueOnce(new Error('offline'))
  expect(await loadCurrentDisciplineNames(['discipline.custom'])).toEqual({})
  mocks.rpc.mockResolvedValueOnce({ data: null, error: { code: 'offline' } })
  expect(await loadCurrentDisciplineNames(['discipline.custom'])).toEqual({})
})

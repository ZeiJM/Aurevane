import { latestEnabledMatureSkills } from '@aurevane/game-core/combat/mature-skills'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
}))

vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/admin', () => ({
  createSupabaseAdminClient: () => ({ rpc: mocks.rpc }),
}))

import { preparePv2BuildcraftTestKit } from './pv2-buildcraft-test-kit'

describe('PV-2 buildcraft test kit', () => {
  const previousMode = process.env.AUREVANE_PV2_TEST_MODE

  beforeEach(() => {
    process.env.AUREVANE_PV2_TEST_MODE = '1'
    mocks.rpc.mockReset()
  })

  afterEach(() => {
    if (previousMode === undefined) delete process.env.AUREVANE_PV2_TEST_MODE
    else process.env.AUREVANE_PV2_TEST_MODE = previousMode
  })

  it('preserves an existing historical learned Skill version while adding missing catalog Skills', async () => {
    mocks.rpc.mockImplementation(async (name: string) => {
      if (name === 'get_character_active_build_v2') {
        return { data: [{ character_id: 'character-1' }], error: null }
      }
      if (name === 'get_character_learned_skills_v1') {
        return {
          data: [
            {
              skill_id: 'vanguard.forceful-strike',
              skill_content_version: 2,
              source_discipline_id: 'vanguard',
            },
          ],
          error: null,
        }
      }
      if (
        name === 'record_character_discipline_mastery_v1' ||
        name === 'record_character_skill_unlock_v1'
      ) {
        return { data: null, error: null }
      }
      throw new Error(`Unexpected RPC ${name}`)
    })

    const desiredSkills = latestEnabledMatureSkills().filter(
      (skill) =>
        skill.enabled &&
        (skill.sourceDisciplineId === 'vanguard' || skill.sourceDisciplineId === 'lifebinder'),
    )

    const result = await preparePv2BuildcraftTestKit('user-1', 'character-1')
    expect(result.learnedSkills).toBe(desiredSkills.length)

    const unlockCalls = mocks.rpc.mock.calls.filter(
      ([name]) => name === 'record_character_skill_unlock_v1',
    )
    expect(unlockCalls).toHaveLength(desiredSkills.length - 1)
    expect(
      unlockCalls.some(
        ([, args]) =>
          (args as { p_skill_id?: string }).p_skill_id === 'vanguard.forceful-strike',
      ),
    ).toBe(false)
    expect(
      unlockCalls.some(
        ([, args]) => (args as { p_skill_id?: string }).p_skill_id === 'lifebinder.mending-light',
      ),
    ).toBe(true)
  })
})

import { expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
import { createMasterPlayersService, parsePlayerCorrection } from './players-service'
const access = {
  requireCapability: vi.fn(async () => ({
    userId: 'owner',
    accessVersion: 1,
    roles: ['game-owner'] as const,
    specialCapabilities: [],
    effectiveCapabilities: ['staff.manage'] as const,
  })),
}
const facts = {
  level: 1,
  xp: 0,
  cycle: 1,
  attributes: { might: 12, finesse: 4, vitality: 7, agility: 4, intellect: 3, resolve: 6 },
  build: {
    buildVersion: 8,
    sourceHash: 'private',
    primary: { disciplineId: 'vanguard', definitionVersion: 1, profileVersion: 1 },
    secondary: null,
    disciplineSkills: [],
    supportActionId: 'basic.guard',
    extensions: { resonance: null, essence: null },
  },
}
const raw = () => ({
  characterId: 'target',
  name: 'Target',
  portraitRef: 'portrait',
  verifiedEmail: 'verified@example.test',
  fingerprint: 'f'.repeat(64),
  facts,
  world: null,
  training: null,
  battle: {
    battleSessionId: 'battle',
    version: 1,
    lifecycle: 'active',
    participants: [
      { characterId: 'target', name: 'Target' },
      { characterId: 'peer', name: 'Peer' },
    ],
    snapshot: {
      sourceHash: 'root-secret',
      tactical: {
        battle: {
          combatants: [
            {
              id: 'target',
              hp: 5,
              mp: 3,
              temporaryResources: [{ key: 'pv1f.action-economy', current: 2, maximum: 5 }],
            },
          ],
        },
      },
    },
    recentActions: [],
  },
  password: 'never',
  authToken: 'never',
})
it('neutral_reader_no_world_mutation projects real AP, resources, derived maxima and names all human participants without secrets', async () => {
  const rpc = vi.fn(async () => raw())
  const view = await createMasterPlayersService(access, rpc).read('owner', 'target')
  expect(rpc).toHaveBeenCalledExactlyOnceWith('read_master_player_v1', {
    p_actor_user_id: 'owner',
    p_character_id: 'target',
  })
  expect(access.requireCapability).toHaveBeenLastCalledWith('owner', 'staff.manage')
  expect(view.battle?.combatants[0]).toMatchObject({ hp: 5, mp: 3, ap: 2 })
  expect(view.battle?.participants.map((p) => p.name)).toEqual(['Target', 'Peer'])
  expect(view.calculated.maxHp).toBeGreaterThan(0)
  expect(JSON.stringify(view)).not.toMatch(/sourceHash|password|authToken|snapshot/)
})
it.each([undefined, -1, 1.5, '2', null])(
  'projects absent/malformed AP safely: %s',
  async (current) => {
    const value = raw()
    Object.assign(value.battle.snapshot.tactical.battle.combatants[0]!.temporaryResources[0]!, {
      current,
    })
    const view = await createMasterPlayersService(access, async () => value).read('owner', 'target')
    expect(view.battle?.combatants[0]?.ap).toBeNull()
  },
)
it.each([
  { kind: 'source', ...facts, role: 'owner' },
  { kind: 'support', supportActionId: 'basic.guard', userId: 'owner' },
  {
    kind: 'skills',
    skills: [{ skillId: 'x', contentVersion: 1, sourceDisciplineId: 'vanguard', role: 'owner' }],
  },
  { kind: 'source', xp: 0, attributes: { ...facts.attributes, might: 1.5 } },
])('rejects unknown identity/nested role/malformed correction fields', (command) => {
  expect(() => parsePlayerCorrection(command)).toThrow()
})
it('denies delegated support before any protected SQL call', async () => {
  const rpc = vi.fn()
  const service = createMasterPlayersService(
    {
      requireCapability: async () => {
        throw new Error('Owner required')
      },
    },
    rpc,
  )
  await expect(service.read('moderator', 'target')).rejects.toThrow('Owner required')
  expect(rpc).not.toHaveBeenCalled()
})
it('retries terminal recovery through durable SQL receipt even after neutral active-battle read is empty', async () => {
  const rpc = vi.fn(async (name: string) =>
    name === 'read_master_player_v1'
      ? { ...raw(), battle: null }
      : { outcome: 'NoContest', rewards: 'NoRewards', version: 2, replayed: true },
  )
  const result = await createMasterPlayersService(access, rpc).recover('owner', {
    characterId: 'target',
    battleSessionId: 'battle',
    expectedVersion: 1,
    participantIds: ['target', 'peer'],
    requestKey: 'request',
  })
  expect(result.replayed).toBe(true)
  expect(rpc).toHaveBeenLastCalledWith(
    'recover_master_player_battle_v1',
    expect.objectContaining({
      p_terminal_snapshot: null,
      p_participant_ids: ['target', 'peer'],
      p_confirmed: true,
    }),
  )
})

it('accepts explicit selected eligibility in a Skill correction but rejects caller-earned facts', () => {
  const skill = {
    skillId: 'lifebinder.mend',
    contentVersion: 5,
    sourceDisciplineId: 'lifebinder',
    eligibilityDisciplineId: 'vanguard',
  }
  expect(parsePlayerCorrection({ kind: 'skills', skills: [skill] })).toEqual({
    kind: 'skills',
    skills: [skill],
  })
  expect(() =>
    parsePlayerCorrection({ kind: 'skills', skills: [{ ...skill, earnedEligibility: true }] }),
  ).toThrow()
})

import { beforeEach, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
const { adminRpc } = vi.hoisted(() => ({ adminRpc: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({ createSupabaseAdminClient: () => ({ rpc: adminRpc }) }))
import {
  latestEnabledMatureSkills,
  resolveMatureSkillVersion,
} from '@aurevane/game-core/combat/mature-skills'
import { currentEssenceDefinitions } from '@aurevane/game-core/combat/essence'
import { currentResonanceDefinitions } from '@aurevane/game-core/combat/resonance'
import { defaultBasicSkills } from '@aurevane/game-core/combat/combat-basic-actions'
import { parseAbilityDefinition } from '@aurevane/game-core/combat/combat-definition'
import { RpcCombatContentAuthoringStore } from './supabase-combat-content-authoring-store'
import { publishCombatEffectTimingPolicy } from './combat-effect-timing-policy-store'

const actor = '11111111-1111-4111-8111-111111111111'
const token = 'a'.repeat(32)
const instantPolicy = { version: 7, modes: {} }
function record(kind: string, key: string, definition: object, version: number) {
  return {
    id: `version:${key}:${version}`,
    content_key: key,
    content_kind: kind,
    content_version: version,
    definition,
    published_by: actor,
    published_at: '2026-10-15T12:00:00Z',
  }
}
function disabledNativeRecords() {
  return [
    ...latestEnabledMatureSkills().map((d) =>
      record('skill', d.id, { ...d, enabled: false }, d.contentVersion),
    ),
    ...currentEssenceDefinitions().map((d) =>
      record('essence', d.essenceId, { ...d, enabled: false }, d.contentVersion),
    ),
    ...currentResonanceDefinitions().map((d) =>
      record('resonance', d.id, { ...d, enabled: false }, d.contentVersion),
    ),
  ]
}
function fixture(policy = instantPolicy, publications: ReturnType<typeof record>[] = []) {
  const writes: { name: string; parameters: Readonly<Record<string, unknown>> }[] = []
  const skill = structuredClone(resolveMatureSkillVersion('vanguard.forceful-strike')!)
  const row = record('skill', skill.id, skill, skill.contentVersion)
  const rpc = vi.fn(async (name: string, parameters: Readonly<Record<string, unknown>>) => {
    if (name === 'read_combat_content_catalogue_v1')
      return { data: structuredClone({ token, policy, publications }), error: null }
    if (name === 'list_combat_content_versions_v1') return { data: [row], error: null }
    writes.push({ name, parameters })
    return {
      data: name.includes('timing') ? { version: 8, modes: parameters.p_modes } : [row],
      error: null,
    }
  })
  adminRpc.mockImplementation(rpc)
  return { rpc, writes, skill, store: new RpcCombatContentAuthoringStore(rpc, actor) }
}
beforeEach(() => {
  adminRpc.mockReset()
})
it.each(['manual', 'automatic'] as const)(
  'uses root Essence %s authority at the actual timing publication boundary',
  async (activation) => {
    const manual = structuredClone(
      defaultBasicSkills().find((skill) => skill.id === 'unarmed.basic')!.ability.behaviors[0]!,
    )
    Object.assign(manual, {
      effects: [{ id: 'hit', payload: { type: 'damage', recipient: 'primary-unit', amount: 10 } }],
    })
    const automatic = {
      ...manual,
      activation: 'automatic',
      activationLimits: ['once-per-action'],
      automaticTarget: { subject: 'triggering' },
      requirements: { kind: 'event', eventType: 'combat_action_used', phase: 'before' },
    }
    const essence = structuredClone(currentEssenceDefinitions()[0]!)
    Object.assign(essence, {
      ability: parseAbilityDefinition({
        schemaVersion: 1,
        behaviors: [activation === 'manual' ? manual : automatic],
      }),
    })
    Object.assign(essence.skill, {
      ability: parseAbilityDefinition({
        schemaVersion: 1,
        behaviors: [activation === 'manual' ? automatic : manual],
      }),
    })
    const publications = disabledNativeRecords().filter(
      (row) => row.content_key !== essence.essenceId,
    )
    publications.push(record('essence', essence.essenceId, essence, essence.contentVersion))
    const f = fixture(instantPolicy, publications)
    const before = JSON.stringify(publications)
    const proposed = { version: 7, modes: { damage: 'controlled' } }
    const result = publishCombatEffectTimingPolicy({ actorUserId: actor, policy: proposed })
    if (activation === 'automatic') {
      await expect(result).rejects.toMatchObject({ code: 'INVALID_REQUEST' })
      expect(f.writes).toEqual([])
    } else {
      await expect(result).resolves.toEqual({ version: 8, modes: proposed.modes })
      expect(f.writes).toEqual([
        {
          name: 'publish_combat_effect_timing_policy_v2',
          parameters: {
            p_actor_user_id: actor,
            p_expected_version: 7,
            p_modes: proposed.modes,
            p_expected_catalogue_token: token,
          },
        },
      ])
    }
    expect(JSON.stringify(publications)).toBe(before)
  },
)
it('publishes compatible content only through the catalogue-CAS writer with its validated token', async () => {
  const f = fixture()
  await f.store.publish({
    actorUserId: actor,
    contentKey: f.skill.id,
    contentKind: 'skill',
    definition: f.skill as unknown as Record<string, unknown>,
    expectedBaseVersion: f.skill.contentVersion,
  })
  expect(f.writes).toEqual([
    {
      name: 'publish_combat_content_v3',
      parameters: expect.objectContaining({
        p_expected_catalogue_token: token,
        p_definition: f.skill,
        p_version_floor: f.skill.contentVersion,
      }),
    },
  ])
})
it('rejects a new legacy Skill incompatible with the pinned timing before any writer is called', async () => {
  const f = fixture({ version: 7, modes: { damage: 'controlled' } }, disabledNativeRecords())
  const custom = { ...f.skill, id: 'a.owner-legacy' }
  await expect(
    f.store.publish({
      actorUserId: actor,
      contentKey: custom.id,
      contentKind: 'skill',
      definition: custom as unknown as Record<string, unknown>,
      expectedBaseVersion: null,
    }),
  ).rejects.toMatchObject({ code: 'INVALID_REQUEST' })
  expect(f.writes).toEqual([])
})
it('accepts the same custom Skill with an actual compatible captured Manual behavior', async () => {
  const f = fixture({ version: 7, modes: { damage: 'controlled' } }, disabledNativeRecords())
  const custom = {
    ...f.skill,
    id: 'a.owner-manual',
    ability: defaultBasicSkills().find((d) => d.id === 'unarmed.basic')!.ability,
  }
  await f.store.publish({
    actorUserId: actor,
    contentKey: custom.id,
    contentKind: 'skill',
    definition: custom as unknown as Record<string, unknown>,
    expectedBaseVersion: null,
  })
  expect(f.writes).toEqual([
    {
      name: 'publish_combat_content_v3',
      parameters: expect.objectContaining({ p_expected_catalogue_token: token }),
    },
  ])
})
it('checks restored historical definitions and static fallback against the complete current timing before changing a pointer', async () => {
  const f = fixture({ version: 7, modes: { damage: 'controlled' } }, disabledNativeRecords())
  await expect(
    f.store.setCurrentPublication(f.skill.id, f.skill.contentVersion, actor),
  ).rejects.toMatchObject({ code: 'INVALID_REQUEST' })
  await expect(f.store.setCurrentPublication(f.skill.id, null, actor)).rejects.toMatchObject({
    code: 'INVALID_REQUEST',
  })
  expect(f.writes).toEqual([])
})
it('passes the validated token on a compatible history change and maps a concurrent catalogue change to refresh', async () => {
  const f = fixture()
  await f.store.setCurrentPublication(f.skill.id, f.skill.contentVersion, actor)
  expect(f.writes).toEqual([
    {
      name: 'set_combat_content_publication_v2',
      parameters: expect.objectContaining({
        p_expected_catalogue_token: token,
        p_target_version: f.skill.contentVersion,
      }),
    },
  ])
  const racingRpc = async (name: string, parameters: Readonly<Record<string, unknown>>) =>
    name === 'publish_combat_content_v3'
      ? { data: null, error: { code: '40001', message: 'COMBAT_CONTENT_CATALOGUE_CONFLICT' } }
      : f.rpc(name, parameters)
  const racing = new RpcCombatContentAuthoringStore(racingRpc, actor)
  await expect(
    racing.publish({
      actorUserId: actor,
      contentKey: f.skill.id,
      contentKind: 'skill',
      definition: f.skill as unknown as Record<string, unknown>,
      expectedBaseVersion: f.skill.contentVersion,
    }),
  ).rejects.toMatchObject({ code: 'STALE_VERSION' })
})
it('rejects a timing change that would strand native skills without publishing a policy version', async () => {
  const f = fixture()
  await expect(
    publishCombatEffectTimingPolicy({
      actorUserId: actor,
      policy: { version: 7, modes: { damage: 'controlled' } },
    }),
  ).rejects.toMatchObject({ code: 'INVALID_REQUEST' })
  expect(f.writes).toEqual([])
})
it('publishes compatible timing through the same catalogue-CAS boundary and preserves reason-free input', async () => {
  const f = fixture()
  await expect(
    publishCombatEffectTimingPolicy({
      actorUserId: actor,
      policy: { version: 7, modes: { slow: 'instant' } },
    }),
  ).resolves.toEqual({ version: 8, modes: { slow: 'instant' } })
  expect(f.writes).toEqual([
    {
      name: 'publish_combat_effect_timing_policy_v2',
      parameters: {
        p_actor_user_id: actor,
        p_expected_version: 7,
        p_modes: { slow: 'instant' },
        p_expected_catalogue_token: token,
      },
    },
  ])
})

it('fails closed when the snapshot or guarded writer is unavailable, without retrying a legacy write', async () => {
  const f = fixture()
  for (const unavailable of ['read_combat_content_catalogue_v1', 'publish_combat_content_v3']) {
    const attempts: string[] = []
    const rpc = async (name: string, parameters: Readonly<Record<string, unknown>>) => {
      attempts.push(name)
      return name === unavailable
        ? { data: null, error: { code: 'PGRST202', message: 'missing migration' } }
        : f.rpc(name, parameters)
    }
    const store = new RpcCombatContentAuthoringStore(rpc, actor)
    await expect(
      store.publish({
        actorUserId: actor,
        contentKey: f.skill.id,
        contentKind: 'skill',
        definition: f.skill as unknown as Record<string, unknown>,
        expectedBaseVersion: f.skill.contentVersion,
      }),
    ).rejects.toMatchObject({ code: 'PERSISTENCE_UNAVAILABLE' })
    expect(attempts).not.toContain('publish_combat_content_v1')
    expect(attempts).not.toContain('publish_combat_content_v2')
    expect(f.writes).toEqual([])
  }
})
it('rejects missing or wrong-kind history targets before a pointer change', async () => {
  const f = fixture()
  await expect(f.store.setCurrentPublication(f.skill.id, 999, actor)).rejects.toMatchObject({
    code: 'COMBAT_CONTENT_VERSION_NOT_FOUND',
  })
  await expect(
    f.store.setCurrentPublication(f.skill.id, f.skill.contentVersion, actor, 'essence'),
  ).rejects.toMatchObject({ code: 'COMBAT_CONTENT_VERSION_NOT_FOUND' })
  expect(f.writes).toEqual([])
})
it('rejects an attempted kind change of a custom current identity', async () => {
  const f = fixture(instantPolicy, [
    record('status', 'a.owner-identity', { id: 'a.owner-identity' }, 1),
  ])
  const custom = { ...f.skill, id: 'a.owner-identity' }
  await expect(
    f.store.publish({
      actorUserId: actor,
      contentKey: custom.id,
      contentKind: 'skill',
      definition: custom as unknown as Record<string, unknown>,
      expectedBaseVersion: 1,
    }),
  ).rejects.toMatchObject({ code: 'INVALID_REQUEST' })
  expect(f.writes).toEqual([])
})
it('rejects a stale timing version before writing and translates a post-validation catalogue race', async () => {
  const f = fixture()
  await expect(
    publishCombatEffectTimingPolicy({ actorUserId: actor, policy: { version: 6, modes: {} } }),
  ).rejects.toMatchObject({ code: 'STALE_VERSION' })
  expect(f.writes).toEqual([])
  adminRpc.mockImplementation((name: string, parameters: Readonly<Record<string, unknown>>) =>
    name === 'publish_combat_effect_timing_policy_v2'
      ? { data: null, error: { code: '40001', message: 'COMBAT_CONTENT_CATALOGUE_CONFLICT' } }
      : f.rpc(name, parameters),
  )
  await expect(
    publishCombatEffectTimingPolicy({ actorUserId: actor, policy: { version: 7, modes: {} } }),
  ).rejects.toMatchObject({ code: 'STALE_VERSION' })
  expect(f.writes).toEqual([])
})

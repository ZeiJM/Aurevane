import { beforeAll, afterAll, beforeEach, afterEach, expect, it, vi } from 'vitest'
import type { CompleteCombatContentRecord } from '@aurevane/db/combat-content'
import { createCombatContentTestDatabase } from '../../../../../packages/db/src/test-support/combat-content-test-database'
const session = vi.hoisted(() => ({
  userId: '00000000-0000-4000-8000-000000000002',
  selected: '00000000-0000-4000-8000-000000000011' as string | null,
  rpc: vi.fn(),
}))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/admin', () => ({ createSupabaseAdminClient: () => ({ rpc: session.rpc }) }))
vi.mock('@/server/auth/actor', () => ({
  getAuthenticatedActor: async () => ({ userId: session.userId }),
}))
vi.mock('@/server/character/selected-character', () => ({
  loadSelectedCharacter: async () => (session.selected ? { id: session.selected } : null),
}))
import { handleCombatContentAuthoringRequest } from './combat-content-authoring-handler'
import { GET as readTags } from '@/app/api/combat-tags/route'
const owner = '00000000-0000-4000-8000-000000000001'
const selected = '00000000-0000-4000-8000-000000000011'
const requestId = '00000000-0000-4000-8000-000000000080'
const tag = {
  schemaVersion: 1,
  id: 'ignored.input',
  contentVersion: 1,
  tagId: 'damage',
  name: 'Impact',
  description: 'Relative power.',
  explanation: 'Damage uses power, not exact HP.',
  sortOrder: 0,
  enabled: true,
  media: {},
}
let db: Awaited<ReturnType<typeof createCombatContentTestDatabase>>
beforeAll(async () => {
  db = await createCombatContentTestDatabase(async (database, name) => {
    if (name !== '20261022221218_canonical_tag_presentation.sql') return
    await database.exec(`insert into auth.users(id,email,email_confirmed_at) values('${owner}','owner@example.test',now()),('${session.userId}','staff@example.test',now());
      insert into app_private.master_panel_role_assignments(user_id,role) values('${owner}','game-owner');
      insert into public.characters(id,user_id,slot_index,rules_version,name,name_key,presentation_id,pronoun_preset_id,portrait_ref,starter_appearance_ref,foundation_discipline_id,might,finesse,vitality,agility,intellect,resolve,level,xp,progression_cycle,created_at,cycle_started_at,last_active_at)
      values('${selected}','${session.userId}',0,1,'Test Player','test-player','default','they','portrait','appearance','vanguard',12,4,7,4,3,6,1,0,1,now(),now(),now());`)
    await database.query(
      'select public.set_master_panel_character_access_v2($1,$2,$3,$4::text[],$5::text[],null,0,true)',
      [owner, session.userId, selected, ['content-staff'], []],
    )
    for (const [index, key, tagId] of [
      ['91', 'tag.00000000-0000-4000-8000-000000000091', 'pierce'],
      ['92', 'tag.healing', 'healing'],
    ]) {
      await database.query('select public.write_combat_content_record_v1($1,$2,$3,$4)', [
        session.userId,
        selected,
        key,
        {
          action: 'create',
          requestId: `00000000-0000-4000-8000-0000000000${index}`,
          contentKind: 'tag',
          definition: { ...tag, id: key, tagId, description: 'x'.repeat(4000) },
        },
      ])
    }
  })
}, 60000)
afterAll(async () => {
  await db?.close()
})
beforeEach(async () => {
  session.selected = selected
  await db.exec('begin')
  // Transport only: every RPC executes the production migration function, including live
  // selected-character authorization, request receipts, locking, CAS and publication.
  session.rpc.mockImplementation(async (name: string, parameters: Record<string, unknown>) => {
    const keys = Object.keys(parameters)
    if (![name, ...keys].every((value) => /^[a-z_][a-z0-9_]*$/u.test(value)))
      throw new Error('Invalid test RPC identifier')
    const invocation = `public.${name}(${keys.map((key, index) => `${key} => $${index + 1}`).join(',')})`
    await db.exec('savepoint rpc_call')
    try {
      const rows = (
        await db.query<Record<string, unknown>>(
          ['read_master_panel_operator_v1', 'read_combat_content_version_v1'].includes(name)
            ? `select * from ${invocation}`
            : `select ${invocation} value`,
          Object.values(parameters),
        )
      ).rows
      await db.exec('release savepoint rpc_call')
      // Match the PostgREST JSON wire format, including timestamptz strings.
      return {
        data: JSON.parse(
          JSON.stringify(
            ['read_master_panel_operator_v1', 'read_combat_content_version_v1'].includes(name)
              ? rows
              : rows[0]?.value,
          ),
        ),
        error: null,
      }
    } catch (error) {
      await db.exec('rollback to savepoint rpc_call; release savepoint rpc_call')
      return {
        data: null,
        error: { code: (error as { code?: string }).code, message: (error as Error).message },
      }
    }
  })
})
afterEach(async () => {
  await db.exec('rollback')
})
async function authoringRequest(input: unknown) {
  const response = await handleCombatContentAuthoringRequest(
    new Request('https://example.test/api/master/combat-content', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  )
  return {
    status: response.status,
    body: (await response.json()) as {
      record: CompleteCombatContentRecord
      error?: { code: string; message: string }
    },
  }
}
async function command(input: unknown) {
  return authoringRequest({ operation: 'record', command: input })
}
async function create(definition = tag, request = requestId) {
  return command({ action: 'create', requestId: request, contentKind: 'tag', definition })
}
async function publish(record: CompleteCombatContentRecord) {
  return command({
    action: 'publish',
    contentKey: record.contentKey,
    expectedDraftVersion: record.draft!.draftVersion,
    expectedBaseVersion: record.draft!.baseVersion,
  })
}
async function currentTags() {
  return (await readTags(new Request('https://example.test/api/combat-tags'))).json()
}
async function exactTag(version: number) {
  return (
    await readTags(
      new Request(`https://example.test/api/combat-tags?key=tag.damage&version=${version}`),
    )
  ).json()
}
it('actual API create → saved publication → current/exact readers retains versions and operation retries', async () => {
  const created = await create()
  expect(created.status, JSON.stringify(created.body)).toBe(200)
  expect(created.body.record.contentKey).toBe('tag.damage')
  expect(created.body.record.draft!.definition.id).toBe('tag.damage')
  expect(await create()).toEqual(created)
  expect(await currentTags()).toEqual({ tags: [] })
  const first = await publish(created.body.record)
  expect(first.status, JSON.stringify(first.body)).toBe(200)
  const version = first.body.record.current!.contentVersion
  const pinned = await exactTag(version)
  expect(pinned).toMatchObject({
    tag: { contentKey: 'tag.damage', contentVersion: version, name: 'Impact' },
  })
  expect(await create()).toEqual(created)
  expect((await command({ action: 'read', contentKey: 'tag.damage' })).body.record).toEqual(
    first.body.record,
  )
  const saved = await command({
    action: 'save',
    contentKey: 'tag.damage',
    expectedRevision: first.body.record.revision,
    definition: { ...first.body.record.current!.definition, name: 'Strike' },
  })
  expect(saved.status).toBe(200)
  const second = await publish(saved.body.record)
  expect(second.status, JSON.stringify(second.body)).toBe(200)
  expect(await currentTags()).toMatchObject({
    tags: [{ name: 'Strike', contentVersion: second.body.record.current!.contentVersion }],
  })
  expect(await exactTag(version)).toEqual(pinned)
  // The authoring response omits rollback history; exact runtime versions remain immutable.
  expect(second.body.record.history).toEqual([])
  expect(second.body.record).not.toHaveProperty('builtinRestoreVersion')
  expect(
    (
      await db.query(
        "select content_version, definition from app_private.combat_content_versions where content_key='tag.damage' order by content_version",
      )
    ).rows,
  ).toEqual([
    { content_version: version, definition: first.body.record.current!.definition },
    {
      content_version: second.body.record.current!.contentVersion,
      definition: second.body.record.current!.definition,
    },
  ])
})
it('canonical creation preserves request conflicts, one identity and stale save/publication CAS', async () => {
  const first = await create()
  expect(first.status, JSON.stringify(first.body)).toBe(200)
  expect((await create({ ...tag, name: 'Changed retry' })).status).toBe(409)
  expect((await create(tag, '00000000-0000-4000-8000-000000000081')).status).toBe(409)
  const saved = await command({
    action: 'save',
    contentKey: 'tag.damage',
    expectedRevision: first.body.record.revision,
    definition: { ...tag, id: 'tag.damage', name: 'Edited' },
  })
  expect(saved.status).toBe(200)
  expect(
    (
      await command({
        action: 'save',
        contentKey: 'tag.damage',
        expectedRevision: first.body.record.revision,
        definition: { ...tag, id: 'tag.damage' },
      })
    ).status,
  ).toBe(409)
  expect((await publish(first.body.record)).status).toBe(409)
  expect((await command({ action: 'read', contentKey: 'tag.damage' })).body.record).toEqual(
    saved.body.record,
  )
  expect(
    (
      await db.query(
        "select content_key from app_private.combat_content_records where content_key='tag.damage'",
      )
    ).rows,
  ).toHaveLength(1)
})
it('Tag duplication is specifically unavailable and an invented Tag never becomes a record', async () => {
  const invalid = await create({ ...tag, tagId: 'invented' })
  expect(invalid.status).toBe(400)
  const duplicate = await command({
    action: 'duplicate',
    sourceKey: 'tag.healing',
    expectedSourceRevision: 1,
    requestId,
  })
  expect(duplicate.status).toBe(400)
  expect(duplicate.body.error?.message).toMatch(/Tag.*cannot be duplicated/u)
  expect(
    (
      await db.query(
        'select content_key from app_private.combat_content_records where content_key=$1',
        [`tag.${requestId}`],
      )
    ).rows,
  ).toEqual([])
})
it.each(['tag.healing', 'tag.00000000-0000-4000-8000-000000000091'])(
  'retained %s reads and saves under its stable identity but must meet canonical publication constraints',
  async (key) => {
    const read = await command({ action: 'read', contentKey: key })
    expect(read.status, JSON.stringify(read.body)).toBe(200)
    const original = read.body.record.draft!.definition
    expect(original.description).toHaveLength(4000)
    const corrected = await command({
      action: 'save',
      contentKey: key,
      expectedRevision: read.body.record.revision,
      definition: { ...original, explanation: 'Corrected retained explanation.' },
    })
    expect(corrected.status, JSON.stringify(corrected.body)).toBe(200)
    expect(corrected.body.record.draft!.definition.id).toBe(key)
    expect((await publish(corrected.body.record)).status).toBe(400)
    const short = await command({
      action: 'save',
      contentKey: key,
      expectedRevision: corrected.body.record.revision,
      definition: { ...corrected.body.record.draft!.definition, description: 'Relative power.' },
    })
    expect(short.status).toBe(200)
    if (key === 'tag.healing') expect((await publish(short.body.record)).status).toBe(200)
    else {
      expect((await publish(short.body.record)).status).toBe(400)
      const canonical = await create({ ...short.body.record.draft!.definition } as typeof tag)
      expect(canonical.status).toBe(200)
      expect(canonical.body.record.contentKey).toBe('tag.pierce')
      expect((await publish(canonical.body.record)).status).toBe(200)
      expect((await command({ action: 'read', contentKey: key })).body.record).toEqual(
        short.body.record,
      )
    }
  },
)
it('missing selection and revoked live capability reject canonical writes and receipt replay', async () => {
  session.selected = null
  expect((await create()).status).toBe(403)
  session.selected = selected
  const created = await create()
  expect(created.status, JSON.stringify(created.body)).toBe(200)
  await db.query(
    'select public.set_master_panel_character_access_v2($1,$2,$3,$4::text[],$5::text[],null,1,false)',
    [owner, session.userId, selected, ['content-staff'], []],
  )
  expect((await create()).status).toBe(403)
  expect((await publish(created.body.record)).status).toBe(403)
  expect(
    (
      await db.query(
        "select count(*)::int n from app_private.combat_content_versions where content_key='tag.damage'",
      )
    ).rows,
  ).toEqual([{ n: 0 }])
})

import {
  defaultBasicSkills,
  parseBasicSkillDefinition,
  captureBasicSkillSources,
} from '@aurevane/game-core/combat/combat-basic-actions'
import { SUPPORT_ACTION_IDS } from '@aurevane/game-core/combat/support-actions'
import {
  createCombatContentResolver,
  RpcPublishedCombatContentSource,
} from '@/server/combat/combat-content-resolver'
import { reconcileCombatAbilitySources } from '@aurevane/game-core/combat/combat-behavior-runtime'
import {
  executePv1fAction,
  executePv1fMovement,
  preparePv1fTurnEconomy,
} from '@aurevane/game-core/combat/pv1f-action-economy'
import { reattachStatDrivenCombatBridge } from '@aurevane/game-core/combat/stat-driven-combat'
import { percentageDotEncounter } from '../../../../../packages/game-core/src/combat/combat-percentage-dots.test-utils'
import { projectBattleSnapshot } from '@/server/battle/battle-session-service'
import { deriveParticipantBattleViewerEntitlement } from '@/server/battle/battle-viewer-entitlement'

it.each(defaultBasicSkills())(
  'complete current-edit API → SQL commit → $id execution preserves originals and old captures while HTTP rollback is retired',
  async (original) => {
    const initial = (await command({ action: 'read', contentKey: original.id })).body.record
    expect(initial.history).toEqual([])
    expect(initial).not.toHaveProperty('builtinRestoreVersion')
    expect(initial.builtinDefinition).toEqual(original)
    const edited = structuredClone(original)
    Object.assign(edited, { name: 'Edited original', description: 'A complete edited record.' })
    Object.assign(edited.ability.behaviors[0]!, { costs: [{ resource: 'ap', amount: 29 }] })
    const saved = await command({
      action: 'save',
      contentKey: original.id,
      expectedRevision: initial.revision,
      definition: edited,
    })
    expect(saved.status, JSON.stringify(saved.body)).toBe(200)
    expect(saved.body.record).not.toHaveProperty('builtinRestoreVersion')
    const first = await publish(saved.body.record)
    expect(first.status, JSON.stringify(first.body)).toBe(200)
    expect(first.body.record).not.toHaveProperty('builtinRestoreVersion')
    const source = new RpcPublishedCombatContentSource(session.rpc)
    const resolver = createCombatContentResolver(source)
    const oldDefinition = await resolver.resolvePinnedBasicSkillDefinition!(original.id, 2)
    expect(oldDefinition?.name).toBe('Edited original')
    const pinnedOriginal = await resolver.resolvePinnedBasicSkillDefinition!(original.id, 1)
    expect(pinnedOriginal).toEqual(original)
    const support = SUPPORT_ACTION_IDS.find((id) => id === original.id) ?? 'basic.guard'
    const capture = (definition: typeof original) => {
      const state = preparePv1fTurnEconomy(percentageDotEncounter())
      Object.assign(
        state.tactical.battle.combatants.find((c) => c.id === 'actor')!,
        { hp: 800, mp: 5 },
      )
      return reattachStatDrivenCombatBridge(
        reconcileCombatAbilitySources(
          state,
          captureBasicSkillSources({
            ownerCombatantId: 'actor',
            supportActionId: support,
            definitions: defaultBasicSkills().map((d) => (d.id === definition.id ? definition : d)),
          }),
        ),
        state.statBridge,
      )
    }
    const old = capture(oldDefinition!)
    const oldBytes = JSON.stringify(old)
    // Every retired HTTP spelling is rejected before a content read/write or mutation.
    // Retention for current/pinned readers is independent of authoring rollback controls.
    const beforeRetired = (
      await db.query('select app_private.combat_content_record_json_v1($1) record', [original.id])
    ).rows
    const retired = {
      action: 'restore',
      contentKey: original.id,
      expectedRevision: first.body.record.revision,
      sourceVersion: 1,
      sourceKind: 'builtin',
    }
    const rpcStart = session.rpc.mock.calls.length
    for (const body of [
      { operation: 'record', command: retired },
      {
        operation: 'record',
        command: { ...retired, sourceDefinition: { ...original, name: 'Forged' } },
      },
      { operation: 'record', command: { ...retired, sourceVersion: 999 } },
      { operation: 'record', command: { ...retired, sourceVersion: 2, sourceKind: undefined } },
      { operation: 'rollback', contentKey: original.id, contentVersion: 1 },
      { operation: 'restore-basic-draft', contentKey: original.id, sourceVersion: 1 },
    ]) {
      const rejected = await authoringRequest(body)
      expect(rejected.status, JSON.stringify(rejected.body)).toBe(400)
      expect(rejected.body.error?.message).toMatch(/rollback is no longer available/i)
    }
    expect(
      session.rpc.mock.calls
        .slice(rpcStart)
        .every(([name]) => name === 'read_master_panel_operator_v1'),
    ).toBe(true)
    session.selected = null
    expect((await command(retired)).status).toBe(403)
    session.selected = selected
    expect(
      (await db.query('select app_private.combat_content_record_json_v1($1) record', [original.id]))
        .rows,
    ).toEqual(beforeRetired)

    // Author a new current definition through the same fields as the UI, not a
    // restored source. The original values are explicit operator choices here.
    const currentEdit = parseBasicSkillDefinition(
      structuredClone(first.body.record.current!.definition),
    )
    Object.assign(currentEdit, { name: original.name, description: original.description })
    Object.assign(currentEdit.ability.behaviors[0]!, {
      costs: structuredClone(original.ability.behaviors[0]!.costs),
    })
    const commit = {
      action: 'commit',
      contentKey: original.id,
      expectedRevision: first.body.record.revision,
      definition: currentEdit,
    }
    session.selected = null
    expect((await command(commit)).status).toBe(403)
    session.selected = selected
    const published = await command(commit)
    expect(published.status, JSON.stringify(published.body)).toBe(200)
    expect(published.body.record.current).toMatchObject({
      contentVersion: 3,
      restoredFrom: null,
      restoredSource: null,
      restoredBy: null,
      authoredBy: session.userId,
    })
    expect(published.body.record.draft).toBeNull()
    expect(published.body.record.history).toEqual([])
    expect(published.body.record).not.toHaveProperty('builtinRestoreVersion')
    expect((await command(commit)).status).toBe(409)
    // A deliberate same-definition retry at the fresh CAS token is a no-op,
    // preserving the current pointer and immutable version count.
    const noop = await command({
      ...commit,
      expectedRevision: published.body.record.revision,
      definition: published.body.record.current!.definition,
    })
    expect(noop).toEqual(published)
    expect(
      (
        await db.query(
          'select content_version,definition from app_private.combat_content_versions where content_key=$1 order by content_version',
          [original.id],
        )
      ).rows,
    ).toEqual([
      { content_version: 2, definition: first.body.record.current!.definition },
      { content_version: 3, definition: published.body.record.current!.definition },
    ])
    const catalogue = await resolver.resolveCurrentCatalogue!()
    const definition = parseBasicSkillDefinition(
      catalogue.entries.find((e) => e.contentKey === original.id)!.definition,
    )
    expect(definition).toEqual({ ...original, contentVersion: 3 })
    const fresh = capture(definition)
    const execute = (state: typeof fresh) =>
      original.id === 'basic.move'
        ? executePv1fMovement(state, [
            { x: 1, y: 1 },
            { x: 1, y: 0 },
          ])
        : executePv1fAction(
            state,
            original.id === 'unarmed.basic' ? 'basic.attack.unarmed.basic' : original.id,
            original.id === 'unarmed.basic'
              ? { kind: 'unit', combatantId: 'enemy' }
              : { kind: 'self' },
          )
    const result = execute(fresh)
    const actor = result.state.tactical.battle.combatants.find((c) => c.id === 'actor')!
    const price = original.ability.behaviors[0]!.costs.find((c) => c.resource === 'ap')!.amount
    expect(actor.temporaryResources!.find((r) => r.key === 'pv1f.action-economy')!.current).toBe(
      100 - price,
    )
    if (original.id === 'basic.move')
      expect(
        result.state.tactical.placements.find((c) => c.combatantId === 'actor')!.position,
      ).toEqual({ x: 1, y: 0 })
    if (original.id === 'unarmed.basic')
      expect(
        result.state.tactical.battle.combatants.find((c) => c.id === 'enemy')!.hp,
      ).toBeLessThan(1000)
    if (original.id === 'basic.guard')
      expect(
        result.state.statusState
          .find((c) => c.combatantId === 'actor')!
          .statuses.some((s) => s.statusId === 'guarded'),
      ).toBe(true)
    if (original.id === 'basic.recover') expect(actor.hp).toBeGreaterThan(800)
    if (original.id === 'basic.recover.mp') expect(actor.mp).toBeGreaterThan(5)
    const view = projectBattleSnapshot(
      result.state,
      deriveParticipantBattleViewerEntitlement(result.state.tactical.battle.combatants, ['actor']),
    )
    expect(view.basicActions).toHaveLength(3)
    expect(view.basicActions!.some((a) => a.name === original.name && a.contentVersion === 3)).toBe(
      true,
    )
    expect(JSON.stringify(view.basicActions)).not.toMatch(
      /chanceBasisPoints|accuracyMode|sourceInstanceId/,
    )
    expect(JSON.stringify(old)).toBe(oldBytes)
    expect((await resolver.resolvePinnedBasicSkillDefinition!(original.id, 2))!.name).toBe(
      'Edited original',
    )
    expect(await resolver.resolvePinnedBasicSkillDefinition!(original.id, 1)).toEqual(
      pinnedOriginal,
    )
    expect(defaultBasicSkills().find((definition) => definition.id === original.id)).toEqual(
      original,
    )
  },
)

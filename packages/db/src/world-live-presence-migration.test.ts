import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterAll, afterEach, beforeAll, beforeEach, expect, it } from 'vitest'
import { PGlite } from '@electric-sql/pglite'

const migrationDir = resolve(process.cwd(), '../../supabase/migrations')
const sql = readFileSync(
  resolve(
    migrationDir,
    readdirSync(migrationDir).find((name) => name.endsWith('_world_live_presence.sql'))!,
  ),
  'utf8',
)
const existing = (name: string) => readFileSync(resolve(migrationDir, name), 'utf8')
const owner = '00000000-0000-4000-8000-000000000001'
const other = '00000000-0000-4000-8000-000000000002'
const character = '00000000-0000-4000-8000-000000000011'
const peer = '00000000-0000-4000-8000-000000000012'
const unsaved = '00000000-0000-4000-8000-000000000013'
const initialPosition = { sectorId: 'verdant-expanse', x: 5, y: 4 }
const initial = {
  version: 1,
  position: initialPosition,
  safe: true,
  route: [],
  nextStepAt: null,
  discoveries: {},
}
type Receipt = {
  version: number
  serverNow: number
  players: Array<{
    characterId: string
    position: typeof initialPosition
    attackable: boolean
    movement?: { version: number; serverNow: number; route: unknown[]; nextStepAt: number | null }
  }>
  state?: typeof initial
  sceneSectorIds?: string[]
  registered?: boolean
}
let db: PGlite
const scene = async (
  version = 1,
  ids: string[] | null = [initialPosition.sectorId],
  user = owner,
) =>
  (
    await db.query<{ receipt: Receipt }>(
      'select public.read_world_scene_players_v2($1,$2,$3,$4,$5) receipt',
      [user, character, version, ids, initialPosition],
    )
  ).rows[0]!.receipt
const live = async (version = 1, user = owner) =>
  (
    await db.query<{ receipt: Receipt }>(
      'select public.read_world_live_players_v1($1,$2,$3) receipt',
      [user, character, version],
    )
  ).rows[0]!.receipt
async function denied(operation: () => Promise<unknown>, message: string) {
  await db.exec('savepoint denied')
  await expect(operation()).rejects.toThrow(message)
  await db.exec('rollback to savepoint denied')
}
const allowedTopic = async (topic: string, user = owner) => {
  await db.query("select set_config('request.jwt.claim.sub',$1,true)", [user])
  return (
    await db.query<{ allowed: boolean }>('select public.can_receive_world_scene_v1($1) allowed', [
      topic,
    ])
  ).rows[0]!.allowed
}
beforeAll(async () => {
  db = await PGlite.create()
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema app_private; create schema auth; create schema realtime;
    create table auth.users(id uuid primary key);
    create table public.characters(id uuid primary key,user_id uuid,name text,level integer,portrait_ref text);
    create table app_private.character_deletion_requests(character_id uuid,user_id uuid);
    create table app_private.battle_sessions(id uuid,lifecycle text);
    create table app_private.battle_participants(battle_session_id uuid,user_id uuid,participant_role text);
    create table app_private.pvp_active_spectating(user_id uuid,battle_session_id uuid);
    create table app_private.wayfarers_practice_state(character_id uuid,planned_window text,plan_set_at timestamptz,planned_window_seconds bigint);
    create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create function realtime.topic() returns text language sql as $$ select current_setting('realtime.topic',true) $$;
    create table realtime.messages(topic text,extension text);
    alter table realtime.messages enable row level security;
    grant usage on schema realtime to authenticated;
    grant select,insert on realtime.messages to authenticated;
    -- A transport spy records the real trigger's calls. Supabase Realtime itself requires the disposable stack.
    create table app_private.world_broadcast_test_receipts(payload jsonb,event text,topic text,is_private boolean);
    create function realtime.send(payload jsonb,event text,topic text,is_private boolean) returns void language sql as $$
      insert into app_private.world_broadcast_test_receipts values($1,$2,$3,$4)
    $$;
    insert into auth.users values('${owner}'),('${other}');
    insert into public.characters values('${character}','${owner}','Owner',1,'portrait'),('${peer}','${other}','Peer',2,'portrait'),('${unsaved}','${other}','Unsaved',1,'portrait');
  `)
  const travel = existing('20260923190443_living_atlas_world_travel.sql')
  await db.exec(
    travel.slice(
      travel.indexOf('create table app_private.character_world_state'),
      travel.indexOf('create function public.read_world_state_v1'),
    ),
  )
  await db.exec(existing('20261011161830_world_multistep_pacing.sql'))
  await db.exec(sql)
}, 30000)
beforeEach(async () => {
  await db.exec('begin')
  await db.query(
    'insert into app_private.character_world_state(character_id,state) values($1,$3),($2,$3)',
    [character, peer, initial],
  )
})
afterEach(async () => {
  await db.exec('rollback')
})
afterAll(async () => {
  await db?.close()
})

it('registers only a matching owned scene with a bounded two-minute expiry and server initial position', async () => {
  expect(await scene()).toMatchObject({
    version: 1,
    players: expect.any(Array),
    serverNow: expect.any(Number),
  })
  const registry = (
    await db.query<{ scene_sector_ids: string[]; initial_position: unknown; seconds: number }>(
      'select scene_sector_ids,initial_position,extract(epoch from expires_at-clock_timestamp())::float8 seconds from app_private.world_scene_subscriptions where character_id=$1',
      [character],
    )
  ).rows[0]!
  expect(registry.scene_sector_ids).toEqual([initialPosition.sectorId])
  expect(registry.initial_position).toEqual(initialPosition)
  expect(registry.seconds).toBeGreaterThan(115)
  expect(registry.seconds).toBeLessThanOrEqual(120)
  expect(await scene(0, ['unregistered'])).toMatchObject({ version: 1, players: [] })
  expect((await live()).sceneSectorIds).toEqual([initialPosition.sectorId])
  await denied(() => scene(1, null), 'WORLD_INVALID_SCENE')
  await denied(() => scene(1, []), 'WORLD_INVALID_SCENE')
  await denied(
    () =>
      scene(
        1,
        Array.from({ length: 26 }, (_, i) => `scene-${i}`),
      ),
    'WORLD_INVALID_SCENE',
  )
  await denied(() => scene(1, ['']), 'WORLD_INVALID_SCENE')
  await denied(() => scene(1, [initialPosition.sectorId], other), 'WORLD_NOT_OWNED')
})

it('keeps a stable scene read free of registry row writes and renews only near the TTL threshold', async () => {
  await scene()
  const registration = async () =>
    (
      await db.query<{ row: string; expires_at: string }>(
        'select ctid::text row,expires_at::text from app_private.world_scene_subscriptions where character_id=$1',
        [character],
      )
    ).rows[0]!
  const first = await registration()
  await scene()
  await live()
  expect(await registration()).toEqual(first)
  await db.query(
    "update app_private.world_scene_subscriptions set expires_at=clock_timestamp()+interval '75 seconds' where character_id=$1",
    [character],
  )
  const nearExpiry = await registration()
  await live()
  const renewed = await registration()
  expect(renewed.row).not.toBe(nearExpiry.row)
  expect(Date.parse(renewed.expires_at) - Date.parse(nearExpiry.expires_at)).toBeGreaterThan(40_000)
  await scene(1, [initialPosition.sectorId, 'changed-scene'])
  expect((await live()).sceneSectorIds).toEqual(['changed-scene', initialPosition.sectorId])
})

it('withholds the old registered scene after an owner version and sector change until the new scene is registered', async () => {
  await scene()
  const registration = async () =>
    (
      await db.query<{ row: string; expires_at: string }>(
        'select ctid::text row,expires_at::text from app_private.world_scene_subscriptions where character_id=$1',
        [character],
      )
    ).rows[0]!
  const before = await registration()
  const moved = { ...initial, version: 2, position: { sectorId: 'atlas:58:28', x: 5, y: 4 } }
  await db.query('update app_private.character_world_state set state=$2 where character_id=$1', [
    character,
    moved,
  ])
  expect(await live(2)).toMatchObject({
    version: 2,
    state: moved,
    registered: false,
    sceneSectorIds: [],
    players: [],
  })
  expect(await registration()).toEqual(before)
  await scene(2, [moved.position.sectorId])
  expect(await live(2)).toMatchObject({
    version: 2,
    registered: true,
    sceneSectorIds: [moved.position.sectorId],
    players: [],
  })
  expect(
    (
      await db.query<{ version: number }>(
        'select registered_version::integer version from app_private.world_scene_subscriptions where character_id=$1',
        [character],
      )
    ).rows[0]!.version,
  ).toBe(2)
})

it('denies new joins for an obsolete registration and refreshes its version even when scene IDs stay the same', async () => {
  await scene()
  const topic = `world-scene:${initialPosition.sectorId}`
  expect(await allowedTopic(topic)).toBe(true)
  await db.query('update app_private.character_world_state set state=$2 where character_id=$1', [
    character,
    { ...initial, version: 2 },
  ])
  expect(await allowedTopic(topic)).toBe(false)
  expect(await live(2)).toMatchObject({ registered: false, players: [] })
  await scene(2)
  expect(await allowedTopic(topic)).toBe(true)
  expect(await live(2)).toMatchObject({
    registered: true,
    sceneSectorIds: [initialPosition.sectorId],
  })
})

it('returns only the first twelve approved persisted steps with a shared database clock and unchanged position', async () => {
  const route = Array.from({ length: 20 }, (_, i) => ({
    position: { ...initialPosition, x: i % 13 },
    durationMs: 200,
  }))
  await db.query('update app_private.character_world_state set state=$2 where character_id=$1', [
    peer,
    { ...initial, version: 9, route, nextStepAt: 4000, secret: 'not in movement' },
  ])
  const result = await scene()
  const player = result.players.find((p) => p.characterId === peer)!
  expect(player.position).toEqual(initialPosition)
  expect(player.attackable).toBe(true)
  expect(player.movement).toEqual({
    version: 9,
    serverNow: result.serverNow,
    nextStepAt: 4000,
    route: route.slice(0, 12),
  })
  expect(result.players.find((p) => p.characterId === unsaved)).toMatchObject({
    position: initialPosition,
    attackable: false,
  })
  expect(result.players.find((p) => p.characterId === unsaved)).not.toHaveProperty('movement')
  await db.query('update app_private.character_world_state set state=$2 where character_id=$1', [
    peer,
    { ...initial, version: 10 },
  ])
  expect((await scene()).players.find((p) => p.characterId === peer)?.movement).toMatchObject({
    version: 10,
    route: [],
    nextStepAt: null,
  })
})

it('reads and renews only the registry scene, preserving the owned state and server initial position', async () => {
  expect(await live()).toMatchObject({
    registered: false,
    sceneSectorIds: [],
    players: [],
    state: initial,
  })
  await scene(1, [initialPosition.sectorId, 'neighbour'])
  await db.query(
    "update app_private.world_scene_subscriptions set expires_at=clock_timestamp()+interval '10 seconds' where character_id=$1",
    [character],
  )
  const result = await live()
  expect(result).toMatchObject({
    registered: true,
    state: initial,
    sceneSectorIds: ['neighbour', initialPosition.sectorId],
  })
  expect(result.players.find((p) => p.characterId === unsaved)?.position).toEqual(initialPosition)
  const remaining = (
    await db.query<{ seconds: number }>(
      'select extract(epoch from expires_at-clock_timestamp())::float8 seconds from app_private.world_scene_subscriptions',
    )
  ).rows[0]!.seconds
  expect(remaining).toBeGreaterThan(115)
  expect(await live(0)).toMatchObject({
    registered: false,
    players: [],
    sceneSectorIds: [],
    version: 1,
  })
  await db.query(
    "update app_private.world_scene_subscriptions set expires_at=clock_timestamp()-interval '1 second' where character_id=$1",
    [character],
  )
  expect(await live()).toMatchObject({ registered: false, players: [], sceneSectorIds: [] })
  expect(
    (
      await db.query<{ expired: boolean }>(
        'select expires_at<clock_timestamp() expired from app_private.world_scene_subscriptions',
      )
    ).rows[0]!.expired,
  ).toBe(true)
  await denied(() => live(1, other), 'WORLD_NOT_OWNED')
  await db.query('insert into app_private.character_deletion_requests values($1,$2)', [
    character,
    owner,
  ])
  await denied(() => live(), 'WORLD_NOT_OWNED')
})

it('grants browser roles only the receive helper and no registry or scene RPC access', async () => {
  for (const role of ['anon', 'authenticated']) {
    for (const signature of [
      'read_world_scene_players_v2(uuid,uuid,bigint,text[],jsonb)',
      'read_world_live_players_v1(uuid,uuid,bigint)',
    ]) {
      expect(
        (
          await db.query<{ allowed: boolean }>(
            "select has_function_privilege($1,$2,'execute') allowed",
            [role, `public.${signature}`],
          )
        ).rows[0]!.allowed,
      ).toBe(false)
    }
    expect(
      (
        await db.query<{ allowed: boolean }>(
          "select has_table_privilege($1,'app_private.world_scene_subscriptions','select') allowed",
          [role],
        )
      ).rows[0]!.allowed,
    ).toBe(false)
  }
  expect(
    (
      await db.query<{ allowed: boolean }>(
        "select has_function_privilege('authenticated','public.can_receive_world_scene_v1(text)','execute') allowed",
      )
    ).rows[0]!.allowed,
  ).toBe(true)
  expect(
    (
      await db.query<{ allowed: boolean }>(
        "select has_function_privilege('anon','public.can_receive_world_scene_v1(text)','execute') allowed",
      )
    ).rows[0]!.allowed,
  ).toBe(false)
  await db.exec('set local role authenticated')
  await denied(
    () => db.query('select public.read_world_live_players_v1($1,$2,1)', [owner, character]),
    'permission denied',
  )
  await denied(
    () => db.query('select * from app_private.world_scene_subscriptions'),
    'permission denied',
  )
  await db.exec('reset role')
})

it('authorizes exact registered scene receive topics by JWT owner, expiry and deletion, without client publishing', async () => {
  const topic = `world-scene:${initialPosition.sectorId}`
  await scene()
  expect(await allowedTopic(topic)).toBe(true)
  expect(await allowedTopic(topic, other)).toBe(false)
  expect(await allowedTopic('world-scene:unknown')).toBe(false)
  expect(await allowedTopic(topic + ':extra')).toBe(false)
  await db.query(
    "insert into realtime.messages values($1,'broadcast'),($1,'presence'),('world-scene:unknown','broadcast')",
    [topic],
  )
  await db.query(
    "select set_config('realtime.topic',$1,true),set_config('request.jwt.claim.sub',$2,true)",
    [topic, owner],
  )
  await db.exec('set local role authenticated')
  expect((await db.query('select * from realtime.messages')).rows).toEqual([
    { topic, extension: 'broadcast' },
  ])
  await denied(
    () => db.query("insert into realtime.messages values($1,'broadcast')", [topic]),
    'row-level security',
  )
  await db.exec('reset role')
  await db.query(
    "update app_private.world_scene_subscriptions set expires_at=clock_timestamp()-interval '1 second' where character_id=$1",
    [character],
  )
  expect(await allowedTopic(topic)).toBe(false)
  await scene()
  await db.query('insert into app_private.character_deletion_requests values($1,$2)', [
    character,
    owner,
  ])
  expect(await allowedTopic(topic)).toBe(false)
})

it('emits one empty private invalidation per distinct old/new sector only for committed version changes', async () => {
  await db.query(
    'update app_private.character_world_state set last_seen_at=clock_timestamp() where character_id=$1',
    [peer],
  )
  await db.query('update app_private.character_world_state set state=state where character_id=$1', [
    peer,
  ])
  expect((await db.query('select * from app_private.world_broadcast_test_receipts')).rows).toEqual(
    [],
  )
  await db.query("select public.commit_world_state_v1($1,$2,1,$3,'stop',$4,'receipt')", [
    other,
    peer,
    '00000000-0000-4000-8000-000000000099',
    initial,
  ])
  await db.query("select public.commit_world_state_v1($1,$2,1,$3,'stop',$4,'receipt')", [
    other,
    peer,
    '00000000-0000-4000-8000-000000000099',
    initial,
  ])
  expect((await db.query('select * from app_private.world_broadcast_test_receipts')).rows).toEqual([
    {
      payload: {},
      event: 'changed',
      topic: `world-scene:${initialPosition.sectorId}`,
      is_private: true,
    },
  ])
  await db.exec('truncate app_private.world_broadcast_test_receipts')
  await db.query('update app_private.character_world_state set state=$2 where character_id=$1', [
    peer,
    {
      ...initial,
      version: 3,
      position: { sectorId: 'private-survey', x: 8, y: 4 },
      discoveries: { secret: [9] },
    },
  ])
  expect(
    (await db.query('select * from app_private.world_broadcast_test_receipts order by topic')).rows,
  ).toEqual([
    { payload: {}, event: 'changed', topic: 'world-scene:private-survey', is_private: true },
    {
      payload: {},
      event: 'changed',
      topic: `world-scene:${initialPosition.sectorId}`,
      is_private: true,
    },
  ])
})

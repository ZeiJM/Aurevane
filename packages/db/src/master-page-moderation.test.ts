import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import { beforeAll, afterAll, expect, it } from 'vitest'
const root = resolve(process.cwd(), '../../supabase/migrations')
const sql = (name: string) => readFileSync(resolve(root, name), 'utf8')
const owner = '11111111-1111-4111-8111-111111111111'
const staff = '22222222-2222-4222-8222-222222222222'
const chosen = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const player = '33333333-3333-4333-8333-333333333333'
const alternate = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
let db: PGlite
beforeAll(async () => {
  db = await PGlite.create()
  await db.exec(`create role anon;create role authenticated;create role service_role;
    create schema auth;create schema app_private;
    create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
    create table public.characters(id uuid primary key,user_id uuid references auth.users,name text);
    create table app_private.character_deletion_requests(character_id uuid primary key);
    insert into auth.users values('${owner}','owner@example.com',now()),('${staff}','staff@example.com',now());
    insert into public.characters values('${chosen}','${staff}','Chosen'),('${alternate}','${staff}','Alternate');`)
  for (const name of [
    '20260917213000_combat_content_authoring.sql',
    '20260917214500_combat_content_resolver.sql',
    '20260917220000_master_panel_combat_authoring.sql',
  ])
    await db.exec(sql(name))
  await db.exec(
    `insert into app_private.master_panel_operators(user_id,role) values('${owner}','owner'),('${staff}','content-staff');`,
  )
  for (const name of [
    '20260918193000_phase5_staff_authority_foundation.sql',
    '20260918200927_phase5_staff_management_and_capabilities.sql',
    '20260928042812_combat_content_essence_resonance_kinds.sql',
    '20261015095150_typed_combat_authoring_kinds.sql',
    '20261003040911_combat_effect_timing_policy.sql',
    '20261015073458_remove_combat_timing_reason.sql',
    '20261015100834_combat_content_catalogue_snapshot.sql',
    '20261015103321_combat_catalogue_publication_guard.sql',
    '20261015191634_combat_content_version_floor.sql',
  ])
    await db.exec(sql(name))
  await db.exec(
    sql('20260815205500_server_architecture_foundation.sql').match(
      /create table app_private.idempotency_records[\s\S]*?\n\);/,
    )![0],
  )
  await db.exec(sql('20260918233000_phase5_persistent_event_kernel.sql'))
  await db.exec(
    sql('20260919051500_phase4_event_terminal_cleanup.sql').match(
      /alter table app_private.event_runs[\s\S]*?\n {2}\);/,
    )![0],
  )
  await db.exec(
    sql('20260919051500_phase4_event_terminal_cleanup.sql').match(
      /create table app_private.event_run_cleanup_requirements[\s\S]*?\n\);/,
    )![0],
  )
  for (const name of [
    '20260919053000_phase4_event_builder_mvp.sql',
    '20260919053700_phase4_event_authoring_audit.sql',
    '20260919054500_phase4_live_event_operations.sql',
    '20260919055500_phase4_live_event_operations_audit.sql',
  ])
    await db.exec(sql(name))
  const migration = readdirSync(root).find((name) =>
    name.endsWith('_selected_character_staff_access.sql'),
  )
  if (migration && existsSync(resolve(root, migration))) await db.exec(sql(migration))
  const defaultsMigration = readdirSync(root).find((name) =>
    name.endsWith('_master_panel_role_defaults.sql'),
  )
  if (defaultsMigration) await db.exec(sql(defaultsMigration))
  await db.exec(`alter table auth.users add column banned_until timestamptz;alter table auth.users add column updated_at timestamptz;
    insert into auth.users(id,email,email_confirmed_at) values('${player}','player@example.com',now());
    insert into public.characters values('${player}','${player}','Player');
    create table app_private.account_game_session_leases(user_id uuid primary key,auth_session_id text,claimed_at timestamptz,last_seen_at timestamptz);`)
  await db.exec(sql('20260825004020_read_first_active_game_session_verification.sql'))
  await db.exec(
    `create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);`,
  )
  for (const name of readdirSync(root)
    .filter((name) => name.includes('_site_music_'))
    .sort())
    await db.exec(sql(name))
  await db.exec(
    sql(readdirSync(root).find((name) => name.endsWith('_master_page_access_and_moderation.sql'))!),
  )
}, 30000)
afterAll(async () => {
  await db?.close()
})

async function assign() {
  await db.query(
    'select public.set_master_panel_character_access_v2($1,$2,$3,$4::text[],$5::text[],null,0,true)',
    [owner, staff, chosen, ['moderator'], []],
  )
}
async function read(actor = staff, character: string | null = chosen) {
  return (
    await db.query<{
      value: {
        revision: string
        active: boolean
        permanent: boolean
        expiresAt: string | null
        history: unknown[]
      }
    }>('select public.read_master_moderation_v1($1,$2,$3) value', [actor, player, character])
  ).rows[0]!.value
}
async function write(
  action: string,
  revision: string | undefined = undefined,
  minutes: number | null = 60,
  permanent = false,
  target = player,
) {
  return db.query('select public.write_master_moderation_v1($1,$2,$3,$4,$5,$6,$7,$8) value', [
    staff,
    target,
    revision ?? (await read()).revision,
    action,
    'Reviewed misconduct',
    minutes,
    permanent,
    chosen,
  ])
}
it('gives page tools together and denies wrong character, revoked/expired assignment and protected targets', async () => {
  await assign()
  expect(
    (
      await db.query<{ effective_capabilities: string[] }>(
        'select * from public.read_master_panel_access_v2($1,$2)',
        [staff, chosen],
      )
    ).rows[0]!.effective_capabilities,
  ).toEqual(expect.arrayContaining(['moderation.manage', 'moderation.permanent_ban']))
  await expect(read(staff, alternate)).rejects.toThrow('MASTER_PANEL_PAGE_ACCESS_REQUIRED')
  await expect(read(staff, null)).rejects.toThrow('MASTER_PANEL_PAGE_ACCESS_REQUIRED')
  await expect(write('ban', '0', 60, false, owner)).rejects.toThrow('MODERATION_PROTECTED_IDENTITY')
  await expect(write('ban', '0', 60, false, staff)).rejects.toThrow('MODERATION_PROTECTED_IDENTITY')
  await db.exec(
    `update app_private.master_panel_character_access set expires_at=now()-interval '1 second' where character_id='${chosen}'`,
  )
  await expect(read()).rejects.toThrow('MASTER_PANEL_PAGE_ACCESS_REQUIRED')
  await db.exec(
    `update app_private.master_panel_character_access set expires_at=null,enabled=false where character_id='${chosen}'`,
  )
  await expect(read()).rejects.toThrow('MASTER_PANEL_PAGE_ACCESS_REQUIRED')
  await db.exec(
    `update app_private.master_panel_character_access set enabled=true where character_id='${chosen}'`,
  )
})
it('applies, edits and lifts real account bans with immutable history, CAS and immediate session denial', async () => {
  expect(await read()).toMatchObject({ active: false, history: [] })
  await write('ban')
  let state = await read()
  expect(state).toMatchObject({ active: true, permanent: false })
  expect(state.history).toHaveLength(1)
  await expect(
    db.query("select public.ensure_active_game_session_v1($1,'session')", [player]),
  ).rejects.toThrow('ACCOUNT_BANNED')
  await expect(write('edit', '0')).rejects.toThrow('MODERATION_VERSION_CONFLICT')
  await db.exec("set timezone='Asia/Tokyo'")
  expect((await read()).revision).toBe(state.revision)
  await db.exec("set timezone='UTC'")
  await db.query("update auth.users set banned_until=banned_until+interval '1 hour' where id=$1", [
    player,
  ])
  await expect(write('edit', state.revision)).rejects.toThrow('MODERATION_VERSION_CONFLICT')
  state = await read()
  await write('edit', state.revision, null, true)
  state = await read()
  expect(state).toMatchObject({ active: true, permanent: true, expiresAt: null })
  expect(state.history).toHaveLength(2)
  await write('lift', state.revision)
  expect(await read()).toMatchObject({ active: false, history: expect.any(Array) })
  expect(
    (await db.query("select public.ensure_active_game_session_v1($1,'session') allowed", [player]))
      .rows,
  ).toEqual([{ allowed: true }])
  await expect(db.exec('delete from app_private.master_moderation_audit')).rejects.toThrow(
    'MODERATION_HISTORY_IMMUTABLE',
  )
  state = await read()
  await write('ban', state.revision, 1)
  await db.query("update auth.users set banned_until=now()-interval '1 second' where id=$1", [
    player,
  ])
  expect(await read()).toMatchObject({ active: false, expiresAt: null, permanent: false })
  expect(
    (await db.query("select public.ensure_active_game_session_v1($1,'session') allowed", [player]))
      .rows,
  ).toEqual([{ allowed: true }])
})
it('authorizes the complete music and combat timing tools through selected page access with CAS and no-op writes', async () => {
  const defaults = (
    await db.query<{ v: { revision: number; roles: Record<string, string[]> } }>(
      'select public.read_master_panel_role_defaults_v1($1) v',
      [owner],
    )
  ).rows[0]!.v
  await db.query('select public.save_master_panel_role_defaults_v1($1,$2,$3)', [
    owner,
    defaults.revision,
    { ...defaults.roles, moderator: ['moderation', 'music', 'combat-timing'] },
  ])
  const current = (
    await db.query<{
      v: {
        enabled: boolean
        default_track: unknown
        route_overrides: unknown
        song_library: unknown
        revision: number
        updated_at: string
      }
    }>('select to_jsonb(s) v from public.site_music_configuration s')
  ).rows[0]!.v
  const config = {
    enabled: current.enabled,
    defaultTrack: current.default_track,
    routeOverrides: current.route_overrides,
    songLibrary: current.song_library,
  }
  const save = (revision: number, c = config, character = chosen) =>
    db.query<{ v: typeof current }>(
      'select public.save_site_music_configuration_v1($1,$2,$3,$4) v',
      [staff, character, revision, c],
    )
  expect((await save(current.revision)).rows[0]!.v).toEqual(current)
  const changed = (await save(current.revision, { ...config, enabled: !config.enabled })).rows[0]!.v
  expect(changed.revision).toBe(Number(current.revision) + 1)
  await expect(save(current.revision)).rejects.toThrow('SITE_MUSIC_VERSION_CONFLICT')
  await expect(save(changed.revision, config, alternate)).rejects.toThrow(
    'MASTER_PANEL_PAGE_ACCESS_REQUIRED',
  )
  await expect(
    db.query('select public.publish_combat_effect_timing_policy_v2($1,1,$2,$3,$4)', [
      staff,
      {},
      'wrong',
      chosen,
    ]),
  ).rejects.toThrow('COMBAT_CONTENT_CATALOGUE_CONFLICT')
  const catalogue = (
    await db.query<{ v: { token: string; policy: { version: number; modes: unknown } } }>(
      'select public.read_combat_content_catalogue_v1() v',
    )
  ).rows[0]!.v
  const timing = (
    await db.query<{ v: { version: number; modes: unknown } }>(
      'select public.read_combat_effect_timing_policy_v1() v',
    )
  ).rows[0]!.v
  expect(
    (
      await db.query<{ v: { version: number } }>(
        'select public.publish_combat_effect_timing_policy_v2($1,$2,$3,$4,$5) v',
        [staff, timing.version, timing.modes, catalogue.token, chosen],
      )
    ).rows[0]!.v.version,
  ).toBe(timing.version + 1)
  await db.query('select public.save_master_panel_role_defaults_v1($1,$2,$3)', [
    owner,
    Number(defaults.revision) + 1,
    defaults.roles,
  ])
  await expect(save(changed.revision)).rejects.toThrow('MASTER_PANEL_PAGE_ACCESS_REQUIRED')
  await db.exec('set role service_role')
  await expect(db.exec('update public.site_music_configuration set enabled=true')).rejects.toThrow(
    'permission denied',
  )
  await expect(
    db.query('select public.publish_combat_effect_timing_policy_v1($1,1,$2,null,$3)', [
      staff,
      {},
      chosen,
    ]),
  ).rejects.toThrow('permission denied')
  await db.exec('reset role')
})
it('pages through durable moderation history with stable cursors and no private identity payload', async () => {
  await db.query(
    `insert into app_private.master_moderation_audit(actor_user_id,actor_character_id,target_user_id,action,reason) select $1,$2,$3,'lift','Prior reviewed action '||n from generate_series(1,105) n`,
    [staff, chosen, player],
  )
  const first = (await read()) as unknown as {
    history: { id: string; actor: string }[]
    nextCursor: string | null
  }
  expect(first.history).toHaveLength(100)
  expect(first.history[0]!.actor).toBe('Chosen')
  expect(first.nextCursor).not.toBeNull()
  const second = (
    await db.query<{ v: { history: { id: string }[]; nextCursor: string | null } }>(
      'select public.read_master_moderation_v1($1,$2,$3,$4) v',
      [staff, player, chosen, first.nextCursor],
    )
  ).rows[0]!.v
  expect(second.history.length).toBeGreaterThan(0)
  expect(second.nextCursor).toBeNull()
  expect(new Set([...first.history, ...second.history].map((entry) => entry.id)).size).toBe(109)
  expect(JSON.stringify(first.history)).not.toContain(staff)
  await expect(
    db.query('select public.read_master_moderation_v1($1,$2,$3,-1)', [staff, player, chosen]),
  ).rejects.toThrow('INVALID_MODERATION_CURSOR')
})
it('revokes whole pages live and does not let a historic granular exception defeat the revocation', async () => {
  await db.exec(
    `update app_private.master_panel_character_access set special_capabilities=array['moderation.permanent_ban'] where character_id='${chosen}'`,
  )
  const defaults = (
    await db.query<{ v: { revision: number; roles: Record<string, string[]> } }>(
      'select public.read_master_panel_role_defaults_v1($1) v',
      [owner],
    )
  ).rows[0]!.v
  await db.query('select public.save_master_panel_role_defaults_v1($1,$2,$3)', [
    owner,
    defaults.revision,
    { ...defaults.roles, moderator: ['activity'] },
  ])
  await expect(read()).rejects.toThrow('MASTER_PANEL_PAGE_ACCESS_REQUIRED')
  await expect(
    db.query('select public.save_master_panel_role_defaults_v1($1,$2,$3)', [
      staff,
      defaults.revision,
      { ...defaults.roles, moderator: ['moderation'] },
    ]),
  ).rejects.toThrow('MASTER_PANEL_OWNER_REQUIRED')
  const effective = (
    await db.query<{ effective_capabilities: string[] }>(
      'select * from public.read_master_panel_access_v2($1,$2)',
      [staff, chosen],
    )
  ).rows[0]!.effective_capabilities
  expect(effective).toContain('activity.read')
  expect(effective).not.toContain('moderation.permanent_ban')
})
it('denies browser RPC and direct private-table access', async () => {
  await db.exec('set role authenticated')
  await expect(read()).rejects.toThrow('permission denied')
  await expect(db.query('select * from app_private.master_moderation_audit')).rejects.toThrow(
    'permission denied',
  )
  await db.exec('reset role;set role service_role')
  await expect(db.query('select * from app_private.master_moderation_audit')).rejects.toThrow(
    'permission denied',
  )
  await db.exec('reset role')
})

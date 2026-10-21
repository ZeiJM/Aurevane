import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest'

const owner = '11111111-1111-4111-8111-111111111111'
const staff = '22222222-2222-4222-8222-222222222222'
const ownerCharacter = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const first = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const alternate = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const directory = resolve(process.cwd(), '../../supabase/migrations')
const sql = (name: string) => readFileSync(resolve(directory, name), 'utf8')
let db: PGlite
beforeAll(async () => {
  db = await PGlite.create()
  await db.exec(`create role anon; create role authenticated; create role service_role; create schema auth; create schema app_private;
    create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
    create table public.characters(id uuid primary key,user_id uuid references auth.users(id),name text);
    create table app_private.character_deletion_requests(character_id uuid primary key);
    create table public.player_profiles(user_id uuid primary key);
    create table public.site_music_configuration(singleton_id boolean primary key,enabled boolean,default_track jsonb,route_overrides jsonb,revision bigint,updated_by uuid,updated_at timestamptz);
    alter table public.site_music_configuration enable row level security;
    grant select,update on public.site_music_configuration to service_role;
    insert into public.site_music_configuration values(true,true,'{}','[]',1,null,now());
    insert into auth.users values('${owner}','owner@example.test',now()),('${staff}','staff@example.test',now());
    insert into public.characters values('${ownerCharacter}','${owner}','Owner'),('${first}','${staff}','First'),('${alternate}','${staff}','Alternate');`)
  for (const name of [
    '20260815205500_server_architecture_foundation.sql',
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
    '20260918233000_phase5_persistent_event_kernel.sql',
    '20260919043000_phase5_event_participation_ledger.sql',
    '20260919051500_phase4_event_terminal_cleanup.sql',
    '20260919053000_phase4_event_builder_mvp.sql',
    '20260919053500_phase4_event_builder_authority_hardening.sql',
    '20260919053700_phase4_event_authoring_audit.sql',
    '20260919054500_phase4_live_event_operations.sql',
    '20260919055500_phase4_live_event_operations_audit.sql',
    '20260928042812_combat_content_essence_resonance_kinds.sql',
    '20261003040911_combat_effect_timing_policy.sql',
    '20261015071731_combat_controlled_timing.sql',
    '20261007101310_battlefield_elevation_policy.sql',
    '20261011030821_world_environment_controls.sql',
    '20261015073458_remove_combat_timing_reason.sql',
    '20261015095150_typed_combat_authoring_kinds.sql',
    '20261015100834_combat_content_catalogue_snapshot.sql',
    '20261015103321_combat_catalogue_publication_guard.sql',
    '20261015191634_combat_content_version_floor.sql',
    '20261018141646_modular_global_tag_timing.sql',
  ])
    await db.exec(sql(name))
  const migration = readdirSync(directory).find((name) =>
    name.endsWith('_selected_character_staff_authority.sql'),
  )
  if (migration) await db.exec(sql(migration))
}, 30_000)
beforeEach(async () => {
  await db.exec(`delete from app_private.master_panel_capability_grants;
    delete from app_private.master_panel_role_assignments where role<>'game-owner';
    insert into app_private.master_panel_role_assignments(user_id,role) values('${staff}','content-staff');
    update public.site_music_configuration set revision=1;`)
})
afterAll(async () => {
  await db?.close()
})
async function service(query: string, args: unknown[] = []) {
  await db.exec('set role service_role')
  try {
    return await db.query<Record<string, unknown>>(query, args)
  } finally {
    await db.exec('reset role')
  }
}
async function currentVersion() {
  return Number(
    (
      await db.query<{ access_version: number }>(
        'select access_version from app_private.master_panel_access_versions where user_id=$1',
        [staff],
      )
    ).rows[0]?.access_version ?? 1,
  )
}
async function assign(days: number | null = null, bind = true) {
  return service('select public.set_master_panel_character_access_v2($1,$2,$3,$4,$5,$6,$7,$8)', [
    ownerCharacter,
    owner,
    first,
    ['content-staff'],
    [],
    days,
    bind,
    await currentVersion(),
  ])
}
it('legacy_needs_binding: closes the real predecessor account authority RPC', async () => {
  await expect(
    service('select * from public.read_master_panel_access_v1($1)', [staff]),
  ).rejects.toThrow(/permission denied/)
  expect(
    (await service('select * from public.read_master_panel_access_v1($1,$2)', [first, staff])).rows,
  ).toEqual([])
  await expect(assign(null, false)).rejects.toThrow(/LEGACY_BINDING_REQUIRED/)
})
it('selected_only_grant / alternate_character_denied / switch_recalculates', async () => {
  await assign(null, true)
  expect(
    (await service('select * from public.read_master_panel_access_v1($1,$2)', [first, staff])).rows,
  ).toMatchObject([{ roles: ['content-staff'], character_id: first }])
  expect(
    (await service('select * from public.read_master_panel_access_v1($1,$2)', [alternate, staff]))
      .rows,
  ).toEqual([])
  expect(
    (await service('select * from public.read_master_panel_access_v1($1,$2)', [first, staff])).rows,
  ).toHaveLength(1)
  await expect(
    service('select * from public.read_master_panel_access_v1($1,$2)', [ownerCharacter, staff]),
  ).rejects.toThrow(/CHARACTER_REQUIRED/)
})
it('direct_rpc_capability: protects latest complete Essence publication and older drafts', async () => {
  await assign()
  await expect(
    service('select * from public.save_combat_content_draft_v1($1,$2,$3,$4,$5::jsonb,null,null)', [
      alternate,
      staff,
      'staff.skill',
      'skill',
      JSON.stringify({ id: 'staff.skill', contentVersion: 1 }),
    ]),
  ).rejects.toThrow(/OPERATOR_REQUIRED/)
  const token = (await service("select public.read_combat_content_catalogue_v1()->>'token' token"))
    .rows[0]!.token
  const definition = {
    essenceId: 'staff.essence',
    sourceDisciplineId: 'vanguard',
    contentVersion: 1,
    skill: { id: 'staff.essence', contentVersion: 1, text: 'Complete nested content' },
  }
  await expect(
    service('select * from public.publish_combat_content_v3($1,$2,$3,$4,$5::jsonb,null,$6,9)', [
      alternate,
      staff,
      'staff.essence',
      'essence',
      JSON.stringify(definition),
      token,
    ]),
  ).rejects.toThrow(/OPERATOR_REQUIRED/)
  const result = await service(
    'select * from public.publish_combat_content_v3($1,$2,$3,$4,$5::jsonb,null,$6,9)',
    [first, staff, 'staff.essence', 'essence', JSON.stringify(definition), token],
  )
  expect(result.rows[0]).toMatchObject({
    content_version: 10,
    definition: {
      sourceDisciplineId: 'vanguard',
      skill: { contentVersion: 10, text: 'Complete nested content' },
    },
  })
  await expect(
    service('select * from public.publish_combat_content_v3($1,$2,$3,$4::jsonb,null,$5,9)', [
      staff,
      'staff.essence',
      'essence',
      JSON.stringify(definition),
      token,
    ]),
  ).rejects.toThrow(/permission denied/)
  expect(
    (
      await service(
        "select * from public.read_combat_content_version_v1('staff.essence','essence',10)",
      )
    ).rows,
  ).toHaveLength(1)
})
it('utc_expiry_boundary / expired_revoked_open_session: rereads the live grant on every call', async () => {
  await assign(1)
  const grant = (
    await db.query<Record<string, unknown>>(
      'select expires_at,granted_at from app_private.master_panel_role_assignments where character_id=$1 and enabled',
      [first],
    )
  ).rows[0]!
  expect(
    new Date(grant.expires_at as string).getTime() - new Date(grant.granted_at as string).getTime(),
  ).toBe(86_400_000)
  await db.query<Record<string, unknown>>(
    'update app_private.master_panel_role_assignments set expires_at=clock_timestamp() where character_id=$1',
    [first],
  )
  expect(
    (await service('select * from public.read_master_panel_access_v1($1,$2)', [first, staff])).rows,
  ).toEqual([])
  await expect(
    service("select * from public.read_combat_content_draft_v1($1,$2,'staff.skill')", [
      first,
      staff,
    ]),
  ).rejects.toThrow(/OPERATOR_REQUIRED/)
  await assign()
  await service('select public.revoke_master_panel_character_access_v2($1,$2,$3,$4)', [
    ownerCharacter,
    owner,
    first,
    await currentVersion(),
  ])
  expect(
    (await service('select * from public.read_master_panel_access_v1($1,$2)', [first, staff])).rows,
  ).toEqual([])
  await expect(
    service("select * from public.read_combat_content_draft_v1($1,$2,'staff.skill')", [
      first,
      staff,
    ]),
  ).rejects.toThrow(/OPERATOR_REQUIRED/)
})
it('owner_single_non_delegable / self_elevation_denied', async () => {
  await expect(
    service('select public.set_master_panel_character_access_v2($1,$2,$3,$4,$5,null,false,null)', [
      ownerCharacter,
      owner,
      first,
      ['game-owner'],
      [],
    ]),
  ).rejects.toThrow(/ROLE_INVALID/)
  await expect(
    service('select public.set_master_panel_character_access_v2($1,$2,$3,$4,$5,null,false,null)', [
      first,
      staff,
      alternate,
      ['content-staff'],
      [],
    ]),
  ).rejects.toThrow(/OWNER_REQUIRED/)
  await expect(assign(0)).rejects.toThrow(/EXPIRY_INVALID/)
  await expect(
    service('select public.set_master_panel_character_access_v2($1,$2,$3,$4,$5,null,false,null)', [
      ownerCharacter,
      owner,
      ownerCharacter,
      ['moderator'],
      [],
    ]),
  ).rejects.toThrow(/SELF_GRANT/)
  await expect(
    db.exec(
      `insert into app_private.master_panel_role_assignments(user_id,role) values('${staff}','game-owner')`,
    ),
  ).rejects.toThrow(/unique/)
})
it('reason_free_attribution: automatic actor, character, time and before/after without a fake reason', async () => {
  await assign()
  const audit = (
    await db.query<Record<string, unknown>>(
      'select * from app_private.master_panel_access_audit order by id desc limit 1',
    )
  ).rows[0]!
  expect(audit).toMatchObject({
    actor_user_id: owner,
    actor_character_id: ownerCharacter,
    target_user_id: staff,
    target_character_id: first,
    note: null,
    action: 'role.granted',
  })
  expect(audit.created_at).toBeTruthy()
  expect(audit.before_state).toBeTruthy()
  expect(audit.after_state).toBeTruthy()
})
it('music mutation checks current selected Owner authority atomically', async () => {
  await expect(
    service("select public.save_site_music_configuration_v2($1,$2,1,true,'{}','[]')", [
      first,
      staff,
    ]),
  ).rejects.toThrow(/OWNER_REQUIRED/)
  const saved = await service(
    "select public.save_site_music_configuration_v2($1,$2,1,true,'{}','[]') as configuration",
    [ownerCharacter, owner],
  )
  expect(saved.rows[0]!.configuration).toMatchObject({ revision: 2, updated_by: owner })
  await expect(service('update public.site_music_configuration set enabled=false')).rejects.toThrow(
    /permission denied/,
  )
})
it('real Event authoring and scope capabilities do not inherit from legacy or alternate characters', async () => {
  await assign()
  await service(
    'select public.set_master_panel_character_access_v2($1,$2,$3,$4,$5,null,false,$6)',
    [
      ownerCharacter,
      owner,
      first,
      ['event-staff'],
      ['events.global_scope', 'events.production_publish'],
      await currentVersion(),
    ],
  )
  expect(
    (
      await service('select * from public.read_event_definition_draft_v1($1,$2,$3)', [
        first,
        staff,
        'staff.event',
      ])
    ).rows,
  ).toEqual([])
  await expect(
    service('select * from public.read_event_definition_draft_v1($1,$2,$3)', [
      alternate,
      staff,
      'staff.event',
    ]),
  ).rejects.toThrow(/EVENT_STAFF_REQUIRED/)
  // Exercise the genuine private nested assertion as the local database owner.
  // Its product ACL is never relaxed for this fixture.
  await db.query("select app_private.assert_event_production_publish_v1($1,$2,'global')", [
    first,
    staff,
  ])
  await db.query<Record<string, unknown>>(
    'update app_private.master_panel_capability_grants set expires_at=statement_timestamp() where character_id=$1',
    [first],
  )
  await expect(
    db.query("select app_private.assert_event_production_publish_v1($1,$2,'global')", [
      first,
      staff,
    ]),
  ).rejects.toThrow(/CAPABILITY_REQUIRED/)
  await expect(
    service("select app_private.assert_event_production_publish_v1($1,$2,'global')", [
      first,
      staff,
    ]),
  ).rejects.toThrow(/permission denied/)
})
it('Owner settings/history and latest timing/elevation retain selected ownership and Owner-only SQL parity', async () => {
  await expect(
    service("select public.publish_battlefield_elevation_policy_v1($1,$2,1,'{}','test')", [
      first,
      staff,
    ]),
  ).rejects.toThrow(/OWNER_REQUIRED/)
  await expect(
    service("select public.set_world_environment_v1($1,$2,0,'{}','test reason')", [first, staff]),
  ).rejects.toThrow(/OWNER_REQUIRED/)
  await expect(
    service('select public.read_world_environment_history_v1($1,$2,20)', [first, staff]),
  ).rejects.toThrow(/OWNER_REQUIRED/)
  expect(
    (
      await service('select public.read_world_environment_history_v1($1,$2,20) as history', [
        ownerCharacter,
        owner,
      ])
    ).rows[0]!.history,
  ).toEqual([])
  await expect(service('select public.read_world_environment_history_v1(20)')).rejects.toThrow(
    /permission denied/,
  )
  const token = (await service("select public.read_combat_content_catalogue_v1()->>'token' token"))
    .rows[0]!.token
  await expect(
    service("select public.publish_combat_effect_timing_policy_v2($1,$2,1,'{}',$3)", [
      first,
      staff,
      token,
    ]),
  ).rejects.toThrow(/OWNER_REQUIRED/)
})
it('directory edits report the current scope and an explicit legacy bind does not stay pending', async () => {
  await assign(1)
  await service(
    'select public.set_master_panel_character_access_v2($1,$2,$3,$4,$5,null,false,$6)',
    [ownerCharacter, owner, first, ['moderator'], [], await currentVersion()],
  )
  const rows = (
    await service('select * from public.list_master_panel_staff_v1($1,$2)', [ownerCharacter, owner])
  ).rows
  expect(rows.find((r) => r.character_id === first)).toMatchObject({
    roles: ['moderator'],
    status: 'active',
    expires_at: null,
  })
  expect(rows.find((r) => r.user_id === staff && r.character_id === null)).toMatchObject({
    roles: [],
    status: 'revoked',
  })
})
it('revokes an unbound legacy grant without changing the bound character', async () => {
  await assign()
  await service(
    'select public.set_master_panel_character_access_v2($1,$2,$3,$4,$5,null,false,$6)',
    [ownerCharacter, owner, first, ['moderator'], [], await currentVersion()],
  )
  await db.query<Record<string, unknown>>(
    "insert into app_private.master_panel_role_assignments(user_id,role) values($1,'event-staff')",
    [staff],
  )
  await service('select public.revoke_master_panel_legacy_access_v2($1,$2,$3,$4)', [
    ownerCharacter,
    owner,
    staff,
    await currentVersion(),
  ])
  expect(
    (await service('select * from public.read_master_panel_access_v1($1,$2)', [first, staff]))
      .rows[0],
  ).toMatchObject({ roles: ['moderator'] })
  expect(
    (
      await db.query<Record<string, unknown>>(
        'select enabled from app_private.master_panel_role_assignments where user_id=$1 and character_id is null',
        [staff],
      )
    ).rows.every((r) => r.enabled === false),
  ).toBe(true)
})
it('a direct RPC cannot bypass an existing character edit/revoke version by submitting null', async () => {
  await assign()
  await expect(
    service('select public.set_master_panel_character_access_v2($1,$2,$3,$4,$5,null,false,null)', [
      ownerCharacter,
      owner,
      first,
      ['moderator'],
      [],
    ]),
  ).rejects.toThrow(/VERSION_CONFLICT/)
  await expect(
    service('select public.revoke_master_panel_character_access_v2($1,$2,$3,null)', [
      ownerCharacter,
      owner,
      first,
    ]),
  ).rejects.toThrow(/VERSION_CONFLICT/)
})
it('installed protected RPCs require selected-character arguments and retain private/browser ACLs', async () => {
  const protectedFunctions = await db.query<{
    name: string
    arguments: string
    browser_access: boolean
  }>(`select p.proname as name,pg_get_function_identity_arguments(p.oid) as arguments,
    has_function_privilege('anon',p.oid,'execute') or has_function_privilege('authenticated',p.oid,'execute') as browser_access
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prokind='f'
      and p.prosrc ~ 'master_panel_(role_assignments|capability_grants|operators)|app_private.assert_(game_owner|master_panel_operator|event_staff_author)_v1'
      and has_function_privilege('service_role',p.oid,'execute')`)
  expect(protectedFunctions.rows.length).toBeGreaterThan(20)
  expect(
    protectedFunctions.rows.every(
      (f) => f.arguments.includes('p_actor_character_id uuid') && !f.browser_access,
    ),
  ).toBe(true)
  const tables = await db.query<{ relrowsecurity: boolean }>(
    "select relrowsecurity from pg_class where oid in ('app_private.master_panel_role_assignments'::regclass,'app_private.master_panel_capability_grants'::regclass,'app_private.master_panel_access_audit'::regclass)",
  )
  expect(tables.rows).toHaveLength(3)
  expect(tables.rows.every((t) => t.relrowsecurity)).toBe(true)
})
it('verified identity lookup returns every linked character through either discovery route', async () => {
  const byEmail = await service('select * from public.resolve_master_panel_accounts_v2($1,$2,$3)', [
    ownerCharacter,
    owner,
    'staff@example.test',
  ])
  const byName = await service('select * from public.resolve_master_panel_accounts_v2($1,$2,$3)', [
    ownerCharacter,
    owner,
    'Alternate',
  ])
  expect(byName.rows).toEqual(byEmail.rows)
  expect(byEmail.rows[0]).toMatchObject({
    user_id: staff,
    email: 'staff@example.test',
    characters: expect.arrayContaining([
      { id: first, name: 'First', playable: true },
      { id: alternate, name: 'Alternate', playable: true },
    ]),
  })
  await expect(
    service('select * from public.resolve_master_panel_accounts_v2($1,$2,$3)', [
      first,
      staff,
      'Owner',
    ]),
  ).rejects.toThrow(/OWNER_REQUIRED/)
})
it('independent grants on two linked characters coexist and revocation affects only its target', async () => {
  await assign()
  await service(
    'select public.set_master_panel_character_access_v2($1,$2,$3,$4,$5,null,false,null)',
    [ownerCharacter, owner, alternate, ['event-staff'], []],
  )
  await service('select public.revoke_master_panel_character_access_v2($1,$2,$3,$4)', [
    ownerCharacter,
    owner,
    first,
    await currentVersion(),
  ])
  expect(
    (await service('select * from public.read_master_panel_access_v1($1,$2)', [first, staff])).rows,
  ).toEqual([])
  expect(
    (await service('select * from public.read_master_panel_access_v1($1,$2)', [alternate, staff]))
      .rows[0],
  ).toMatchObject({ roles: ['event-staff'] })
})
it('a selected character pending deletion cannot use a surviving grant', async () => {
  await assign()
  await db.query('insert into app_private.character_deletion_requests values($1)', [first])
  try {
    await expect(
      service('select * from public.read_combat_content_draft_v1($1,$2,$3)', [
        first,
        staff,
        'staff.skill',
      ]),
    ).rejects.toThrow(/CHARACTER_REQUIRED/)
  } finally {
    await db.query('delete from app_private.character_deletion_requests where character_id=$1', [
      first,
    ])
  }
})

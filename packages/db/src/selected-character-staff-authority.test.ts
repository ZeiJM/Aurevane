import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import { beforeAll, afterAll, expect, it } from 'vitest'
const root = resolve(process.cwd(), '../../supabase/migrations')
const sql = (name: string) => readFileSync(resolve(root, name), 'utf8')
const owner = '11111111-1111-4111-8111-111111111111'
const staff = '22222222-2222-4222-8222-222222222222'
const chosen = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
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
}, 30000)
afterAll(async () => {
  await db?.close()
})
it('executes the native Staff gate SQL against the real predecessor authority and protected consumers', async () => {
  const other = '33333333-3333-4333-8333-333333333333'
  await db.exec('begin')
  try {
    await db.query('insert into auth.users values($1,$2,now())', [other, 'other@example.com'])
    await db.query(
      `select set_config('task8.owner',$1,true),set_config('task8.staff',$2,true),
        set_config('task8.other',$3,true),set_config('task8.character',$4,true),
        set_config('task8.alternate',$5,true),set_config('task8.character_name','Chosen',true)`,
      [owner, staff, other, chosen, alternate],
    )
    await db.exec(
      readFileSync(
        resolve(root, '../../.github/scripts/verify-master-panel-staff-authority.sql'),
        'utf8',
      ),
    )
  } finally {
    await db.exec('rollback')
  }
})
it('legacy_needs_binding: real migrated account grants no longer authorize old account access', async () => {
  const directory = (
    await db.query<{ directory: { userId: string; status: string; characterId: string | null }[] }>(
      'select public.list_master_panel_staff_v2($1) directory',
      [owner],
    )
  ).rows[0]!.directory
  expect(directory.find((row) => row.userId === staff)).toMatchObject({
    status: 'needs-binding',
    characterId: null,
  })
  expect(directory.find((row) => row.userId === owner)).toMatchObject({
    status: 'owner',
    characterId: null,
  })
  expect(
    (await db.query('select * from public.read_master_panel_access_v1($1)', [staff])).rows,
  ).toEqual([])
})
it('alternate_character_denied: predecessor direct draft RPC cannot inherit the account grant', async () => {
  await expect(
    db.query('select * from public.read_combat_content_draft_v1($1,$2)', [staff, 'staff.skill']),
  ).rejects.toThrow(/REQUIRED/)
})
it('owner_single_non_delegable: existing bootstrap identity still has root authority', async () => {
  expect(
    (await db.query('select roles from public.read_master_panel_access_v1($1)', [owner])).rows,
  ).toEqual([{ roles: ['game-owner'] }])
  await expect(
    db.exec(
      `insert into app_private.master_panel_role_assignments(user_id,role) values('${staff}','game-owner')`,
    ),
  ).rejects.toThrow(/unique/)
})

async function assign(
  roles = ['content-staff'],
  caps: string[] = [],
  days: number | null = null,
  enabled = true,
) {
  const version =
    (
      await db.query<{ access_version: number }>(
        'select access_version from app_private.master_panel_character_access where character_id=$1',
        [chosen],
      )
    ).rows[0]?.access_version ?? 0
  return db.query(
    'select public.set_master_panel_character_access_v2($1,$2,$3,$4::text[],$5::text[],$6,$7,$8)',
    [owner, staff, chosen, roles, caps, days, version, enabled],
  )
}
it('selected_only_grant and switch_recalculates: only the explicitly bound linked character authorizes actual draft and relationship consumers', async () => {
  await assign()
  expect(
    (await db.query('select roles from public.read_master_panel_access_v1($1,$2)', [staff, chosen]))
      .rows,
  ).toEqual([{ roles: ['content-staff'] }])
  expect(
    (await db.query('select * from public.read_master_panel_access_v1($1,$2)', [staff, alternate]))
      .rows,
  ).toEqual([])
  for (const kind of ['skill', 'essence', 'resonance', 'status', 'effect-profile']) {
    const key = 'staff.' + kind
    await db.query(
      'select * from public.save_combat_content_draft_v1($1,$2,$3,$4,$5::jsonb,null,null)',
      [staff, chosen, key, kind, JSON.stringify({ id: key })],
    )
    await expect(
      db.query('select * from public.read_combat_content_draft_v1($1,$2,$3)', [
        staff,
        alternate,
        key,
      ]),
    ).rejects.toThrow(/REQUIRED/)
    expect(
      (
        await db.query('select content_key from public.read_combat_content_draft_v1($1,$2,$3)', [
          staff,
          chosen,
          key,
        ])
      ).rows,
    ).toEqual([{ content_key: key }])
  }
})
it('expired_revoked_open_session and utc_expiry_boundary: the next actual protected call rechecks the current row', async () => {
  await assign(['content-staff'], [], 1)
  const expiry = (
    await db.query<{ days: number }>(
      'select extract(epoch from expires_at-statement_timestamp())/86400 days from app_private.master_panel_character_access where character_id=$1',
      [chosen],
    )
  ).rows[0]!
  expect(Number(expiry.days)).toBeCloseTo(1, 3)
  await db.query(
    'update app_private.master_panel_character_access set expires_at=statement_timestamp() where character_id=$1',
    [chosen],
  )
  await expect(
    db.query('select * from public.read_combat_content_draft_v1($1,$2,$3)', [
      staff,
      chosen,
      'staff.skill',
    ]),
  ).rejects.toThrow(/REQUIRED/)
  // One simple-query message shares statement_timestamp across these statements:
  // this proves equality is denied, rather than only checking a later instant.
  const boundary = await db.exec(`
    begin;
    set local timezone='America/New_York';
    update app_private.master_panel_character_access set expires_at=statement_timestamp() where character_id='${chosen}';
    select (select expires_at=statement_timestamp() from app_private.master_panel_character_access where character_id='${chosen}') exact,
      exists(select 1 from public.read_master_panel_access_v1('${staff}','${chosen}')) allowed;
    rollback;
  `)
  expect(boundary[3]!.rows).toEqual([{ exact: true, allowed: false }])
  await assign(['content-staff'], [], null, false)
  await expect(
    db.query('select * from public.read_combat_content_draft_v1($1,$2,$3)', [
      staff,
      chosen,
      'staff.skill',
    ]),
  ).rejects.toThrow(/REQUIRED/)
  await assign()
  expect(
    (
      await db.query(
        'select expires_at from app_private.master_panel_character_access where character_id=$1',
        [chosen],
      )
    ).rows[0],
  ).toEqual({ expires_at: null })
  await expect(assign(['content-staff'], [], 0)).rejects.toThrow(/EXPIRY_INVALID/)
})
it('direct_rpc_capability: real event scope and emergency helpers use live selected grants rather than predecessor capability rows', async () => {
  await db.exec(
    `insert into app_private.master_panel_role_assignments(user_id,role) values('${staff}','event-staff'); insert into app_private.master_panel_capability_grants(user_id,capability,note) values('${staff}','events.global_scope','Predecessor grant');`,
  )
  await assign(['event-staff'])
  await expect(
    db.query('select app_private.assert_event_operational_scope_v1($1,$2,$3)', [
      staff,
      chosen,
      'global',
    ]),
  ).rejects.toThrow(/CAPABILITY_REQUIRED/)
  await expect(
    db.query('select app_private.assert_event_emergency_stop_v1($1,$2)', [staff, chosen]),
  ).rejects.toThrow(/CAPABILITY_REQUIRED/)
  await assign(
    ['event-staff'],
    ['events.global_scope', 'events.production_publish', 'events.emergency_stop'],
  )
  await db.query('select app_private.assert_event_production_publish_v1($1,$2,$3)', [
    staff,
    chosen,
    'global',
  ])
  await db.query('select app_private.assert_event_emergency_stop_v1($1,$2)', [staff, chosen])
  await expect(
    db.query('select app_private.assert_event_emergency_stop_v1($1)', [staff]),
  ).rejects.toThrow(/REQUIRED/)
  await expect(
    db.query('select * from public.read_event_definition_draft_v1($1,$2,$3)', [
      staff,
      alternate,
      'example.event',
    ]),
  ).rejects.toThrow(/REQUIRED/)
})
it('deleted/unowned selection is denied even while a live grant exists', async () => {
  await assign()
  await db.query('insert into app_private.character_deletion_requests values($1)', [chosen])
  expect(
    (await db.query('select * from public.read_master_panel_access_v1($1,$2)', [staff, chosen]))
      .rows,
  ).toEqual([])
  await db.exec('delete from app_private.character_deletion_requests')
  await db.query('update public.characters set user_id=$1 where id=$2', [owner, chosen])
  expect(
    (await db.query('select * from public.read_master_panel_access_v1($1,$2)', [staff, chosen]))
      .rows,
  ).toEqual([])
  await db.query('update public.characters set user_id=$1 where id=$2', [staff, chosen])
})
it('self_elevation_denied, reason_free_attribution and optimistic concurrency survive direct calls', async () => {
  await expect(
    db.query(
      'select public.set_master_panel_character_access_v2($1,$2,$3,$4::text[],$5::text[],null,0,true)',
      [staff, staff, chosen, ['content-staff'], []],
    ),
  ).rejects.toThrow(/OWNER_REQUIRED/)
  await expect(assign(['game-owner'])).rejects.toThrow(/INVALID/)
  await assign()
  const audit = (
    await db.query<{ created_at: Date }>(
      'select actor_user_id,target_character_id,action,note,created_at from app_private.master_panel_access_audit where target_character_id=$1 order by id desc limit 1',
      [chosen],
    )
  ).rows[0]!
  expect(audit).toMatchObject({
    actor_user_id: owner,
    target_character_id: chosen,
    action: 'role.granted',
    note: null,
  })
  expect(audit.created_at).toBeTruthy()
  await expect(
    db.query(
      'select public.set_master_panel_character_access_v2($1,$2,$3,$4::text[],$5::text[],null,0,true)',
      [owner, staff, chosen, ['content-staff'], []],
    ),
  ).rejects.toThrow(/VERSION_CONFLICT/)
})
it('verified identity discovery returns all linked characters by name or email, privately', async () => {
  for (const query of ['Chosen', 'staff@example.com']) {
    const result = (
      await db.query<{ identity: { userId: string; characters: unknown[] } }>(
        'select public.resolve_master_panel_account_v2($1,$2) identity',
        [owner, query],
      )
    ).rows[0]!.identity
    expect(result.userId).toBe(staff)
    expect(result.characters).toHaveLength(2)
  }
  await expect(
    db.query('select public.resolve_master_panel_account_v2($1,$2)', [staff, 'owner@example.com']),
  ).rejects.toThrow(/OWNER_REQUIRED/)
  await db.query('update auth.users set email_confirmed_at=null where id=$1', [staff])
  expect(
    (
      await db.query('select public.resolve_master_panel_account_v2($1,$2) identity', [
        owner,
        'Chosen',
      ])
    ).rows[0],
  ).toEqual({ identity: null })
})
it('all explicit actor overload ACLs reject browser execution and preserve predecessor service-only grants', async () => {
  const functions = (
    await db.query<{
      schema: string
      name: string
      identity: string
      anon: boolean
      authenticated: boolean
      service: boolean
    }>(
      `select n.nspname schema,p.proname name,pg_get_function_identity_arguments(p.oid) identity,has_function_privilege('anon',p.oid,'execute') anon,has_function_privilege('authenticated',p.oid,'execute') authenticated,has_function_privilege('service_role',p.oid,'execute') service from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','app_private') and 'p_actor_character_id'=any(p.proargnames)`,
    )
  ).rows
  expect(functions.length).toBe(35)
  for (const fn of functions) {
    expect(fn.anon, fn.name).toBe(false)
    expect(fn.authenticated, fn.name).toBe(false)
    if (fn.schema === 'app_private') expect(fn.service, fn.name).toBe(false)
    else {
      const oldArgs = fn.identity
        .replace(/p_actor_character_id uuid,?\s*/, '')
        .replace(/,\s*$/, '')
        .replace(/p_\w+ /g, '')
      const previous = (
        await db.query<{ allowed: boolean }>(
          "select has_function_privilege($1,$2,'execute') allowed",
          ['service_role', `${fn.schema}.${fn.name}(${oldArgs})`],
        )
      ).rows[0]!.allowed
      expect(fn.service, fn.name).toBe(previous)
    }
  }
})
it('actual selected publish v3 retains catalogue CAS, immutable history and relationship ownership boundaries', async () => {
  await db.query('update auth.users set email_confirmed_at=now() where id=$1', [staff])
  await assign()
  const token = (
    await db.query<{ token: string }>(
      "select public.read_combat_content_catalogue_v1()->>'token' token",
    )
  ).rows[0]!.token
  const definition = {
    id: 'staff.relationship',
    disciplinePair: ['vanguard', 'arcanist'],
    contentVersion: 1,
  }
  await expect(
    db.query('select * from public.publish_combat_content_v3($1,$2,$3,$4,$5::jsonb,1,$6,null)', [
      staff,
      alternate,
      'staff.relationship',
      'resonance',
      JSON.stringify(definition),
      token,
    ]),
  ).rejects.toThrow(/REQUIRED/)
  const published = await db.query(
    'select content_kind,content_version from public.publish_combat_content_v3($1,$2,$3,$4,$5::jsonb,1,$6,null)',
    [staff, chosen, 'staff.relationship', 'resonance', JSON.stringify(definition), token],
  )
  expect(published.rows).toEqual([{ content_kind: 'resonance', content_version: 2 }])
  await expect(
    db.query('select * from public.publish_combat_content_v3($1,$2,$3,$4,$5::jsonb,2,$6,null)', [
      staff,
      chosen,
      'staff.relationship',
      'resonance',
      JSON.stringify(definition),
      token,
    ]),
  ).rejects.toThrow(/CATALOGUE_CONFLICT/)
  expect(
    (
      await db.query('select * from public.read_combat_content_version_v1($1,$2,$3)', [
        'staff.relationship',
        'resonance',
        2,
      ])
    ).rows,
  ).toHaveLength(1)
  await assign(['content-staff'], [], null, false)
  await expect(
    db.query('select * from public.list_combat_content_versions_v1($1,$2,$3)', [
      staff,
      chosen,
      'staff.relationship',
    ]),
  ).rejects.toThrow(/REQUIRED/)
  expect(
    (
      await db.query('select * from public.read_combat_content_version_v1($1,$2,$3)', [
        'staff.relationship',
        'resonance',
        2,
      ])
    ).rows,
  ).toHaveLength(1)
})
it('every retained protected staff RPC signature denies ambiguous legacy account authority', async () => {
  const functions = (
    await db.query<{ name: string; identity: string; names: string[]; types: string }>(
      `select p.proname name,pg_get_function_identity_arguments(p.oid) identity,p.proargnames names,oidvectortypes(p.proargtypes) types from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and 'p_actor_user_id'=any(p.proargnames) and not 'p_actor_character_id'=any(p.proargnames) and (p.proname like '%combat_content%' or p.proname like '%event%')`,
    )
  ).rows
  expect(functions.length).toBe(25)
  for (const fn of functions) {
    const types = fn.types.split(', '),
      names = fn.names.slice(0, types.length)
    const values = names.map((name) =>
      name === 'p_actor_user_id'
        ? staff
        : name === 'p_confirmed'
          ? true
          : name === 'p_reason'
            ? 'Reviewed test action'
            : name === 'p_scope_type'
              ? 'region'
              : name === 'p_definition'
                ? { scope: { type: 'region' } }
                : null,
    )
    const args = types.map((type, index) => `$${index + 1}::${type}`).join(',')
    await expect(
      db.query(`select * from public.${fn.name}(${args})`, values),
      fn.identity,
    ).rejects.toMatchObject({ code: '42501' })
  }
})
it('Owner/self targets, root special powers and duplicate grants are rejected; legacy administration is retired', async () => {
  for (const [targetUser, targetCharacter, roles, caps] of [
    [owner, chosen, ['content-staff'], []],
    [staff, chosen, ['content-staff'], ['staff.manage']],
    [staff, chosen, ['content-staff', 'content-staff'], []],
    [staff, chosen, ['content-staff'], ['events.global_scope', 'events.global_scope']],
  ] as const) {
    await expect(
      db.query(
        'select public.set_master_panel_character_access_v2($1,$2,$3,$4::text[],$5::text[],null,0,true)',
        [owner, targetUser, targetCharacter, roles, caps],
      ),
    ).rejects.toThrow(/PROTECTED|INVALID/)
  }
  for (const signature of [
    'grant_master_panel_role_v1(uuid,uuid,text,text)',
    'revoke_master_panel_role_v1(uuid,uuid,text,text)',
    'grant_master_panel_capability_v1(uuid,uuid,text,text)',
    'revoke_master_panel_capability_v1(uuid,uuid,text,text)',
    'list_master_panel_staff_v1(uuid)',
    'resolve_master_panel_account_v1(uuid,text)',
  ]) {
    expect(
      (
        await db.query<{ allowed: boolean }>(
          "select has_function_privilege('service_role',$1,'execute') allowed",
          ['public.' + signature],
        )
      ).rows[0]!.allowed,
    ).toBe(false)
  }
})
it('every explicit protected RPC rechecks selected character capability before real content/event execution', async () => {
  const functions = (
    await db.query<{ name: string; identity: string; names: string[]; types: string }>(
      `select p.proname name,pg_get_function_identity_arguments(p.oid) identity,p.proargnames names,oidvectortypes(p.proargtypes) types from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and 'p_actor_user_id'=any(p.proargnames) and 'p_actor_character_id'=any(p.proargnames)`,
    )
  ).rows
  expect(functions.length).toBe(25)
  for (const fn of functions) {
    const types = fn.types.split(', '),
      names = fn.names.slice(0, types.length)
    const values = names.map((name) =>
      name === 'p_actor_user_id'
        ? staff
        : name === 'p_actor_character_id'
          ? alternate
          : name === 'p_confirmed'
            ? true
            : name === 'p_reason'
              ? 'Reviewed test action'
              : name === 'p_scope_type'
                ? 'region'
                : name === 'p_definition'
                  ? { scope: { type: 'region' } }
                  : null,
    )
    const args = types.map((type, index) => `$${index + 1}::${type}`).join(',')
    await expect(
      db.query(`select * from public.${fn.name}(${args})`, values),
      fn.identity,
    ).rejects.toMatchObject({ code: '42501' })
  }
})

it('Owner defaults CAS changes immediately authorize and withdraw actual draft operations for existing selected role holders', async () => {
  await db.query('update auth.users set email_confirmed_at=now() where id=$1', [staff])
  await assign(['moderator'], ['content.story_copy'])
  const readDefaults = async () =>
    (
      await db.query<{ defaults: { revision: number; roles: Record<string, string[]> } }>(
        'select public.read_master_panel_role_defaults_v1($1) defaults',
        [owner],
      )
    ).rows[0]!.defaults
  const original = await readDefaults()
  const roles = { ...original.roles, moderator: ['master.access', 'content.combat.author'] }
  const save = (actor: string, revision: number, value: unknown) =>
    db.query('select public.save_master_panel_role_defaults_v1($1,$2,$3::jsonb) defaults', [
      actor,
      revision,
      JSON.stringify(value),
    ])
  await expect(save(staff, original.revision, roles)).rejects.toThrow(/OWNER_REQUIRED/)
  await expect(
    db.query('select public.read_master_panel_role_defaults_v1($1)', [staff]),
  ).rejects.toThrow(/OWNER_REQUIRED/)
  await expect(
    db.query('select * from public.read_combat_content_draft_v1($1,$2,$3)', [
      staff,
      chosen,
      'staff.skill',
    ]),
  ).rejects.toThrow(/REQUIRED/)
  await save(owner, original.revision, roles)
  await expect(save(owner, original.revision, original.roles)).rejects.toThrow(/VERSION_CONFLICT/)
  expect((await readDefaults()).roles.moderator).toEqual(roles.moderator)
  await db.query(
    'select * from public.save_combat_content_draft_v1($1,$2,$3,$4,$5::jsonb,null,null)',
    [staff, chosen, 'defaults.skill', 'skill', JSON.stringify({ id: 'defaults.skill' })],
  )
  expect(
    (await db.query('select * from public.read_master_panel_operator_v1($1,$2)', [staff, chosen]))
      .rows,
  ).toHaveLength(1)
  await expect(
    db.query('select * from public.read_combat_content_draft_v1($1,$2,$3)', [
      staff,
      alternate,
      'defaults.skill',
    ]),
  ).rejects.toThrow(/REQUIRED/)
  for (const invalid of [
    { ...roles, moderator: ['staff.manage'] },
    { ...roles, moderator: ['content.combat.author', 'content.combat.author'] },
    { ...roles, 'game-owner': ['staff.manage'] },
    { ...roles, moderator: ['invented'] },
  ]) {
    await expect(save(owner, original.revision + 1, invalid)).rejects.toThrow(/INVALID/)
  }
  await save(owner, original.revision + 1, original.roles)
  await expect(
    db.query('select * from public.read_combat_content_draft_v1($1,$2,$3)', [
      staff,
      chosen,
      'defaults.skill',
    ]),
  ).rejects.toThrow(/REQUIRED/)
  const access = (
    await db.query<{ effective_capabilities: string[] }>(
      'select * from public.read_master_panel_access_v2($1,$2)',
      [staff, chosen],
    )
  ).rows[0]!
  expect(access.effective_capabilities).toContain('content.story_copy')
  expect(access.effective_capabilities).not.toContain('staff.manage')
  expect(
    (await db.query('select * from public.read_master_panel_operator_v1($1,$2)', [staff, chosen]))
      .rows,
  ).toHaveLength(0)
  await assign(['moderator'], [], null, false)
  expect(
    (await db.query('select * from public.read_master_panel_access_v2($1,$2)', [staff, chosen]))
      .rows,
  ).toEqual([])
})
it('role defaults tables and RPCs deny direct browser/service table writes and browser forgery', async () => {
  for (const role of ['anon', 'authenticated', 'service_role']) {
    for (const privilege of ['SELECT', 'INSERT', 'UPDATE', 'DELETE']) {
      expect(
        (
          await db.query<{ allowed: boolean }>(
            "select has_table_privilege($1,'app_private.master_panel_role_defaults',$2) allowed",
            [role, privilege],
          )
        ).rows[0]!.allowed,
      ).toBe(false)
    }
  }
  for (const signature of [
    'read_master_panel_role_defaults_v1(uuid)',
    'save_master_panel_role_defaults_v1(uuid,bigint,jsonb)',
    'read_master_panel_access_v2(uuid,uuid)',
  ]) {
    for (const role of ['anon', 'authenticated', 'service_role']) {
      expect(
        (
          await db.query<{ allowed: boolean }>(
            "select has_function_privilege($1,$2,'execute') allowed",
            [role, 'public.' + signature],
          )
        ).rows[0]!.allowed,
      ).toBe(role === 'service_role')
    }
  }
})
it('role defaults separate live event authoring and operation gates without changing scheduling authority', async () => {
  await assign(['event-staff'])
  const original = (
    await db.query<{ defaults: { revision: number; roles: Record<string, string[]> } }>(
      'select public.read_master_panel_role_defaults_v1($1) defaults',
      [owner],
    )
  ).rows[0]!.defaults
  const save = (revision: number, capabilities: string[]) =>
    db.query('select public.save_master_panel_role_defaults_v1($1,$2,$3::jsonb)', [
      owner,
      revision,
      JSON.stringify({ ...original.roles, 'event-staff': capabilities }),
    ])
  await save(original.revision, ['master.access', 'events.author'])
  await expect(
    db.query('select * from public.list_event_operation_runs_v1($1,$2)', [staff, chosen]),
  ).rejects.toThrow(/REQUIRED/)
  await db.query('select * from public.read_event_definition_draft_v1($1,$2,$3)', [
    staff,
    chosen,
    'event.defaults',
  ])
  // Scheduling remains an authoring operation. It checks scope without requiring live-operations authority.
  await db.query('select app_private.assert_event_operational_scope_v1($1,$2,$3)', [
    staff,
    chosen,
    'region',
  ])
  await save(original.revision + 1, ['master.access', 'events.operate'])
  await db.query('select * from public.list_event_operation_runs_v1($1,$2)', [staff, chosen])
  await expect(
    db.query('select * from public.read_event_definition_draft_v1($1,$2,$3)', [
      staff,
      chosen,
      'event.defaults',
    ]),
  ).rejects.toThrow(/REQUIRED/)
  await db.query('select public.save_master_panel_role_defaults_v1($1,$2,$3::jsonb)', [
    owner,
    original.revision + 2,
    JSON.stringify(original.roles),
  ])
})

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest'
import { createEventPageAccessFixture } from '../../../apps/web/e2e/event-page-access-fixture'
let db: PGlite
const unrelated = '00000000-0000-4000-8000-000000007001'
const root = resolve(process.cwd(), '../../supabase/migrations')
const sql = (file: string) => readFileSync(resolve(root, file), 'utf8')
beforeAll(async () => {
  db = await PGlite.create()
  await db.exec(`create role service_role;create schema auth;create schema app_private;
 create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
 create table app_private.master_panel_role_assignments(user_id uuid references auth.users,role text,enabled boolean default true,primary key(user_id,role));
 create unique index single_fixture_owner on app_private.master_panel_role_assignments(role) where role='game-owner' and enabled;
 create table app_private.master_panel_role_defaults(singleton boolean primary key default true,revision bigint default 1,roles jsonb,updated_by uuid,updated_at timestamptz);
 insert into app_private.master_panel_role_defaults(roles) values('{"moderator":[],"content-staff":[],"event-staff":["events"]}');`)
  // Use the actual protected API bodies; only platform/private table fixtures are minimal.
  await db.exec(
    sql('20260918193000_phase5_staff_authority_foundation.sql').match(
      /create or replace function app_private.assert_game_owner_v1\([\s\S]*?\n\$\$;/,
    )![0],
  )
  await db.exec(
    sql('20261026062311_master_panel_role_defaults.sql').match(
      /create function public.read_master_panel_role_defaults_v1\([\s\S]*?end; \$\$;/,
    )![0],
  )
  await db.exec(
    sql('20261027123107_master_page_access_and_moderation.sql').match(
      /create or replace function public.save_master_panel_role_defaults_v1\([\s\S]*?end; \$\$;/,
    )![0],
  )
}, 30000)
afterAll(async () => db?.close())
beforeEach(async () => {
  await db.exec(
    `drop trigger if exists fail_fixture_change on app_private.master_panel_role_defaults;truncate app_private.master_panel_role_assignments,auth.users;update app_private.master_panel_role_defaults set revision=1,roles='{"moderator":[],"content-staff":[],"event-staff":["events"]}',updated_by=null,updated_at=null;`,
  )
})
function capture(existing = '0') {
  const writes: string[] = []
  const query = (text: string) => {
    if (text.startsWith('select count(*)')) return existing
    if (text.startsWith('select (roles')) return '["events"]'
    writes.push(text)
    return ''
  }
  return { writes, query }
}
async function seedUnrelated(enabled = true) {
  await db.query('insert into auth.users values($1,$2,now())', [
    unrelated,
    'unrelated@example.test',
  ])
  await db.query(
    "insert into app_private.master_panel_role_assignments(user_id,role,enabled) values($1,'game-owner',$2)",
    [unrelated, enabled],
  )
}
it('rechecks inside the transaction and preserves an unrelated Owner appearing after setup', async () => {
  const captureSql = capture(),
    fixture = createEventPageAccessFixture(captureSql.query)
  fixture.set(false)
  await seedUnrelated()
  await expect(db.exec(captureSql.writes[0]!)).rejects.toThrow('EVENT_FIXTURE_EXISTING_OWNER')
  await db.exec('rollback')
  expect(
    (await db.query('select user_id,role,enabled from app_private.master_panel_role_assignments'))
      .rows,
  ).toEqual([{ user_id: unrelated, role: 'game-owner', enabled: true }])
  expect((await db.query('select id from auth.users')).rows).toEqual([{ id: unrelated }])
  expect(
    (await db.query<{ roles: unknown }>('select roles from app_private.master_panel_role_defaults'))
      .rows[0]!.roles,
  ).toMatchObject({ 'event-staff': ['events'] })
})
it('creates and releases only its own temporary Owner while saving and restoring through the protected API', async () => {
  await seedUnrelated(false)
  const captureSql = capture(),
    fixture = createEventPageAccessFixture(captureSql.query)
  fixture.set(false)
  await db.exec(captureSql.writes[0]!)
  expect(
    (await db.query('select user_id,role,enabled from app_private.master_panel_role_assignments'))
      .rows,
  ).toEqual([{ user_id: unrelated, role: 'game-owner', enabled: false }])
  expect(
    (await db.query<{ roles: unknown }>('select roles from app_private.master_panel_role_defaults'))
      .rows[0]!.roles,
  ).toMatchObject({ 'event-staff': [] })
  fixture.restore()
  await db.exec(captureSql.writes[1]!)
  expect(
    (await db.query('select user_id,role,enabled from app_private.master_panel_role_assignments'))
      .rows,
  ).toEqual([{ user_id: unrelated, role: 'game-owner', enabled: false }])
  expect(
    (await db.query<{ roles: unknown }>('select roles from app_private.master_panel_role_defaults'))
      .rows[0]!.roles,
  ).toMatchObject({ 'event-staff': ['events'] })
})
it('rolls back its temporary identity and grant if the protected defaults write fails', async () => {
  const captureSql = capture(),
    fixture = createEventPageAccessFixture(captureSql.query)
  fixture.set(false)
  await db.exec(`create or replace function app_private.fail_fixture_change() returns trigger language plpgsql as $$ begin raise exception 'FIXTURE_CHANGE_FAILURE'; end; $$;
 create trigger fail_fixture_change before update on app_private.master_panel_role_defaults for each row execute function app_private.fail_fixture_change();`)
  await expect(db.exec(captureSql.writes[0]!)).rejects.toThrow('FIXTURE_CHANGE_FAILURE')
  await db.exec('rollback')
  expect((await db.query('select * from auth.users')).rows).toEqual([])
  expect((await db.query('select * from app_private.master_panel_role_assignments')).rows).toEqual(
    [],
  )
  expect(
    (await db.query<{ roles: unknown }>('select roles from app_private.master_panel_role_defaults'))
      .rows[0]!.roles,
  ).toMatchObject({ 'event-staff': ['events'] })
})

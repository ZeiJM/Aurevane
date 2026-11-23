import { afterAll, beforeAll, expect, it } from 'vitest'
import type { PGlite } from '@electric-sql/pglite'
import { createCombatContentTestDatabase } from './test-support/combat-content-test-database'
let db: PGlite
const owner = '00000000-0000-4000-8000-000000000001'
const user = '00000000-0000-4000-8000-000000000002'
const character = '00000000-0000-4000-8000-000000000011'
beforeAll(async () => {
  db = await createCombatContentTestDatabase()
  await db.exec(`insert into auth.users(id,email,email_confirmed_at) values('${owner}','owner@example.test',now()),('${user}','player@example.test',now());
 insert into app_private.master_panel_role_assignments(user_id,role) values('${owner}','game-owner');
 insert into public.characters(id,user_id,slot_index,rules_version,name,name_key,presentation_id,pronoun_preset_id,portrait_ref,starter_appearance_ref,foundation_discipline_id,might,finesse,vitality,agility,intellect,resolve,level,xp,progression_cycle,created_at,cycle_started_at,last_active_at)
 values('${character}','${user}',0,1,'Verified Player','verified-player','default','they','portrait','appearance','vanguard',12,4,7,4,3,6,1,0,1,now(),now(),now());`)
}, 120000)
afterAll(async () => db?.close())
const query = (sql: string, args: unknown[] = []) => db.query(sql, args)
it('search returns verified stable accounts, guards reads and records/revokes independent grants', async () => {
  const search = await query('select public.search_discipline_grant_players_v1($1,null,$2) value', [
    owner,
    'verified',
  ])
  expect(search.rows).toEqual([
    { value: [{ accountId: user, characterId: character, name: 'Verified Player' }] },
  ])
  await expect(
    query('select public.search_discipline_grant_players_v1($1,null,$2)', [user, 'verified']),
  ).rejects.toThrow('MASTER_FORBIDDEN')
  const before = (await query('select * from app_private.character_discipline_masteries')).rows
  const write = (action: string) =>
    query('select public.write_discipline_player_grants_v1($1,null,$2,$3,$4,$5) value', [
      owner,
      'vanguard',
      [user],
      action,
      'Owner test',
    ])
  expect((await write('grant')).rows).toEqual([{ value: { changed: 1 } }])
  expect((await write('grant')).rows).toEqual([{ value: { changed: 0 } }])
  expect(
    (
      await query('select public.read_discipline_player_grants_v1($1,null,$2) value', [
        owner,
        'vanguard',
      ])
    ).rows[0],
  ).toMatchObject({ value: [{ accountId: user }] })
  expect((await write('revoke')).rows).toEqual([{ value: { changed: 1 } }])
  expect(
    (await query('select * from app_private.discipline_player_grant_audit')).rows,
  ).toHaveLength(2)
  expect((await query('select * from app_private.character_discipline_masteries')).rows).toEqual(
    before,
  )
})
it('denies forged actors, unsupported discipline, partial bad batches and browser roles', async () => {
  await expect(
    query('select public.write_discipline_player_grants_v1($1,null,$2,$3,$4,$5)', [
      user,
      'vanguard',
      [user],
      'grant',
      'reason',
    ]),
  ).rejects.toThrow('MASTER_FORBIDDEN')
  await expect(
    query('select public.write_discipline_player_grants_v1($1,null,$2,$3,$4,$5)', [
      owner,
      'missing',
      [user],
      'grant',
      'reason',
    ]),
  ).rejects.toThrow('DISCIPLINE_GRANT_UNAVAILABLE')
  await expect(
    query('select public.write_discipline_player_grants_v1($1,null,$2,$3,$4,$5)', [
      owner,
      'vanguard',
      [user, 'ffffffff-ffff-4fff-8fff-ffffffffffff'],
      'grant',
      'reason',
    ]),
  ).rejects.toThrow('DISCIPLINE_GRANT_RECIPIENT_UNAVAILABLE')
  expect(
    (await query('select 1 from app_private.discipline_player_grants where revoked_at is null'))
      .rows,
  ).toHaveLength(0)
  for (const role of ['anon', 'authenticated']) {
    await db.exec(`set role ${role}`)
    await expect(
      query('select public.read_discipline_player_grants_v1($1,null,$2)', [owner, 'vanguard']),
    ).rejects.toThrow('permission denied')
    await db.exec('reset role')
  }
})
it('grants multiple stable accounts and survives character rename without crediting Mastery', async () => {
  const second = '00000000-0000-4000-8000-000000000003'
  const secondCharacter = '00000000-0000-4000-8000-000000000012'
  await query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())', [
    second,
    'second@example.test',
  ])
  await query(
    `insert into public.characters(id,user_id,slot_index,rules_version,name,name_key,presentation_id,pronoun_preset_id,portrait_ref,starter_appearance_ref,foundation_discipline_id,might,finesse,vitality,agility,intellect,resolve,level,xp,progression_cycle,created_at,cycle_started_at,last_active_at)
 values($1,$2,0,1,'Second Player','second-player','default','they','portrait','appearance','vanguard',12,4,7,4,3,6,1,0,1,now(),now(),now())`,
    [secondCharacter, second],
  )
  const before = (
    await query(
      'select * from app_private.character_discipline_masteries order by character_id,discipline_id',
    )
  ).rows
  expect(
    (
      await query('select public.write_discipline_player_grants_v1($1,null,$2,$3,$4,$5) value', [
        owner,
        'vanguard',
        [user, second],
        'grant',
        'Two verified recipients',
      ])
    ).rows,
  ).toEqual([{ value: { changed: 2 } }])
  await query('update public.characters set name=$1,name_key=$2 where id=$3', [
    'Renamed Player',
    'renamed-player',
    character,
  ])
  const grants = (
    await query('select public.read_discipline_player_grants_v1($1,null,$2) value', [
      owner,
      'vanguard',
    ])
  ).rows[0] as { value: unknown }
  expect(grants.value).toEqual([
    expect.objectContaining({ accountId: user, name: 'Renamed Player' }),
    expect.objectContaining({ accountId: second, name: 'Second Player' }),
  ])
  expect(
    (
      await query(
        'select * from app_private.character_discipline_masteries order by character_id,discipline_id',
      )
    ).rows,
  ).toEqual(before)
})

it('runs Usage & Balance against the complete real migration chain and Owner authority', async () => {
  const result = await query('select public.read_master_usage_balance_v1($1,null,$2) value', [
    owner,
    'vanguard',
  ])
  expect(result.rows[0]).toMatchObject({
    value: {
      contentKey: 'vanguard',
      subjectKind: 'discipline',
      coverage: { legacyHistoryAvailable: false },
    },
  })
})

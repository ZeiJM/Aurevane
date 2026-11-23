import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, expect, it } from 'vitest'
import { createCombatContentTestDatabase } from './test-support/combat-content-test-database'

const grantMigration = '20261123011735_appearance_token_launch.sql'
const user = '84000000-0000-4000-8000-000000000001'
const first = '84000000-0000-4000-8000-000000000011'
const second = '84000000-0000-4000-8000-000000000012'
const late = '84000000-0000-4000-8000-000000000013'
const look =
  '/api/media/appearance/1/athletic.fair.oval.hazel.short.black.none.roadworn.umber.leather.hide.plain/neutral.svg'
let db: Awaited<ReturnType<typeof createCombatContentTestDatabase>>

beforeAll(async () => {
  db = await createCombatContentTestDatabase(async (connection, migration) => {
    if (migration !== grantMigration) return
    await connection.query(
      'insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',
      [user, 'appearance@example.test'],
    )
    for (const [slot, id] of [first, second, late].entries()) {
      await connection.query(
        `insert into public.characters(
        id,user_id,slot_index,rules_version,name,name_key,presentation_id,pronoun_preset_id,
        portrait_ref,starter_appearance_ref,foundation_discipline_id,might,finesse,vitality,
        agility,intellect,resolve,level,xp,progression_cycle,created_at,cycle_started_at,last_active_at
      ) values($1,$2,$3,1,$4,$4,'default','they','portrait','appearance','vanguard',12,4,7,4,3,6,1,0,1,$5,now(),now())`,
        [
          id,
          user,
          slot,
          `appearance${slot}`,
          id === late ? '2026-11-23T02:00:00Z' : '2026-11-23T01:00:00Z',
        ],
      )
    }
    await connection.query('select * from public.set_character_personal_title_v1($1,$2,$3)', [
      user,
      first,
      'Old Custom Title',
    ])
    await connection.query(
      "insert into public.character_profile_display (character_id,user_id,image_url) values ($1,$2,'https://example.com/portrait.webp')",
      [first, user],
    )
  })
}, 60000)
afterAll(async () => db?.close())

async function balance(id: string) {
  const result = await db.query<{ balance: number }>(
    'select public.read_character_appearance_tokens_v1($1,$2) balance',
    [user, id],
  )
  return result.rows[0]!.balance
}

it('grants 99 per existing character once, clears old titles and portraits, and allows shared switches', async () => {
  expect(await balance(first)).toBe(99)
  expect(await balance(second)).toBe(99)
  expect(await balance(late)).toBe(0)
  await db.exec(
    readFileSync(
      new URL(`../../../supabase/migrations/${grantMigration}`, import.meta.url),
      'utf8',
    ),
  )
  expect(await balance(first)).toBe(99)
  expect(await balance(late)).toBe(0)
  expect(
    (
      await db.query('select personal_title from public.get_character_personal_title_v1($1,$2)', [
        user,
        first,
      ])
    ).rows,
  ).toEqual([{ personal_title: null }])
  expect(
    (
      await db.query(
        'select image_url from public.character_profile_display where character_id = $1',
        [first],
      )
    ).rows,
  ).toEqual([{ image_url: null }])
  for (const [id, title] of [
    [first, 'Roadfarer'],
    [second, 'Roadfarer'],
    [first, 'Dawn Seeker'],
    [first, 'Horizon Wanderer'],
  ])
    expect(
      (
        await db.query(
          'select personal_title from public.set_character_personal_title_v1($1,$2,$3)',
          [user, id, title],
        )
      ).rows,
    ).toEqual([{ personal_title: title }])
  await expect(
    db.query('select * from public.set_character_personal_title_v1($1,$2,$3)', [
      user,
      first,
      'New Custom Title',
    ]),
  ).rejects.toThrow('PERSONAL_TITLE_INVALID')
})

it('spends one on a changed look, preserves retries, and rolls back a change with zero tokens', async () => {
  const commit = (id: string, revision: number, url: string) =>
    db.query('select public.commit_character_appearance_v4($1,$2,$3,$4) receipt', [
      user,
      id,
      revision,
      url,
    ])
  await commit(first, 0, look)
  expect(await balance(first)).toBe(98)
  await commit(first, 0, look)
  expect(await balance(first)).toBe(98)
  await expect(commit(second, 0, look)).rejects.toThrow('CHARACTER_APPEARANCE_DUPLICATE')
  expect(await balance(second)).toBe(99)
  await db.query(
    "delete from app_private.character_item_stacks where character_id = $1 and item_id = 'item.appearance-token'",
    [first],
  )
  await expect(commit(first, 1, look.replace('umber', 'green'))).rejects.toThrow(
    'APPEARANCE_TOKEN_REQUIRED',
  )
  expect(
    (
      await db.query(
        'select appearance_image_url,appearance_revision from public.character_profile_display where character_id=$1',
        [first],
      )
    ).rows,
  ).toEqual([{ appearance_image_url: look, appearance_revision: 1 }])
  expect(
    (
      await db.query(
        "select has_function_privilege('authenticated', 'public.commit_character_appearance_v4(uuid,uuid,integer,text)', 'EXECUTE') as allowed",
      )
    ).rows,
  ).toEqual([{ allowed: false }])
})

import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, expect, it } from 'vitest'
import { createCombatContentTestDatabase } from './test-support/combat-content-test-database'

const cutover = readFileSync(
  new URL(
    '../../../supabase/migrations/20261126180000_painted_character_cutover.sql',
    import.meta.url,
  ),
  'utf8',
)
const user = '85000000-0000-4000-8000-000000000001'
const female = '85000000-0000-4000-8000-000000000011'
const male = '85000000-0000-4000-8000-000000000012'
const approved = '85000000-0000-4000-8000-000000000013'
const npc = '85000000-0000-4000-8000-000000000021'
const legacy =
  '/api/media/appearance/1/athletic.fair.oval.hazel.short.black.none.roadworn.umber.leather.hide.plain/neutral.svg'
const alreadyPainted =
  '/api/media/appearance/6/f32.pine.natural.none.natural.none.natural.none.natural.natural.natural.layers.natural.natural.leavesfern/neutral.svg'
let db: Awaited<ReturnType<typeof createCombatContentTestDatabase>>

beforeAll(async () => {
  db = await createCombatContentTestDatabase(
    undefined,
    '20261125142500_illustrated_appearance_catalogue.sql',
  )
  await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())', [
    user,
    'painted-cutover@example.test',
  ])
  for (const [slot, id] of [female, male, approved].entries()) {
    await db.query(
      `insert into public.characters(
        id,user_id,slot_index,rules_version,name,name_key,presentation_id,pronoun_preset_id,
        portrait_ref,starter_appearance_ref,foundation_discipline_id,might,finesse,vitality,
        agility,intellect,resolve,level,xp,progression_cycle,created_at,cycle_started_at,last_active_at
      ) values($1,$2,$3,1,$4,$4,$5,'they_them',$6,'appearance.starter.roadworn','vanguard',12,4,7,4,3,6,1,0,1,now(),now(),now())`,
      [
        id,
        user,
        slot,
        `painted${slot}`,
        id === male ? 'masculine' : 'feminine',
        id === male ? 'portrait.adventure.male-01' : 'portrait.adventure.female-01',
      ],
    )
    if (id !== male)
      await db.query(
        `insert into app_private.character_item_stacks
           (character_id,item_id,inventory_category,slot_index,quantity,acquired_content_version,provenance)
         values ($1,'item.appearance-token','general',0,99,1,'test')`,
        [id],
      )
  }
  await db.query(
    `insert into public.character_profile_display
      (character_id, user_id, appearance_image_url, pending_appearance_image_url)
      values ($1,$2,$3,$3),($4,$2,$5,null)`,
    [female, user, legacy, approved, alreadyPainted],
  )
  const portraitRef = 'portrait.adventure.male-01'
  const identity = { name: 'Guide', imageUrl: legacy, portraitRef }
  await db.query(
    'insert into app_private.npc_designs(id,revision,draft,story) values($1,1,$2,$3)',
    [npc, { ...identity, uses: ['story'], arena: null }, { ...identity, id: npc, revision: 1 }],
  )
  const battle = '85000000-0000-4000-8000-000000000031'
  await db.query(
    `insert into app_private.battle_sessions
      (id,owner_user_id,battle_id,rules_version,content_version,lifecycle,current_snapshot)
      select $1,$2,'cutover-battle',1,1,'active',
        '{"tactical":{"battle":{"battleId":"cutover-battle","rulesVersion":1,"contentVersion":1,"lifecycle":"active","combatants":[{},{}],"rng":{}}}}'::jsonb ||
        jsonb_build_object('buildAuthority',jsonb_build_object('combatants',jsonb_build_array(
          public.get_character_committed_build_snapshot_v2($2,$3) ||
          jsonb_build_object('combatantId','cutover-battle','characterId',$3::uuid)
        )))`,
    [battle, user, female],
  )
  await db.query(
    `insert into app_private.battle_participants
      (battle_session_id,combatant_id,participant_role,user_id,character_id)
      values($1,'cutover-battle','player',$2,$3)`,
    [battle, user, female],
  )
  await db.query(
    'select app_private.sync_npc_appearance_claims_v2($1,array[$2::text],null,false)',
    [npc, legacy],
  )
}, 60_000)

afterAll(async () => db?.close())

async function playerState() {
  return (
    await db.query<{
      id: string
      url: string | null
      queued: string | null
      tokens: number | null
    }>(
      `select c.id, d.appearance_image_url url, d.pending_appearance_image_url queued,
              (select sum(quantity)::int from app_private.character_item_stacks s
                where s.character_id = c.id and s.item_id = 'item.appearance-token') tokens
        from public.characters c left join public.character_profile_display d on d.character_id = c.id
        order by c.id`,
    )
  ).rows
}

it('rolls back conversion if a player cannot pay, then charges once and converts players and NPCs by presentation', async () => {
  const before = await playerState()
  await expect(db.exec(cutover)).rejects.toThrow('APPEARANCE_TOKEN_REQUIRED')
  await db.exec('rollback')
  expect(await playerState()).toEqual(before)
  await db.query(
    `insert into app_private.character_item_stacks
      (character_id,item_id,inventory_category,slot_index,quantity,acquired_content_version,provenance)
      values ($1,'item.appearance-token','general',0,99,1,'test')`,
    [male],
  )
  await db.exec(cutover)
  expect(
    (
      await db.query(
        'select appearance_image_url from app_private.battle_participants where character_id=$1',
        [female],
      )
    ).rows,
  ).toEqual([{ appearance_image_url: legacy }])
  const after = await playerState()
  expect(after[0]).toMatchObject({
    id: female,
    url: expect.stringMatching(/appearance\/6\/f/),
    tokens: 98,
  })
  expect(after[0]?.queued).toMatch(/appearance\/6\/f/)
  expect(after[0]?.url).not.toBe(after[0]?.queued)
  expect(after[1]).toMatchObject({
    id: male,
    url: expect.stringMatching(/appearance\/6\/m/),
    queued: null,
    tokens: 98,
  })
  expect(after[2]).toMatchObject({ id: approved, url: alreadyPainted, tokens: 99 })
  const { rows } = await db.query<{
    draft: { imageUrl: string }
    story: { imageUrl: string; revision: number }
  }>('select draft,story from app_private.npc_designs where id=$1', [npc])
  expect(rows[0]?.story).toMatchObject({
    imageUrl: expect.stringMatching(/appearance\/6\/m/),
    revision: 2,
  })
  expect(rows[0]?.draft.imageUrl).toBe(rows[0]?.story.imageUrl)
  expect(
    (
      await db.query('select image_url from app_private.npc_appearance_claims where npc_id=$1', [
        npc,
      ])
    ).rows,
  ).toEqual([{ image_url: rows[0]?.story.imageUrl }])
  await db.exec(cutover)
  expect(await playerState()).toEqual(after)
  expect(
    (await db.query('select revision from app_private.npc_designs where id=$1', [npc])).rows,
  ).toEqual([{ revision: 2 }])
}, 60_000)

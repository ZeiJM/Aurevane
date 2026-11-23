import { expect, it } from 'vitest'
import { PAINTED_PORTRAIT_SETTINGS } from '../../../apps/web/src/appearance/appearance-painted-wardrobe'
import { createCombatContentTestDatabase } from './test-support/combat-content-test-database'

it('admits every canonical painted setting through the shared NPC and player validators', async () => {
  const db = await createCombatContentTestDatabase()
  const actor = 'a8460000-0000-4000-8000-000000000001'
  const original =
    '/api/media/appearance/6/pinescout.none.natural.none.natural.none.natural.none.natural.natural.natural.original/neutral.svg'
  const tailored =
    '/api/media/appearance/6/pinescout.brigandine.midnight.journal.ochre.circlet.gold.eyepatch.ink.strong.honey.braid.auburn.green.astral/neutral.svg'
  try {
    const candidates = Object.keys(PAINTED_PORTRAIT_SETTINGS).map((setting) =>
      original.replace('.original/', `.${setting}/`),
    )
    const check = (urls: string[]) =>
      db.query<{ url: string; valid: boolean }>(
        'select url, app_private.valid_npc_appearance_v1(to_jsonb(url)) as valid from unnest($1::text[]) url',
        [urls],
      )
    expect((await check([...candidates, tailored])).rows).toHaveLength(52)
    expect((await check([...candidates, tailored])).rows.filter(({ valid }) => !valid)).toEqual([])
    const invalid = [
      original.replace('.original/', '.invented/'),
      original.replace('.original/', '/'),
      original.replace('.original/', '.natural.natural.natural.original/'),
      original.replace('/6/', '/5/').replace('.original/', '/'),
      original.replace('.none.natural.', '.none.ochre.'),
      tailored.replace('.eyepatch.', '.invented.'),
    ]
    expect((await check(invalid)).rows.map(({ valid }) => valid)).toEqual(invalid.map(() => false))

    await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())', [
      actor,
      'painted-player-look@example.test',
    ])
    const created = await db.query<{ id: string }>(
      `select public.create_character_with_appearance_v1(
        $1,0::smallint,gen_random_uuid(),'painted-player',1,'Pine Scout','pine scout',
        'default','they','portrait.adventure.male-01','appearance.test','vanguard',2,0,2,0,0,1,null,$2
      )#>>'{0,id}' as id`,
      [actor, original],
    )
    const characterId = created.rows[0]!.id
    const save = (recipe: string) =>
      db.query<{ receipt: { imageUrl: string } }>(
        'select public.commit_character_appearance_v2($1,$2,1,$3) as receipt',
        [actor, characterId, recipe],
      )
    await expect(save(invalid[0]!)).rejects.toThrow()
    await expect(save(tailored)).resolves.toMatchObject({
      rows: [{ receipt: { imageUrl: tailored } }],
    })
  } finally {
    await db.close()
  }
}, 30_000)

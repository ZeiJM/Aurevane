import { PORTRAIT_FACES } from '../../../apps/web/src/appearance/appearance-face-catalog'
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
    candidates.push(...PORTRAIT_FACES.map(({ id }) => original.replace('pinescout.', id + '.')))
    const check = (urls: string[]) =>
      db.query<{ url: string; valid: boolean }>(
        'select url, app_private.valid_npc_appearance_v1(to_jsonb(url)) as valid from unnest($1::text[]) url',
        [urls],
      )
    expect((await check([...candidates, tailored])).rows).toHaveLength(471)
    expect((await check([...candidates, tailored])).rows.filter(({ valid }) => !valid)).toEqual([])
    const invalid = [
      original.replace('.original/', '.invented/'),
      original.replace('.original/', '/'),
      original.replace('.original/', '.natural.natural.natural.original/'),
      original.replace('/6/', '/5/').replace('.original/', '/'),
      original.replace('.none.natural.', '.none.ochre.'),
      tailored.replace('.eyepatch.', '.invented.'),
      tailored.replace('.astral/', '.scar-cross.scar-jaw.astral/'),
      tailored.replace('.astral/', '.eye-natural.astral/'),
      tailored.replace('.astral/', '.age-adult.astral/'),
      tailored.replace('.astral/', '.age-child.astral/'),
      tailored.replace('.astral/', '.age-mature.scar-cross.astral/'),
      tailored.replace('.astral/', '.scar-cross.dye-tips.astral/'),
      tailored.replace('neutral.svg', 'illustrated-neutral.svg'),
      ...['f00', 'm65', 'f001', 'fitunknown'].map((id) => original.replace('pinescout.', id + '.')),
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
    const saved = tailored
      .replace('pinescout.', 'm64keen.')
      .replace('.braid.', '.longbraid.')
      .replace(
        '.astral/',
        '.beard-full.accent-silver.dye-split.eye-blue.scar-cross.age-elder.wavejade/',
      )
    await expect(save(saved)).resolves.toMatchObject({
      rows: [{ receipt: { imageUrl: saved } }],
    })
  } finally {
    await db.close()
  }
}, 30_000)

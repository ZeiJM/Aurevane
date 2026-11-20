import { expect, it } from 'vitest'
import { createCombatContentTestDatabase } from './test-support/combat-content-test-database'

it('uses the existing Creation, Account and NPC authority for expanded painted designs', async () => {
  const db = await createCombatContentTestDatabase()
  const actor = 'a8450000-0000-4000-8000-000000000001'
  const recipe =
    '/api/media/appearance/5/scout.brigandine.ink.journal.cedar.furcap.walnut.mask.pewter.strong.honey/neutral.svg'
  const final = recipe.replace('.strong.honey', '.stocky.espresso')
  try {
    await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())', [
      actor,
      'expanded-wardrobe@example.test',
    ])
    const result = await db.query<{ id: string }>(
      `select public.create_character_with_appearance_v1(
        $1,0::smallint,gen_random_uuid(),'wardrobe-creation',1,'Wardrobe Scout','wardrobe scout',
        'default','they','portrait.adventure.male-01','appearance.test','vanguard',2,0,2,0,0,1,null,$2
      )#>>'{0,id}' as id`,
      [actor, recipe],
    )
    const charId = result.rows[0]!.id
    const profile = () =>
      db.query(
        'select confirmed_sprite_designs, appearance_revision, appearance_image_url from public.character_profile_display where character_id=$1',
        [charId],
      )
    expect((await profile()).rows).toEqual([
      { confirmed_sprite_designs: 1, appearance_revision: 1, appearance_image_url: recipe },
    ])
    const verifyNpc = (candidate: string) =>
      db.query('select app_private.valid_npc_appearance_v1(to_jsonb($1::text)) as valid', [
        candidate,
      ])
    await expect(verifyNpc(recipe)).resolves.toMatchObject({ rows: [{ valid: true }] })
    for (const invalid of [
      recipe.replace('.honey/', '.invalid/'),
      recipe.replace('.strong.', '.invalid.'),
      recipe.replace('.mask.', '.none.'),
      recipe.replace('.brigandine.', '.invented.'),
    ]) {
      await expect(verifyNpc(invalid)).resolves.toMatchObject({ rows: [{ valid: false }] })
    }
    const save = (revision: number, next: string) =>
      db.query('select public.commit_character_appearance_v3($1,$2,$3,$4) as receipt', [
        actor,
        charId,
        revision,
        next,
      ])
    const saved = await save(1, final)
    expect(saved.rows).toEqual([
      {
        receipt: { revision: 2, imageUrl: final, pendingImageUrl: null, remainingDesigns: 0 },
      },
    ])
    expect((await save(1, final)).rows).toEqual(saved.rows)
    await expect(save(2, recipe)).rejects.toThrow('CHARACTER_APPEARANCE_LOCKED')
    expect((await profile()).rows).toEqual([
      { confirmed_sprite_designs: 2, appearance_revision: 2, appearance_image_url: final },
    ])
  } finally {
    await db.close()
  }
}, 30_000)

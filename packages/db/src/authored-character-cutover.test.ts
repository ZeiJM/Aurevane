import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { expect, it } from 'vitest'

const migration = readFileSync(
  new URL(
    '../../../supabase/migrations/20261128000000_authored_character_cutover.sql',
    import.meta.url,
  ),
  'utf8',
)
const authoredValidator = readFileSync(
  new URL(
    '../../../supabase/migrations/20261127214500_authored_player_appearance_urls.sql',
    import.meta.url,
  ),
  'utf8',
)

async function createDatabase() {
  const db = new PGlite()
  await db.exec(`
    create schema app_private;
    create role anon;
    create role authenticated;
    create function app_private.valid_painted_player_look_url_v1(p_url text)
    returns boolean language plpgsql immutable set search_path = '' as $$
begin
  if p_url is null then return false; end if;
  return p_url like '/api/media/appearance/6/%';
end;
$$;
    create table public.characters (
      id int primary key, user_id int not null, presentation_id text not null, portrait_ref text
    );
    create table public.character_profile_display (
      character_id int primary key, user_id int not null, appearance_image_url text unique,
      pending_appearance_image_url text unique, updated_at timestamptz not null default now(),
      appearance_revision int not null default 0
    );
    create function app_private.bump_revision()
    returns trigger language plpgsql as $$
    begin
      new.appearance_revision := case when tg_op = 'INSERT' then 1 else old.appearance_revision + 1 end;
      return new;
    end;
    $$;
    create trigger bump_revision before insert or update on public.character_profile_display
      for each row execute function app_private.bump_revision();
    create table app_private.character_deletion_requests (character_id int primary key);
    create table app_private.character_item_stacks (character_id int primary key, quantity int);
    create table app_private.battle_participants (
      character_id int, user_id int, appearance_captured boolean default false, appearance_image_url text
    );
    create function app_private.capture_battle_character_appearance_v1()
    returns trigger language plpgsql set search_path = '' as $$ begin return new; end; $$;
    create trigger capture_appearance before insert on app_private.battle_participants
      for each row execute function app_private.capture_battle_character_appearance_v1();
  `)
  await db.exec(authoredValidator)
  return db
}

it('assigns distinct matching looks while preserving queued changes, tokens, and battle captures', async () => {
  const db = await createDatabase()
  try {
    await db.exec(`
      insert into public.characters values
        (1, 1, 'feminine', 'portrait.adventure.female-01'),
        (2, 2, 'masculine', 'portrait.adventure.male-01'),
        (3, 3, 'androgynous', 'portrait.adventure.male-04'),
        (4, 4, 'androgynous', null),
        (5, 5, 'masculine', 'portrait.adventure.male-01'),
        (6, 6, 'feminine', 'portrait.adventure.female-01');
      insert into public.character_profile_display
        (character_id, user_id, appearance_image_url, pending_appearance_image_url) values
        (1, 1, '/api/media/appearance/6/f32.legacy/neutral.svg', '/api/media/appearance/6/f05.legacy/neutral.svg'),
        (5, 5, '/api/media/appearance/7/human-m-0001.v1/neutral.svg', null);
      insert into app_private.character_deletion_requests values (6);
      insert into app_private.character_item_stacks values (1, 3), (2, 0);
      insert into app_private.battle_participants values
        (1, 1, true, '/api/media/appearance/6/f32.legacy/neutral.svg');
    `)

    await db.exec(migration)

    const { rows } = await db.query<{
      character_id: number
      appearance_image_url: string
      pending_appearance_image_url: string | null
      appearance_revision: number
    }>('select * from public.character_profile_display order by character_id')
    expect(rows.map((row) => row.character_id)).toEqual([1, 2, 3, 4, 5])
    expect(rows[0]?.appearance_image_url).toMatch(/\/7\/[a-z-]+-f-\d{4}\.v[12]\/neutral\.svg$/)
    expect(rows[0]?.pending_appearance_image_url).toMatch(
      /\/7\/[a-z-]+-f-\d{4}\.v[12]\/neutral\.svg$/,
    )
    expect(rows[0]?.appearance_revision).toBe(2)
    for (const row of rows.slice(1, 3))
      expect(row.appearance_image_url).toMatch(/\/7\/[a-z-]+-m-\d{4}\.v[12]\/neutral\.svg$/)
    expect(rows[3]?.appearance_image_url).toMatch(/\/7\/[a-z-]+-[fm]-\d{4}\.v[12]\/neutral\.svg$/)
    expect(rows[4]?.appearance_image_url).toBe(
      '/api/media/appearance/7/human-m-0001.v1/neutral.svg',
    )
    expect(
      new Set(
        rows
          .flatMap((row) => [row.appearance_image_url, row.pending_appearance_image_url])
          .filter(Boolean),
      ).size,
    ).toBe(6)
    expect(
      (
        await db.query(
          'select quantity from app_private.character_item_stacks order by character_id',
        )
      ).rows,
    ).toEqual([{ quantity: 3 }, { quantity: 0 }])
    expect(
      (await db.query('select appearance_image_url from app_private.battle_participants')).rows,
    ).toEqual([{ appearance_image_url: '/api/media/appearance/6/f32.legacy/neutral.svg' }])
    await db.exec(`
      insert into public.characters values (7, 7, 'masculine', 'portrait.adventure.male-01');
      insert into app_private.battle_participants (character_id, user_id) values (7, 7);
    `)
    expect(
      (
        await db.query(
          'select appearance_captured, appearance_image_url from app_private.battle_participants where character_id = 7',
        )
      ).rows,
    ).toEqual([
      {
        appearance_captured: true,
        appearance_image_url: '/api/media/appearance/7/human-m-0001.v1/neutral.svg',
      },
    ])
  } finally {
    await db.close()
  }
})

it('rolls back every reassignment if a gender has too few exclusive looks', async () => {
  const db = await createDatabase()
  try {
    await db.exec(`
      insert into public.characters
        select n, n, 'feminine', 'portrait.adventure.female-01' from generate_series(1, 3001) n;
    `)
    await expect(db.exec(migration)).rejects.toThrow('AUTHORED_APPEARANCE_POOL_EXHAUSTED: f')
    await db.exec('rollback')
    expect(
      (await db.query('select count(*)::int as total from public.character_profile_display')).rows,
    ).toEqual([{ total: 0 }])
  } finally {
    await db.close()
  }
})

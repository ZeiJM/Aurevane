import { execFileSync } from 'node:child_process'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, it } from 'vitest'
import { createCombatContentTestDatabase } from './test-support/combat-content-test-database'

const root = fileURLToPath(new URL('../../../', import.meta.url))
const migrationDir = resolve(root, 'supabase/migrations')
const predecessor = '20261118171500_offshore_and_water_teleport_geometry.sql'
const preservationError = 'PRESERVATION_POSTFLIGHT'

function releasePython(expression: string, args: string[] = []) {
  return execFileSync(
    'python3',
    [
      '-c',
      [
        'from pathlib import Path',
        'from runpy import run_path',
        'import sys',
        'release = run_path(".github/scripts/apply-aurevane-pr1045.py")',
        `print(${expression})`,
      ].join('\n'),
      ...args,
    ],
    { cwd: root, encoding: 'utf8' },
  )
}

it('applies the exact combined batch, aborts a preservation failure, and rejects replay', async () => {
  const db = await createCombatContentTestDatabase(undefined, predecessor)
  try {
    await db.exec(`create schema supabase_migrations;
      create table supabase_migrations.schema_migrations(version text primary key,name text,statements text[]);
    `)
    const installed = readdirSync(migrationDir)
      .filter((name) => name.endsWith('.sql') && name <= predecessor)
      .sort()
    for (const name of installed) {
      await db.query(
        'insert into supabase_migrations.schema_migrations values ($1,$2,array[$3]::text[])',
        [name.slice(0, 14), name.slice(15, -4), readFileSync(resolve(migrationDir, name), 'utf8')],
      )
    }
    await db.exec(`
      insert into auth.users(id) values ('85000000-0000-4000-8000-000000000001');
      insert into public.player_profiles(user_id)
        values ('85000000-0000-4000-8000-000000000001') on conflict do nothing;
      insert into public.characters (
        id,user_id,slot_index,rules_version,name,name_key,presentation_id,pronoun_preset_id,
        portrait_ref,starter_appearance_ref,foundation_discipline_id,might,finesse,vitality,
        agility,intellect,resolve,level,xp,progression_cycle,created_at,cycle_started_at,last_active_at
      ) values (
        '85000000-0000-4000-8000-000000000011','85000000-0000-4000-8000-000000000001',
        0,1,'Existing Sprite','existing sprite','default','they','portrait.adventure.male-01',
        'appearance.test','vanguard',12,4,7,4,3,6,1,0,1,now(),now(),now()
      );
    `)
    const version3 =
      '/api/media/appearance/3/slight.tan.braid.copper.doublet.open.split.lacing.pointed.linen.satchel.pine.original.flared/neutral.svg'
    await db.query(
      `insert into public.character_profile_display(character_id,user_id,appearance_image_url)
       values ('85000000-0000-4000-8000-000000000011','85000000-0000-4000-8000-000000000001',$1)`,
      [version3],
    )
    const stateSql = releasePython('release["state_sql"](preserve=True)')
    const snapshot = async () =>
      (
        await db.query<{
          jsonb_build_object: {
            baseline_digest: string
            ledger: [string, string][]
            preserved: Record<string, string>
            sources: Record<string, string>
          }
        }>(stateSql)
      ).rows[0]!.jsonb_build_object
    const before = await snapshot()
    const sql = releasePython(
      'release["atomic_apply_sql"](release["read_sources"](Path.cwd()), int(sys.argv[1]), sys.argv[2])',
      [String(installed.length), before.baseline_digest],
    )
    const faulty = sql.replace(
      'create temporary table aurevane_release_after',
      `update public.characters set xp=xp+1 where id='85000000-0000-4000-8000-000000000011';
      create temporary table aurevane_release_after`,
    )
    expect(faulty).not.toBe(sql)
    await expect(db.transaction((tx) => tx.exec(faulty))).rejects.toThrow(preservationError)
    expect(await snapshot()).toEqual(before)

    await db.transaction((tx) => tx.exec(sql))
    const after = await snapshot()
    expect(after.baseline_digest).toBe(before.baseline_digest)
    expect(after.preserved).toEqual(before.preserved)
    expect(after.ledger.slice(0, installed.length)).toEqual(before.ledger)
    expect(after.ledger).toHaveLength(installed.length + 12)
    expect(Object.keys(after.sources)).toHaveLength(12)
    expect(after.ledger.slice(-2).map(([version]) => version)).toEqual([
      '20261120100000',
      '20261120101000',
    ])
    expect(
      (
        await db.query(`select appearance_image_url, confirmed_sprite_designs
          from public.character_profile_display
          where character_id='85000000-0000-4000-8000-000000000011'`)
      ).rows,
    ).toEqual([{ appearance_image_url: version3, confirmed_sprite_designs: 1 }])
    await expect(db.transaction((tx) => tx.exec(sql))).rejects.toThrow('RELEASE_BASELINE_CHANGED')
    expect(await snapshot()).toEqual(after)
    const version5 =
      '/api/media/appearance/5/scout.brigandine.ink.journal.cedar.furcap.walnut.mask.pewter.stocky.espresso.twins.lilac.green/neutral.svg'
    const current = await db.query<{ appearance_revision: number }>(
      `select appearance_revision from public.character_profile_display
       where character_id='85000000-0000-4000-8000-000000000011'`,
    )
    const expectedRevision = current.rows[0]!.appearance_revision
    const saveAppearance = (revision: number, imageUrl: string) =>
      db.query(
        `select public.commit_character_appearance_v3(
          '85000000-0000-4000-8000-000000000001', '85000000-0000-4000-8000-000000000011',
          $1, $2
        ) as receipt`,
        [revision, imageUrl],
      )
    const saved = await saveAppearance(expectedRevision, version5)
    expect(saved.rows).toEqual([
      {
        receipt: {
          revision: expectedRevision + 1,
          imageUrl: version5,
          pendingImageUrl: null,
          remainingDesigns: 0,
        },
      },
    ])
    await expect(saveAppearance(expectedRevision + 1, version3)).rejects.toThrow(
      'CHARACTER_APPEARANCE_LOCKED',
    )
  } finally {
    await db.close()
  }
}, 30000)

import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, expect, it } from 'vitest'

let db: PGlite
const actor = '00000000-0000-4000-8000-000000000001'
const character = '00000000-0000-4000-8000-000000000011'
const other = '00000000-0000-4000-8000-000000000012'
const migration = readFileSync(
  new URL(
    '../../../supabase/migrations/20261027123206_master_usage_balance_reporting.sql',
    import.meta.url,
  ),
  'utf8',
)
beforeAll(async () => {
  db = await PGlite.create()
  // Completed receipts precede the report's exclusive as-of boundary. PGlite
  // can give consecutive statements the same clock value; never wait on wall time.
  await db.exec(`create role anon; create role authenticated; create role service_role; create schema app_private;
    create table public.characters(id uuid primary key,user_id uuid);
    create table app_private.character_active_builds(character_id uuid primary key,user_id uuid,primary_discipline_id text,secondary_discipline_id text);
    create table app_private.character_build_discipline_skills(character_id uuid,skill_id text,source_discipline_id text);
    create table app_private.phase4_skill_catalog(skill_id text primary key,discipline_id text);
    create table app_private.character_deletion_requests(character_id uuid);
    create table app_private.account_deletion_requests(user_id uuid primary key,requested_at timestamptz,delete_after timestamptz);
    create table app_private.battle_sessions(id uuid primary key,lifecycle text,current_snapshot jsonb,created_at timestamptz default now()-interval '2 seconds',updated_at timestamptz default now());
    create table app_private.battle_events(battle_session_id uuid,event jsonb,created_at timestamptz default now()-interval '1 second');
    create table app_private.combat_content_records(content_key text,content_kind text,lifecycle text,builtin_name text,builtin_source_discipline_id text);
    create table app_private.combat_content_publications(content_key text,version_id uuid);
    create table app_private.combat_content_versions(id uuid,definition jsonb);
    create table app_private.report_access(user_id uuid,character_id uuid,enabled boolean);
    create function app_private.has_master_capability_v2(u uuid,c uuid,cap text) returns boolean language sql as $$select exists(select 1 from app_private.report_access where user_id=u and character_id=c and enabled and cap='content.combat.author')$$;
    insert into app_private.report_access values('${actor}','${character}',true);
    insert into public.characters values('${character}','${actor}'),('${other}','${actor}');
    insert into app_private.character_active_builds values('${character}','${actor}','vanguard','lifebinder'),('${other}','${actor}','lifebinder','vanguard');
    insert into app_private.character_build_discipline_skills values('${character}','vanguard.strike','vanguard'),('${other}','vanguard.strike','vanguard');
    insert into app_private.phase4_skill_catalog values('vanguard.strike','vanguard'),('vanguard.guard','vanguard');`)
  await db.exec(migration)
  await db.exec(
    readFileSync(
      new URL(
        '../../../supabase/migrations/20261028195800_usage_balance_week_selection.sql',
        import.meta.url,
      ),
      'utf8',
    ),
  )
}, 30000)
afterAll(async () => {
  await db?.close()
})
async function read() {
  return (
    await db.query<{ report: Record<string, unknown> }>(
      'select public.read_master_usage_balance_v1($1,$2,$3) report',
      [actor, character, 'vanguard'],
    )
  ).rows[0]!.report
}
function snapshot(eligible: boolean, source = 'pvp') {
  return {
    usageBalance: { version: 1, eligible, source },
    buildAuthority: {
      combatContext: source === 'pvp' ? 'pvp' : 'pve',
      combatants: [
        {
          combatantId: 'player',
          characterId: character,
          primary: { disciplineId: 'vanguard' },
          secondary: { disciplineId: 'lifebinder' },
          disciplineSkills: [{ skillId: 'vanguard.strike' }],
        },
      ],
    },
    tactical: {
      battle: {
        combatants: [
          { id: 'player', teamId: 'a' },
          { id: 'opponent', teamId: 'b' },
        ],
      },
    },
  }
}
async function battle(id: number, eligible = true, source = 'pvp', completed = true) {
  const session = `00000000-0000-4000-8000-${String(id).padStart(12, '0')}`
  await db.query(
    'insert into app_private.battle_sessions(id,lifecycle,current_snapshot) values($1,$2,$3)',
    [session, completed ? 'completed' : 'active', snapshot(eligible, source)],
  )
  await db.query('insert into app_private.battle_events(battle_session_id,event) values($1,$2)', [
    session,
    { event: 'combat_action_used', actorId: 'player', actionId: 'vanguard.strike' },
  ])
  if (completed)
    await db.query('insert into app_private.battle_events(battle_session_id,event) values($1,$2)', [
      session,
      { event: 'battle_completed', winningTeamId: 'a' },
    ])
  return session
}
it('reports current distinct player and character counts, secondary counts and unequipped skills without exposing identities', async () => {
  const report = await read()
  expect(report.current).toMatchObject({
    primaryPlayers: 1,
    secondaryPlayers: 1,
    primaryCharacters: 1,
    secondaryCharacters: 1,
    totalPlayers: 1,
    totalCharacters: 2,
  })
  expect(report.skills).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        skillId: 'vanguard.strike',
        equippedPlayers: 1,
        equippedCharacters: 2,
      }),
      expect.objectContaining({ skillId: 'vanguard.guard', equippedPlayers: 0 }),
    ]),
  )
  expect(JSON.stringify(report)).not.toContain(actor)
  expect(JSON.stringify(report)).not.toContain(character)
})
it('collects only trusted completed battles, ignores test/unfinished/unknown-source and keeps source denominators independent', async () => {
  await battle(101)
  await battle(102, false)
  await battle(103, true, 'unknown')
  await battle(104, true, 'pvp', false)
  const ai = await battle(105, true, 'pve-recruit')
  await db.query(
    'update app_private.usage_balance_sessions set winner_team_id=null where battle_session_id=$1',
    [ai],
  )
  const report = await read()
  expect(report.weekly).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ source: 'pvp', wins: 1, losses: 0, draws: 0, appearances: 1 }),
      expect.objectContaining({
        source: 'pve-recruit',
        wins: 0,
        losses: 0,
        draws: 1,
        appearances: 1,
      }),
    ]),
  )
  expect(report.skills).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ skillId: 'vanguard.strike', actualUses: 2, usedBattles: 2 }),
    ]),
  )
  expect(report.coverage).toMatchObject({ legacyHistoryAvailable: false })
})
it('pins original battle builds, counts actual action receipts once per event, and treats an explicit null winner as a draw', async () => {
  const id = await battle(106, true, 'pvp', false)
  await db.query(
    "update app_private.battle_sessions set lifecycle='completed',current_snapshot='{}'::jsonb where id=$1",
    [id],
  )
  await db.query('insert into app_private.battle_events(battle_session_id,event) values($1,$2)', [
    id,
    { event: 'battle_completed', winningTeamId: null },
  ])
  const report = await read()
  expect(report.weekly).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ source: 'pvp', wins: 1, draws: 1, appearances: 2 }),
    ]),
  )
})
it('excludes completed receipts outside the UTC week and future timestamps; missing terminal facts are not draws', async () => {
  const old = await battle(107)
  const future = await battle(108)
  await db.query(
    "update app_private.usage_balance_sessions set completed_at=date_trunc('week',now() at time zone 'UTC') at time zone 'UTC' - interval '1 second' where battle_session_id=$1",
    [old],
  )
  await db.query(
    "update app_private.usage_balance_sessions set completed_at=now()+interval '1 day' where battle_session_id=$1",
    [future],
  )
  const incomplete = await battle(109, true, 'pvp', false)
  await db.query("update app_private.battle_sessions set lifecycle='completed' where id=$1", [
    incomplete,
  ])
  const report = await read()
  expect(report.weekly).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ source: 'pvp', wins: 1, draws: 1, appearances: 2 }),
    ]),
  )
  expect(report.coverage).toMatchObject({ collectedBattles: 3 })
})
it('uses current authored linked Skills including another source, and does not restore removed native catalogue membership', async () => {
  const publication = '00000000-0000-4000-8000-000000000200'
  await db.query(
    "insert into app_private.combat_content_records values('vanguard','discipline','active','Vanguard',null),('shadehand.shared','skill','active','Shared Step','shadehand')",
  )
  await db.query('insert into app_private.combat_content_versions values($1,$2)', [
    publication,
    { enabled: true, linkedSkills: ['shadehand.shared'] },
  ])
  await db.query("insert into app_private.combat_content_publications values('vanguard',$1)", [
    publication,
  ])
  const report = await read()
  expect(report.skills).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        skillId: 'shadehand.shared',
        name: 'Shared Step',
        equippedPlayers: 0,
      }),
    ]),
  )
  expect(report.skills).not.toEqual(
    expect.arrayContaining([expect.objectContaining({ skillId: 'vanguard.guard' })]),
  )
  await db.exec(
    'delete from app_private.combat_content_publications; delete from app_private.combat_content_versions; delete from app_private.combat_content_records',
  )
})
it('enforces live actor/selection capability and denies browser execution', async () => {
  await expect(
    db.query('select public.read_master_usage_balance_v1($1,$2,$3)', [actor, other, 'vanguard']),
  ).rejects.toThrow('MASTER_PANEL_OPERATOR_REQUIRED')
  await db.exec(`update app_private.report_access set enabled=false`)
  await expect(read()).rejects.toThrow('MASTER_PANEL_OPERATOR_REQUIRED')
  await db.exec(`update app_private.report_access set enabled=true`)
  for (const role of ['anon', 'authenticated']) {
    expect(
      (
        await db.query<{ allowed: boolean }>(
          "select has_function_privilege($1,'public.read_master_usage_balance_v1(uuid,uuid,text)','execute') allowed",
          [role],
        )
      ).rows[0]!.allowed,
    ).toBe(false)
  }
})

it('excludes a pending account deletion from current roster and equipped counts', async () => {
  await db.exec('begin')
  try {
    await db.query(
      "insert into app_private.account_deletion_requests values($1,now(),now()+interval '24 hours')",
      [actor],
    )
    const report = await read()
    expect(report.current).toMatchObject({
      primaryPlayers: 0,
      secondaryPlayers: 0,
      totalPlayers: 0,
      totalCharacters: 0,
    })
    expect(
      (report.skills as { equippedPlayers: number }[]).every((row) => row.equippedPlayers === 0),
    ).toBe(true)
  } finally {
    await db.exec('rollback')
  }
})

it('includes qualifying automatic Skill action receipts without inventing a manual-only cast count', async () => {
  const before = await read()
  const previous = (before.skills as { skillId: string; actualUses: number }[]).find(
    (row) => row.skillId === 'vanguard.strike',
  )!.actualUses
  const id = await battle(9001, true, 'pvp', false)
  await db.query('insert into app_private.battle_events(battle_session_id,event) values($1,$2)', [
    id,
    {
      event: 'combat_action_used',
      actorId: 'player',
      actionId: 'vanguard.strike',
      triggeringActorId: 'opponent',
    },
  ])
  await db.query("update app_private.battle_sessions set lifecycle='completed' where id=$1", [id])
  await db.query('insert into app_private.battle_events(battle_session_id,event) values($1,$2)', [
    id,
    { event: 'battle_completed', winningTeamId: 'a' },
  ])
  expect((await read()).skills).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ skillId: 'vanguard.strike', actualUses: previous + 2 }),
    ]),
  )
})

it('selects real collected weekly buckets, preserves current adoption and rejects future/invalid weeks', async () => {
  await db.exec('begin')
  try {
    await db.exec('delete from app_private.usage_balance_sessions')
    await battle(999)
    await db.exec(
      "update app_private.usage_balance_sessions set completed_at=date_trunc('week',statement_timestamp() at time zone 'UTC') at time zone 'UTC' - interval '7 days' + interval '1 hour' where battle_session_id='00000000-0000-4000-8000-000000000999'",
    )
    const week = (
      await db.query<{ week_date: string }>(
        "select to_char(date_trunc('week',statement_timestamp() at time zone 'UTC')-interval '7 days','YYYY-MM-DD') week_date",
      )
    ).rows[0]!.week_date
    const get = async (selected: string | null) =>
      (
        await db.query<{ report: Record<string, unknown> }>(
          'select public.read_master_usage_balance_week_v1($1,$2,$3,$4::date) report',
          [actor, character, 'vanguard', selected],
        )
      ).rows[0]!.report
    const old = await get(week)
    expect(String(old.weekStartsAt).slice(0, 10)).toBe(week)
    expect(old.availableWeeks).toContain(week)
    expect(old.current).toEqual((await read()).current)
    expect(old.coverage).toMatchObject({ collectedBattles: 1 })
    await db.exec('savepoint invalid_week')
    await expect(get('2999-01-04')).rejects.toThrow('USAGE_BALANCE_INVALID_WEEK')
    await db.exec('rollback to savepoint invalid_week')
    for (const role of ['anon', 'authenticated']) {
      expect(
        (
          await db.query<{ allowed: boolean }>(
            "select has_function_privilege($1,'public.read_master_usage_balance_week_v1(uuid,uuid,text,date)','execute') allowed",
            [role],
          )
        ).rows[0]!.allowed,
      ).toBe(false)
    }
  } finally {
    await db.exec('rollback')
  }
})

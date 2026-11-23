import type { PGlite } from '@electric-sql/pglite'
import { afterAll, afterEach, beforeAll, beforeEach, expect, it } from 'vitest'
import { createCombatContentTestDatabase } from './test-support/combat-content-test-database'

const actor = '11111111-1111-4111-8111-111111111111'
const other = '99999999-9999-4999-8999-999999999999'
const eventKey = 'event.fixture-repeatable-travel'
const position = (x: number) => ({ sectorId: 'verdant-expanse', x, y: 4 })
const initial = { version: 1, position: position(2), route: [], nextStepAt: null }
const definition = (recurrence: object) => ({
  schemaVersion: 1,
  eventKey,
  templateKey: 'template.travel',
  contentVersion: 1,
  title: 'Practice survey',
  summary: 'Disposable repeatable travel fixture.',
  internalNotes: '',
  family: 'regional-event',
  category: 'repeatable-activities',
  scope: { type: 'region', key: 'verdant-expanse' },
  repeatableTravel: {
    journey: {
      type: 'travel-and-report',
      giverId: 'eastern-watch-officer',
      destination: position(3),
      offer: 'Survey the trail.',
      active: 'Walk to the trail.',
      ready: 'Report back.',
      completed: 'The trail is surveyed.',
    },
    recurrence,
  },
  phases: [
    {
      id: 'trail',
      name: 'Trail',
      objectives: [],
      effects: [],
      cleanupEffects: [],
      transition: { type: 'manual' },
    },
  ],
  rewardPackageRefs: [],
  aftermathRefs: [],
})

let db: PGlite
beforeAll(async () => {
  db = await createCombatContentTestDatabase()
  for (const [id, index, name] of [
    [actor, 0, 'First player'],
    [other, 1, 'Second player'],
  ] as const) {
    await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())', [
      id,
      `fixture-${index}@example.test`,
    ])
    await db.query(
      `insert into public.characters(id,user_id,slot_index,rules_version,name,name_key,
        presentation_id,pronoun_preset_id,portrait_ref,starter_appearance_ref,foundation_discipline_id,
        might,finesse,vitality,agility,intellect,resolve,level,xp,progression_cycle,created_at,cycle_started_at,last_active_at)
        values($1,$1,0,1,$2,$3,'default','they','portrait','appearance','vanguard',12,4,7,4,3,6,1,0,1,now(),now(),now())`,
      [id, name, `fixture-player-${index}`],
    )
  }
  await db.query(
    "insert into app_private.master_panel_role_assignments(user_id,role) values($1,'game-owner')",
    [actor],
  )
  await db.exec(`create table app_private.repeatable_clock_fixture(at timestamptz);
    insert into app_private.repeatable_clock_fixture values(null);
    create or replace function app_private.repeatable_travel_now_v1()
    returns timestamptz language sql volatile set search_path = '' as $$
      select coalesce(at,clock_timestamp()) from app_private.repeatable_clock_fixture
    $$;`)
}, 60_000)
beforeEach(async () => db.exec('begin'))
afterEach(async () => db.exec('rollback'))
afterAll(async () => db?.close())

const publish = (body: object, expectedVersion: number | null = null) =>
  db.query(
    'select * from public.publish_event_definition_v2($1,null::uuid,$2,$3::jsonb,$4,gen_random_uuid(),null,true)',
    [actor, eventKey, body, expectedVersion],
  )

const schedule = async () => {
  const { rows } = await db.query<{ run_id: string }>(
    `select * from public.schedule_event_run_v2($1,null::uuid,$2,gen_random_uuid(),'schedule:travel',
      clock_timestamp()+interval '1 minute',clock_timestamp()+interval '7 days',null,true)`,
    [actor, eventKey],
  )
  const runId = rows[0]!.run_id
  await db.query(
    "update app_private.event_runs set scheduled_start_at=clock_timestamp()-interval '1 second' where id=$1",
    [runId],
  )
  await db.query(
    "select * from public.operate_event_run_v2($1,null::uuid,$2,1,gen_random_uuid(),'start',null,true)",
    [actor, runId],
  )
  return runId
}

const read = async (character = actor) =>
  (
    await db.query<{ view: { repeatableActivities: unknown[] } }>(
      'select public.read_world_state_v1($1,$1,$2) view',
      [character, initial],
    )
  ).rows[0]!.view.repeatableActivities

const interact = (
  version: number,
  ref: string,
  action: string,
  command: string | null = null,
  character = actor,
) =>
  db.query(
    'select public.commit_world_repeatable_travel_v1($1,$1,$2,coalesce($3,gen_random_uuid()),$4,$5,$6)',
    [character, version, command, ref, action, `repeat:${ref}:${action}`],
  )
const move = (version: number, kind: string, state: object) =>
  db.query('select public.commit_world_state_v1($1,$1,$2,gen_random_uuid(),$3,$4)', [
    actor,
    version,
    kind,
    state,
  ])
const clock = (value: Date) =>
  db.query('update app_private.repeatable_clock_fixture set at=$1', [value.toISOString()])

const reject = async (action: () => Promise<unknown>, code: string) => {
  await db.exec('savepoint expected_denial')
  await expect(action()).rejects.toThrow(code)
  await db.exec('rollback to savepoint expected_denial')
}

it.each([
  ['rolling 24 hours', { mode: 'rolling-24h' }, 24 * 60],
  [
    'explicit fixture UTC calendar day',
    { mode: 'calendar-day', timeZone: 'UTC', resetMinute: 0 },
    5,
  ],
] as const)(
  'uses the normal World route, completion and next admission for %s',
  async (_, recurrence, elapsedMinutes) => {
    await publish(definition(recurrence))
    const run = await schedule()
    expect(await read()).toEqual([expect.objectContaining({ runId: run, action: 'accept' })])
    await read(other)
    await interact(1, run, 'accept')
    const attempt = (
      await db.query<{ id: string }>('select id from app_private.event_repeatable_travel_attempts')
    ).rows[0]!.id
    expect(attempt).not.toBe(run)
    await reject(() => interact(2, run, 'accept'), 'WORLD_QUEST_ACTION_UNAVAILABLE')
    await reject(() => interact(2, attempt, 'report'), 'WORLD_QUEST_ACTION_UNAVAILABLE')
    await reject(
      () => interact(1, attempt, 'report', null, other),
      'WORLD_QUEST_ACTION_UNAVAILABLE',
    )
    expect(await read(other)).toEqual([expect.objectContaining({ runId: run, action: 'accept' })])
    let successor: string | undefined
    if (recurrence.mode === 'rolling-24h') {
      // A distinct global occurrence can overlap the regional one. The active
      // attempt and later cooldown still share the Event key across versions.
      await publish(
        {
          ...definition({ mode: 'calendar-day', timeZone: 'UTC', resetMinute: 0 }),
          scope: { type: 'global' },
        },
        1,
      )
      successor = await schedule()
      await reject(() => interact(2, successor!, 'accept'), 'WORLD_QUEST_ACTION_UNAVAILABLE')
    }
    await db.exec('select pg_sleep(0.35)')
    const now = async () =>
      (
        await db.query<{ ms: number }>(
          'select floor(extract(epoch from clock_timestamp())*1000)::bigint ms',
        )
      ).rows[0]!.ms
    await move(2, 'walk', {
      ...initial,
      nextStepAt: (await now()) - 300,
      route: [{ position: position(3), durationMs: 275 }],
    })
    await move(3, 'tick', { ...initial, position: position(3) })
    expect(await read()).toEqual([
      expect.objectContaining({ runId: attempt, progress: 'ready', action: null }),
    ])
    await move(4, 'walk', {
      ...initial,
      position: position(3),
      nextStepAt: (await now()) - 300,
      route: [{ position: position(2), durationMs: 275 }],
    })
    await move(5, 'tick', initial)
    expect(await read()).toEqual([
      expect.objectContaining({ runId: attempt, progress: 'ready', action: 'report' }),
    ])

    // Explicit UTC is fixture data, not a gameplay calendar default. Finishing at
    // 23:55 demonstrates that the two modes open at very different instants.
    const completion = (
      await db.query<{ at: Date }>(`select
    (date_trunc('day', clock_timestamp() at time zone 'UTC') at time zone 'UTC') + interval '47 hours 55 minutes' as at`)
    ).rows[0]!.at
    const next = new Date(+completion + elapsedMinutes * 60_000)
    await clock(completion)
    const reportId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    await interact(6, attempt, 'report', reportId)
    await interact(6, attempt, 'report', reportId)
    expect(await read()).toEqual([
      expect.objectContaining({ runId: attempt, progress: 'completed', action: null }),
    ])
    expect(
      (
        await db.query(
          'select completed_at, next_available_at from app_private.event_repeatable_travel_attempts',
        )
      ).rows,
    ).toEqual([{ completed_at: completion, next_available_at: next }])
    await clock(new Date(+next - 1))
    await reject(() => interact(7, run, 'accept'), 'WORLD_QUEST_ACTION_UNAVAILABLE')
    await clock(next)
    expect(await read()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ runId: run, action: 'accept' }),
        ...(successor ? [expect.objectContaining({ runId: successor, action: 'accept' })] : []),
      ]),
    )
    await interact(7, successor ?? run, 'accept')
    await interact(6, attempt, 'report', reportId)
    expect(
      (await db.query('select id from app_private.event_repeatable_travel_attempts')).rows,
    ).toHaveLength(2)
    expect((await db.query('select xp from public.characters where id=$1', [actor])).rows).toEqual([
      { xp: 0 },
    ])
  },
)

it('rejects reward recipes and unconfigured calendar definitions at the SQL publication boundary', async () => {
  await db.query(
    "insert into app_private.event_reward_budget_policies values('budget.repeatable-fixture','character-xp',100,$1,now())",
    [actor],
  )
  await db.query(
    `insert into app_private.event_reward_packages(reward_package_ref,package_version,reward_kind,amount,published_by,budget_ref)
    values('reward.test',1,'character-xp',25,$1,'budget.repeatable-fixture')`,
    [actor],
  )

  await reject(
    () => publish({ ...definition({ mode: 'rolling-24h' }), rewardPackageRefs: ['reward.test'] }),
    'EVENT_REPEATABLE_TRAVEL_INVALID',
  )
  await reject(
    () => publish(definition({ mode: 'calendar-day' })),
    'EVENT_REPEATABLE_RECURRENCE_INVALID',
  )
  expect(
    (
      await db.query(`select has_function_privilege(
    'authenticated','public.commit_world_repeatable_travel_v1(uuid,uuid,bigint,uuid,uuid,text,text)','execute'
  ) allowed`)
    ).rows,
  ).toEqual([{ allowed: false }])
})

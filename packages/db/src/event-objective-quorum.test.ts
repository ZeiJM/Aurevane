import { expect, it } from 'vitest'
import { createCombatContentTestDatabase } from './test-support/combat-content-test-database'

const actor = '11111111-1111-4111-8111-111111111111'
const version = '22222222-2222-4222-8222-222222222222'
const run = '33333333-3333-4333-8333-333333333333'
const eventKey = 'event.watch-patrol'
const arrival = (id: string, x: number) => ({
  id,
  type: 'discover',
  completion: 'world-arrival',
  referenceKey: `objective.${id}`,
  target: 1,
  worldNavigation: { sectorId: 'verdant-expanse', x, y: 4, autoPath: true, guidance: 'exact' },
})
const phase = {
  id: 'patrol',
  name: 'Patrol',
  objectives: [arrival('watch', 4), arrival('gate', 5), arrival('tower', 6)],
  effects: [],
  cleanupEffects: [],
  transition: { type: 'objective-quorum', objectiveIds: ['watch', 'gate'], required: 2 },
}
const definition = {
  schemaVersion: 1,
  eventKey,
  templateKey: 'template.patrol',
  contentVersion: 1,
  title: 'Watch Patrol',
  summary: 'Check both approaches.',
  internalNotes: '',
  family: 'regional-event',
  category: 'world-events',
  scope: { type: 'global' },
  phases: [
    phase,
    { ...phase, id: 'brief', name: 'Briefing', objectives: [], transition: { type: 'manual' } },
  ],
  rewardPackageRefs: [],
  aftermathRefs: [],
}

it('routes a timed patrol by confirmed arrivals and rejects credit after the cutoff', async () => {
  const db = await createCombatContentTestDatabase()
  const lateRun = '55555555-5555-4555-8555-555555555555'
  const transition = {
    ...phase.transition,
    deadline: { afterSeconds: 120, nextPhaseId: 'relief' },
  }
  const timed = {
    ...definition,
    phases: [
      { ...phase, transition },
      { ...definition.phases[1], nextPhaseId: 'close' },
      { ...definition.phases[1], id: 'relief', name: 'Send relief' },
      { ...definition.phases[1], id: 'close', name: 'Close' },
    ],
  }
  try {
    const validate = (payload: unknown) =>
      db.query('select app_private.assert_event_definition_shape_v1($1,$2)', [eventKey, payload])
    await expect(validate(timed)).resolves.toBeDefined()
    for (const deadline of [
      null,
      { ...transition.deadline, afterSeconds: 0 },
      { ...transition.deadline, afterSeconds: 2_147_483_648 },
      { ...transition.deadline, nextPhaseId: 'brief' },
      { ...transition.deadline, nextPhaseId: 'patrol' },
      { ...transition.deadline, nextPhaseId: 'missing' },
    ]) {
      await expect(
        validate({
          ...timed,
          phases: [{ ...phase, transition: { ...transition, deadline } }, ...timed.phases.slice(1)],
        }),
      ).rejects.toThrow('EVENT_DEFINITION_DEADLINE_INVALID')
    }
    await expect(
      validate({
        ...timed,
        phases: [
          {
            ...phase,
            objectives: [arrival('watch', 4), { ...arrival('gate', 5), completion: undefined }],
            transition,
          },
          ...timed.phases.slice(1),
        ],
      }),
    ).rejects.toThrow('EVENT_DEFINITION_DEADLINE_INVALID')

    await db.query('select app_private.assert_event_runtime_supported_v1($1)', [timed])
    await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())', [
      actor,
      'deadline@example.test',
    ])
    await db.query(
      `insert into public.characters(id,user_id,slot_index,rules_version,name,name_key,
      presentation_id,pronoun_preset_id,portrait_ref,starter_appearance_ref,foundation_discipline_id,
      might,finesse,vitality,agility,intellect,resolve,level,xp,progression_cycle,created_at,cycle_started_at,last_active_at)
      values($1,$1,0,1,'Watch Scout','watch scout','default','they','portrait','appearance','vanguard',12,4,7,4,3,6,1,0,1,now(),now(),now())`,
      [actor],
    )
    await db.query("insert into app_private.event_templates values($1,'regional-event',$2,now())", [
      eventKey,
      actor,
    ])
    await db.query(
      'insert into app_private.event_definition_versions(id,event_key,definition_version,definition,published_by) values($1,$2,1,$3,$4)',
      [version, eventKey, timed, actor],
    )
    for (const runId of [run, lateRun]) {
      await db.query(
        "insert into app_private.event_runs(id,event_key,definition_version_id,run_mode,lifecycle_status,scope_type,current_phase_id,started_at,created_by) values($1,$2,$3,'production','live','global','patrol',now()-interval '10 minutes',$4)",
        [runId, eventKey, version, actor],
      )
      await db.query(
        `insert into app_private.event_run_phases (run_id,phase_id,ordinal,phase_status,started_at)
        values ($1,'patrol',0,'live',now()-interval '10 seconds'),($1,'brief',1,'pending',null),
          ($1,'relief',2,'pending',null),($1,'close',3,'pending',null)`,
        [runId],
      )
      await db.query(
        `insert into app_private.event_run_objectives (run_id,phase_id,objective_id,objective_status,target)
        values ($1,'patrol','watch','active',1),($1,'patrol','gate','active',1)`,
        [runId],
      )
    }
    const arrive = (x: number) =>
      db.query(
        `select app_private.record_world_event_arrivals_v1($1,$1,$2,1,
          floor(extract(epoch from clock_timestamp())*1000)::bigint)`,
        [actor, [{ position: { sectorId: 'verdant-expanse', x, y: 4 } }]],
      )
    const recover = (runId: string, expected = 1) =>
      db.query('select app_private.recover_event_phase_transition_v1($1,$2) as outcome', [
        runId,
        expected,
      ])
    await expect(recover(lateRun)).resolves.toMatchObject({ rows: [{ outcome: 'noop' }] })
    await arrive(4)
    // Simulate one patrol closing before its second World arrival settles.
    await db.query(
      "update app_private.event_run_phases set started_at=now()-interval '3 minutes' where run_id=$1 and phase_id='patrol'",
      [lateRun],
    )
    await arrive(5)
    await arrive(5)
    expect(
      await db.query(
        'select run_id,objective_id from app_private.event_contributions order by run_id,objective_id',
      ),
    ).toMatchObject({
      rows: [
        { run_id: run, objective_id: 'gate' },
        { run_id: run, objective_id: 'watch' },
        { run_id: lateRun, objective_id: 'watch' },
      ],
    })

    // Recovery may run after the deadline. Previously confirmed success still wins.
    await db.query(
      "update app_private.event_run_objectives set updated_at=now()-interval '2 minutes' where run_id=$1",
      [run],
    )
    await db.query(
      "update app_private.event_run_phases set started_at=now()-interval '3 minutes' where run_id=$1 and phase_id='patrol'",
      [run],
    )
    for (const runId of [run, lateRun]) {
      await expect(recover(runId)).resolves.toMatchObject({ rows: [{ outcome: 'advanced' }] })
      await expect(recover(runId)).resolves.toMatchObject({ rows: [{ outcome: 'noop' }] })
    }
    expect(
      await db.query(
        'select id,current_phase_id,state_version from app_private.event_runs order by id',
      ),
    ).toMatchObject({
      rows: [
        { id: run, current_phase_id: 'brief', state_version: 2 },
        { id: lateRun, current_phase_id: 'relief', state_version: 2 },
      ],
    })
    expect(
      await db.query(
        'select phase_id,phase_status from app_private.event_run_phases where run_id=$1 order by ordinal',
        [lateRun],
      ),
    ).toMatchObject({
      rows: [
        { phase_id: 'patrol', phase_status: 'completed' },
        { phase_id: 'brief', phase_status: 'skipped' },
        { phase_id: 'relief', phase_status: 'live' },
        { phase_id: 'close', phase_status: 'pending' },
      ],
    })
  } finally {
    await db.close()
  }
}, 30_000)

it('advances a pinned run only when enough selected objectives in the live phase are complete', async () => {
  const db = await createCombatContentTestDatabase()
  try {
    const validate = (transition: unknown) =>
      db.query('select app_private.assert_event_definition_shape_v1($1,$2)', [
        eventKey,
        { ...definition, phases: [{ ...phase, transition }, definition.phases[1]] },
      ])
    await expect(validate(phase.transition)).resolves.toBeDefined()
    for (const objectiveIds of [['watch', 'watch'], ['watch', 'other'], ['watch'], { watch: true }])
      await expect(validate({ ...phase.transition, objectiveIds })).rejects.toThrow(
        'EVENT_DEFINITION_TRANSITION_INVALID',
      )
    await expect(validate({ ...phase.transition, required: 3 })).rejects.toThrow(
      'EVENT_DEFINITION_TRANSITION_INVALID',
    )
    await expect(
      db.query('select app_private.assert_event_runtime_supported_v1($1)', [
        {
          ...definition,
          phases: [
            {
              ...phase,
              objectives: [{ ...arrival('watch', 4), completion: undefined }, arrival('gate', 5)],
            },
          ],
        },
      ]),
    ).rejects.toThrow('EVENT_NAVIGATION_IS_NOT_OBJECTIVE_EXECUTION')
    await db.query('select app_private.assert_event_runtime_supported_v1($1)', [definition])

    await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())', [
      actor,
      'quorum@example.test',
    ])
    await db.query("insert into app_private.event_templates values($1,'regional-event',$2,now())", [
      eventKey,
      actor,
    ])
    await db.query(
      'insert into app_private.event_definition_versions(id,event_key,definition_version,definition,published_by) values($1,$2,1,$3,$4)',
      [version, eventKey, definition, actor],
    )
    await db.query(
      "insert into app_private.event_runs(id,event_key,definition_version_id,run_mode,lifecycle_status,scope_type,current_phase_id,started_at,created_by) values($1,$2,$3,'production','live','global','patrol',now(),$4)",
      [run, eventKey, version, actor],
    )
    await db.query(
      "insert into app_private.event_run_phases(run_id,phase_id,ordinal,phase_status,started_at) values($1,'patrol',0,'live',now()),($1,'brief',1,'pending',null)",
      [run],
    )
    await db.query(
      `insert into app_private.event_run_objectives(run_id,phase_id,objective_id,objective_status,target,progress)
        values($1,'patrol','watch','completed',1,1),($1,'patrol','gate','active',1,0),($1,'patrol','tower','completed',1,1)`,
      [run],
    )
    const recover = () =>
      db.query('select app_private.recover_event_phase_transition_v1($1,1) as outcome', [run])
    await expect(recover()).resolves.toMatchObject({ rows: [{ outcome: 'noop' }] })
    await db.query(
      "update app_private.event_run_objectives set progress=1, objective_status='completed' where run_id=$1 and objective_id='gate'",
      [run],
    )
    await expect(recover()).resolves.toMatchObject({ rows: [{ outcome: 'advanced' }] })
    await expect(recover()).resolves.toMatchObject({ rows: [{ outcome: 'noop' }] })
    const receipt = await db.query(
      'select current_phase_id,state_version from app_private.event_runs where id=$1',
      [run],
    )
    expect(receipt.rows).toEqual([{ current_phase_id: 'brief', state_version: 2 }])
  } finally {
    await db.close()
  }
}, 30_000)

it('takes the first confirmed branch and skips both alternate phases and explicit manual jumps', async () => {
  const db = await createCombatContentTestDatabase()
  try {
    const routes = [
      { objectiveId: 'watch', nextPhaseId: 'bridge' },
      { objectiveId: 'gate', nextPhaseId: 'harbor' },
    ]
    const buildPhase = (id: string, nextPhaseId?: string) => ({
      id,
      name: id,
      nextPhaseId,
      objectives: [],
      effects: [],
      cleanupEffects: [],
      transition: { type: 'manual' },
    })
    const branched = {
      ...definition,
      phases: [
        { ...phase, transition: { type: 'objective-branch', routes } },
        buildPhase('bridge', 'brief'),
        buildPhase('harbor', 'brief'),
        buildPhase('false-trail'),
        buildPhase('brief'),
      ],
    }
    const validate = (value: unknown) =>
      db.query('select app_private.assert_event_definition_shape_v1($1,$2)', [eventKey, value])
    await expect(validate(branched)).resolves.toBeDefined()
    await expect(
      validate({
        ...branched,
        phases: [
          {
            ...phase,
            transition: {
              type: 'objective-branch',
              routes: [routes[0], { ...routes[1], nextPhaseId: 'patrol' }],
            },
          },
          ...branched.phases.slice(1),
        ],
      }),
    ).rejects.toThrow('EVENT_DEFINITION_TRANSITION_INVALID')
    await expect(
      validate({
        ...branched,
        phases: [...branched.phases.slice(0, -1), buildPhase('brief', 'patrol')],
      }),
    ).rejects.toThrow('EVENT_DEFINITION_PHASE_DESTINATION_INVALID')
    await db.query('select app_private.assert_event_runtime_supported_v1($1)', [branched])
    await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())', [
      actor,
      'branch@example.test',
    ])
    await db.query(
      "insert into app_private.master_panel_role_assignments(user_id,role) values($1,'game-owner')",
      [actor],
    )
    await db.query("insert into app_private.event_templates values($1,'regional-event',$2,now())", [
      eventKey,
      actor,
    ])
    await db.query(
      'insert into app_private.event_definition_versions(id,event_key,definition_version,definition,published_by) values($1,$2,1,$3,$4)',
      [version, eventKey, branched, actor],
    )
    await db.query(
      "insert into app_private.event_runs(id,event_key,definition_version_id,run_mode,lifecycle_status,scope_type,current_phase_id,started_at,created_by) values($1,$2,$3,'production','live','global','patrol',now(),$4)",
      [run, eventKey, version, actor],
    )
    await db.query(
      `insert into app_private.event_run_phases(run_id,phase_id,ordinal,phase_status,started_at)
        values($1,'patrol',0,'live',now()),($1,'bridge',1,'pending',null),
          ($1,'harbor',2,'pending',null),($1,'false-trail',3,'pending',null),($1,'brief',4,'pending',null)`,
      [run],
    )
    await db.query(
      `insert into app_private.event_run_objectives(run_id,phase_id,objective_id,objective_status,target,progress)
        values($1,'patrol','watch','active',1,0),($1,'patrol','gate','active',1,0),($1,'patrol','tower','completed',1,1)`,
      [run],
    )
    const recover = () =>
      db.query('select app_private.recover_event_phase_transition_v1($1,1) as outcome', [run])
    await expect(recover()).resolves.toMatchObject({ rows: [{ outcome: 'noop' }] })
    await db.query(
      `update app_private.event_run_objectives
      set progress=1, objective_status='completed',
        updated_at=now() - case when objective_id='gate' then interval '2 seconds' else interval '1 second' end
      where run_id=$1 and objective_id in ('watch','gate')`,
      [run],
    )
    await expect(recover()).resolves.toMatchObject({ rows: [{ outcome: 'advanced' }] })
    await expect(recover()).resolves.toMatchObject({ rows: [{ outcome: 'noop' }] })
    expect(
      await db.query(
        'select current_phase_id,state_version from app_private.event_runs where id=$1',
        [run],
      ),
    ).toMatchObject({
      rows: [{ current_phase_id: 'harbor', state_version: 2 }],
    })
    const command = '44444444-4444-4444-8444-444444444444'
    const advance = () =>
      db.query('select * from public.advance_event_run_phase_v2($1,null::uuid,$2,2,$3,null,true)', [
        actor,
        run,
        command,
      ])
    await expect(advance()).resolves.toMatchObject({
      rows: [{ current_phase_id: 'brief', state_version: 3, replayed: false }],
    })
    await expect(advance()).resolves.toMatchObject({
      rows: [{ current_phase_id: 'brief', state_version: 3, replayed: true }],
    })
    expect(
      await db.query(
        'select phase_id,phase_status from app_private.event_run_phases where run_id=$1 order by ordinal',
        [run],
      ),
    ).toMatchObject({
      rows: [
        { phase_id: 'patrol', phase_status: 'completed' },
        { phase_id: 'bridge', phase_status: 'skipped' },
        { phase_id: 'harbor', phase_status: 'completed' },
        { phase_id: 'false-trail', phase_status: 'skipped' },
        { phase_id: 'brief', phase_status: 'live' },
      ],
    })
  } finally {
    await db.close()
  }
}, 30_000)

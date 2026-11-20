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

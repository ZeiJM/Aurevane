import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, it } from 'vitest'
import { createCombatContentTestDatabase } from './test-support/combat-content-test-database'

it('Events page grants all native tools, and Owner page revocation blocks publication, global scope, replay and emergency stop', async () => {
  const db = await createCombatContentTestDatabase()
  const owner = '00000000-0000-4000-8000-000000006001',
    staff = '00000000-0000-4000-8000-000000006002',
    chosen = '00000000-0000-4000-8000-000000006011',
    alternate = '00000000-0000-4000-8000-000000006012'
  const pageSql = readFileSync(
    resolve(process.cwd(), '../../.github/scripts/event-page-access-fixture.sql'),
    'utf8',
  )
  async function page(enabled: boolean) {
    await db.exec('begin')
    await db.query(
      "select set_config('event_fixture.owner',$1,true),set_config('event_fixture.enabled',$2,true)",
      [owner, String(enabled)],
    )
    await db.exec('set local role service_role')
    await db.exec(pageSql)
    await db.exec('reset role;commit')
  }
  const definition = (key: string, global = false) => ({
    schemaVersion: 1,
    eventKey: key,
    templateKey: 'template.page-native',
    contentVersion: 1,
    title: 'Native page fixture',
    summary: 'Native Events page authority proof',
    internalNotes: 'Disposable local fixture',
    family: 'regional-event',
    scope: global ? { type: 'global' } : { type: 'region', key: 'region.frostmere' },
    phases: [
      {
        id: 'mobilization',
        name: 'Mobilization',
        objectives: [
          {
            id: 'community',
            type: 'discover',
            worldNavigation: {
              sectorId: 'verdant-expanse',
              x: 12,
              y: 4,
              autoPath: true,
              guidance: 'exact',
            },
            referenceKey: 'objective.page-native',
            target: 10,
          },
        ],
        effects: [],
        cleanupEffects: [],
        transition: { type: 'manual' },
      },
    ],
    rewardPackageRefs: [],
    aftermathRefs: [],
  })
  const regional = definition('event.page-native'),
    global = definition('event.page-native-global', true)
  const publication = '00000000-0000-4000-8000-000000006101'
  const publish = (
    def = regional,
    key = publication,
    confirmed = true,
    char: string | null = chosen,
  ) =>
    db.query(
      'select * from public.publish_event_definition_v2($1,$2,$3,$4::jsonb,null,$5,null,$6)',
      [staff, char, def.eventKey, def, key, confirmed],
    )
  try {
    await db.exec(`insert into auth.users(id,email,email_confirmed_at) values('${owner}','page-owner@example.test',now()),('${staff}','page-staff@example.test',now());
   insert into app_private.master_panel_role_assignments(user_id,role) values('${owner}','game-owner');
   insert into public.characters(id,user_id,slot_index,rules_version,name,name_key,presentation_id,pronoun_preset_id,portrait_ref,starter_appearance_ref,foundation_discipline_id,might,finesse,vitality,agility,intellect,resolve,level,xp,progression_cycle,created_at,cycle_started_at,last_active_at)
   values('${chosen}','${staff}',0,1,'Events Staff','events-staff','default','they','portrait','appearance','vanguard',12,4,7,4,3,6,1,0,1,now(),now(),now()),('${alternate}','${staff}',1,1,'Events Alternate','events-alternate','default','they','portrait','appearance','vanguard',12,4,7,4,3,6,1,0,1,now(),now(),now());`)
    await db.query(
      'select public.set_master_panel_character_access_v2($1,$2,$3,$4::text[],$5::text[],null,0,true)',
      [owner, staff, chosen, ['event-staff'], []],
    )
    await page(true)
    const access = (
      await db.query<{ special_capabilities: string[]; effective_capabilities: string[] }>(
        'select * from public.read_master_panel_access_v2($1,$2)',
        [staff, chosen],
      )
    ).rows[0]!
    expect(access.special_capabilities).toEqual([])
    expect(access.effective_capabilities).toEqual(
      expect.arrayContaining([
        'events.author',
        'events.operate',
        'events.production_publish',
        'events.global_scope',
        'events.reward_titles',
        'events.emergency_stop',
      ]),
    )
    await expect(
      db.query('select public.read_master_panel_role_defaults_v1($1)', [staff]),
    ).rejects.toThrow('MASTER_PANEL_OWNER_REQUIRED')
    await db.query(
      'select * from public.save_event_definition_draft_v1($1,$2,$3,$4::jsonb,null,null)',
      [staff, chosen, regional.eventKey, regional],
    )
    await expect(
      db.query(
        'select * from public.save_event_definition_draft_v1($1,$2,$3,$4::jsonb,null,null)',
        [staff, chosen, regional.eventKey, regional],
      ),
    ).rejects.toThrow('EVENT_DRAFT_VERSION_CONFLICT')
    await expect(publish(regional, publication, true, null)).rejects.toThrow('EVENT_STAFF_REQUIRED')
    await expect(publish(regional, publication, true, alternate)).rejects.toThrow(
      'EVENT_STAFF_REQUIRED',
    )
    await page(false)
    await expect(publish()).rejects.toThrow('EVENT_STAFF_REQUIRED')
    await page(true)
    await expect(publish(regional, publication, false)).rejects.toThrow(
      'EVENT_ACTION_CONFIRMATION_REQUIRED',
    )
    expect((await publish()).rows[0]).toMatchObject({ definition_version: 1 })
    expect((await publish()).rows[0]).toMatchObject({ definition_version: 1 })
    await expect(publish({ ...regional, title: 'Changed reuse' })).rejects.toThrow(
      'EVENT_AUTHORING_IDEMPOTENCY_CONFLICT',
    )
    await page(false)
    await expect(publish()).rejects.toThrow('EVENT_STAFF_REQUIRED')
    await expect(publish(global, '00000000-0000-4000-8000-000000006102')).rejects.toThrow(
      'EVENT_STAFF_REQUIRED',
    )
    await page(true)
    expect((await publish(global, '00000000-0000-4000-8000-000000006102')).rows[0]).toMatchObject({
      definition_version: 1,
    })
    const run = (
      await db.query<{ run_id: string; state_version: number }>(
        "select * from public.schedule_event_run_v2($1,$2,$3,gen_random_uuid(),$4,clock_timestamp()+interval '2 hours',clock_timestamp()+interval '4 hours',null,true)",
        [staff, chosen, global.eventKey, 'page:native:schedule'],
      )
    ).rows[0]!
    const stopKey = '00000000-0000-4000-8000-000000006103'
    const stop = (confirmed = true) =>
      db.query('select * from public.operate_event_run_v2($1,$2,$3,$4,$5,$6,null,$7)', [
        staff,
        chosen,
        run.run_id,
        run.state_version,
        stopKey,
        'emergency-stop',
        confirmed,
      ])
    await page(false)
    await expect(stop()).rejects.toThrow('EVENT_STAFF_REQUIRED')
    await page(true)
    await expect(stop(false)).rejects.toThrow('EVENT_OPERATION_CONFIRMATION_REQUIRED')
    expect((await stop()).rows[0]).toMatchObject({
      lifecycle_status: 'emergency-stopped',
      state_version: 2,
      replayed: false,
    })
    expect((await stop()).rows[0]).toMatchObject({
      lifecycle_status: 'emergency-stopped',
      state_version: 2,
      replayed: true,
    })
    expect(
      (
        await db.query<{ n: number }>(
          'select count(*)::int n from app_private.event_authoring_audit where actor_user_id=$1',
          [staff],
        )
      ).rows[0]!.n,
    ).toBe(3)
    expect(
      (
        await db.query<{ n: number }>(
          'select count(*)::int n from app_private.event_operations_audit where actor_user_id=$1',
          [staff],
        )
      ).rows[0]!.n,
    ).toBe(1)
    expect(
      (
        await db.query<{ n: number }>(
          'select count(*)::int n from app_private.event_authoring_audit where actor_user_id=$1 and reason is not null',
          [staff],
        )
      ).rows[0]!.n,
    ).toBe(0)
  } finally {
    await db.close()
  }
}, 120000)

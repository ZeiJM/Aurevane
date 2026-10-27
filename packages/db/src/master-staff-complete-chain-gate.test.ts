import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, it } from 'vitest'
import { createCombatContentTestDatabase } from './test-support/combat-content-test-database'
it('executes the native staff authority inventory against the complete real migration chain', async () => {
  const db = await createCombatContentTestDatabase()
  const owner = '00000000-0000-4000-8000-000000005001',
    staff = '00000000-0000-4000-8000-000000005002',
    other = '00000000-0000-4000-8000-000000005003',
    chosen = '00000000-0000-4000-8000-000000005011',
    alternate = '00000000-0000-4000-8000-000000005012'
  try {
    await db.exec(`insert into auth.users(id,email,email_confirmed_at) values('${owner}','gate-owner@example.test',now()),('${staff}','gate-staff@example.test',now()),('${other}','gate-other@example.test',now());
   insert into app_private.master_panel_role_assignments(user_id,role,granted_by) values('${owner}','game-owner','${owner}'),('${staff}','content-staff','${owner}');
   insert into app_private.master_panel_access_versions(user_id,access_version) values('${owner}',1);
   insert into public.characters(id,user_id,slot_index,rules_version,name,name_key,presentation_id,pronoun_preset_id,portrait_ref,starter_appearance_ref,foundation_discipline_id,might,finesse,vitality,agility,intellect,resolve,level,xp,progression_cycle,created_at,cycle_started_at,last_active_at)
   values('${chosen}','${staff}',0,1,'Chosen Staff','chosen-staff','default','they','portrait','appearance','vanguard',12,4,7,4,3,6,1,0,1,now(),now(),now()),('${alternate}','${staff}',1,1,'Alternate Staff','alternate-staff','default','they','portrait','appearance','vanguard',12,4,7,4,3,6,1,0,1,now(),now(),now());`)
    const domainRaises = await db.query<{ custom_raises: number }>(
      `select count(*)::int custom_raises from pg_proc p join pg_namespace n on n.oid=p.pronamespace cross join lateral regexp_matches(p.prosrc,$pattern$errcode[[:space:]]*=[[:space:]]*'40001'$pattern$,'gi') m where n.nspname in ('public','app_private')`,
    )
    expect(domainRaises.rows).toEqual([{ custom_raises: 0 }])
    await db.exec('begin')
    await db.query(
      `select set_config('task8.owner',$1,true),set_config('task8.staff',$2,true),set_config('task8.other',$3,true),set_config('task8.character',$4,true),set_config('task8.alternate',$5,true),set_config('task8.character_name','Chosen Staff',true)`,
      [owner, staff, other, chosen, alternate],
    )
    await db.exec(
      readFileSync(
        resolve(process.cwd(), '../../.github/scripts/verify-master-panel-staff-authority.sql'),
        'utf8',
      ),
    )
    await db.exec('rollback')
  } finally {
    await db.close()
  }
}, 120000)

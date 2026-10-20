#!/usr/bin/env python3
"""Native, disposable Docker-local two-session Task9 authority proof.
Run after the entire unmodified migration chain. Never accepts a hosted URL.
"""
import json
import subprocess
import time
import uuid

containers = subprocess.check_output(['docker','ps','--filter','name=supabase_db_','--format','{{.Names}}'],text=True).splitlines()
assert len(containers)==1, 'Exactly one disposable local Supabase DB is required'
container=containers[0]
assert container.startswith('supabase_db_')
base=['docker','exec','-i',container,'psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U','postgres','-d','postgres']
def sql(statement, fail=None):
    result=subprocess.run(base,input=statement,text=True,capture_output=True)
    if fail:
        assert result.returncode and fail in result.stderr,(fail,result.stdout,result.stderr)
    else:
        assert result.returncode==0,(result.stdout,result.stderr)
    return result.stdout.strip()
def quote(value):
    return "'"+str(value).replace("'","''")+"'"
def js(value):
    return quote(json.dumps(value))+'::jsonb'
def uid(): return str(uuid.uuid4())
owner=None
user,char=uid(),uid()
guest,guestchar=uid(),uid()
owned_accounts=[]
borrowed_owner=False
def setup():
    global owner,borrowed_owner
    existing=json.loads(sql("select coalesce(jsonb_agg(jsonb_build_object('owner',a.user_id,'account',u.id)),'[]') from app_private.master_panel_role_assignments a left join auth.users u on u.id=a.user_id where a.role='game-owner' and a.enabled"))
    assert len(existing)<=1,'Disposable database must preserve the single enabled Owner invariant'
    if existing:
        assert existing[0]['account']==existing[0]['owner'],'Existing Owner must reference a real account'
        owner=existing[0]['owner'];borrowed_owner=True
        print('Reusing existing disposable Owner; its account and Staff evidence are not owned by this harness')
    else:
        owner=uid();owned_accounts.append(owner)
        sql(f"insert into auth.users(id,email) values('{owner}','{owner}@example.test');insert into app_private.master_panel_role_assignments(user_id,role) values('{owner}','game-owner');")
    owned_accounts.append(user)
    sql(f"""insert into auth.users(id,email) values('{user}','{user}@example.test');
insert into public.characters(id,user_id,slot_index,rules_version,name,name_key,presentation_id,pronoun_preset_id,portrait_ref,starter_appearance_ref,foundation_discipline_id,might,finesse,vitality,agility,intellect,resolve,level,xp,progression_cycle,created_at,cycle_started_at,last_active_at)
values('{char}','{user}',0,1,'Native recovery','native-{char}','default','they','portrait','appearance','vanguard',12,4,7,4,3,6,1,0,1,now(),now(),now());""")
def prepare():
    build=json.loads(sql(f"select public.get_character_committed_build_snapshot_v2('{user}','{char}')"))
    return {'tactical':{'battle':{'battleId':uid(),'rulesVersion':1,'contentVersion':1,'lifecycle':'active','currentTurn':{'combatantId':'character:'+char},'rng':{'algorithm':'xorshift32-v1','seed':7,'state':7,'draws':0},'combatants':[{'id':'character:'+char,'teamId':'players','hp':100,'mp':10},{'id':'enemy','teamId':'enemies','hp':0,'mp':10}]}},'buildAuthority':{'combatants':[{**build,'combatantId':'character:'+char,'characterId':char}]},'statBridge':{'combatants':[{'combatantId':'enemy','provenance':{'kind':'scenario','sourceId':'scenario:p2-7-recruit:vanguard:mastery-trial:standard'}}]}}
def create_statement(prepared):
    participants=[{'combatant_id':'character:'+char,'participant_role':'player','character_id':char},{'combatant_id':'enemy','participant_role':'opponent','character_id':None}]
    return f"select battle_session_id from public.create_battle_session_v1('{user}','{uid()}','native','{user}',{quote(prepared['tactical']['battle']['battleId'])},1,1,{js(prepared)},{js(participants)});"
def create(prepared,fail=None): return sql(create_statement(prepared),fail)
def terminal(prepared):
    result=json.loads(json.dumps(prepared));result['administrativeOutcome']='NoContest';result['rewardOutcome']='NoRewards';result['tactical']['battle']['lifecycle']='abandoned';result['tactical']['battle']['currentTurn']=None
    return result
def recovery(session,prepared):
    return f"select public.recover_master_player_battle_v1('{owner}','{char}','{session}',1,array['{char}'::uuid],'{uid()}',{js(terminal(prepared))},true,null);"
def complete(session,prepared):
    result=json.loads(json.dumps(prepared));result['tactical']['battle']['lifecycle']='completed';result['tactical']['battle']['currentTurn']=None
    return f"select * from public.commit_battle_intent_v2('{user}','{uid()}','completion','{user}','{session}',1,{js(result)},'[]');"
def claim(session): return f"select * from public.claim_discipline_trial_v1('{user}','{session}');"
def race(lock,first,second,second_failure=None):
    tag='task9-'+uid()
    command=f"set application_name={quote(tag)};begin;{lock};select pg_sleep(1.5);{first};commit;"
    holder=subprocess.Popen(base,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
    holder.stdin.write(command);holder.stdin.close()
    deadline=time.monotonic()+8
    while sql(f"select count(*) from pg_stat_activity where application_name={quote(tag)} and wait_event='PgSleep'")!='1':
        assert time.monotonic()<deadline,'First session did not acquire the authority lock'
        time.sleep(.05)
    output=sql(second,second_failure)
    stdout=holder.stdout.read();stderr=holder.stderr.read();assert holder.wait(timeout=10)==0,(stdout,stderr)
    return output
try:
    setup()
    # Correction/admission account locks must request retry without leaving an orphan.
    prepared=prepare()
    command={'kind':'source','xp':0,'attributes':{'might':11,'finesse':4,'vitality':7,'agility':4,'intellect':3,'resolve':6}}
    def edit():
        fingerprint=sql(f"select public.read_master_player_v1('{owner}','{char}',null)->>'fingerprint'")
        return f"select public.edit_master_player_v1('{owner}','{char}',{quote(fingerprint)},'{uid()}',{js(command)},true,null);"
    race(f"select pg_advisory_xact_lock(hashtextextended('{user}',1))",'select 1',edit(),'PLAYER_EDIT_RETRY')
    race(f"select pg_advisory_xact_lock(hashtextextended('{user}',1))",'select 1',create_statement(prepared),'PLAYER_ADMISSION_RETRY')
    assert sql(f"select count(*) from app_private.battle_sessions where battle_id={quote(prepared['tactical']['battle']['battleId'])}")=='0'
    sql(edit())
    create(prepared,'PLAYER_PREPARATION_STALE')
    assert sql(f"select count(*) from app_private.battle_sessions where battle_id={quote(prepared['tactical']['battle']['battleId'])}")=='0'
    fresh=prepare();session=create(fresh)
    sql(edit(),'PLAYER_BATTLE_ACTIVE')
    # Recovery wins: real late completion resynchronizes; concurrent actual claim rejects.
    output=race(f"select id from app_private.battle_sessions where id='{session}' for update",recovery(session,fresh),complete(session,fresh))
    assert 'NoContest' in output
    sql(claim(session),'BATTLE_NO_REWARDS')
    assert sql(f"select count(*) from app_private.discipline_trial_claims where battle_session_id='{session}'")=='0'
    fresh=prepare();session=create(fresh)
    race(f"select id from app_private.battle_sessions where id='{session}' for update",recovery(session,fresh),claim(session),'BATTLE_NO_REWARDS')
    # Completion wins: real trial claim races recovery and retains its one receipt.
    fresh=prepare();session=create(fresh)
    for index,action in enumerate(['vanguard.forceful-strike','vanguard.cleave','vanguard.forceful-strike']):
        sql(f"insert into app_private.battle_events(battle_session_id,battle_version,event_index,event) values('{session}',1,{index},{js({'event':'combat_action_used','actorId':'character:'+char,'actionId':action})});")
    result=race(f"select id from app_private.battle_sessions where id='{session}' for update",complete(session,fresh)+claim(session),recovery(session,fresh))
    assert 'AlreadyTerminal' in result
    assert sql(f"select count(*) from app_private.discipline_trial_claims where battle_session_id='{session}'")=='1'
    assert 't' in sql(claim(session))
    # Guest account contention in the actual PvP producer retries before atlas
    # participant locks; failure rolls back the head and preserves waiting seats.
    owned_accounts.append(guest)
    sql(f"insert into auth.users(id,email) values('{guest}','{guest}@example.test');")
    sql(f"""insert into public.characters(id,user_id,slot_index,rules_version,name,name_key,presentation_id,pronoun_preset_id,portrait_ref,starter_appearance_ref,foundation_discipline_id,might,finesse,vitality,agility,intellect,resolve,level,xp,progression_cycle,created_at,cycle_started_at,last_active_at)
    select '{guestchar}','{guest}',0,rules_version,'Native guest','native-{guestchar}',presentation_id,pronoun_preset_id,portrait_ref,starter_appearance_ref,foundation_discipline_id,might,finesse,vitality,agility,intellect,resolve,level,xp,progression_cycle,created_at,cycle_started_at,last_active_at from public.characters where id='{char}';""")
    lobby=uid(); key='AVL-'+uuid.uuid4().hex[:4].upper()+'-'+uuid.uuid4().hex[:4].upper()
    sql(f"insert into app_private.pvp_lobbies(id,lobby_key,mode,owner_user_id,team_a_size,team_b_size) values('{lobby}','{key}','1v1','{user}',1,1);insert into app_private.pvp_lobby_members(lobby_id,user_id,character_id,team_index,seat_index,ready) values('{lobby}','{user}','{char}',0,0,true),('{lobby}','{guest}','{guestchar}',1,0,true);")
    fresh=prepare()
    fresh['tactical']['battle']['combatants'][0]['teamId']='team:0'
    fresh['tactical']['battle']['combatants'][1].update(id='character:'+guestchar,teamId='team:1',hp=100)
    fresh['statBridge']['combatants'][0]['combatantId']='character:'+guestchar
    guestbuild=json.loads(sql(f"select public.get_character_committed_build_snapshot_v2('{guest}','{guestchar}')"))
    fresh['buildAuthority']['combatants'].append({**guestbuild,'combatantId':'character:'+guestchar,'characterId':guestchar})
    members=[{'combatant_id':'character:'+char,'user_id':user,'character_id':char,'team_index':0},{'combatant_id':'character:'+guestchar,'user_id':guest,'character_id':guestchar,'team_index':1}]
    pvp=f"select battle_session_id from public.create_pvp_battle_session_v1('{user}','{lobby}',{quote(fresh['tactical']['battle']['battleId'])},1,1,{js(fresh)},{js(members)});"
    race(f"select pg_advisory_xact_lock(hashtextextended('{guest}',1))",'select 1',pvp,'PLAYER_ADMISSION_RETRY')
    assert sql(f"select status from app_private.pvp_lobbies where id='{lobby}'")=='waiting'
    assert sql(f"select count(*) from app_private.battle_sessions where battle_id={quote(fresh['tactical']['battle']['battleId'])}")=='0'
    session=sql(pvp)
    sql(recovery(session,fresh).replace(f"array['{char}'::uuid]",f"array['{char}'::uuid,'{guestchar}'::uuid]"))
    print('PASS native completion/recovery orders, actual concurrent trial claims, account/guest admission and correction retry, edit-first stale/no-orphan, fresh admission and live-edit rejection')
finally:
    # Exercise real account deletion authority, including raw recovery-payload deletion.
    for account in reversed(owned_accounts):
        if sql(f"select count(*) from auth.users where id='{account}'")=='0': continue
        sql(f"insert into app_private.account_deletion_requests(user_id,requested_at,delete_after) values('{account}',now()-interval '2 days',now()-interval '1 day') on conflict(user_id) do update set delete_after=excluded.delete_after;select app_private.finalize_account_deletion_for_user_v1('{account}');")
    if borrowed_owner:
        assert sql(f"select count(*) from app_private.master_panel_role_assignments a join auth.users u on u.id=a.user_id where a.user_id='{owner}' and a.role='game-owner' and a.enabled")=='1','Borrowed Staff Owner must survive fixture cleanup'

"""Source/discovery audit only: does not execute native browser or database tests."""
import json
from pathlib import Path
import subprocess
import yaml
BASE_MAIN='14df01a2c42d4cb36bd6c99d21372a1c51084164'
MAIN='ff4467ed7284b7c2497caf4df6dff6669043ca39'
root=Path(__file__).resolve().parents[3]
def git(*args):return subprocess.check_output(['git',*args],cwd=root,text=True).strip()
w=yaml.safe_load((root/'.github/workflows/browser-smoke.yml').read_text())
steps=w['jobs']['browser']['steps']
assert sum('run-browser-verification.mjs' in s.get('run','') for s in steps)==1
assert not any('exec playwright test' in s.get('run','') or 'test:browser' in s.get('run','') for s in steps)
components=next(s for s in steps if s.get('name')=='Verify complete Master operational components')
assert components['if']=="${{ needs.verification-plan.outputs.battle == 'true' }}"
for name in ['master-operations-browser-regression.mjs','technique-eligibility-browser-regression.mjs','event-workspace-browser-regression.mjs','nexus-desktop-integration-regression.mjs']:
 assert f'node apps/web/scripts/{name}' in components['run']
original=next(s for s in steps if s.get('name')=='Verify immediate System original restore through actual mutation responses')
assert original['env']['AV_BASIC_ORIGINAL_RPC_ACCEPTANCE']=='1'
assert original['if']==components['if']
assert 'COMPILE_ONLY' not in json.dumps(components)+json.dumps(original)
master_upload=next(s for s in steps if s.get('name')=='Save complete Master operational evidence')
assert master_upload['if']=='always()'
assert '/tmp/master-full-integration-review' in master_upload['with']['path']
assert any('/tmp/basic-original-rpc-review'==s.get('with',{}).get('path') for s in steps)
ci=yaml.safe_load((root/'.github/workflows/ci.yml').read_text())
assert any('verify-event-lifecycle-safety.sh' in s.get('run','') for j in ci['jobs'].values() for s in j.get('steps',[]))
changed=git('diff','--name-only',f'{BASE_MAIN}..{MAIN}').splitlines()
allowed={'.github/workflows/browser-smoke.yml','.github/workflows/ci.yml','.github/scripts/run-browser-verification.mjs','.github/scripts/run-browser-verification.test.mjs','apps/web/src/components/world/map-renderer.test.ts'}
for path in changed:
 if path not in allowed:assert git('diff',MAIN,'--',path)=='',path
code="""
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {classifyChanges,specInventory} from './.github/scripts/verification-plan.mjs';
import {browserCommands} from './.github/scripts/run-browser-verification.mjs';
const paths=execFileSync('git',['diff','--name-only','ff4467ed7284b7c2497caf4df6dff6669043ca39'],{encoding:'utf8'}).trim().split('\\n');
const selection=classifyChanges(paths.map(path=>({path,status:'M'})),specInventory());
assert.equal(selection.scope,'full');assert.equal(selection.battle,true);
const commands=browserCommands({schemaVersion:1,execute:true,...selection});
assert.equal(commands.length,3);assert.deepEqual(commands[1].files,[]);
console.log(JSON.stringify({scope:selection.scope,battle:selection.battle,commands}));
"""
plan=json.loads(subprocess.check_output(['node','--input-type=module','-e',code],cwd=root,text=True))
authority=plan['commands'][0]
expected=['master-complete-layout.pw.ts','master-world-environment-cadence.pw.ts','master-combat-content-authoring.pw.ts','staff-selected-character-access.pw.ts','master-players-recovery.pw.ts','battle-wasd-backtracking.pw.ts']
assert authority['files']==expected
assert '--repeat-each=2' in authority['args'] and '--project=desktop-chromium' in authority['args']
discovery=json.loads(subprocess.check_output(['corepack','pnpm',*authority['args'],'--list','--reporter=json'],cwd=root,text=True))
assert discovery['errors']==[]
def rows(suite):
 return [dict(file=s['file'],title=s['title'],project=t['projectName']) for s in suite.get('specs',[]) for t in s['tests']]+[row for child in suite.get('suites',[]) for row in rows(child)]
entries=[row for suite in discovery['suites'] for row in rows(suite)]
assert {x['project'] for x in entries}=={'desktop-chromium'}
selected_projects=[p for p in discovery['config']['projects'] if p['name']=='desktop-chromium']
assert len(selected_projects)==1 and selected_projects[0]['repeatEach']==2
assert {p['name'] for p in discovery['config']['projects']}=={'desktop-chromium','laptop-chromium','mobile-chromium'}
assert {x['file'].split('/')[-1] for x in entries}==set(expected)
result={'scope':'Source wiring and real discovery only; no native execution','main':MAIN,'preserved_main_paths':len(changed)-len(set(changed)&allowed),'main_changed_paths':len(changed),'selection':plan,'authority_cases':entries,'configured_repeat_each':2,'retired_preliminary_phases':0,'master_components_and_original_executable':True,'phase_preserved_master_artifacts':True,'event_emergency_gate_retained':True}
output=root/'docs/verification/task-10-reconstruction/task13-fix2-recovery-wiring-audit.json'
output.write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps({'main':MAIN,'main_changed_paths':len(changed),'preserved_main_paths':result['preserved_main_paths'],'scope':plan['scope'],'component_guards':plan['battle'],'native_phases':len(plan['commands']),'authority_case_project_entries':len(entries),'configured_repeat_each':2,'retired_preliminary_phases':0,'source_and_discovery_only':True},indent=2))

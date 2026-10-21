from pathlib import Path
import collections,gzip,hashlib,json,zipfile
root=Path.cwd(); evidence=root/'docs/verification/task-9-reconstruction'
p=next(Path('/tmp/players-fix5-profile').glob('*.cpuprofile'))
d=json.loads(p.read_text()); nodes={n['id']:n for n in d['nodes']}; parent={c:n['id'] for n in d['nodes'] for c in n.get('children',[])}
targets={'createLegalRosterDuel','playLegalRosterDuel','chooseBuildAwareRecruitAiDecision','executeBuildAwareRecruitAiAction','finishPv1fTurn','executePv1fMovement','publishCorrectionRoster','parseAbilityDefinition','validateStatDrivenCombatEncounterState','validateCombatAbilityState'}
inclusive=collections.Counter(); own=collections.Counter()
for id,dt in zip(d['samples'],d['timeDeltas']):
 frame=nodes[id]['callFrame']; own[(frame['functionName'],frame['url'].replace(str(root)+'/',''))]+=dt
 names=set()
 while id:
  fn=nodes[id]['callFrame']['functionName']
  if fn in targets:names.add(fn)
  id=parent.get(id)
 for fn in names:inclusive[fn]+=dt
profile={'rawProfileSha256':hashlib.sha256(p.read_bytes()).hexdigest(),'sampledDurationMs':round(sum(d['timeDeltas'])/1000,2),'inclusiveSamplesMs':{k:round(v/1000,2) for k,v in inclusive.most_common()},'topSelfSamples':[{'function':k[0],'source':k[1],'ms':round(v/1000,2)} for k,v in own.most_common(12)],'note':'CPU sample ancestry is diagnostic, not wall time or native runner measurement; inclusive categories overlap.'}
(evidence/'fix5-n4-profile-summary.json').write_text(json.dumps(profile,indent=2)+'\n')
(evidence/'fix5-n4-profile.cpuprofile.gz').write_bytes(gzip.compress(p.read_bytes(),mtime=0))
print('CPU_PROFILE_SUMMARY',json.dumps(profile,indent=2))
tracebase=Path('/workspace/scratch/081f137b6a6d/players-native-05aba4f4/home/runner/work/Aurevane/Aurevane/apps/web/test-results')
traces=[]
for path in sorted(tracebase.glob('master-players*/trace.zip')):
 with zipfile.ZipFile(path) as z:
  events=[json.loads(l) for l in z.read('test.trace').splitlines()]
  calls={e.get('callId'):e for e in events if e.get('type')=='before'}
  selected=[]
  for e in events:
   if e.get('type')!='after':continue
   b=calls.get(e.get('callId'),{});title=b.get('title','')
   if ('Players facts' in title or 'correction group' in title or 'XP correction in SQL' in title or e.get('error')):
    selected.append({'title':title,'method':b.get('method'),'error':bool(e.get('error')),'durationMs':round(e.get('endTime',0)-b.get('startTime',0),2)})
  traces.append({'repetition':path.parent.name,'traceSha256':hashlib.sha256(path.read_bytes()).hexdigest(),'selectedActions':selected})
(evidence/'fix5-native-trace-summary.json').write_text(json.dumps(traces,indent=2)+'\n')
print('NATIVE_TRACE_SUMMARY',json.dumps(traces,indent=2))
for path in ['apps/web/src/server/battle/roster-legal-duel.test-utils.ts','apps/web/src/server/master/modular-correction-publication.test.ts']:
 print('RESTORED_SOURCE_SHA256',path,hashlib.sha256((root/path).read_bytes()).hexdigest())

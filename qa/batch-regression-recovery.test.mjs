import test from 'node:test';
import assert from 'node:assert/strict';
import {WATCHED,decideRecovery,isAuthorizedRepo,dispatchInputFor,MAX_RECOVERIES_PER_CHECK} from '../scripts/batch-regression-recovery.mjs';

const stamp=Date.parse('2026-11-18T00:00:00Z');
const live=(conclusion,age=10,attempt=1)=>({
 status:'completed',conclusion,run_attempt:attempt,
 created_at:new Date(stamp-age*60000).toISOString(),id:123
});
test('every active batch category has a recovery watcher',()=>{
 const groups=new Set(WATCHED.flatMap(x=>x.groups));
 assert.deepEqual([...groups].sort(),
  ['faceHair','outfit','creatureMonster','creatureSummon','world','anime','gameQuality'].sort());
});
test('successful executions are not called source improvements',()=>{
 for(const s of WATCHED){
  const result=decideRecovery(s,live('success',1),stamp);
  assert.equal(result,'success');
 }
});
test('only QA workflows permit one failed-run retry',()=>{
 const qa=WATCHED.find(x=>x.workflow==='character-six-lane.yml');
 assert.equal(decideRecovery(qa,live('failure',5,1),stamp),'rerun_failed');
 assert.equal(decideRecovery(qa,live('failure',5,2),stamp),'escalate');
 const image=WATCHED.find(x=>x.workflow==='story-chapter1-free-complete-draft-production.yml');
 assert.equal(decideRecovery(image,live('failure',5,1),stamp),'escalate');
});
test('missed schedules dispatch only safe scheduled workflows',()=>{
 const qa=WATCHED.find(x=>x.workflow==='world-six-lane.yml');
 assert.equal(decideRecovery(qa,live('success',111),stamp),'dispatch');
 const free=WATCHED.find(x=>x.workflow==='story-cloudflare-free-daily.yml');
 assert.equal(decideRecovery(free,live('success',1621),stamp),'stale');
 const generator=WATCHED.find(x=>x.workflow==='story-chapter1-free-complete-draft-production.yml');
 assert.equal(decideRecovery(generator,null,stamp),'observe_only');
});
test('queued runs are left alone; repository guard is exact',()=>{
 const qa=WATCHED[0];
 assert.equal(decideRecovery(qa,{status:'queued',created_at:new Date(stamp).toISOString()},stamp),'running');
 assert.equal(isAuthorizedRepo('yamadayoshitaka/hai-gin-rpg'),true);
 assert.equal(isAuthorizedRepo('other/other'),false);
});

test('newly-added game quality, evolution, self-heal and source recovery are actually watched',()=>{
 for(const name of ['game-quality-six-lane.yml','quality-evolution-loop.yml',
  'batch-rule-self-heal.yml','batch-self-drive.yml']){
  const spec=WATCHED.find(x=>x.workflow===name);
  assert(spec,name+' not watched');
  assert.equal(spec.dispatch,true);
  assert(spec.maxAgeMinutes>=80);
  assert.equal(decideRecovery(spec,null,stamp),'dispatch');
  assert.equal(decideRecovery(spec,live('success',spec.maxAgeMinutes+1),stamp),'dispatch');
 }
 assert.equal(MAX_RECOVERIES_PER_CHECK,3,
  'no bulk restart of all heavy FPS/3D workflows within one watchdog run');
});
test('stale game QA dispatch rotates six different FPS and model lanes',()=>{
 const spec=WATCHED.find(x=>x.workflow==='game-quality-six-lane.yml');
 const switches={groups:{gameQuality:{enabled:true}}};
 const values=new Set();
 for(let hour=0;hour<6;hour++){
  values.add(dispatchInputFor(spec,'2026-11-18T'+String(hour).padStart(2,'0')+':00:00Z',switches).lane);
 }
 assert.equal(values.size,6);
});
test('stale quality evolution dispatch favors the oldest real unmeasured model domain',()=>{
 const spec=WATCHED.find(x=>x.workflow==='quality-evolution-loop.yml');
 const switches={groups:{faceHair:{enabled:true},outfit:{enabled:true}}};
 const last=domain=>({
  face:'2026-11-18T07:00:00Z',
  hair:null,
  outfit:'2026-11-18T08:00:00Z'
 })[domain];
 assert.equal(dispatchInputFor(spec,'2026-11-18T09:00:00Z',switches,last).domain,'hair');
 const disabled={groups:{faceHair:{enabled:false},outfit:{enabled:true}}};
 assert.equal(dispatchInputFor(spec,'2026-11-18T09:00:00Z',disabled,last).domain,'outfit');
 assert.equal(dispatchInputFor(spec,'2026-11-18T09:00:00Z',{groups:{}},last),null);
});
test('source recovery chooses only enabled categories and never overwrites artifacts',()=>{
 const spec=WATCHED.find(x=>x.workflow==='batch-self-drive.yml');
 const cfg={groups:{faceHair:{enabled:false},outfit:{enabled:false},
  creatureMonster:{enabled:true},world:{enabled:false},anime:{enabled:false}}};
 assert.equal(dispatchInputFor(spec,'2026-11-18T09:00:00Z',cfg).category,'creatureMonster');
 assert.equal(dispatchInputFor(spec,'2026-11-18T09:00:00Z',{groups:{}}),null);
 const standard=WATCHED.find(x=>x.workflow==='world-six-lane.yml');
 assert.deepEqual(dispatchInputFor(standard,'2026-11-18T09:00:00Z',cfg),{});
});

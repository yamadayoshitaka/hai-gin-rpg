import test from 'node:test';
import assert from 'node:assert/strict';
import {WATCHED,decideRecovery,isAuthorizedRepo} from '../scripts/batch-regression-recovery.mjs';

const stamp=Date.parse('2026-11-18T00:00:00Z');
const live=(conclusion,age=10,attempt=1)=>({
 status:'completed',conclusion,run_attempt:attempt,
 created_at:new Date(stamp-age*60000).toISOString(),id:123
});
test('every active batch category has a recovery watcher',()=>{
 const groups=new Set(WATCHED.flatMap(x=>x.groups));
 assert.deepEqual([...groups].sort(),
  ['faceHair','outfit','creatureMonster','creatureSummon','world','anime'].sort());
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

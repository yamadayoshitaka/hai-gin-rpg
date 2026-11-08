import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {COMMAND_BY_STATE,resolveJobMotion} from '../src/character-system/job-motion-source.js';
import {skirmishTravelMotion,measureSkirmishDashCoverage} from '../src/skirmish-dash-policy.js';

const data=JSON.parse(readFileSync(new URL('../job-command-motion-map.json',import.meta.url),'utf8'));
const jobs=data.jobs;
assert.ok(Object.keys(jobs).length>=10,'test every playable profession');
assert.deepEqual(COMMAND_BY_STATE.run,['ダッシュ','走行','弓を持って走る'],
 'never choose a slow walk or sneaking animation for the RUN state');

for(const name of Object.keys(jobs)){
 const run=resolveJobMotion(jobs,name,'run');
 assert.ok(run,'every job has a genuine dash clip: '+name);
 assert.equal(run.available,true,'mapped clip exists: '+name);
 assert.ok(/Running/.test(run.clip),'not a walking/sneaking clip: '+name+' -> '+run.clip);
 assert.ok(/Rig_Medium_Movement/.test(run.asset),'shared compatible retarget skeleton: '+name);
}
for(const name of ['盾戦士','農民・職人']){
 assert.equal(jobs[name].some(x=>x.available&&x.command==='ダッシュ'),false,
  'the original job map has no independent RUN for '+name);
 assert.equal(resolveJobMotion(jobs,name,'run').clip,'Running_A',
  'use same true run as swordfighter instead of slow Walking_A');
 assert.equal(resolveJobMotion(jobs,name,'walk').clip,'Walking_A',
  'a deliberate staircase walk still uses walking feet');
}
assert.equal(resolveJobMotion(jobs,'弓使い','run').clip,'Running_HoldingBow');
assert.equal(resolveJobMotion(jobs,'盗賊','run').clip,'Running_A',
 'thief runs in combat; Sneaking must not take precedence');
assert.equal(resolveJobMotion(jobs,'guardian','run').clip,'Running_A',
 'English job id resolves to its native class');
assert.equal(resolveJobMotion(jobs,'farmer','run').clip,'Running_A');

for(const phase of [null,'approach','toStair','upstairs','roof'])
 assert.equal(skirmishTravelMotion('walk',{floorPhase:phase}),'run',
  'ordinary 50v50 movement is a dash even through rooms: '+phase);
assert.equal(skirmishTravelMotion('walk',{floorPhase:'climb'}),'walk',
 'only the genuine stair treads use the slow walk');
assert.equal(skirmishTravelMotion('walk',{stealth:true}),'walk',
 'explicit stealth is an authorized slow movement');
for(const action of ['run','idle','hit','attack','skill','jump','dead'])
 assert.equal(skirmishTravelMotion(action),action,
  'non-walk actions must not be changed: '+action);

// Use REAL playing clips for coverage (not AI requested states).
const actors=Array.from({length:10},(_,i)=>({
 id:i,job:{name:'剣士'},hp:100,defeated:false,nextCell:{x:i+1,z:0},
 character:{diagnostics:()=>({state:i<9?'run':'walk'})}
}));
const states=new Map(actors.map(a=>[a.id,'run']));
let report=measureSkirmishDashCoverage(actors,states,25);
assert.deepEqual([report.moving,report.dash,report.walk,report.other,report.dashPercent],
 [10,9,1,0,90]);
actors[9].floorTravel={phase:'climb'};
actors[0].character.diagnostics=()=>({state:'hit'});
report=measureSkirmishDashCoverage(actors,states,25);
assert.equal(report.other,1);
assert.equal(report.exceptions[0].id,0,'report regressed run visuals for targeted debugging');

const game=readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
const rig=readFileSync(new URL('../src/character-system/shared-character-runtime.js',import.meta.url),'utf8');
assert.match(game,/if\(!massSim\)state=skirmishTravelMotion\(state/);
assert.match(game,/floorPhase:a\.floorTravel\?\.phase/);
assert.match(game,/else if\(a\.floorTravel\?\.phase==='climb'\)requestMotion\(a,'walk',true\)/);
assert.match(game,/window\.getSkirmishDashReport/,'query actual run/walk ratio during battle');
assert.match(game,/else if\(a\.nextCell\|\|\(a\.lastMovedAt!=null/);
assert.match(game,/from '\.\/src\/character-system\/job-motion-source\.js\?v=4\.6\.34'/);
assert.match(rig,/from '\.\/job-motion-source\.js\?v=4\.6\.33'/,
 'fresh motion resolver loads after the static browser cache');
console.log('PASS: every 50v50 job uses actual dash clip; only stair/stealth are walk; screen reports real animated dash coverage');

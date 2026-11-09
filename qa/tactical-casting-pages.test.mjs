import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CombatActionRuntime,LONG_CAST_SECONDS} from '../src/combat-action-runtime.js';
import {COMBAT_JOB_SPECS,COMBAT_OBJECT_SPECS} from '../src/combat-action-spec.js';
import {recomposeSquadAssignments} from '../src/battle-squad-recomposition.js';

assert.deepEqual(LONG_CAST_SECONDS,{mage:4,priest:5,summoner:6});
assert.equal(COMBAT_JOB_SPECS.mage.skills.find(s=>s.id==='inferno').radius,8);
assert.equal(COMBAT_JOB_SPECS.priest.skills.find(s=>s.id==='group_heal').radius,15);
assert.equal(COMBAT_OBJECT_SPECS.dragon_lord.radius,10);

const unit=(id,jobId,team,x,z,hp=100)=>({
 id,jobId,team,x,z,hp,maxHp:100,mp:250,maxMp:250,
 rarity:'UR',alive:true,cooldown:0
});
const makeSectors=units=>{
 const sectors=new Map();
 for(const u of units){
  if(!u.alive)continue;
  const key=Math.floor(u.x/5)+':'+Math.floor(u.z/5);
  if(!sectors.has(key))sectors.set(key,[]);
  sectors.get(key).push(u);
 }
 return sectors;
};
for(const [job,expected] of [['mage',4],['priest',5],['summoner',6]]){
 const caster=unit(0,job,0,8,8),ally=unit(1,'sword',0,9,8,20);
 const foe=unit(2,'fighter',1,11,8,100);
 const units=[caster,ally,foe];
 const runtime=new CombatActionRuntime({width:40,height:40,walkable:new Uint8Array(1600).fill(1)});
 runtime.beginTick(.1,units,{sectors:makeSectors(units)});
 assert.equal(runtime.tryAutoAction(caster,foe,units),true,job+' starts casting');
 assert.ok(caster._pendingCast,job+' has a pending chant');
 const end=caster._pendingCast.until;
 assert.ok(Math.abs(end-runtime.time-expected)<.01);
 assert.equal(foe.hp,100,'Damage never lands at chant start');
 assert.equal(ally.hp,20,'Healing never lands at chant start');
 assert.equal(runtime.objects.filter(o=>o.alive&&o.category==='summon').length,0);
 runtime.beginTick(expected-.25,units,{sectors:makeSectors(units)});
 runtime.tryAutoAction(caster,foe,units);
 assert.equal(foe.hp,100,'No premature caster impact');
 assert.equal(ally.hp,20,'No premature healer impact');
 runtime.beginTick(.3,units,{sectors:makeSectors(units)});
 runtime.tryAutoAction(caster,foe,units);
 assert.equal(caster._pendingCast,null,job+' resolves the chant');
 if(job==='mage')assert.ok(foe.hp<100,'Mage releases the improved spell');
 if(job==='priest')assert.ok(ally.hp>20,'Priest releases improved area healing');
 if(job==='summoner')assert.ok(runtime.objects.some(o=>o.alive&&o.category==='summon'),
  'Summoner materializes a powerful creature after the chant');
}
const soldiers=Array.from({length:20},(_,id)=>({
 id,team:0,squadId:id<10?0:1,jobId:id<6?'priest':id<10?'mage':'sword',hp:100,alive:true
}));
const plan=recomposeSquadAssignments(soldiers,{0:'support',1:'attack'},0,{},{
 0:{priest:5}
});
assert.equal(plan.assignments.length,20);
assert.equal(new Set(plan.assignments.map(a=>a.id)).size,20);
assert.ok(plan.summaries.find(s=>s.squadId==='0').heal>=5,'Manual job buttons reserve real priests');

const html=readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
assert.match(html,/manualScreen\.id='manualFormationScreen'/);
assert.match(html,/manualJobs\[id\]/);
assert.match(html,/manualPager\.append\(manualPrev,manualPageText,manualNext\)/,
 'Every manual profession is available through prev/next buttons');
assert.match(html,/MASS_JOBS\.slice\(manualPage\*manualPageSize/,
 'Manual editor shows a fixed page rather than a clipped scrolling list');
assert.doesNotMatch(html,/range\.type='range'/,'Formation sliders were removed');
assert.match(html,/squadQuickPage==='explore'/);
assert.match(html,/requestSquadRecovery\(target\.targetId\)/);
assert.doesNotMatch(html,/queueMultipleSquadRecovery/,'Support cannot multi-select');
assert.doesNotMatch(html,/commandDurationSeconds/,'No order-duration chooser');
assert.doesNotMatch(html,/commandSoldierAmount|chosenCount|countValues|quickCountChoices'/,'No soldier-count selector');
assert.match(html,/const issue=mode=>\{if\(issueSquadOrder\(mode\)\)closeSquadTactics\(\)\}/,'Every order applies to an entire squad');
const simulation=readFileSync(new URL('../src/mass-battle-grid-sim.js',import.meta.url),'utf8');
assert.doesNotMatch(simulation,/options\.count/,'The simulation no longer allows per-soldier command amounts');
assert.match(simulation,/this\.squadCommands\.set\(id,command\)/,'Orders are stored for the whole squad');
assert.match(html,/button\.userDataDeaths\.textContent/);
assert.match(html,/ribbonPageSize=5/);
assert.match(html,/const visibleRibbonPageSize=Math\.max\(1/,
 'Side squad icons adapt to screen height without scroll');
assert.match(html,/setOpeningWizardPage\('formation'\)/);
assert.match(html,/vitalsPageSize=5/);
console.log('PASS sustained casts, stronger broad magic, precise job buttons, non-scrolling pages and mirrored death counters');

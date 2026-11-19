import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {CombatActionRuntime} from '../src/combat-action-runtime.js';
import {battleJobSpecialActions} from '../src/battle-job-special-actions.js';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const ui=read('src/battle-realtime-commands.js');
const page=read('tactics-wireframe.html');
const mass=read('src/mass-battle-grid-sim.js');
const client=read('src/mass-battle-worker-client.js');
const worker=read('src/mass-battle-worker-runtime.js');

test('battle start is accepted only after battle state is unpaused',()=>{
 assert.match(ui,/const accepted=onStart\(\)/);
 assert.match(ui,/if\(accepted===false\)/);
 assert.match(page,/commandOverviewLocked=false;document\.body\.classList\.remove\('battle-command-active'\)/);
 assert.match(page,/if\(paused\)\{log\('戦闘開始を保留/);
});

test('50v50 high-ground selects a physical building, invokes floor travel and allows roof pursuit',()=>{
 assert.match(page,/if\(!massSim\)\{[\s\S]*?Detailed 50v50 battles use actor floorTravel/);
 assert.match(page,/id:'skirmish:'\+index\+':'\+kind/);
 assert.match(page,/requestUnitFloor\(selected,1,building\)/);
 assert.match(page,/selected\.floorTravel\.manualHighGroundTarget=true/);
 assert.match(page,/a\.floorTravel&&!a\.floorTravel\.manualHighGroundTarget/);
 assert.match(ui,/className='realtimeStructureMap'/);
});

test('shield knight offers a nominated ally cover action in both combat modes',()=>{
 for(const job of ['盾兵','盾騎士']){
  const cover=battleJobSpecialActions(job).find(action=>action.id==='frontline_guard');
  assert.equal(cover?.target,'ally');
  assert.match(cover.label,/身代わり防御/);
 }
 assert.match(page,/massSim\.assignShieldCover\(id,targetId,0\)/);
 assert.match(page,/massWorker\.assignShieldCover\(id,targetId,0\)/);
 assert.match(mass,/assignShieldCover\(squadId,targetSquadId,team=0\)/);
 assert.match(client,/type:'shieldCover'/);
 assert.match(worker,/case 'shieldCover'/);
});

test('shield interception transfers real HP damage to a nearby guarding knight',()=>{
 const rt=new CombatActionRuntime();
 const knight={id:1,team:0,squadId:'1',jobId:'shield',x:8,z:8,alive:true,hp:100,maxHp:100,
  guardCoverTargetSquadId:'2',guardCoverUntil:60};
 const ally={id:2,team:0,squadId:'2',jobId:'archer',x:9,z:8,alive:true,hp:100,maxHp:100};
 const enemy={id:3,team:1,squadId:'1',jobId:'sword',x:10,z:8,alive:true,hp:100,maxHp:100};
 rt.beginTick(0,[knight,ally,enemy]);
 const applied=rt.damageUnit(ally,40,enemy,'physical');
 assert.ok(applied>0);
 assert.ok(knight.hp<100,'guard actually loses HP on intercepted hit');
 assert.ok(ally.hp>80,'guarded ally takes reduced damage');
 assert.ok(rt.events.some(e=>e.type==='shieldCover'&&e.guardId===1&&e.targetId===2));
});

test('a distant or expired cover cannot reduce damage',()=>{
 const create=({x=8,until=60}={})=>{
  const rt=new CombatActionRuntime();
  const knight={id:1,team:0,squadId:'1',jobId:'shield',x,z:8,alive:true,hp:100,maxHp:100,
   guardCoverTargetSquadId:'2',guardCoverUntil:until};
  const ally={id:2,team:0,squadId:'2',jobId:'archer',x:9,z:8,alive:true,hp:100,maxHp:100};
  const enemy={id:3,team:1,squadId:'1',jobId:'sword',x:10,z:8,alive:true,hp:100,maxHp:100};
  rt.beginTick(0,[knight,ally,enemy]);rt.damageUnit(ally,40,enemy,'physical');
  return {knight,ally};
 };
 const far=create({x:100});
 const expired=create({until:0});
 assert.equal(far.knight.hp,100);
 assert.equal(expired.knight.hp,100);
 assert.equal(far.ally.hp,expired.ally.hp);
});

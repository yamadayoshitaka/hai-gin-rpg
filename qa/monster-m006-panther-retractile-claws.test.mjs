import assert from 'node:assert/strict';
import {MONSTER_BY_ID} from '../src/monster-catalog.js';
import {createMonsterModel,disposeMonsterSculpture,monsterSculptCacheStats}
 from '../src/monster-geometry.js';
import {MONSTER_ACTIONS,startMonsterAction,animateMonsterModel}
 from '../src/monster-animation.js';

assert.equal(MONSTER_BY_ID.m006.name,'黒爪パンサー');
let distant=0;
for(const detail of ['low','high']){
 const model=createMonsterModel(MONSTER_BY_ID.m006,{detail}),p=model.userData.pivots;
 assert.ok(p.paraspinal?.isGroup,detail+' real lumbar muscle pivot missing');
 assert.ok(p.caudalMuscle?.isGroup,detail+' tail musculature missing');
 for(const side of ['L','R']){
   assert.ok(p['scapula'+side]?.isGroup,'Missing independent panther scapula '+side);
   assert.equal(p['scapula'+side].parent,p.torso);
 }
 for(const limb of ['frontL','frontR','rearL','rearR']){
   assert.ok(p['wrist'+limb]?.isGroup,detail+' wrist missing '+limb);
   assert.ok(p['paw'+limb]?.isGroup,detail+' digits missing '+limb);
   assert.equal(p['wrist'+limb].parent,p['lower'+limb]);
   assert.equal(p['paw'+limb].parent,p['wrist'+limb]);
   for(let digit=0;digit<4;digit++)
     assert.equal(p['claw'+limb+digit].parent,p['paw'+limb],
       'Claws must articulate with their own digits');
 }
 const count=new Map();let tris=0;
 model.traverse(o=>{
   if(!o.isMesh)return;
   count.set(o.name,(count.get(o.name)||0)+1);
   const geo=o.geometry,v=geo.getAttribute('position');
   assert.ok(v?.count>2&&v.array.every(Number.isFinite),
      detail+' invalid actual mesh '+o.name);
   assert.equal(geo.getAttribute('uv')?.count,v.count,'Missing UV '+o.name);
   assert.equal(geo.getAttribute('normal')?.count,v.count,'Missing normals '+o.name);
   tris+=(geo.index?.count??v.count)/3;
 });
 for(const [part,n] of [
   ['m006-lumbar-multifidus',2],
   ['m006-mobile-scapular-muscle',2],['m006-masseter',2],
   ['m006-nostril',2],['m006-supraorbital-ridge',2],
   ['m006-vibrissa-follicle',8],['m006-rhinarium',1],
   ['m006-carpal-tarsal-cushion',4],
   ['m006-metapodial-pad',4],['m006-digit',16],
   ['m006-retractile-claw',16],['m006-tail-base-muscle',1]
 ])assert.equal(count.get(part),n,'Missing physical mesh '+part);
 assert.ok(tris>1500&&tris<900000,'Mobile poly ceiling violated');
 if(detail==='low')distant=tris;
 else assert.ok(tris>distant,'No near-LOD savings for panther');
 startMonsterAction(model,'walk',0);animateMonsterModel(model,.18);
 const first=p.wristfrontL.rotation.x,scap=p.scapulaR.rotation.x;
 animateMonsterModel(model,.38);
 assert.notEqual(p.wristfrontL.rotation.x,first,'Wrist not bending on stride');
 assert.notEqual(p.scapulaR.rotation.x,scap,'Scapula not moving');
 assert.notEqual(p.scapulaL.rotation.x,p.scapulaR.rotation.x,
   'Shoulders should not move in a rigid mirror');
 const claw=p.clawfrontL0;
 startMonsterAction(model,'walk',0);animateMonsterModel(model,.31);
 const retracted=claw.rotation.x;
 startMonsterAction(model,'attack',0);animateMonsterModel(model,.31);
 assert.ok(claw.rotation.x<retracted-.20,
   'Panther claws must extend for prey grasp and retract for stealth');
 for(const [action] of MONSTER_ACTIONS){
   startMonsterAction(model,action,0);animateMonsterModel(model,.25);
   for(const q of Object.values(p))
     assert.ok([q.rotation.x,q.rotation.y,q.rotation.z].every(Number.isFinite),
       'Nonfinite joint '+action);
 }
 disposeMonsterSculpture(model);
 assert.equal(monsterSculptCacheStats().activeMaterials,0,
   'm006 shared materials leaked on switching');
}
for(const id of ['m001','m005','m007','m015','m031']){
 const model=createMonsterModel(MONSTER_BY_ID[id],{detail:'low'});
 let leak=0;
 model.traverse(o=>{if(o.isMesh&&o.name.startsWith('m006-'))leak++});
 assert.equal(leak,0,'m006 panther components leaked to '+id);
 assert.equal(model.userData.pivots.paraspinal,undefined,
   'm006 lumbar pivot leaked to '+id);
 disposeMonsterSculpture(model);
 assert.equal(monsterSculptCacheStats().activeMaterials,0);
}
console.log('m006 real scapular, face, paw and 16 retractile-claw meshes / ten actions / LOD / species isolation PASS');

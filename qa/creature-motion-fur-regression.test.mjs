import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {startMonsterAction,animateMonsterModel} from '../src/monster-animation.js';
import {MONSTER_BY_ID} from '../src/monster-catalog.js';

const node=()=>({
 rotation:{x:0,y:0,z:0,set(x,y,z){this.x=x;this.y=y;this.z=z;}},
 position:{x:0,y:0,z:0,set(x,y,z){this.x=x;this.y=y;this.z=z;}},
 scale:{x:1,y:1,z:1,setScalar(v){this.x=this.y=this.z=v;}},
 userData:{},
});
const head=node(),wing=node(),tail=node(),lid=node(),leg=node(),lower=node();
lid.userData={restY:.4,blinkTravel:.09};
let faceUpdates=0;
const specimen={...node(),userData:{
 speciesId:'m011',homeScale:1,
 pivots:{head,wingL:wing,tail,eyelidL:lid,legfrontL:leg,lowerfrontL:lower},
 facialControls:{update(){faceUpdates++;}},
}};
startMonsterAction(specimen,'run',0);
animateMonsterModel(specimen,.25);
const livingWing=wing.rotation.z;
animateMonsterModel(specimen,.47);
assert.notEqual(wing.rotation.z,livingWing,'living bird wing must move in flight');
assert.ok(faceUpdates>0,'living face updates should continue');

startMonsterAction(specimen,'defeat',2);
animateMonsterModel(specimen,2.5);
assert.ok(specimen.scale.x<1,'defeat should interpolate down to its final pose');
animateMonsterModel(specimen,3.2);
const snapshot=()=>[specimen.rotation.x,specimen.rotation.z,
 specimen.position.y,specimen.scale.x,head.rotation.x,wing.rotation.x,
 wing.rotation.z,tail.rotation.y,lid.position.y,leg.rotation.z,
 lower.rotation.x];
const down=snapshot(),stoppedUpdates=faceUpdates;
assert.ok(lid.position.y<lid.userData.restY-.08,'defeated bird keeps eye shut');
assert.ok(lower.rotation.x>.20,'distal limb bends during defeat');
animateMonsterModel(specimen,18.0);
assert.deepEqual(snapshot(),down,'dead body, tail, wings and eyelids must stay still');
assert.equal(faceUpdates,stoppedUpdates,'no speech or facial idle updates after defeat');
assert.equal(specimen.userData.action,'defeat','death pose must not become idle');

startMonsterAction(specimen,'run',20);
animateMonsterModel(specimen,20.25);
assert.ok(faceUpdates>stoppedUpdates,'explicit new action resumes facial animation');
assert.equal(lid.position.y,lid.userData.restY,'living eye reopens after defeat');

const source=readFileSync(new URL('../src/monster-geometry.js',import.meta.url),'utf8');
assert.match(source,/else if\(s\.id!=='m003'&&s\.id!=='m005'\)/,
 'Fenrir and woodland wolf cannot retain duplicate rigid legacy paws');
assert.match(source,/g\.skinnedFur\(leg,'skin'/,
 'all three fur regions must use one GPU-skinned mesh per articulated leg');

const THREE=await import('three').catch(e=>{
 if(e.code!=='ERR_MODULE_NOT_FOUND')throw e;
 return null;
});
if(THREE){
 const {createMonsterModel,disposeMonsterSculpture}=
  await import('../src/monster-geometry.js');
 for(const id of ['m003','m004']){
  const model=createMonsterModel(MONSTER_BY_ID[id],{detail:'high'});
  const joints=model.userData.pivots;
  const fur=(name)=>{
   let found;model.traverse(x=>{if(x.name===name)found=x;});
   assert.ok(found,id+' missing '+name);return found;
  };
  const suffix='frontL';
  const paw=fur('canine-coat-leg'+suffix);
  assert.strictEqual(paw.parent,joints['leg'+suffix],
    id+' entire limb coat must be one shoulder-attached draw call');
  assert.equal(paw.isSkinnedMesh,true,id+' GPU-weighted fur required');
  assert.equal(paw.skeleton.bones.length,3,'upper/shin/paw must have independent bones');
  for(const [i,part] of ['leg','lower','toe'].entries()){
   assert.equal(paw.skeleton.bones[i].parent,joints[part+suffix],
    id+' coat bone '+part+' must track the anatomical pivot');
  }
  const positions=paw.geometry.getAttribute('position');
  const indices=paw.geometry.getAttribute('skinIndex');
  const weights=paw.geometry.getAttribute('skinWeight');
  assert.equal(indices.count,positions.count);
  assert.equal(weights.count,positions.count);
  let sampleIndex=-1;
  for(let i=0;i<positions.count;i++){
   const sum=weights.getX(i)+weights.getY(i)+weights.getZ(i)+weights.getW(i);
   assert.ok(Math.abs(sum-1)<.00001,'skin weights must sum to 1');
   if(indices.getX(i)===2&&weights.getX(i)>.8){sampleIndex=i;break;}
  }
  assert.ok(sampleIndex>=0,'no paw-weighted vertices');
  const point=new THREE.Vector3().fromBufferAttribute(positions,sampleIndex);
  model.updateMatrixWorld(true);
  const rest=point.clone().applyMatrix4(paw.matrixWorld);
  const old=paw.applyBoneTransform(sampleIndex,point.clone()).applyMatrix4(paw.matrixWorld);
  assert.ok(rest.distanceTo(old)<.0005,
    id+' coat bind pose must not shift vertices when model scale is applied');
  joints['toe'+suffix].rotation.x=.27;
  model.updateMatrixWorld(true);
  const moved=paw.applyBoneTransform(sampleIndex,point.clone()).applyMatrix4(paw.matrixWorld);
  assert.ok(old.distanceTo(moved)>.001,id+' moving toe must deform coat vertices');
  disposeMonsterSculpture(model);
 }
 const wolf=createMonsterModel(MONSTER_BY_ID.m001,{detail:'low'});
 let detailFur=0;wolf.traverse(x=>{
  if(x.name.startsWith('canine-coat-'))detailFur++;
 });
 assert.equal(detailFur,0,'low LOD must not grow new GPU-heavy strands');
 disposeMonsterSculpture(wolf);
}
console.log('Monster regression: motionless defeat, live recovery, joint-bound coats, duplicate Fenrir foot and low LOD PASS');

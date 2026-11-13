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
assert.match(source,/else if\(s\.id!=='m003'\)/,
 'Fenrir cannot retain the duplicate rigid legacy paw');
for(const name of ['upper','lower','paw'])
 assert.ok(source.includes("'canine-coat-'+region+name"),
   'limb fur segments must be named and follow their own parent joints');

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
  assert.strictEqual(fur('canine-coat-upper'+suffix).parent,joints['leg'+suffix],
    id+' upper coat must follow shoulder');
  assert.strictEqual(fur('canine-coat-lower'+suffix).parent,joints['lower'+suffix],
    id+' lower coat must follow shin');
  assert.strictEqual(fur('canine-coat-paw'+suffix).parent,joints['toe'+suffix],
    id+' paw coat must follow the actual toe pivot');
  const paw=fur('canine-coat-paw'+suffix);
  model.updateMatrixWorld(true);
  const old=new THREE.Vector3();paw.getWorldPosition(old);
  joints['toe'+suffix].rotation.x=.27;
  model.updateMatrixWorld(true);
  const moved=new THREE.Vector3();paw.getWorldPosition(moved);
  assert.ok(old.distanceTo(moved)>.00001,id+' moving toe must move its coat');
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

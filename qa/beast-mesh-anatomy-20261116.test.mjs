import assert from 'node:assert/strict';
import {MONSTER_BY_ID} from '../src/monster-catalog.js';
import {createMonsterModel,disposeMonsterSculpture} from '../src/monster-geometry.js';
import {startMonsterAction,animateMonsterModel} from '../src/monster-animation.js';

const remeshed=['m001','m002','m003','m004'];
for(const id of remeshed){
 const model=createMonsterModel(MONSTER_BY_ID[id],{detail:'high'});
 try{
  const meshes=[];
  model.traverse(node=>{if(node.isMesh)meshes.push(node);});
  const limbs=meshes.filter(m=>m.userData.anatomicalLimb);
  assert.equal(limbs.length,8,id+' must have continuous upper and lower muscle shells');
  // The reference target is a long wolf snout and flexed digitigrade limbs,
  // never an attached white muzzle sphere or straight tubular legs.
  const snout=meshes.filter(m=>m.name==='beast-continuous-nasal-bridge-'+id);
  const jaw=meshes.filter(m=>m.name==='beast-integrated-mandible-'+id);
  assert.equal(snout.length,1,id+' must have a continuous authored nose bridge');
  assert.equal(jaw.length,1,id+' must have one shaped lower jaw instead of stacked balls');
  assert.ok(snout[0].userData.axialAnatomy,id+' snout must contain real cross-section geometry');
  const nasal=meshes.filter(m=>m.name===(id==='m001'?'wolf-nasal-cartilage':id==='m002'?'m002-rhinarium':'beast-rhinarium-'+id));
  assert.equal(nasal.length,1,id+' rhinarium must not duplicate a round nose cap');
  for(const limb of limbs){
    const a=limb.geometry.getAttribute('position');
    let zMin=Infinity,zMax=-Infinity;
    for(let j=2;j<a.array.length;j+=3){
      zMin=Math.min(zMin,a.array[j]);zMax=Math.max(zMax,a.array[j]);
    }
    assert.ok(zMax-zMin>.12,id+' limb must contain a visible bend, not a straight column');
  }
  if(id==='m001'||id==='m002'){
    const p=model.userData.pivots;
    for(const side of ['L','R'])for(const segment of ['front','rear']){
      const name=segment+side;
      assert.ok(p['beastHock'+name]?.isGroup,id+' real hock/wrist missing '+name);
      assert.ok(p['beastToe'+name]?.isGroup,id+' metatarsal toe pivot missing '+name);
    }
    assert.ok(p.beastHockrearL.position.z<-.11,
      'Hind hock must sit behind the knee in the bind pose');
    assert.ok(p.beastToerearL.position.z>.16,
      'Hind foot needs a forward-projecting metatarsal');
    startMonsterAction(model,'walk',0);
    animateMonsterModel(model,.19);
    const first=p.beastHockrearL.rotation.x;
    animateMonsterModel(model,.49);
    assert.notEqual(p.beastHockrearL.rotation.x,first,
      id+' rear hock must flex during locomotion');
  }
  // Geometry, not rendered screenshots: the animal's shoulders taper to
  // a smaller waist/croup and the head sits lower in its ready stance.
  const trunk=meshes.find(m=>m.name==='species-shoulder-rib-pelvis-'+id);
  assert.ok(trunk?.userData.axialAnatomy,id+' must use a real torso loft');
  const torsoPositions=trunk.geometry.getAttribute('position');
  const spanAt=z=>{
    let span=0,samples=0;
    for(let k=0;k<torsoPositions.count;k++){
      if(Math.abs(torsoPositions.getZ(k)-z)>.043)continue;
      span=Math.max(span,Math.abs(torsoPositions.getX(k)));samples++;
    }
    assert.ok(samples>6,'Missing torso cross section for '+id+' z='+z);
    return span;
  };
  const frontWidth=spanAt(MONSTER_BY_ID[id].size*0+(.72+MONSTER_BY_ID[id].variant*.06)*.46);
  const rearWidth=spanAt(-(.72+MONSTER_BY_ID[id].variant*.06)*.56);
  assert.ok(frontWidth>rearWidth*1.32,
    id+' must narrow visibly from chest/shoulder toward the croup');
  assert.ok(model.userData.pivots.head.position.y<=1.301,
    id+' hunting head must be down near shoulder height');
  assert.ok(model.userData.pivots.jaw.position.y<=1.161,
    id+' mandible must align below lowered head');
  // The prior walk-action assertion intentionally compressed the support
  // limb. Reset to idle BEFORE asserting the clean neutral bind scale.
  startMonsterAction(model,'idle',0);
  animateMonsterModel(model,0);
  const beforeMotion=[...['frontL','frontR','rearL','rearR'].map(key=>
    model.userData.pivots['leg'+key].scale.y)];
  assert.ok(beforeMotion.every(n=>Math.abs(n-.88)<.0001),
   id+' idle pose must keep the anatomically shortened upper limb');
  assert.ok(Math.abs(model.userData.pivots.legrearL.rotation.x)>.12,
    id+' needs a bent rear leg even when not moving');
  assert.ok(Math.abs(model.userData.pivots.lowerfrontL.rotation.x)>.12,
    id+' elbow remains flexed in idle');
  assert.ok(model.position.y<0,id+' lower resting centre of gravity');
  startMonsterAction(model,'run',0);
  const bodyHeights=[];
  const compressed=[];
  for(const t of [.10,.17,.24,.31,.38,.46,.53]){
    animateMonsterModel(model,t);
    bodyHeights.push(model.position.y);
    compressed.push(...['frontL','frontR','rearL','rearR'].map(key=>
      model.userData.pivots['leg'+key].scale.y));
  }
  assert.ok(Math.max(...bodyHeights)-Math.min(...bodyHeights)<.019,
    id+' running body must not pogo bounce off the ground');
  assert.ok(Math.min(...compressed)<.97,id+' stance requires spring compression');
  assert.ok(Math.max(...compressed)<=.8801,
    id+' no elongating forelegs to fake a jump');
  startMonsterAction(model,'idle',.54);
  animateMonsterModel(model,.55);
  for(const key of ['frontL','frontR','rearL','rearR'])
    assert.equal(model.userData.pivots['leg'+key].scale.y,.88,
      id+' compression must reset after running');
  const chestProfile=trunk.geometry.getAttribute('position');
  let frontBottom=Infinity,rearBottom=Infinity;
  for(let i=0;i<chestProfile.count;i++){
    const z=chestProfile.getZ(i),y=chestProfile.getY(i);
    if(z>.13&&z<.5)frontBottom=Math.min(frontBottom,y);
    if(z<-.2&&z>-.55)rearBottom=Math.min(rearBottom,y);
  }
  assert.ok(frontBottom<rearBottom,
    id+' shoulder/chest underside should be lower than narrow waist');
  for(const [segment,pivot] of [
    ['root',model.userData.pivots.tail],
    ['middle',model.userData.pivots.tailMid],
    ['tip',model.userData.pivots.tailTip]
  ]){
    const patch=meshes.find(m=>m.name==='beast-tail-coat-'+segment);
    assert.ok(patch?.userData.furStrands>=150,id+' missing '+segment+' tail hair');
    assert.strictEqual(patch.parent,pivot,
      id+' tail follicles must move with '+segment+' bone');
  }
  const tailCoats=meshes.filter(m=>m.userData.furRegion==='tail');
  assert.equal(tailCoats.length,3,id+' should use one mesh per tail joint');
  // Anatomical face is assessed through actual mesh dimensions, not a
  // concept-art screenshot. Earlier variants used a long attached snout
  // and tiny black dots instead of a visible iris.
  const muzzlePosition=snout[0].geometry.getAttribute('position');
  let muzzleTip=-Infinity;
  for(let i=0;i<muzzlePosition.count;i++)
    muzzleTip=Math.max(muzzleTip,muzzlePosition.getZ(i));
  assert.ok(muzzleTip<.70,id+' muzzle must be shorter than the old .762 profile');
  const eyes=meshes.filter(m=>m.name==='eye');
  assert.equal(eyes.length,2,id+' should have two actual pigmented iris volumes');
  assert.ok(eyes.every(m=>m.scale.y>=.033&&
      m.scale.z>=(id==='m001'?.033:.05)),
    id+' iris should be visible while the m001 frontal iris sits inset: '+
      JSON.stringify(eyes.map(m=>({parent:m.parent?.name,scale:m.scale.toArray()}))));
  const ears=meshes.filter(m=>m.userData.foxPinna);
  const earLining=meshes.filter(m=>m.userData.foxPinnaInner);
  assert.equal(ears.length,2,id+' should have paired sharp fox-shaped pinnae');
  assert.equal(earLining.length,2,id+' needs an inner ear surface on both sides');
  assert.ok(ears.every(m=>m.geometry.getAttribute('position').count>=100),
    id+' fox cartilage requires a genuinely sculpted surface, not cones');
  for(const key of ['frontL','frontR','rearL','rearR']){
    const limb=model.userData.pivots['leg'+key];
    assert.equal(limb.userData.restLengthScale,.88,id+' missing 12% limb shortening');
    assert.ok(Math.abs(limb.position.y-(id==='m004'&&key.startsWith('rear')?-.54:.55))<.0001,
      id+' hip height must be adjusted along with limb length');
  }
  if(id==='m001'){
    const front=model.userData.pivots.legfrontL;
    const rear=model.userData.pivots.legrearL;
    assert.ok(Math.abs(front.position.x)>=.39,
      'm001 forelegs must attach to the shoulder flank, not front underside');
    assert.ok(Math.abs(rear.position.x)>=.31,
      'm001 hind legs must emerge from the lateral waist');
    assert.ok(front.position.x*rear.position.x>0,
      'm001 legs must preserve left/right side axes with no outward twist');
    const top=meshes.find(m=>m.name==='beast-upper-limb-frontL');
    const lower=meshes.find(m=>m.name==='beast-shin-frontL');
    const crossWidth=mesh=>{
      const a=mesh.geometry.getAttribute('position');let max=0;
      for(let k=0;k<a.count;k++)max=Math.max(max,Math.abs(a.getX(k)));
      return max;
    };
    assert.ok(crossWidth(top)<.175,
      'm001 upper forelegs must be visibly slimmer than the old bulky legs');
    assert.ok(crossWidth(lower)<.134,
      'm001 shins must taper without bloated fur cuffs');
    const eyes=meshes.filter(m=>m.name==='eye');
    assert.equal(eyes.length,2);
    assert.ok(eyes.every(m=>Math.abs(m.position.x)<.27&&m.position.z>.30),
      'm001 pupils/irises must be close-set on the skull front, not far apart');
    assert.equal(meshes.filter(m=>m.name.startsWith('m001-eyebrow-ridge-')).length,2,
      'm001 needs two anatomical brow ridges');
    const mane=model.userData.pivots.head.children.filter(
      m=>m.isMesh&&m.userData.wolfKingMane);
    assert.ok(mane.length>=2,'m001 dense mane must follow its animated skull');
    assert.ok(mane.reduce((n,m)=>n+(m.userData.furStrands||0),0)>1000,
      'm001 lion-like under-jaw and cheek mane needs dense, longer fur');
  }
  const keratin=meshes.filter(m=>m.userData.rootedKeratin);
  assert.ok(keratin.length>=11,id+' must have physically curved dorsal horns and canines');
  assert.equal(meshes.filter(m=>m.name==='beast-pupil').length,2,
    id+' needs pupils inside the existing eye sockets');
  assert.equal(meshes.filter(m=>m.name==='beast-corneal-glint').length,2,
    id+' needs two wet highlights on the iris surface');
  assert.ok(meshes.filter(m=>m.userData.furStrands).length>=6,
    id+' needs separate groomed fur batches for anatomy and articulated limbs');
  for(const mesh of [...limbs,...keratin]){
   assert.ok(mesh.geometry.getAttribute('position').array.every(Number.isFinite),
     id+' has non-finite anatomical geometry');
   assert.equal(mesh.geometry.getAttribute('normal').count,
     mesh.geometry.getAttribute('position').count,
     id+' has missing surface normals');
  }
  for(const leg of ['frontL','frontR','rearL','rearR'])
   assert.ok(model.userData.pivots['lower'+leg],id+' missing animated lower joint '+leg);
 }finally{disposeMonsterSculpture(model);}
}
// PR #345 protects the old ancient wolf; the mesh upgrade must not touch it.
const protectedWolf=createMonsterModel(MONSTER_BY_ID.m005,{detail:'high'});
try{
 let changed=0;
 protectedWolf.traverse(n=>{if(n.userData.anatomicalLimb||n.userData.rootedKeratin)changed++;});
 assert.equal(changed,0,'m005 protected source mesh must remain unchanged');
}finally{disposeMonsterSculpture(protectedWolf);}
console.log('Beast anatomical remesh: four species, eyes, fangs, horns, limbs, coat, protected m005 PASS');

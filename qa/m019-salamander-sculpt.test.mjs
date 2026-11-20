import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {MONSTER_BY_ID} from '../src/monster-catalog.js';
import {createMonsterModel,disposeMonsterSculpture} from '../src/monster-geometry.js';
import {startMonsterAction,animateMonsterModel} from '../src/monster-animation.js';
import {MAGMA_SALAMANDER_REVISION,MAGMA_SALAMANDER_BODY_DROP,MAGMA_SALAMANDER_LEG_REACH,
 magmaSkullFromWolfKing,magmaTorsoFromWolfKing} from '../src/magma-salamander-sculpt.js';
import {M019_HERO_REVISION,M019_BODY_DROP,M019_TAIL_LENGTH,
 M019_BODY_STRETCH,M019_LIMB_REACH,M019_LIMB_WIDTH,
 M019_APPROVED_SILHOUETTE,M019_SPRAWL_KNEE_X,M019_SPRAWL_KNEE_Y,
 M019_SPRAWL_FOOT_X,M019_SPRAWL_FOOT_Y,M019_SHOULDER_LOCAL_Y,
 m019HeroSkullRings,m019HeroTorsoRings}
 from '../src/m019-hero-sculpt.js';
import {m019FullBodyFit} from '../src/m019-full-body-camera.js';

test('m019 is an explicitly m001-derived original salamander, not a copied wolf',()=>{
 const donor=[{z:.5,y:0,rx:.1,ry:.1},{z:.4,y:0,rx:.2,ry:.2},
 {z:.3,y:0,rx:.3,ry:.3},{z:.2,y:0,rx:.4,ry:.3},
 {z:.1,y:0,rx:.4,ry:.3},{z:0,y:0,rx:.3,ry:.3},
 {z:-.1,y:0,rx:.25,ry:.2},{z:-.2,y:0,rx:.15,ry:.15}];
 const m=magmaSkullFromWolfKing(donor);
 assert.equal(m.length,donor.length);
 assert(m.every((p,i)=>i===0||p.z<m[i-1].z));
 assert(m.some((p,i)=>p.rx!==donor[i].rx));
 assert.equal(donor[0].rx,.1,'m001 donor must remain unmodified');
 const body=magmaTorsoFromWolfKing(Array.from({length:8},(_,i)=>({
  z:1-i*.25,y:1.3,rx:.4,ry:.35
 })));
 assert.equal(body.length,8);
 assert(body.every(x=>x.rx>.4&&x.ry>.35));
 assert.equal(MONSTER_BY_ID.m019.family,'reptile');
});

for(const detail of ['low','high']){
 test('m019 real 3D mesh and motion / '+detail,()=>{
  const model=createMonsterModel(MONSTER_BY_ID.m019,{detail});
  try{
   assert.equal(model.userData.m019SculptRevision,MAGMA_SALAMANDER_REVISION);
   assert.equal(model.userData.clonedFromSpecies,'m001');
   assert.equal(model.userData.speciesId,'m019');
   assert.equal(model.userData.m019ShortLegReach,MAGMA_SALAMANDER_LEG_REACH);
   const meshes=[],nameSet=new Set();
   model.traverse(o=>{if(o.isMesh){meshes.push(o);nameSet.add(o.name)}});
   assert(meshes.length>0,'real triangle meshes are required');
   assert(nameSet.has('m019-m001-sourced-closed-cranium'));
   assert.equal(model.userData.m019HeroSilhouette,M019_HERO_REVISION);
   assert.equal(model.userData.gameModelRevision,M019_HERO_REVISION);
   assert.equal(model.userData.m019ModelFollowsFourView,true);
   assert.deepEqual(model.userData.m019ApprovedTurnaround,
     M019_APPROVED_SILHOUETTE);
   assert.equal(model.userData.m019ApprovedTurnaround.legs,4);
   assert(nameSet.has('m019-unbroken-salamander-muzzle'));
   assert(nameSet.has('m019-articulated-wide-mandible'));
   assert(nameSet.has('m019-recessed-mouth-slit'));
   assert(!nameSet.has('quadruped-tongue'),'m019 must never show a floating tongue ball');
   assert(!nameSet.has('reptile-orbital-socket'),'m019 must use its own narrow eyes');
   assert(nameSet.has('m019-continuous-tail-tip'));
   assert.equal(nameSet.has('m019-cheek-horn-L'),false,
    'concept has only two major cranial horns, not extra tusks');
   const tailTipMesh=meshes.find(m=>m.name==='m019-continuous-tail-tip');
   assert.equal(tailTipMesh.userData.m019ClosedTaperedTail,true);
   assert.equal(tailTipMesh.userData.m019UpcurledTip,true);
   assert(tailTipMesh.geometry.getAttribute('position').array.some((v,i)=>
     i%3===1&&v>.47),'tail tip must actually rise in 3D');

   const skull=meshes.find(m=>m.name==='m019-m001-sourced-closed-cranium');
   assert.equal(skull.geometry.userData.faceVolumeApplied,true,
    'm019 must preserve the existing physically sculpted facial surface');
   assert(nameSet.has('m019-grand-horn-L')&&nameSet.has('m019-grand-horn-R'),
    'both large horns must follow the head pivot');
   for(const suffix of ['L','R']){
    const horn=meshes.find(m=>m.name==='m019-grand-horn-'+suffix);
    const pos=horn.geometry.getAttribute('position');
    const rings=detail==='low'?7:11,around=pos.count/rings;
    assert(Number.isInteger(around),'horn rows must be complete rings');
    const meanY=row=>{
     let sum=0;
     for(let i=0;i<around;i++)sum+=pos.getY(row*around+i);
     return sum/around;
    };
    const arc=meanY((rings-1)/2)-(meanY(0)+meanY(rings-1))/2;
    assert(arc>.20,'major horn needs a clearly arched crescent, not a straight rod');
   }
   assert(nameSet.has('m019-vertical-pupil-L')&&nameSet.has('m019-vertical-pupil-R'));
   assert(nameSet.has('m019-amber-iris-L')&&nameSet.has('m019-amber-iris-R'));
   assert([...nameSet].some(n=>n.startsWith('m019-lava-ridge-')));
   for(const suffix of ['L','R']){
    const channel=meshes.find(o=>o.name==='m019-molten-dorsal-channel-'+suffix);
    assert(channel?.parent,'both real dorsal heat channels must exist');
    assert.equal(channel.userData.m019SurfaceHeatChannel,true);
    if(detail!=='low')assert(channel.material.emissiveIntensity>.3,
      'molten fissure must emit light in near LOD');
   }
   assert(nameSet.has('m019-molten-tail-tip'),
     'the hot tail seam must follow the animated caudal tip');
   assert.equal(model.userData.m019VolcanicSurface,
     'dry-basalt-with-emissive-lava-fissures');
   assert(![...nameSet].some(n=>n.includes('billboard-lava')),
     'lava appearance must come from actual sculpted 3D mesh');
   assert(![...nameSet].some(n=>n.includes('wolf-mane')||n.includes('canine-fur')),
    'salamander must not grow the m001 fur coat');
   const pivot=model.userData.pivots;
   assert(pivot?.head&&pivot?.torso&&pivot?.tail);
   assert.equal(pivot.head.parent,pivot.torso,'m019 head must move with rib cage');
   assert.equal(pivot.torso.position.y,-M019_BODY_DROP);
   assert.equal(MAGMA_SALAMANDER_BODY_DROP,M019_BODY_DROP);
   assert(M019_BODY_DROP>=.80,'the entire ribcage must stay low, not only the legs');
   assert.equal(pivot.tail.scale.z,M019_TAIL_LENGTH);
   assert(pivot.tailTip?.userData!==undefined,'tail tip must be a movable pivot');
   assert.equal(pivot.tailMid.parent,pivot.tail);
   assert.equal(pivot.tailTip.parent,pivot.tailMid);
   // A formerly +.164 Y offset created a visible disconnected tail.
   // Current outer mid ring is at y=-.108; the tip inlet is y=-.016.
   assert(Math.abs((pivot.tailTip.position.y-.016)-(-.108))<.075,
    'the upcurled tip must overlap the previous anatomical tail ring');

   const body=meshes.find(o=>o.name==='species-shoulder-rib-pelvis-m019');
   assert.equal(body?.parent,pivot.torso);
   assert(body.userData.anatomicalStations>=8);
   assert.equal(body.userData.closedAnatomicalHull,true,
     'thin torso needs end caps to prevent neck/tail holes');
   model.updateMatrixWorld(true);
   const bodySize=new THREE.Box3().setFromObject(body)
     .getSize(new THREE.Vector3());
   assert(bodySize.z>bodySize.x*3.8,
     'approved side silhouette is a very long narrow lizard');
   assert(bodySize.z>bodySize.y*3.5,
     'approved body is long and dorsoventrally flattened');
   const bodyBox=new THREE.Box3().setFromObject(body);
   assert(bodyBox.min.y>.06&&bodyBox.min.y<.28,
     'belly must skim above ground without clipping the floor');
   assert(bodyBox.getCenter(new THREE.Vector3()).y<.60,
     'torso center must not float above the short sideways legs');
   const snout=meshes.find(o=>o.name==='m019-unbroken-salamander-muzzle');
   assert.equal(snout.parent,pivot.head,'snout follows skull');
    const snoutPosition=snout.geometry.getAttribute('position');
    let snoutMaxWidth=0;
    for(let q=0;q<snoutPosition.count;q++)
      snoutMaxWidth=Math.max(snoutMaxWidth,Math.abs(snoutPosition.getX(q)));
    assert(snoutMaxWidth<.16,
      'm019 pointed snout must be visibly narrower than the previous face');
   const mandible=meshes.find(o=>o.name==='m019-articulated-wide-mandible');
   assert.equal(mandible.parent,pivot.jaw);
   assert.equal(pivot.jaw.parent,pivot.head);
   for(const legId of ['legfrontL','legfrontR','legrearL','legrearR']){
    const leg=pivot[legId];
    assert(leg?.userData.m019ShortPlantedLeg,legId+' must be short');
    assert.equal(leg.scale.y,MAGMA_SALAMANDER_LEG_REACH);
    assert.equal(leg.parent,pivot.torso,
      'hips must follow body motion without drifting');
    assert.equal(leg.scale.x,M019_LIMB_WIDTH);
    assert.equal(leg.scale.z,M019_LIMB_WIDTH);
    assert.equal(leg.scale.y,M019_LIMB_REACH);
    assert(Math.abs(leg.position.z)>1,
      'fore and hind legs must be separated across elongated body');
    assert(nameSet.has('m019-seamless-skin-'+legId.slice(3)));
    assert(!nameSet.has('m019-scaled-upper-limb-'+legId.slice(3)));
    assert(!nameSet.has('m019-scaled-lower-limb-'+legId.slice(3)),
      'a detached shin post must not survive alongside the new skin');
    assert(nameSet.has('m019-rooted-claw-'+legId.slice(3)+'-0'));
    assert(nameSet.has('m019-rooted-claw-'+legId.slice(3)+'-3'));
    const toe=pivot['toe'+legId.slice(3)];
    assert(toe?.userData.m019PlantedToeJoint,'m019 toes must follow joint');
    const side=legId.endsWith('L')?-1:1;
    const knee=pivot[legId.replace('leg','lower')];
    assert.equal(knee.userData.m019SprawledKnee,true,
      'true knee bones must spread laterally, not just drawn decorations');
    assert.equal(knee.position.x,side*M019_SPRAWL_KNEE_X);
    assert.equal(knee.position.y,M019_SPRAWL_KNEE_Y);
    assert.equal(toe.position.x,side*M019_SPRAWL_FOOT_X);
    assert.equal(toe.position.y,M019_SPRAWL_FOOT_Y);
    assert.equal(leg.position.y,M019_SHOULDER_LOCAL_Y);
    assert.equal(leg.userData.m019AnatomicalSocket,true);
    assert.equal(leg.userData.m019RightAngleUpperArm,true);
    const suffix=legId.slice(3);
    const root=meshes.find(o=>o.name==='m019-shoulder-hip-fascia-'+suffix);
    assert.equal(root?.parent,pivot.torso,'shoulder skin follows body');
    assert.equal(root?.userData.m019TorsoAnchoredSocket,true);
    const upper=meshes.find(o=>o.name==='m019-seamless-skin-'+suffix);
    assert.equal(upper?.parent,leg,'whole muscle skin follows shoulder');
    // The old tests verified CPU vertices, while Android still drew only
    // leg shadows. Verify an independent, non-deformed, visible pair for
    // every limb in BOTH LODs, even if outer skin is unavailable to WebGL.
    const mobileUpper=meshes.find(o=>o.name==='m019-mobile-upper-'+suffix);
    const mobileShin=meshes.find(o=>o.name==='m019-mobile-shin-'+suffix);
    assert(mobileUpper?.isMesh&&mobileShin?.isMesh,
      suffix+' requires real permanent upper and lower meshes');
    assert.equal(mobileUpper.parent,leg);
    assert.equal(mobileShin.parent,knee);
    for(const part of [mobileUpper,mobileShin]){
      assert.equal(part.userData.m019IndependentVisibleCore,true);
      assert.equal(part.isSkinnedMesh,undefined);
      assert(part.visible&&part.material.visible&&!part.material.transparent);
      assert(part.geometry.getAttribute('position').count>=24);
      assert(part.geometry.getIndex().count>=24);
    }
    model.updateMatrixWorld(true);
    const mobileUpperBox=new THREE.Box3().setFromObject(mobileUpper);
    const mobileShinBox=new THREE.Box3().setFromObject(mobileShin);
    assert(mobileUpperBox.max.y>.40,
      'mobile upper muscle must rise above terrain/torso occlusion');
    assert(mobileShinBox.max.y>.35&&mobileShinBox.min.y>-.06,
      'mobile shin must visibly connect knee to the planted foot');
    const mobileOuter=new THREE.Box3().setFromObject(mobileUpper);
    assert(side>0?mobileOuter.max.x>bodyBox.max.x+.20:
      mobileOuter.min.x<bodyBox.min.x-.20,
      'mobile-visible core must extend outside the torso silhouette');
    // A real visible Mesh avoids the v9 GPU-skinned surface which vanished
    // on Android while CPU skeleton-space tests still returned PASS.
    assert.equal(upper.isMesh,true);
    assert.equal(upper.isSkinnedMesh,undefined,
      'm019 must not depend on a device-specific GPU skinning path');
    assert.equal(upper.userData.m019GpuSkinningRemoved,true);
    assert.equal(upper.userData.m019VisibleLimbRenderer,'cpu-deformed-tube');
    assert.equal(typeof upper.userData.m019RefreshVisibleLimb,'function');
    assert.equal(upper.userData.m019WholeLegClosedSurface,true);
    assert.equal(upper.geometry.getAttribute('skinIndex'),undefined);
    assert.equal(upper.frustumCulled,false);
    model.updateMatrixWorld(true);
    const limbBox=new THREE.Box3().setFromObject(upper);
    const limbExtents=limbBox.getSize(new THREE.Vector3());
    assert(limbExtents.x>.30&&limbExtents.y>.22,
      'real visible shoulder-to-ankle mesh must occupy substantial width and height');
    // A shadow-only leg can have a valid world-space bounding box. Require
    // a muscle crest above the terrain and clearly outside the rib cage,
    // plus real warm-basalt colour contrast against the black torso.
    assert(limbBox.max.y>.39,
      'upper muscle must rise above the ground and dark belly occluder');
    if(side>0)
     assert(limbBox.max.x>bodyBox.max.x+.31,
      'right elbow must project beyond the torso silhouette');
    else
     assert(limbBox.min.x<bodyBox.min.x-.31,
      'left elbow must project beyond the torso silhouette');
    assert(upper.material.color.r>body.material.color.r*1.65,
      'real limb basalt must remain visible against charcoal torso');
    assert.equal(upper.userData.m019AboveFloorMuscleCrest,true);
    assert(upper.material.color.getHex()>0,
      'visible limbs must have a real lit basalt material');
    assert.equal(upper?.userData.m019HorizontalThigh,true);
    // A vertical-oriented limbLoft turns lateral muscles into flat sheets.
    // TubeGeometry cross sections face the sideways bone and stay round.
    assert.equal(upper.userData.m019TrueRoundLimb,true);
    assert.equal(upper.userData.m019CrossSectionsPerpendicularToAxis,true);
    assert.equal(upper.userData.cappedTubularSkin,true);
    assert.equal(upper.material.userData.m019DryObsidian,true);
    const upperRoot=upper.geometry.getAttribute('position');
    const radial=detail==='low'?5:8,ring=radial+1;
    let minY=Infinity,maxY=-Infinity,minZ=Infinity,maxZ=-Infinity;
    for(let j=0;j<ring;j++){
     minY=Math.min(minY,upperRoot.getY(j));
     maxY=Math.max(maxY,upperRoot.getY(j));
     minZ=Math.min(minZ,upperRoot.getZ(j));
     maxZ=Math.max(maxZ,upperRoot.getZ(j));
    }
    assert(maxY-minY>.21&&maxZ-minZ>.21,
      'round shoulder/thigh needs substantial muscle depth in both axes');
    assert((maxY-minY)/(maxZ-minZ)>.58 &&
           (maxY-minY)/(maxZ-minZ)<1.72,
      'lateral upper leg must not be an extremely flat oval');
    assert(nameSet.has('m019-limb-molten-crack-'+suffix+'-0'),
      'heat channel must follow the rounded moving limb');
    if(detail==='high')assert(nameSet.has('m019-limb-molten-crack-'+suffix+'-1'),
      'near LOD preserves branching molten limb markings');
    assert.equal(upper.userData.m019VerticalShin,true);
    // Validate the ACTUAL deforming mesh, not only its joint coordinates.
    model.updateMatrixWorld(true);
    const geoPos=upper.geometry.getAttribute('position');
    const capIndex=geoPos.count-1;
    const capPosition=new THREE.Vector3().fromBufferAttribute(geoPos,capIndex);
    upper.userData.m019RefreshVisibleLimb();
    const renderedEnd=upper.localToWorld(capPosition);
    const toeWorldPosition=toe.getWorldPosition(new THREE.Vector3());
    assert(renderedEnd.distanceTo(toeWorldPosition)<.045,
      'the REAL visible ankle cap must meet the planted toes');
    const hipWorld=leg.getWorldPosition(new THREE.Vector3());
    const footWorld=toe.getWorldPosition(new THREE.Vector3());
    assert(side*(footWorld.x-hipWorld.x)>.38,
      'each foot must be wider than the narrow ribcage');
    const kneeWorld=knee.getWorldPosition(new THREE.Vector3());
    const upperVector=kneeWorld.clone().sub(hipWorld);
    const lowerVector=footWorld.clone().sub(kneeWorld);
    assert(side*upperVector.x>.38,'upper thigh extends sideways');
    assert(Math.abs(upperVector.y)<Math.abs(upperVector.x)*.20,
      'upper arm nearly horizontal, not a dangling dog leg');
    assert(Math.abs(lowerVector.x)<.035,
      'lower forearm must descend vertically');
    assert(lowerVector.y>-.47&&lowerVector.y<-.24,
      'shin is short and vertical, not a long hanging stilt');
    const cosAngle=Math.abs(upperVector.dot(lowerVector)/
      (upperVector.length()*lowerVector.length()));
    assert(cosAngle<.19,'upper and lower segments must meet near 90 degrees');
    const upperEnd=leg.localToWorld(new THREE.Vector3(
      side*M019_SPRAWL_KNEE_X,M019_SPRAWL_KNEE_Y,
      legId.includes('front')?-.012:.022));
    assert(upperEnd.distanceTo(kneeWorld)<1e-5,
      'upper and lower shells share precisely the same world-space elbow');
    assert.equal(toe.userData.m019SprawledOutward,true);
    model.updateMatrixWorld(true);
    const groundBox=new THREE.Box3().setFromObject(toe);
    assert(groundBox.min.y>-.09&&groundBox.min.y<.10,
      'four small feet must remain grounded at bind pose, '+legId);
    assert.equal(toe.parent,pivot[legId.replace('leg','lower')],
      'toes follow the hock after leg animation');
    const lowerId=legId.replace('leg','lower');
    assert(pivot[lowerId]?.parent===leg,'lower joint must follow upper leg');
   }
   for(const id of ['m019-grand-horn-L','m019-grand-horn-R',
    'm019-amber-iris-L','m019-amber-iris-R']){
    const obj=meshes.find(o=>o.name===id);
    assert.equal(obj.parent,pivot.head,id+' detached from head');
   }
   for(const obj of meshes){
    const p=obj.geometry?.getAttribute('position');
    assert(p?.count>0,obj.name+' missing geometry');
    for(let i=0;i<p.count;i++){
     assert(Number.isFinite(p.getX(i))&&Number.isFinite(p.getY(i))&&
      Number.isFinite(p.getZ(i)),obj.name+' has invalid vertex');
    }
   }
   assert.doesNotThrow(()=>{
    for(const action of ['idle','walk','run']){
     startMonsterAction(model,action,0);
     for(const time of [0,.15,.4,.85,1.1]){
      animateMonsterModel(model,time);
      model.updateMatrixWorld(true);
      for(const id of ['frontL','frontR','rearL','rearR']){
       const joint=pivot['lower'+id],arm=pivot['leg'+id];
       const side=id.endsWith('L')?-1:1;
       const end=arm.localToWorld(new THREE.Vector3(
        side*M019_SPRAWL_KNEE_X,M019_SPRAWL_KNEE_Y,
        id.startsWith('front')?-.012:.022));
       assert(end.distanceTo(joint.getWorldPosition(new THREE.Vector3()))<1e-5,
        action+' '+time+' must never split the elbow/knee');
       const mesh=model.getObjectByName('m019-seamless-skin-'+id);
       const toes=pivot['toe'+id];
       const verts=mesh.geometry.getAttribute('position');
       const capIndex=verts.count-1;
       const cap=new THREE.Vector3().fromBufferAttribute(verts,capIndex);
       const skinFoot=mesh.localToWorld(cap);
       assert(skinFoot.distanceTo(toes.getWorldPosition(new THREE.Vector3()))<.055,
        action+' '+time+' visible solid arm must stay attached to animated foot');
       assert(mesh.visible&&mesh.material.visible,
        action+' '+time+' skin cannot disappear via visibility or material');
       const lowerSafe=model.getObjectByName('m019-mobile-shin-'+id);
       const upperSafe=model.getObjectByName('m019-mobile-upper-'+id);
       assert(upperSafe.visible&&lowerSafe.visible,
         action+' '+time+' independent mobile limbs must remain visible');
       assert.equal(upperSafe.parent,arm);
       assert.equal(lowerSafe.parent,joint);
       const worldBox=new THREE.Box3().setFromObject(mesh);
       const worldSize=worldBox.getSize(new THREE.Vector3());
       assert(worldSize.x>.28&&worldSize.y>.17,
        action+' '+time+' visible limb must not collapse into an unseen strip');
      }
     }
    }
   });
   model.updateMatrixWorld(true);
   const bounds=new THREE.Box3().setFromObject(model);
   assert(!bounds.isEmpty(),'m019 bounds must be nonempty');
   assert(bounds.max.y>bounds.min.y&&bounds.max.z>bounds.min.z);
  }finally{disposeMonsterSculpture(model)}
 });
}

test('m019 does not change other reptile silhouettes',()=>{
 const other=createMonsterModel(MONSTER_BY_ID.m016,{detail:'low'});
 try{
  assert.equal(other.userData.m019SculptRevision,undefined);
  const names=[];
  other.traverse(obj=>{if(obj.isMesh)names.push(obj.name)});
  assert(!names.some(n=>n.startsWith('m019-')));
 }finally{disposeMonsterSculpture(other)}
});

test('m019 heroic silhouette is genuinely flatter and longer than the wolf donor',()=>{
 const donor=[
 {z:.80,y:1.27,rx:.12,ry:.25},{z:.63,y:1.29,rx:.39,ry:.34},
 {z:.44,y:1.31,rx:.49,ry:.38},{z:.19,y:1.32,rx:.45,ry:.36},
 {z:-.15,y:1.28,rx:.37,ry:.31},{z:-.42,y:1.27,rx:.34,ry:.28},
 {z:-.72,y:1.26,rx:.26,ry:.24},{z:-.83,y:1.26,rx:.11,ry:.10}
 ];
 const grown=m019HeroTorsoRings(donor);
 assert.equal(grown.length,donor.length);
 assert(grown[0].z>donor[0].z&&grown.at(-1).z<donor.at(-1).z,
  'rib cage must extend forward and backward');
 assert(grown.every((p,i)=>p.rx<donor[i].rx*.7),
  'approved narrow silhouette requires a small cross-sectional width');
 assert(grown.every((p,i)=>Math.abs(p.z-donor[i].z*M019_BODY_STRETCH)<1e-10),
  'all torso source stations must stretch in the long axis');
 assert(grown.every((p,i)=>p.ry<donor[i].ry),
  'reptilian chest should be flatter than the wolf mother');
 assert.equal(donor[0].z,.80,'never mutate wolf-donor stations');
 const head=m019HeroSkullRings([
  {z:.36,y:-.16,rx:.03,ry:.035},
  {z:.33,y:-.14,rx:.08,ry:.06},
  {z:.30,y:-.11,rx:.11,ry:.09},
  {z:.27,y:-.04,rx:.17,ry:.12},
  {z:.20,y:-.01,rx:.21,ry:.14},
  {z:.15,y:.02,rx:.23,ry:.17},
  {z:.06,y:.05,rx:.27,ry:.19},
  {z:-.12,y:.06,rx:.29,ry:.2},
  {z:-.33,y:.02,rx:.24,ry:.17},
  {z:-.51,y:-.01,rx:.17,ry:.12},
  {z:-.64,y:-.03,rx:.05,ry:.06}
 ]);
 assert(head.every((r,i)=>i===0||r.z<head[i-1].z));
 assert(head.every(r=>r.rx>0&&r.ry>0));
 assert(head[6].ry<head[6].rx,'head must be a flattened wedge');
});

test('m016/m017 retain their separate salamander lineages',()=>{
 for(const id of ['m016','m017']){
  const model=createMonsterModel(MONSTER_BY_ID[id],{detail:'low'});
  try{
   assert.equal(model.userData.m019HeroSilhouette,undefined);
   assert(model.userData.salamanderLineageRevision);
   let count=0;
   model.traverse(obj=>{if(obj.name.startsWith('m019-'))count++});
   assert.equal(count,0,'m019-exclusive meshes must not leak into '+id);
  }finally{disposeMonsterSculpture(model)}
 }
});


test('portrait and landscape camera fit the entire m019 from nose to tail',()=>{
 for(const aspect of [.34,.43,.57,.72,1.33,1.80]){
  const fit=m019FullBodyFit({
    width:1.30,height:2.0,depth:9.2,aspect,fovDegrees:42
  });
  const halfHorizontal=Math.tan(fit.horizontalFovRadians/2);
  assert(fit.horizontalSpan/(2*fit.distance)<=halfHorizontal*.88+1e-10,
   'camera must use horizontal FOV to fit the tail at aspect '+aspect);
  assert(fit.distance>=4);
  assert.equal(fit.azimuth,'negative-x-side-head-right');
 }
});

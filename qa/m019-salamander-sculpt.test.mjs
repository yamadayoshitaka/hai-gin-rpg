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
   assert.equal(model.userData.m019VisibleLimbSegmentCount,8);
   assert(!model.userData.m019VisibleLimbUpdaters?.length,
    'old animated CPU tube duplicating the bridge must be removed');
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
    assert(!nameSet.has('m019-seamless-skin-'+legId.slice(3)),
      'overlaid CPU muscle skin would produce doubled polygonal legs');
    assert(!nameSet.has('m019-scaled-upper-limb-'+legId.slice(3)));
    assert(!nameSet.has('m019-scaled-lower-limb-'+legId.slice(3)),
      'a detached shin post must not survive alongside the new skin');
    assert(nameSet.has('m019-rooted-claw-'+legId.slice(3)+'-0'));
    assert(nameSet.has('m019-rooted-claw-'+legId.slice(3)+'-3'));
    const pawSuffix=legId.slice(3);
    const footMeshes=[];
    model.getObjectByName('toe'+pawSuffix)?.traverse(obj=>{
      if(obj.isMesh)footMeshes.push(obj);
    });
    const footByName=new Map(footMeshes.map(obj=>[obj.name,obj]));
    const existingPad=footByName.get('m019-metatarsal-'+pawSuffix);
    assert(existingPad?.isMesh,'original planted metatarsal must remain');
    assert(existingPad.scale.y<existingPad.scale.x*.40,
      'paw must be flattened for weight-bearing contact, not a round bulb');
    assert.equal(footMeshes.filter(obj=>obj.name==='m019-metatarsal-'+pawSuffix).length,1,
      'do not add duplicate hovering foot pads');
    for(let digit=0;digit<4;digit++){
      const finger=footByName.get('m019-digit-'+pawSuffix+'-'+digit);
      const claw=footByName.get('m019-rooted-claw-'+pawSuffix+'-'+digit);
      assert(finger?.isMesh&&claw?.isMesh,
        'all four fingers and curved talons must exist even at low LOD');
      assert.equal(finger.userData.m019ContinuousBasaltDigit,true);
      assert(finger.geometry.parameters.radius>=(detail==='low'?.0215:.0285),
        'digit roots must be visible and rounded at every LOD');
      assert.equal(claw.userData.rootedKeratin,true);
      assert.equal(claw.userData.m019CurvedKeratinTalon,true);
      assert.equal(claw.userData.m019EmbeddedInFinger,true);
      assert.equal(claw.geometry.userData.kind,'curved-keratin-horn');
      assert(claw.geometry.getIndex().count>60,
        'actual curved multi-ring claw geometry is required');
      assert(claw.visible&&claw.material.visible&&!claw.material.transparent);
      assert(claw.material.color.r<.45,
        'claw must use dark volcanic keratin instead of pale ivory');
      assert(claw.material.roughness>=.80,
        'volcanic talons need a dry matte keratin finish');
      const endpoints=claw.geometry.userData;
      assert(endpoints.tip[2]>endpoints.root[2]+.08,
        'talon must project beyond its rooted nail bed');
      assert(endpoints.tip[1]<-.04,
        'curved talon ends near the contact plane, not levitating');
      assert.equal(
        footByName.has('m019-nail-bed-fissure-'+pawSuffix+'-'+digit),
        detail!=='low','near LOD has nail-bed lava seams only');
    }
    assert.equal(
      footMeshes.filter(obj=>obj.userData.m019RootedBasaltScute).length,
      detail==='low'?0:3,
      'high-detail paws carry shallow embedded rock scutes');
    const toe=pivot['toe'+legId.slice(3)];
    assert(toe?.userData.m019PlantedToeJoint,'m019 toes must follow joint');
    assert.equal(toe.userData.m019ToeCount,4);
    assert.equal(toe.userData.m019PawFinish,
      'basalt-scutes-with-rooted-curved-keratin');
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
    const upper=meshes.find(m=>m.name==='m019-mobile-upper-'+suffix);
    const shin=meshes.find(m=>m.name==='m019-mobile-shin-'+suffix);
    assert(upper?.isMesh&&shin?.isMesh,'four legs each need real upper and shin');
    assert.equal(upper.parent,leg);
    assert.equal(shin.parent,knee);
    assert.equal(meshes.filter(m=>m.name==='m019-mobile-upper-'+suffix).length,1);
    assert.equal(meshes.filter(m=>m.name==='m019-mobile-shin-'+suffix).length,1);
    assert(!meshes.some(m=>m.name.startsWith('m019-limb-molten-crack-'+suffix)),
      'old detached orange limb bars must not render');
    for(const [part,kind] of [[upper,'shoulder-elbow'],[shin,'knee-ankle']]){
      assert(part.visible&&part.material.visible&&!part.material.transparent);
      assert.equal(part.userData.m019StableVisibleBridge,true);
      assert.equal(part.userData.m019SingleVisibleAnatomicalShell,true);
      assert.equal(part.userData.m019ContouredVisibleBridge,true);
      assert.equal(part.userData.m019EllipticalAnatomicalSections,true);
      assert.equal(part.userData.m019MuscleProfile,kind);
      assert.equal(part.userData.m019NoAdditionalDrawCalls,true);
      assert.equal(part.userData.m019LastRenderedGeometry,'v13-oriented-bridge');
      assert(!part.frustumCulled&&!part.receiveShadow);
      assert(!part.isSkinnedMesh);
      assert(!part.geometry.parameters?.tubularSegments);
      assert(part.geometry.getAttribute('position').count>100);
      assert(part.geometry.getIndex().count>100);
      assert.equal(part.material.userData.m019DryObsidian,true);
      assert(part.material.color.r>body.material.color.r*2);
    }
    const ringRadius=(mesh,t)=>{
      const p=mesh.geometry.getAttribute('position'),uv=mesh.geometry.getAttribute('uv');
      let stride=0;
      while(stride<uv.count&&Math.abs(uv.getY(stride))<1e-5)stride++;
      assert(stride>=11&&p.count%stride===0,'round evenly spaced rings');
      const start=Math.round((p.count/stride-1)*t)*stride;
      const center=new THREE.Vector3(),point=new THREE.Vector3();
      for(let k=0;k<stride-1;k++)
        center.add(point.fromBufferAttribute(p,start+k));
      center.divideScalar(stride-1);
      let rad=0;
      for(let k=0;k<stride-1;k++)
        rad+=point.fromBufferAttribute(p,start+k).distanceTo(center);
      return rad/(stride-1);
    };
    assert(ringRadius(upper,.4)>.158&&ringRadius(upper,.4)<.23,
      'anatomical shoulder muscle needs noncylindrical rounded contour');
    assert(ringRadius(shin,.30)>.113&&ringRadius(shin,.30)<.175);
    assert(ringRadius(shin,.90)<ringRadius(shin,.30),
      'shin tapers towards planted ankle');
    model.updateMatrixWorld(true);
    const upperBox=new THREE.Box3().setFromObject(upper);
    const shinBox=new THREE.Box3().setFromObject(shin);
    assert(upperBox.max.y>.38&&shinBox.max.y>.34);
    assert(shinBox.min.y>-.09,'ankle not beneath terrain');
    assert(side>0?upperBox.max.x>bodyBox.max.x+.20:
      upperBox.min.x<bodyBox.min.x-.20,'elbow outside silhouette');
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
       const visibleUpper=model.getObjectByName('m019-mobile-upper-'+id);
       const visibleShin=model.getObjectByName('m019-mobile-shin-'+id);
       assert(visibleUpper.visible&&visibleShin.visible,
        action+' '+time+' all four limbs remain visible');
       assert.equal(visibleUpper.parent,arm);
       assert.equal(visibleShin.parent,joint);
       const endRing=(part,last)=>{
        const p=part.geometry.getAttribute('position');
        const uv=part.geometry.getAttribute('uv');
        let stride=0;
        while(stride<uv.count&&Math.abs(uv.getY(stride))<1e-5)stride++;
        const start=last?p.count-stride:0;
        const center=new THREE.Vector3(),point=new THREE.Vector3();
        for(let k=0;k<stride-1;k++)
          center.add(point.fromBufferAttribute(p,start+k));
        return part.localToWorld(center.divideScalar(stride-1));
       };
       const kneeWorld=joint.getWorldPosition(new THREE.Vector3());
       const toeWorld=toes.getWorldPosition(new THREE.Vector3());
       assert(endRing(visibleUpper,true).distanceTo(kneeWorld)<.07,
        action+' '+time+' upper limb must connect to the elbow');
       assert(endRing(visibleShin,false).distanceTo(kneeWorld)<.08,
        action+' '+time+' shin must connect to the elbow');
       assert(endRing(visibleShin,true).distanceTo(toeWorld)<.06,
        action+' '+time+' shin must meet the planted foot');
       const areaUpper=new THREE.Box3().setFromObject(visibleUpper).getSize(new THREE.Vector3());
       const areaShin=new THREE.Box3().setFromObject(visibleShin).getSize(new THREE.Vector3());
       assert(areaUpper.x>.25&&areaShin.y>.15,
        action+' '+time+' rendered muscle must not vanish');
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
  assert(fit.direction.y>.30,'mobile camera must show all sprawled legs above floor');
 }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
 createScalpAnchoredWig,createScalpFirstLongGuide,
 v109RootGapFraction,v109ScalpContactFraction,v109VolumeFreeLengthWeight,
 sadakoCrownSurfaceLayerOffset,sadakoCrownSideOverlayOffset
} from '../src/face-scalp-wig.js';
import {WIG_BASE_VOLUME_PROFILES} from '../src/face-wig-styles.js';

test('v109 attached follicle distance is small and cannot vary with volume',()=>{
 assert.equal(v109RootGapFraction({}),.0055);
 assert.equal(v109RootGapFraction({shortCutKind:'buzz'}),.013,
  'Native buzz stubble is not regressed');
 assert.ok(v109RootGapFraction({})<.0125*.5,'Long roots should lie at least twice as close');
 assert.equal(v109VolumeFreeLengthWeight(0),0);
 assert.equal(v109VolumeFreeLengthWeight(.10),0);
 assert.ok(v109VolumeFreeLengthWeight(.5)>.65);
 assert.equal(v109VolumeFreeLengthWeight(1),1);
 assert.ok(v109ScalpContactFraction(0)<v109ScalpContactFraction(.5));
 assert.ok(v109ScalpContactFraction(0)<=.005);
 assert.ok(v109ScalpContactFraction(.12)<.006);
});

test('v109 volume profiles produce identical root and first centimetres, but spread free lengths',()=>{
 const box=new THREE.Box3(new THREE.Vector3(-.5,0,-.5),new THREE.Vector3(.5,1,.5));
 const root=new THREE.Vector3(.23,.91,.20),normal=new THREE.Vector3(.28,.9,.2).normalize();
 const make=volume=>createScalpFirstLongGuide({
  root,normal,box,zone:'templeRight',whorl:new THREE.Vector3(0,.96,-.08),
  length:3,trimY:-4,targetX:.26,targetZ:.25,segments:18,
  volumeSpread:WIG_BASE_VOLUME_PROFILES[volume].spread
 });
 const soft=make('soft'),full=make('full'),natural=make('natural');
 assert.deepEqual(soft[0].toArray(),full[0].toArray());
 assert.ok(soft[1].distanceTo(full[1])<1e-8,
  'First segment must not depend on volume selector');
 const radial=p=>Math.hypot(p.x,p.z);
 assert.ok(radial(soft[12])<radial(natural[12]));
 assert.ok(radial(full[12])>radial(natural[12]));
 assert.ok(Math.abs(radial(full[18])-radial(soft[18]))>.005);
});
test('v109 crown overlays retain anatomical cover but have lower floating root canopy',()=>{
 const box=new THREE.Box3(new THREE.Vector3(-.5,0,-.5),new THREE.Vector3(.5,1,.5));
 assert.equal(sadakoCrownSurfaceLayerOffset('crown',.95,0,box),0);
 assert.ok(sadakoCrownSurfaceLayerOffset('crown',.92,.20,box)<.01001);
 assert.ok(sadakoCrownSideOverlayOffset('crown',.72,.23,box,true)<.01501);
 assert.ok(sadakoCrownSideOverlayOffset('crown',.72,.23,box,true)>
  sadakoCrownSurfaceLayerOffset('crown',.72,.23,box));
 assert.equal(sadakoCrownSideOverlayOffset('crown',.72,.23,box,false),0);
});

test('v109 actual 3D long hair has a compact root clearance for all volume choices',()=>{
 const geo=new THREE.SphereGeometry(.5,48,36);
 geo.computeVertexNormals();
 const head=new THREE.Mesh(geo,new THREE.MeshStandardMaterial());
 const sampling=(volumeProfile)=>{
  const wig=createScalpAnchoredWig(head,{count:100,styleId:'rb-f-long',
   volumeProfile,gender:'female',color:0xb99a63,
   staticGroom:true,visualFiberMultiplier:1});
  assert.ok(wig.root.userData.wigReport.v109DonorRootContact);
  const samples=wig.getRootSamples();
  assert.ok(samples.length>=7);
  for(const sample of samples){
   const length=Math.hypot(...sample.point);
   assert.ok(Math.abs(length-.5)<.011,
    'Follicle floats away from source sphere: '+sample.zone+' '+length);
  }
  const ret={samples,report:wig.root.userData.wigReport};
  wig.dispose();return ret;
 };
 const soft=sampling('soft'),full=sampling('full');
 assert.deepEqual(soft.samples,full.samples,'Volume must not shift follicles');
 assert.equal(full.report.v109RootGapFraction,.0055);
 assert.equal(full.report.v109MaxVolumeRootWeight,0);
 assert.equal(full.report.v109VolumeOnlyOnLooseLength,true);
 head.geometry.dispose();head.material.dispose();
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {SADAKO_FAMILY_STYLE_IDS,isSadakoFamilyStyle,listWigStyles,
 getWigStyle,WIG_SILHOUETTE_PROFILES} from '../src/face-wig-styles.js';
import {PART_CATALOG} from '../src/face-part-catalog-v32.js';
import {resolveHeroHairSpec} from '../src/hero-hair-controls-v43.js';
import {FACE_HAIR_RUNTIME_BUILD,createScalpAnchoredWig,
 sadakoVariantGuideOffset,shapeSadakoVariantGuide}
 from '../src/face-scalp-wig.js';
import {setCostumeHairScalpMask,releaseCostumeHairScalpMask}
 from '../src/face-costume-scalp-mask.js';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const expected={
 'sadako-straight-long':'straight',
 'sadako-inward-long':'inward',
 'sadako-outward-long':'outward',
 'sadako-sauvage-long':'sauvage',
 'sadako-center-part-long':'center',
 'sadako-bangs-long':'bangs'
};
const head=()=>{
 const g=new THREE.SphereGeometry(.5,24,18);
 g.computeVertexNormals();g.computeBoundingBox();
 return new THREE.Mesh(g,new THREE.MeshStandardMaterial());
};
function guide(){
 return Array.from({length:19},(_,j)=>
  new THREE.Vector3(.11,.90-.08*j,-.18));
}
test('one approved Sadako master plus five registered distinct selectable variants',()=>{
 assert.deepEqual([...SADAKO_FAMILY_STYLE_IDS],Object.keys(expected));
 const choices=listWigStyles('female'),male=listWigStyles('male');
 const femaleCatalog=PART_CATALOG.female.hair;
 assert.equal(new Set(choices.map(s=>s.id)).size,choices.length);
 for(const [id,variant] of Object.entries(expected)){
  const style=getWigStyle(id),spec=resolveHeroHairSpec('female',{},id);
  assert.equal(isSadakoFamilyStyle(id),true);
  assert.equal(style.sadakoVariant,variant);
  assert.equal(style.groomMaster,'sadako-straight-long');
  assert.ok(WIG_SILHOUETTE_PROFILES[id]);
  assert.ok(choices.some(c=>c.id===id));
  assert.ok(femaleCatalog.some(row=>row.values.styleId===id));
  assert.equal(spec.styleId,id);
  assert.equal(femaleCatalog[spec.hairIndex].values.styleId,id);
  assert.equal(male.some(c=>c.id===id),false);
 }
 assert.equal(isSadakoFamilyStyle('buzz-cut'),false);
});
test('all five groom differences move only loose guides; approved roots are identical',()=>{
 const box=new THREE.Box3(new THREE.Vector3(-1,-1,-1),
  new THREE.Vector3(1,1,1));
 const sample={box,zone:'fringeLeft',side:-1,rootIndex:17,front:true};
 const base=guide();
 const roots=[];
 const data={};
 for(const variant of Object.values(expected)){
  const points=guide(),before=points.map(x=>x.clone());
  shapeSadakoVariantGuide(points,{...sample,variant,bangsCut:variant==='bangs'});
  roots.push(points[0].clone());
  data[variant]=points;
  assert.deepEqual(points[0].toArray(),before[0].toArray());
  for(const p of points)assert.ok([p.x,p.y,p.z].every(Number.isFinite));
 }
 for(const root of roots)
  assert.deepEqual(root.toArray(),base[0].toArray());
 assert.deepEqual(data.straight.map(p=>p.toArray()),base.map(p=>p.toArray()));
 assert.ok(data.inward.at(-1).x>base.at(-1).x);
 assert.ok(data.outward.at(-1).x<base.at(-1).x);
 assert.ok(Math.max(...data.sauvage.map((p,j)=>Math.abs(p.x-base[j].x)))>.12);
 assert.ok(data.center[10].x<base[10].x-.02);
 const browY=box.min.y+box.getSize(new THREE.Vector3()).y*.765;
 assert.ok(Math.abs(data.bangs.at(-1).y-browY)<.04);
 assert.ok(data.bangs.at(-1).y>box.min.y+box.getSize(new THREE.Vector3()).y*.72,
  'bangs terminate above the eye line');
 assert.deepEqual(sadakoVariantGuideOffset('straight',1),{x:0,y:0,z:0});
});
test('center-part reveals both eyes symmetrically, short bangs remain near eyebrow',()=>{
 const box=new THREE.Box3(new THREE.Vector3(-1,-1,-1),
  new THREE.Vector3(1,1,1));
 const left=guide(),right=guide().map(p=>new THREE.Vector3(-p.x,p.y,p.z));
 shapeSadakoVariantGuide(left,{variant:'center',box,zone:'fringeLeft',side:-1,front:true});
 shapeSadakoVariantGuide(right,{variant:'center',box,zone:'fringeRight',side:1,front:true});
 assert.ok(left[12].x<-.15&&right[12].x>.15);
 for(let j=1;j<19;j++)
  assert.ok(Math.abs(left[j].x+right[j].x)<1e-8);
 const rear=guide();
 shapeSadakoVariantGuide(rear,{variant:'center',box,zone:'backLeft',side:-1,front:false});
 assert.deepEqual(rear.map(p=>p.toArray()),guide().map(p=>p.toArray()));
});
test('all six variants instantiate the approved three-dimensional scalp/master with independent meshes',()=>{
 for(const id of Object.keys(expected)){
  const face=head();
  const wig=createScalpAnchoredWig(face,{styleId:id,count:90,
   normalLayeredSingleMesh:false,color:0x78503d,
   staticGroom:true,visualFiberMultiplier:1});
  const report=wig.getReport();
  assert.equal(report.hairstyleId,id);
  assert.equal(report.sadakoVariant,expected[id]);
  assert.ok(report.rootCount>=90);
  assert.ok(report.sadakoAreaSampledRoots>0);
  assert.equal(report.sadakoSidePanelCount,0);
  assert.equal(report.sadakoCrownFibreCount>0,true);
  assert.equal(report.sadakoSideRibbonGeometryOnly,true);
  assert.equal(report.v66RealCrownUnderlayTriangles>0,true);
  assert.ok(wig.root.getObjectByName('REAL_ROOTED_SWEPT_HAIR_LOCKS')?.isMesh);
  wig.dispose();face.geometry.dispose();face.material.dispose();
 }
});
test('costume skin clipping is available for new descendants, reversible and does not alter buzz',()=>{
 for(const id of [...SADAKO_FAMILY_STYLE_IDS,'buzz-cut']){
  const face=head(),donor=face.geometry;
  const outcome=setCostumeHairScalpMask(face,id,{scalpReferenceGeometry:donor});
  assert.equal(outcome.active,true,id);
  assert.equal(face.userData.costumeScalpMaskActive,true);
  releaseCostumeHairScalpMask(face);
  assert.equal(face.geometry,donor);
  face.geometry.dispose();face.material.dispose();
 }
});
test('both comboboxes bind new IDs and retain animation/mantle on all Sadako variants',()=>{
 assert.match(FACE_HAIR_RUNTIME_BUILD,/sadako-invisible-perm-rods-v66$/);
 const mesh=read('face-mesh-studio.html'),body=read('face-body-studio.html');
 for(const src of [mesh,body]){
  assert.match(src,/20261121-sadako-invisible-perm-rods-v66/);
  assert.match(src,/isSadakoFamilyStyle/);
  assert.match(src,/face-part-catalog-v32\.js\?v=65/);
 }
 assert.match(mesh,/staticGroom:!isSadakoFamilyStyle\(chosen.styleId\)/);
 assert.match(body,/staticGroom:!isSadakoFamilyStyle\(hairSpec.styleId\)/);
 assert.match(body,/garmentCollisionResolver:mantleCollision/);
 assert.match(body,/wig\?\.update\(dt\)/);
 assert.match(read('.github/workflows/hair-reselect-regression.yml'),
  /hair-sadako-five-variants-v65\.test\.mjs/);
});

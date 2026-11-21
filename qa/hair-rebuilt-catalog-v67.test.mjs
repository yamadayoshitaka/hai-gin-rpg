import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {REBUILT_HAIR_BLUEPRINTS,REBUILT_HAIR_CATALOG,REBUILT_HAIR_PARTS}
 from '../src/hair-rebuilt-catalog-v67.js';
import {WIG_STYLES,listWigStyles,getWigStyle,
 WIG_SILHOUETTE_PROFILES,isBuzzFamilyStyle,isSadakoFamilyStyle,
 DEFAULT_WIG_STYLE_ID} from '../src/face-wig-styles.js';
import {PART_CATALOG} from '../src/face-part-catalog-v32.js';
import {resolveHeroHairSpec} from '../src/hero-hair-controls-v43.js';
import {createScalpAnchoredWig,FACE_HAIR_RUNTIME_BUILD,
 shapeRebuiltCatalogCurl,shapeSadakoVariantGuide}
 from '../src/face-scalp-wig.js';
import {setCostumeHairScalpMask,releaseCostumeHairScalpMask}
 from '../src/face-costume-scalp-mask.js';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
function head(){
 const geometry=new THREE.SphereGeometry(.5,24,18);
 geometry.computeVertexNormals();
 const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial());
 return mesh;
}
function wig(styleId,gender='female'){
 const mesh=head();
 const wig=createScalpAnchoredWig(mesh,{styleId,gender,count:72,
  staticGroom:true,normalLayeredSingleMesh:false,
  visualFiberMultiplier:1,color:0x6a4535});
 return {mesh,wig,cleanup(){wig.dispose();mesh.geometry.dispose();mesh.material.dispose();}};
}

test('old bald hair catalog is retired from both UI lists but saved definitions remain readable',()=>{
 const female=listWigStyles('female').map(s=>s.id);
 const male=listWigStyles('male').map(s=>s.id);
 assert.equal(REBUILT_HAIR_CATALOG.female.length,25);
 assert.equal(REBUILT_HAIR_CATALOG.male.length,19);
 assert.equal(PART_CATALOG.female.hair.length,32);
 assert.equal(PART_CATALOG.male.hair.length,20);
 for(const id of ['natural-short','rounded-bob','male-two-block','female-pixie',
  'salon-layered-long','male-natural-mash']){
  assert.equal(female.includes(id),false);
  assert.equal(male.includes(id),false);
  assert.ok(getWigStyle(id));
 }
 assert.ok(female.includes('sadako-straight-long'));
 assert.ok(female.includes('buzz-cut'));
 assert.ok(male.includes('buzz-cut'));
 assert.equal(male.includes('sadako-straight-long'),false);
 assert.equal(DEFAULT_WIG_STYLE_ID,'rb-f-long');
 assert.equal(PART_CATALOG.female.hair[0].values.styleId,'rb-f-long');
 assert.equal(PART_CATALOG.male.hair[0].values.styleId,'rb-m-natural-short');
});
test('every displayed male/female style is a donor-derived, defined, distinct 3D recipe',()=>{
 const all=Object.values(REBUILT_HAIR_BLUEPRINTS);
 assert.equal(all.length,44);
 for(const gender of ['female','male']){
  const actual=PART_CATALOG[gender].hair.map(h=>h.values.styleId);
  assert.equal(new Set(actual).size,actual.length);
  for(const record of REBUILT_HAIR_CATALOG[gender]){
   assert.ok(actual.includes(record.id));
   assert.ok(listWigStyles(gender).some(s=>s.id===record.id));
   assert.equal(getWigStyle(record.id).rebuiltBase,record.base);
   assert.ok(WIG_SILHOUETTE_PROFILES[record.id]);
   assert.equal(isBuzzFamilyStyle(record.id),record.base==='buzz');
   assert.equal(isSadakoFamilyStyle(record.id),record.base==='sadako');
   const spec=resolveHeroHairSpec(gender,{},record.id);
   assert.equal(spec.styleId,record.id);
   assert.ok(spec.lengthScale>0);
   assert.equal(PART_CATALOG[gender].hair[spec.hairIndex].values.styleId,record.id);
   assert.equal(getWigStyle(record.id).catalogTempleRatio,record.templeRatio);
   assert.equal(getWigStyle(record.id).catalogCurl,record.curl);
  }
 }
});
test('long styles really use original Sadako rooted donor and independent curls/length',()=>{
 const ids=['rb-f-bob-in','rb-f-bob-out','rb-f-medium-wave',
  'rb-f-long','rb-m-center-medium','rb-m-long-wave'];
 let lengthShort=null,lengthLong=null;
 for(const id of ids){
  const x=wig(id,id.startsWith('rb-m')?'male':'female');
  const report=x.wig.getReport();
  assert.equal(report.rebuiltHairBase,'sadako');
  assert.equal(report.rebuiltHairCatalogV67,true);
  assert.ok(report.v66RealCrownUnderlayTriangles>0);
  assert.ok(report.sadakoAreaSampledRoots>0);
  assert.ok(report.sadakoCrownFibreCount>0);
  assert.ok(x.wig.root.getObjectByName('REAL_ROOTED_SWEPT_HAIR_LOCKS'));
  if(id==='rb-f-bob-in')lengthShort=report.rebuiltHairRecipe.length;
  if(id==='rb-f-long')lengthLong=report.rebuiltHairRecipe.length;
  x.cleanup();
 }
 assert.ok(lengthShort<lengthLong*.4);
});
test('short styles retain approved buzz pigment AND real stubble but show grown short hair',()=>{
 for(const id of ['rb-f-pixie','rb-f-natural-short','rb-m-natural-short',
  'rb-m-two-block','rb-m-short-perm']){
  const x=wig(id,id.startsWith('rb-m')?'male':'female');
  const report=x.wig.getReport();
  assert.equal(report.rebuiltHairBase,'buzz');
  assert.equal(report.closeCutFibreCount,30000);
  const scalp=x.wig.root.getObjectByName('REAL_SCALP_TRIANGLE_HAIR_CAP');
  const locks=x.wig.root.getObjectByName('REAL_ROOTED_SWEPT_HAIR_LOCKS');
  assert.ok(scalp&&scalp.visible);
  assert.ok(locks&&locks.visible,'grown top locks must NOT be hidden like pure buzz');
  assert.equal(scalp.userData.v66RealCrownUnderlayTriangles,0);
  x.cleanup();
 }
 const approved=wig('buzz-cut');
 assert.equal(approved.wig.getReport().buzzSparseApprovedLookRestored,true);
 approved.cleanup();
});
test('neck-safe scalp clipping also applies to ALL new short and long hairstyles',()=>{
 for(const id of ['rb-f-pixie','rb-f-bob-in','rb-m-short-perm',
  'rb-m-center-medium']){
  const face=head(),donor=face.geometry;
  const r=setCostumeHairScalpMask(face,id,{scalpReferenceGeometry:donor});
  assert.equal(r.active,true,id);
  releaseCostumeHairScalpMask(face);
  assert.equal(face.geometry,donor);
  donor.dispose();face.material.dispose();
 }
});
test('both interactive studios use the same v67 reconstructed catalogs',()=>{
 assert.match(FACE_HAIR_RUNTIME_BUILD,/two-donor-unisex-catalog-v67$/);
 const salon=read('face-mesh-studio.html'),outfit=read('face-body-studio.html');
 for(const src of [salon,outfit]){
  assert.match(src,/face-part-catalog-v32\.js\?v=67/);
  assert.match(src,/face-wig-styles\.js\?v=67/);
  assert.match(src,/20261121-two-donor-unisex-catalog-v67/);
 }
 assert.match(salon,/isBuzzFamilyStyle/);
 assert.match(outfit,/garmentCollisionResolver:mantleCollision/);
 assert.match(read('.github/workflows/hair-reselect-regression.yml'),
  /hair-rebuilt-catalog-v67\.test\.mjs/);
});

test('v68 rebuilt external flips curl only at tips; soft volume cannot turn into side wings',()=>{
 const box=new THREE.Box3(new THREE.Vector3(-.5,0,-.5),
  new THREE.Vector3(.5,1,.5));
 const create=()=>Array.from({length:19},(_,i)=>
  new THREE.Vector3(.22,1-i*.05,.19));
 const outward=create(),inward=create(),sauvage=create();
 shapeRebuiltCatalogCurl(outward,{variant:'outward',box,side:1});
 shapeRebuiltCatalogCurl(inward,{variant:'inward',box,side:1});
 shapeRebuiltCatalogCurl(sauvage,{variant:'sauvage',box,side:1});
 for(let i=0;i<=13;i++){
  assert.ok(outward[i].distanceTo(create()[i])<1e-8,'outward bends only last 27%');
  assert.ok(inward[i].distanceTo(create()[i])<1e-8,'inward bends only last 27%');
 }
 assert.ok(outward[18].x>.22&&outward[18].x<=.47,
  'outward tip must be visible but below silhouette width');
 assert.ok(inward[18].x<.22,'inward must turn towards face');
 assert.ok(outward[18].y>create()[18].y,'curled tip returns upward');
 assert.ok(sauvage[0].distanceTo(create()[0])<1e-8,'wave keeps real follicle');
 assert.ok(Math.max(...sauvage.map((p,i)=>Math.abs(p.x-create()[i].x)))<.032,
  'sauvage wave is not the old wide fan');
});
test('v68 rebuilt center-part is narrower than approved full Sadako donor',()=>{
 const box=new THREE.Box3(new THREE.Vector3(-.5,0,-.5),
  new THREE.Vector3(.5,1,.5));
 const create=()=>Array.from({length:19},(_,i)=>
  new THREE.Vector3(.12,1-i*.05,.19));
 const donor=create(),rebuilt=create();
 shapeSadakoVariantGuide(donor,{variant:'center',box,side:1,front:true});
 shapeSadakoVariantGuide(rebuilt,{variant:'center',box,side:1,front:true,
  lateralScale:.26});
 assert.ok(Math.abs(donor[18].x-.12)>.33,'approved donor is unchanged');
 assert.ok(rebuilt[18].x-.12<.10,'new catalog keeps the face part close');
 assert.ok(rebuilt[0].distanceTo(donor[0])<1e-8,'scalp roots never move');
});

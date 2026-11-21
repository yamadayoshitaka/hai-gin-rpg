import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {REBUILT_HAIR_CATALOG} from '../src/hair-rebuilt-catalog-v67.js';
import {HAIR_SHAPE_CATALOG_V71,MALE_SHAPE_FAMILIES_V71,
 selectCatalogCutLevel} from '../src/hair-shape-catalog-v71.js';
import {getWigStyle} from '../src/face-wig-styles.js';
import {shapeCatalogLengthGuide,shapeHimeSideGuide,
 createScalpAnchoredWig} from '../src/face-scalp-wig.js';
test('v71 every man and woman has a real catalog-cut blueprint, not borrowed names',()=>{
 assert.equal(REBUILT_HAIR_CATALOG.male.length,19);
 assert.equal(REBUILT_HAIR_CATALOG.female.length,25);
 assert.equal(Object.keys(HAIR_SHAPE_CATALOG_V71).length,44);
 assert.equal(Object.keys(MALE_SHAPE_FAMILIES_V71).length,19);
 for(const gender of ['male','female'])
  for(const row of REBUILT_HAIR_CATALOG[gender]){
   const cut=HAIR_SHAPE_CATALOG_V71[row.id];
   assert.ok(cut,'no profile: '+row.id);
   assert.equal(cut.gender,gender);
   assert.deepEqual(getWigStyle(row.id).catalogShape,cut);
   for(const field of ['crown','temple','back','face','partStrength'])
    assert.ok(Number.isFinite(cut[field]),row.id+' '+field);
  }
 assert.notDeepEqual(HAIR_SHAPE_CATALOG_V71['rb-m-center-medium'],
  HAIR_SHAPE_CATALOG_V71['rb-f-medium'],
  'masculine medium cannot reuse feminine medium geometry');
});
test('v71 male cut families have distinct top/side/nape and correct medium levels',()=>{
 const c=HAIR_SHAPE_CATALOG_V71['rb-m-center-medium'];
 const m=HAIR_SHAPE_CATALOG_V71['rb-m-mash'];
 const wolf=HAIR_SHAPE_CATALOG_V71['rb-m-wolf-medium'];
 const shoulder=HAIR_SHAPE_CATALOG_V71['rb-m-shoulder'];
 assert.ok(c.temple<m.temple,'male medium sides reach farther toward cheek than mash');
 assert.ok(c.back<wolf.temple,'center medium nape is shorter than a wolf nape');
 assert.ok(wolf.back<c.back,'wolf nape extends below classic center medium');
 assert.ok(shoulder.back<c.back-.30,'shoulder male hair extends past the neck');
 assert.equal(selectCatalogCutLevel(wolf,'napeLeft'),wolf.back);
 assert.equal(selectCatalogCutLevel(wolf,'templeRight'),wolf.temple);
 assert.equal(selectCatalogCutLevel(wolf,'fringeLeft',{bangsCut:true}),null);
});
test('v71 hime cut has a blunt distinct jaw side-lock layer over long back',()=>{
 const h=HAIR_SHAPE_CATALOG_V71['rb-f-hime'];
 assert.equal(h.himeSide,true);
 assert.ok(h.temple>.35&&h.temple<.55,'side hime cuts at cheek-jaw');
 assert.ok(h.temple-h.back>1.0,'real two-step silhouette');
 const box=new THREE.Box3(new THREE.Vector3(-.5,0,-.5),new THREE.Vector3(.5,1,.5));
 for(const side of [-1,1]){
  const g=Array.from({length:19},(_,j)=>
   new THREE.Vector3(side*.12,.95-j*.05,.05));
  const origin=g[0].clone();
  shapeHimeSideGuide(g,{box,side,rootIndex:40});
  shapeCatalogLengthGuide(g,{box,tipY:h.temple,rootIndex:40});
  assert.deepEqual(g[0].toArray(),origin.toArray());
  assert.ok(side*g.at(-1).x>.28,'side lock remains close to cheek');
  assert.ok(g.at(-1).z>.18,'separate jaw-lock remains in front of long back');
  assert.ok(Math.abs(g.at(-1).y-h.temple)<.025);
 }
});
const run=(id,gender='female')=>{
 const geo=new THREE.SphereGeometry(.5,24,18),mat=new THREE.MeshStandardMaterial();
 geo.computeVertexNormals();
 const head=new THREE.Mesh(geo,mat);
 const wig=createScalpAnchoredWig(head,{
  styleId:id,gender,count:112,color:0x674534,
  staticGroom:true,normalLayeredSingleMesh:false,
  visualFiberMultiplier:1
 });
 const report=wig.getReport();
 wig.dispose();geo.dispose();mat.dispose();
 return report;
};
test('v71 REAL male medium has a fuller nape than short and less than shoulder',()=>{
 const short=run('rb-m-natural-short','male');
 const medium=run('rb-m-center-medium','male');
 const wolf=run('rb-m-wolf-medium','male');
 const shoulder=run('rb-m-shoulder','male');
 assert.equal(medium.v71CatalogFamily,'center-medium');
 for(const x of [short,medium,wolf,shoulder])
  assert.ok(Number.isFinite(x.v71RearTipMedian));
 assert.ok(short.v71RearTipMedian>medium.v71RearTipMedian+.15,
  'medium must not appear as a short haircut');
 assert.ok(medium.v71RearTipMedian>shoulder.v71RearTipMedian+.25,
  'shoulder should be noticeably longer than medium');
 assert.ok(wolf.v71RearTipMedian<medium.v71RearTipMedian-.08,
  'medium wolf nape extends behind neck');
});
test('v71 REAL bob, semilong and hime reveal continuous back and a separate side cut',()=>{
 const bob=run('rb-f-bob-bangs'),semi=run('rb-f-semilong');
 const hime=run('rb-f-hime');
 assert.ok(bob.v71RearTipMedian>semi.v71RearTipMedian+.25,
  'semilong must have a continuous rear layer below the nape bob');
 assert.ok(hime.v71TempleTipMedian>hime.v71RearTipMedian+.45,
  'hime has jaw-length side locks over long rear hair');
 assert.ok(bob.v71TempleTipMedian>semi.v71TempleTipMedian,
  'bob side hair is cut higher than semilong');
});

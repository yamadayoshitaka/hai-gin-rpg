import assert from 'node:assert/strict';
import * as THREE from 'three';
import {MONSTER_CATALOG} from '../src/monster-catalog.js';
import {HUMAN_MONSTER_IDS,humanoidMonsterCostumeFor}
 from '../src/monster-character-cosplay-manifest.js';
import {GAME_MONSTER_MODEL_REGISTRY} from '../src/creature-game-model-routing.js';
import {HUMANLIKE_CONCEPT_IDS,HUMANLIKE_CONCEPT_REVISION,
 HUMANLIKE_2D_CONCEPTS,applyHumanlikeConceptFinish}
 from '../src/monster-humanoid-concept-finish.js';

assert.equal(HUMANLIKE_CONCEPT_IDS.length,16);
assert.equal(new Set(HUMANLIKE_CONCEPT_IDS).size,16);
assert.deepEqual(new Set(HUMANLIKE_CONCEPT_IDS),new Set(HUMAN_MONSTER_IDS));
assert.equal(Object.keys(HUMANLIKE_2D_CONCEPTS).length,16);
for(const spec of MONSTER_CATALOG){
 const selected=HUMANLIKE_CONCEPT_IDS.includes(spec.id);
 const record=GAME_MONSTER_MODEL_REGISTRY[spec.id];
 assert.equal(record.conceptFinishRevision,
  selected?HUMANLIKE_CONCEPT_REVISION:null);
 if(selected)assert.equal(record.mobileVisualApproved,false);
}
function harness(){
 const frames={
  head:new THREE.Group(),chest:new THREE.Group(),
  arms:[new THREE.Group(),new THREE.Group()],
  forearms:[new THREE.Group(),new THREE.Group()],
  legs:[new THREE.Group(),new THREE.Group()],
  calves:[new THREE.Group(),new THREE.Group()],
 };
 const meshes=[];
 const attach=(frame,geo,role,name,pos=[0,0,0],rot=[0,0,0])=>{
  const mesh=new THREE.Mesh(geo,new THREE.MeshStandardMaterial());
  mesh.name='monster-costume-'+name;
  mesh.userData.role=role;
  mesh.position.set(...pos);mesh.rotation.set(...rot);
  frame.add(mesh);meshes.push(mesh);return mesh;
 };
 const tube=(frame,role,name,points,radius=.01)=>{
  const path=new THREE.CatmullRomCurve3(
   points.map(p=>new THREE.Vector3(...p)));
  return attach(frame,new THREE.TubeGeometry(path,12,radius,6,false),
   role,name);
 };
 return {frames,meshes,attach,tube};
}
for(const id of HUMANLIKE_CONCEPT_IDS){
 const concept=HUMANLIKE_2D_CONCEPTS[id];
 const profile=humanoidMonsterCostumeFor(id);
 assert.ok(profile&&concept);
 assert.ok(concept.silhouette&&concept.facialMotif&&concept.surface);
 assert.equal(concept.visualApproved,false);
 let lowCount=0,highCount=0;
 for(const detail of ['source','high','medium','low']){
  const h=harness();
  const record=applyHumanlikeConceptFinish({
   THREE,profile,detail,frames:h.frames,attach:h.attach,tube:h.tube
  });
  assert.equal(record.id,id);
  assert.equal(record.revision,HUMANLIKE_CONCEPT_REVISION);
  assert.equal(record.featureMeshes,h.meshes.length);
  assert.equal(record.skeletonAnchored,true);
  assert.equal(record.visualApproved,false);
  assert.ok(h.meshes.length>=5,'Too few physical parts: '+id+'/'+detail);
  assert.ok(h.meshes.length<100,'Excessive mobile draw calls: '+id+'/'+detail);
  for(const mesh of h.meshes){
   assert.ok(mesh.parent,'Orphan geometry: '+mesh.name);
   assert.equal(mesh.userData.original2dConcept,id);
   assert.equal(mesh.userData.skeletalAttachment,true);
   assert.ok(mesh.geometry.getAttribute('position')?.count>=3);
   assert.ok(mesh.geometry.getAttribute('position').array.every(Number.isFinite));
   mesh.geometry.dispose();mesh.material.dispose();
  }
  if(detail==='low')lowCount=h.meshes.length;
  if(detail==='high')highCount=h.meshes.length;
 }
 assert.ok(highCount>=lowCount,
  'Near models must not have fewer anatomical details than crowd LOD: '+id);
 console.log('2D->3D HUMANOID',id,profile.costume,
  'high',highCount,'low',lowCount);
}
const excluded=MONSTER_CATALOG.filter(s=>!HUMANLIKE_CONCEPT_IDS.includes(s.id));
for(const spec of excluded){
 const h=harness();
 assert.equal(applyHumanlikeConceptFinish({
  THREE,profile:{id:spec.id},frames:h.frames,
  attach:h.attach,tube:h.tube
 }),null,'Nonhuman must remain on its own family rig: '+spec.id);
}
console.log('PASS: 16 unique 2D concept profiles / physical 3D sculpt / 4 LOD / protected nonhumans');

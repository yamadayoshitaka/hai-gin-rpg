import test from 'node:test';
import assert from 'node:assert/strict';
import {WEB_CREATURE_MESH_SOURCES,WEB_CREATURE_SOURCE_COUNT,
 validateWebCreatureMeshSources} from '../src/creature-web-mesh-catalog.js';
import {WEB_CREATURE_ANATOMY_REFERENCES,
 validateAnatomySources} from '../src/creature-research-reference-catalog.js';
import {REAL_BODY_CANDIDATES,REAL_BODY_SUGGESTIONS}
 from '../src/creature-real-body-candidates.js';
import {readFileSync} from 'node:fs';
const loaderSource=readFileSync(new URL('../src/creature-real-source-catalog.js',import.meta.url),'utf8');
import {CREATURE_RECONSTRUCTION_BY_ID,CREATURE_RECONSTRUCTION_SUMMARY}
 from '../src/creature-reconstruction-plan.js';
import {eligibleCreature,adoptedCreatureMesh,setAdoptedCreatureMesh,
 recommendedMeshSources} from '../src/creature-mesh-adoption.js';

function storage(){
 const d=new Map();
 return {getItem:k=>d.get(k)||null,setItem:(k,v)=>d.set(k,v)};
}
test('published download links and licenses are real catalog entries, no guessed URLs',()=>{
 assert.equal(validateWebCreatureMeshSources(),true);
 assert.equal(WEB_CREATURE_SOURCE_COUNT,26);
 const ids=Object.keys(WEB_CREATURE_MESH_SOURCES);
 assert.equal(new Set(ids).size,26);
 for(const [id,entry] of Object.entries(WEB_CREATURE_MESH_SOURCES)){
  assert.ok(entry.downloadUrl.startsWith('https://'),id);
  assert.ok(entry.downloadUrl.endsWith('.glb'),id);
  assert.equal(entry.integration,'preview-only',id);
  assert.ok(entry.author&&entry.license, id);
  assert.equal(entry.hasPublicGLB,true,id);
  assert.ok(loaderSource.includes('...WEB_CREATURE_MESH_SOURCES'),'runtime importer must expose free GLBs');
 }
 for(const [id,entry] of Object.entries(WEB_CREATURE_MESH_SOURCES)){
  assert.equal(entry.license,id.startsWith('b-')?'CC BY 4.0':'CC0-1.0');
 }
});
test('high-poly anatomical scans stay references: never direct GLB imports',()=>{
 assert.equal(validateAnatomySources(),true);
 assert.equal(Object.keys(WEB_CREATURE_ANATOMY_REFERENCES).length,13);
 for(const [id,ref] of Object.entries(WEB_CREATURE_ANATOMY_REFERENCES)){
  assert.equal(ref.rigVerified,false,id);
  assert.equal('downloadUrl' in ref,false,id);
  assert.ok(ref.sourceUrl.startsWith('https://'));
  assert.ok(ref.caution&&ref.downloadMethod);
  assert.equal(eligibleCreature(id),false,id);
  assert.throws(()=>setAdoptedCreatureMesh('m026',id,storage()));
 }
 for(const id of ['s-spider','s-salamander','s-octopus','s-snake','s-lizard','s-slime-cc0']){
  assert.ok(WEB_CREATURE_ANATOMY_REFERENCES[id]);
 }
});
test('low-poly, mismatched and unrigged assets cannot silently replace existing game models',()=>{
 assert.equal(CREATURE_RECONSTRUCTION_SUMMARY.total,108);
 assert.equal(CREATURE_RECONSTRUCTION_SUMMARY.completed,0);
 assert.equal(CREATURE_RECONSTRUCTION_SUMMARY.qualityPassed,0);
 const s=storage();
 for(const id of ['m008','m021','m022','m023','m024','m025','horse']){
  const item=CREATURE_RECONSTRUCTION_BY_ID[id];
  assert.deepEqual(item.candidateSources,[],id);
  assert.equal(item.rebuiltGLBComplete,false,id);
  assert.equal(item.kpiPass,false,id);
  assert.equal(adoptedCreatureMesh(id,s),'legacy',id);
 }
 assert.equal(Object.keys(REAL_BODY_CANDIDATES).length,5);
 assert.ok(REAL_BODY_SUGGESTIONS.m008.includes('w-lion'));
 assert.ok(CREATURE_RECONSTRUCTION_BY_ID.m008.anatomyReferences.includes('w-lion'));
 assert.ok(CREATURE_RECONSTRUCTION_BY_ID.m021.anatomyReferences.includes('s-beetle-male'));
 for(const source of ['g-mantis','g-lion','g-horse','b-trex','b-fox','w-lion','w-tiger']){
  assert.throws(()=>setAdoptedCreatureMesh('m023',source,s),source);
 }
 s.setItem('hai-gin.creature-mesh-adoption.v1',
  JSON.stringify({m023:'g-mantis',horse:'g-horse',m008:'w-lion'}));
 for(const id of ['m023','horse','m008'])assert.equal(adoptedCreatureMesh(id,s),'legacy');
 for(const id of ['m005','m006','summon_m005','summon_m006']){
  assert.ok(!eligibleCreature(id));
  assert.deepEqual(recommendedMeshSources(id),[]);
  assert.throws(()=>setAdoptedCreatureMesh(id,'g-lion',s));
 }
});

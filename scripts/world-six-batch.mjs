#!/usr/bin/env node
/**
 * Six independent, source-driven quality gates for the real game catalog.
 * Art references are not interpreted as 3D meshes or as visual QA approval.
 * The integration step only publishes a deterministic parity report.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {qualityInventory,objectCount,stageCount} from './world-quality-catalog.mjs';
import {STAGE_IDENTITIES,TERRITORY_IDENTITIES} from '../src/stage-library.js';
const root=path.resolve(new URL('..',import.meta.url).pathname);
const file=p=>fs.readFileSync(path.join(root,p),'utf8');
const json=p=>JSON.parse(file(p));
const lanes=Object.freeze(['catalog','geometry','materials','interaction','lod','visual']);
const argv=process.argv.slice(2),value=key=>argv[argv.indexOf(key)+1];
const sha=p=>crypto.createHash('sha256').update(file(p)).digest('hex');
const sourcePaths=['src/object-catalog.js','src/stage-library.js','src/stage-static-instancing.js','src/world-quality-pbr.js','tactics-wireframe.html','world-quality-preview.html','src/tree-seasons.js'];
const fingerprint=crypto.createHash('sha256').update(sourcePaths.map(p=>p+':'+sha(p)).join('\n')).digest('hex');
const objects=qualityInventory.filter(x=>x.type==='object');
const unique=(x,label)=>{if(new Set(x).size!==x.length)throw Error('Duplicate '+label)};
const assert=(ok,message)=>{if(!ok)throw Error(message)};
const newIds=['town_firewood_001','town_water_trough_001','town_signpost_001','town_sacks_001','town_stone_pile_001','town_brazier_001','town_herb_garden_001'];
const reportDir=path.join(root,'qa-reports/world-six-lane');
const catalog=file('src/object-catalog.js');
function runLane(lane){
 assert(lanes.includes(lane),'Unknown lane');
 const details=[];
 unique(objects.map(x=>x.id),'catalog IDs');
 assert(objectCount>=60&&stageCount===200,'Expected at least 60 real objects and 200 campaign stages');
 if(lane==='catalog'){
  for(const o of objects)assert(o.kind&&o.category&&o.name,'Invalid object '+o.id);
  for(const id of newIds)assert(objects.some(x=>x.id===id),'New object missing: '+id);
  details.push(objectCount+' catalog objects / '+stageCount+' story stages');
 }
 if(lane==='geometry'){
  for(const o of objects)assert(['furniture','building_component','town_prop','town_building','building','hill','swamp','mountain','bridge'].includes(o.kind),'Unsupported geometry kind: '+o.id);
  for(const id of newIds)assert(catalog.includes("if(id==='"+id+"')"),'No geometry branch for '+id);
  assert(catalog.includes('createCatalogObject(id,options={})'),'Missing common production factory');
  assert(catalog.includes('mergeGeometries(items.map'),'No part batching');
  details.push('Seven new IDs have production factory paths, shared with preview');
 }
 if(lane==='materials'){
  const pbr=file('src/world-quality-pbr.js');
  assert(catalog.includes('tuneWorldQualityMaterial'),'Catalog does not apply shared PBR settings');
  assert(pbr.includes('WORLD_QUALITY_AUTO_BEGIN')&&pbr.includes('WORLD_QUALITY_AUTO_END'),'Missing bounded PBR region');
  assert(pbr.includes('scale<.75||scale>1.15'),'Unsafe PBR scale');
  details.push('PBR overrides are bounded and shared with production mesh factory');
 }
 if(lane==='interaction'){
  const game=file('tactics-wireframe.html');
  assert(game.includes('OBJECT_CATALOG,createCatalogObject'),'Game must import the same runtime model catalog as studio');
  assert(game.includes('const meta=OBJECT_CATALOG[id]'),'Game placement must read authoritative footprint dimensions');
  assert(game.includes('batchStaticStageDecorations(stageObjects'),'Game must instantiate the same optimized catalog meshes');
  let count=0;
  for(const identity of Object.values({...STAGE_IDENTITIES,...TERRITORY_IDENTITIES})){
   for(const [id,x,z] of identity.landmarks){
    assert(objects.some(o=>o.id===id),'Stage landmark missing in game catalog: '+id);
    assert(Number.isFinite(x)&&Number.isFinite(z)&&x>=0&&z>=0&&x<=232&&z<=232,'Landmark outside world: '+id);
    count++;
   }
  }
  for(const id of newIds)assert(catalog.includes("id==='"+id+"'"),'Unrenderable interaction object: '+id);
  details.push(count+' stage landmark placements resolve to catalog IDs');
 }
 if(lane==='lod'){
  const staticCode=file('src/stage-static-instancing.js');
  assert(staticCode.includes('InstancedMesh')&&staticCode.includes('setMatrixAt'),'Runtime instancing is missing');
  for(const id of newIds)assert(staticCode.includes("'"+id+"'"),'New object lacks instancing eligibility: '+id);
  assert(catalog.includes("mesh.name='baked_catalog_parts'"),'Catalog part batching missing');
  details.push('Seven props eligible for static instancing and material-group mesh baking');
 }
 if(lane==='visual'){
  const preview=file('world-quality-preview.html');
  assert(preview.includes('createCatalogObject(asset)'),'Preview does not use the production factory');
  assert(preview.includes("dataset.qaReady='true'"),'WebGL-ready contract missing');
  const evidence=json('qa-reports/world-six-lane/visual-capture.json');
  assert(evidence.assetId&&objects.some(o=>o.id===evidence.assetId),'Visual target not in catalog');
  assert(evidence.captures?.length===4&&evidence.captures.every(c=>c.bytes>=10000),'Missing real WebGL screenshots');
  details.push('Real WebGL screenshots available for '+evidence.assetId+' (visual review still required)');
 }
 fs.mkdirSync(reportDir,{recursive:true});
 const output={schemaVersion:1,lane,status:'gate_passed',sourceFingerprint:fingerprint,objectCount,stageCount,details,
  visualApproved:false,gamePerformanceApproved:false};
 fs.writeFileSync(path.join(reportDir,lane+'.json'),JSON.stringify(output,null,2)+'\n');
 console.log(JSON.stringify(output));
}
function integrate(){
 const results=lanes.map(lane=>{
  const p=path.join(reportDir,lane+'.json');
  assert(fs.existsSync(p),'Missing six-lane artifact: '+lane);
  const r=JSON.parse(fs.readFileSync(p,'utf8'));
  assert(r.lane===lane&&r.status==='gate_passed'&&r.sourceFingerprint===fingerprint,
   'Stale, failed or incorrect lane: '+lane);
  return r;
 });
 const report={schemaVersion:1,status:'six_static_gates_passed_visual_approval_pending',
  sourceFingerprint:fingerprint,objectCount,stageCount,
  objectIds:objects.map(x=>x.id),newObjectIds:newIds,
  lanes:Object.fromEntries(results.map(r=>[r.lane,{status:r.status,details:r.details}])),
  runtimeSource:'src/object-catalog.js',
  gameIntegration:'tactics-wireframe.html + src/stage-library.js + src/stage-static-instancing.js',
  automaticMergeScope:'deterministic index and QA report only',
  visualQualityApproved:false,androidFpsVerified:false,
  note:'A 2D reference, WebGL screenshot or passing source audit does not prove game fidelity, visual quality or Android 1000v1000 FPS.'};
 const dest=path.join(root,'data/world-quality/live-batch-report.json');
 fs.mkdirSync(path.dirname(dest),{recursive:true});
 fs.writeFileSync(dest,JSON.stringify(report,null,2)+'\n');
 const targets={schemaVersion:1,source:'src/object-catalog.js',count:objectCount,
  objects:objects.map(({id,name,category,kind})=>({id,name,category,kind}))};
 fs.writeFileSync(path.join(root,'data/world-quality/catalog-targets.json'),JSON.stringify(targets,null,2)+'\n');
 // Six independent gates establish code-level production parity, not final
 // artist approval. Publish the exact per-ID route from authoring to GAME.
 const usage=new Map(objects.map(o=>[o.id,0]));
 for(const stage of Object.values({...STAGE_IDENTITIES,...TERRITORY_IDENTITIES}))
  for(const [id] of stage.landmarks)usage.set(id,(usage.get(id)||0)+1);
 const adoption={schemaVersion:1,status:'production_factory_connected_visual_qa_pending',
  sourceFingerprint:fingerprint,gamePage:'tactics-wireframe.html',
  runtimeFactory:'src/object-catalog.js#createCatalogObject',
  rendering:'src/stage-static-instancing.js#batchStaticStageDecorations',
  objects:objects.map(o=>({id:o.id,name:o.name,kind:o.kind,
    factoryRegistered:true,staticQaPassed:true,
    stageLandmarkUses:usage.get(o.id)||0,
    gameAccess:'shared-catalog-factory',
    visualQaApproved:false,androidFpsVerified:false})),
  note:'The game and object viewer share the exact same model factory. Generated reference images and unmerged experimental PRs are NOT automatically production models.'};
 fs.writeFileSync(path.join(root,'data/world-quality/production-model-adoption.json'),
  JSON.stringify(adoption,null,2)+'\n');
 console.log(JSON.stringify({integrated:6,objects:objectCount,output:'data/world-quality/live-batch-report.json'}));
}
if(argv.includes('--integrate'))integrate();
else runLane(value('--lane')||'catalog');

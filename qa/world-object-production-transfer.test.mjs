import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {qualityInventory,objectCount} from '../scripts/world-quality-catalog.mjs';
const path=new URL('../data/world-quality/production-model-adoption.json',import.meta.url);
assert.ok(existsSync(path),'Six QA lanes must produce adoption manifest before publication');
const manifest=JSON.parse(readFileSync(path,'utf8'));
const objects=qualityInventory.filter(x=>x.type==='object');
assert.equal(manifest.status,'production_factory_connected_visual_qa_pending');
assert.equal(manifest.objects.length,objectCount);
assert.equal(manifest.runtimeFactory,'src/object-catalog.js#createCatalogObject');
assert.equal(manifest.rendering,'src/stage-static-instancing.js#batchStaticStageDecorations');
assert.deepEqual(new Set(manifest.objects.map(x=>x.id)),new Set(objects.map(x=>x.id)));
for(const entry of manifest.objects){
 assert.equal(entry.factoryRegistered,true,entry.id+' not in production factory');
 assert.equal(entry.staticQaPassed,true,entry.id+' lacks independent six-lane QA');
 assert.equal(entry.gameAccess,'shared-catalog-factory');
 assert.equal(entry.visualQaApproved,false,'No silent promotion of unreviewed graphics');
 assert.equal(entry.androidFpsVerified,false,'Do not invent Android FPS checks');
}
const battle=readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
assert.match(battle,/createCatalogObject\(id,\{cellSize:CELL\}\)/);
assert.match(battle,/stageBatchStats=batchStaticStageDecorations\(stageObjects,THREE/);
assert.match(battle,/getBattleObjectTransferStats/);
console.log('PASS: '+manifest.objects.length+' canonical objects have verified authoring→production route, with visual QA pending');

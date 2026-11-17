import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

test('six category selector is backed by the same six active registry IDs',()=>{
 const dashboard=JSON.parse(fs.readFileSync('data/hourly-batch-dashboard.json','utf8'));
 const sw=JSON.parse(fs.readFileSync('data/batch-center-switches.json','utf8'));
 const ids=dashboard.groups.map(group=>group.id);
 assert.deepEqual(ids,['faceHair','outfit','world','creatureMonster','creatureSummon','anime']);
 for(const id of ids)assert.equal(sw.groups[id].enabled,true,id+' must be active');
 for(const id of ['human','monster'])assert.equal(sw.groups[id].enabled,false,id+' legacy should stay off');
 const page=fs.readFileSync('batch-monitor.html','utf8');
 for(const id of ids)assert.match(page,new RegExp('<option value="'+id+'">'));
 assert.match(page,/id="batchDisplaySelect"/);
 assert.match(page,/applyDisplayFilter\(\)/);
 assert.match(page,/v\.card\.hidden=!all&&g\.id!==id/);
 assert.match(page,/id="selectedBatchCount"/);
 const start=page.indexOf('<script>')+8,end=page.indexOf('</script>',start);
 assert(start>7&&end>start);
 assert.doesNotThrow(()=>new vm.Script(page.slice(start,end)));
});

test('60 real object IDs are selectable and route to the same production 3D preview',()=>{
 const c=JSON.parse(fs.readFileSync('data/world-quality/catalog-targets.json','utf8'));
 assert.equal(c.count,60);
 assert.equal(c.objects.length,60);
 assert.equal(new Set(c.objects.map(x=>x.id)).size,60);
 const page=fs.readFileSync('batch-monitor.html','utf8');
 assert.match(page,/id="worldObjectPicker"/);
 assert.match(page,/id="worldObjectPreview"/);
 assert.match(page,/updateWorldSix\(\)/);
 assert.match(page,/createCatalogObject\(\)/);
 assert.match(page,/world-quality-preview\.html\?object=/);
 const script=fs.readFileSync('scripts/manual-hourly-batch-dispatch.mjs','utf8');
 assert.match(script,/world:'world-quality-photoreal\.yml'/);
});

test('all 22 real 3D facial expression IDs are offered, preserving preview parameter names',()=>{
 const page=fs.readFileSync('batch-monitor.html','utf8');
 const from=page.match(/const EXPRESSION_OPTIONS=Object\.freeze\(\[([\s\S]*?)\]\);/);
 assert(from,'expression selector registry missing');
 const offered=[...from[1].matchAll(/\['([a-zA-Z]+)','/g)].map(x=>x[1]);
 const source=fs.readFileSync('src/face-expression-animation-v48.js','utf8');
 const master=source.match(/export const FACE_EXPRESSIONS=Object\.freeze\(\{([\s\S]*?)\}\);/);
 assert(master,'canonical expression registry missing');
 const canonical=[...master[1].matchAll(/^\s*([a-zA-Z]+):Object\.freeze\(/gm)].map(x=>x[1]);
 assert.equal(canonical.length,22);
 assert.deepEqual(new Set(offered),new Set(canonical));
 assert.match(page,/id="faceExpressionSelect"/);
 assert.match(page,/face-mesh-studio\.html\?/);
 assert.match(page,/gender:\$\('facePreviewGender'\)\.value/);
 assert.match(page,/expression:sel\.value/);
 assert.match(page,/view:\$\('facePreviewView'\)\.value/);
});

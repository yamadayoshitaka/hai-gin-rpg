import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {MARKER,parseRequest} from '../scripts/manual-hourly-batch-dispatch.mjs';
function issue(category,target='',instruction='Quality improvement',max=1){
 return {title:'[hai-gin-batch] '+category,user:{login:'yamadayoshitaka'},body:MARKER+'\n```json\n'+JSON.stringify({category,target,instruction,max})+'\n```'};
}
test('owner can submit all four batch categories',()=>{
 const selected=[
 ['human','human-v65-quality.yml'],
 ['monster','monster-anatomy-qa.yml'],
 ['world','world-quality-photoreal.yml'],
 ['anime','story-cinematic-qa.yml']];
 for(const [kind,wf] of selected)assert.equal(parseRequest(issue(kind),'yamadayoshitaka').workflow,wf);
});
test('target and instruction are preserved without shell interpolation',()=>{
 const x=parseRequest(issue('world','object:castle_001','stone walls and close-up mortar',2),'yamadayoshitaka');
 assert.equal(x.target,'object:castle_001');assert.equal(x.instruction,'stone walls and close-up mortar');assert.equal(x.max,2);
});
test('reject non-owner and malformed payloads',()=>{
 assert.throws(()=>parseRequest(issue('human'),'another-user'),/owner/);
 assert.throws(()=>parseRequest({...issue('human'),title:'ordinary issue'},'yamadayoshitaka'),/owner/);
 assert.throws(()=>parseRequest(issue('other'),'yamadayoshitaka'),/Unknown/);
 assert.throws(()=>parseRequest(issue('world','/etc/passwd'),'yamadayoshitaka'),/target/i);
 assert.throws(()=>parseRequest(issue('world','stage:c03-s99','hello',4),'yamadayoshitaka'),/size/);
 assert.throws(()=>parseRequest(issue('human','','x'.repeat(501)),'yamadayoshitaka'),/Instruction/);
});
test('dashboard always shows exactly four task groups with existing previews',()=>{
 const d=JSON.parse(fs.readFileSync('data/hourly-batch-dashboard.json','utf8'));
 assert.equal(d.groups.length,4);
 assert.deepEqual(d.groups.map(g=>g.id),['human','monster','world','anime']);
 assert.deepEqual(d.groups.map(g=>g.autoEnabled),[true,true,true,false]);
 for(const x of d.groups){assert.equal(typeof x.preview,'string');assert.equal(typeof x.workflow,'string');}
 const html=fs.readFileSync('batch-monitor.html','utf8');
 assert(html.includes('現在の画面を見る'));
 assert(html.includes('次の手動指示'));
 assert(html.includes('issues/new?'));
 assert(html.includes('daily')===false);
 const start=html.indexOf('<script>')+8, end=html.indexOf('</script>',start);
 const script=start>7&&end>start?html.slice(start,end):null;
 assert(script,'Dashboard JavaScript must exist');
 assert.doesNotThrow(()=>new vm.Script(script),'Inline batch control JavaScript must parse');
});

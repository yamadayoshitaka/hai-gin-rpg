import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {MARKER,parseRequest} from '../scripts/manual-hourly-batch-dispatch.mjs';
function issue(category,target='',instruction='Quality improvement',max=1){
 return {title:'[hai-gin-batch] '+category,user:{login:'yamadayoshitaka'},body:MARKER+'\n```json\n'+JSON.stringify({category,target,instruction,max})+'\n```'};
}
test('owner can submit six active batch categories',()=>{
 const selected=[
 ['faceHair','character-six-lane.yml'],
 ['outfit','character-six-lane.yml'],
 ['world','world-quality-photoreal.yml'],
 ['creatureMonster','creature-six-lane.yml'],
 ['creatureSummon','creature-six-lane.yml'],
 ['anime','story-cinematic-qa.yml']];
 for(const [kind,wf] of selected)assert.equal(parseRequest(issue(kind),'yamadayoshitaka').workflow,wf);
});
test('target and instruction are preserved without shell interpolation',()=>{
 const x=parseRequest(issue('faceHair','female','stone walls and close-up mortar',2),'yamadayoshitaka');
 assert.equal(x.target,'female');assert.equal(x.instruction,'stone walls and close-up mortar');assert.equal(x.max,2);
});
test('reject non-owner and malformed payloads',()=>{
 assert.throws(()=>parseRequest(issue('human'),'another-user'),/owner/);
 assert.throws(()=>parseRequest({...issue('human'),title:'ordinary issue'},'yamadayoshitaka'),/owner/);
 assert.throws(()=>parseRequest(issue('other'),'yamadayoshitaka'),/Unknown/);
 assert.throws(()=>parseRequest(issue('faceHair','/etc/passwd'),'yamadayoshitaka'),/target/i);
 assert.throws(()=>parseRequest(issue('faceHair','female','hello',4),'yamadayoshitaka'),/size/);
 assert.throws(()=>parseRequest(issue('outfit','','x'.repeat(501)),'yamadayoshitaka'),/Instruction/);
});
test('dashboard lists six active quality and story groups',()=>{
 const d=JSON.parse(fs.readFileSync('data/hourly-batch-dashboard.json','utf8'));
 assert.equal(d.groups.length,6);
 assert.deepEqual(d.groups.map(g=>g.id),['faceHair','outfit','world','creatureMonster','creatureSummon','anime']);
 const switches=JSON.parse(fs.readFileSync('data/batch-center-switches.json','utf8'));
 assert.deepEqual(d.groups.map(g=>g.autoEnabled),d.groups.map(g=>switches.groups[g.id].enabled));
 for(const g of ['human','monster'])assert.equal(switches.groups[g].enabled,false);
 assert.equal(switches.groups.world.enabled,true);
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

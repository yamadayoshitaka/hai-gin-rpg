import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const stages=['launch','code','qa','commit','pr','merge','deploy'];
const values=new Set(['done','pending','failed','skipped','unknown']);
const kinds=['human','monster','world','anime'];
test('batch work progress uses evidence-backed stage status without treating scheduled tasks as implementation',()=>{
 const state=JSON.parse(fs.readFileSync('data/batch-work-progress.json','utf8'));
 assert.equal(state.schemaVersion,1);
 assert.deepEqual(state.stageOrder,stages);
 assert.deepEqual(Object.keys(state.groups),kinds);
 for(const [kind,entry] of Object.entries(state.groups)){
  assert.equal(typeof entry.summary,'string');
  assert.equal(typeof entry.nextAction,'string');
  assert(entry.nextAction.length>0);
  for(const stage of stages)assert(values.has(entry.steps?.[stage]),kind+' / '+stage);
  if(entry.status==='deployed')assert(stages.every(s=>entry.steps[s]==='done'),kind+' false completion');
  if(entry.carryover)assert(entry.nextAction.length>0,kind+' carryover required');
  for(const e of entry.evidence)assert(e.url.startsWith('https://github.com/yamadayoshitaka/hai-gin-rpg/'));
 }
 for(const [kind,entry] of Object.entries(state.groups)){
  if(entry.status==='work_incomplete')assert.notEqual(entry.steps.deploy,'done',kind+' must not claim deployment');
  if(entry.steps.commit==='done')assert(entry.evidence.some(e=>/commit|pull|actions|compare/.test(e.url)),kind+' commit needs evidence');
 }
});
test('management page distinguishes QA from implementation progress and pulls the persisted record',()=>{
 const html=fs.readFileSync('batch-monitor.html','utf8');
 assert.match(html,/batch-work-progress\.json/);
 assert.match(html,/updateProgress\(\)/);
 assert.match(html,/実作業進捗/);
 assert.match(html,/次回引継ぎ/);
 assert.match(html,/最終記録/);
});


test('visual PR preview entries are anchored to valid public GitHub routes and known batches',()=>{
 const cfg=JSON.parse(fs.readFileSync('data/batch-pr-previews.json','utf8'));
 assert.equal(cfg.schemaVersion,1);
 assert.deepEqual(Object.keys(cfg.groups).sort(),[...kinds].sort());
 const expected={world:[434,430,427,409],human:[418],monster:[426],anime:[415,424]};
 for(const [category,entries] of Object.entries(cfg.groups)){
  // New, real review PRs must not break Pages merely because a hardcoded
  // historical PR list became stale. Retain the original baseline links.
  const actual=entries.map(x=>x.pr);
  assert.equal(new Set(actual).size,actual.length,category+' duplicate PR');
  for(const pr of expected[category]){
   assert(actual.includes(pr),category+' lost baseline preview PR #'+pr);
  }
  for(const entry of entries){
   assert(Number.isSafeInteger(entry.pr)&&entry.pr>0);
   assert(/^[a-z0-9-]+\.html$/.test(entry.page));
   assert(fs.existsSync(entry.page),entry.page+' must exist');
   assert(Array.isArray(entry.ids));
   if(entry.object)assert(/^[a-z0-9_]+$/.test(entry.object));
   if(entry.params)assert(/^[a-z0-9_=&-]+$/.test(entry.params));
  }
 }
 const ui=fs.readFileSync('batch-pr-preview.html','utf8');
 assert.match(ui,/raw\.githack\.com/);
 assert.match(ui,/commit.*main|commits\/main/);
 assert.match(ui,/compare\//);
 assert.match(ui,/release\.json/);
 assert.match(ui,/merged_at/);
 assert.match(ui,/main未反映|未マージ/);
 assert.match(ui,/試験|試作/);
 assert.match(ui,/PR版/);
 const script=ui.match(/<script>([\s\S]*?)<\/script>/);
 assert(script,'preview must include a live browser script');
 assert.doesNotThrow(()=>new vm.Script(script[1]));
 const dash=fs.readFileSync('batch-monitor.html','utf8');
 assert.match(dash,/batch-pr-preview\.html/);
 assert.match(dash,/updatePreviewStatus/);
 assert.match(dash,/GitHubから照会/);
});

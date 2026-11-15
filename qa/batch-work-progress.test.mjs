import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
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
 assert.equal(state.groups.human.status,'work_incomplete');
 assert.equal(state.groups.human.steps.commit,'pending');
 assert.equal(state.groups.monster.steps.qa,'failed');
});
test('management page distinguishes QA from implementation progress and pulls the persisted record',()=>{
 const html=fs.readFileSync('batch-monitor.html','utf8');
 assert.match(html,/batch-work-progress\.json/);
 assert.match(html,/updateProgress\(\)/);
 assert.match(html,/実作業進捗/);
 assert.match(html,/次回引継ぎ/);
 assert.match(html,/最終記録/);
});

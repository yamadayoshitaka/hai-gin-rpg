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
 for(const [kind,entry] of Object.entries(state.groups)){
  if(entry.status==='work_incomplete')assert.notEqual(entry.steps.deploy,'done',kind+' must not claim deployment');
  if(entry.steps.commit==='done'){
    assert.equal(entry.steps.code,'done',kind+' quality commit requires genuine source/artwork change');
    assert(entry.evidence.some(e=>/\/commit\/[0-9a-f]{40}(?:$|[?#])/.test(e.url)),kind+' requires a genuine commit SHA URL');
  }
  if(entry.steps.pr==='done')assert(entry.evidence.some(e=>/\/pull\/\d+/.test(e.url)),kind+' PR completion needs PR evidence');
  if(entry.steps.deploy==='done')assert.equal(entry.status,'deployed',kind+' deployment and status must agree');
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

test('all four groups require meaningful regression fixes and commit, not report-only work',()=>{
 const state=JSON.parse(fs.readFileSync('data/hourly-batch-dashboard.json','utf8'));
 assert.equal(state.groups.length,4);
 for(const group of state.groups){
  assert.equal(group.schedulerEnabled,true,group.id+' must be scheduled');
  assert.match(group.goal,/実ソース|3Dモデル|実アセット|アセット/);
  assert.match(group.goal,/QA/);
  assert.match(group.goal,/コミット/);
  assert.match(group.goal,/未完了/);
 }
});

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

test('all four batches declare realistic cohort targets without claiming those targets as actual outputs',()=>{
 const cfg=JSON.parse(fs.readFileSync('data/hourly-batch-dashboard.json','utf8'));
 const expected={human:[5,10],monster:[3,5],world:[5,10],anime:[5,20]};
 assert.deepEqual(cfg.groups.map(x=>x.id),Object.keys(expected));
 for(const group of cfg.groups){
  const goal=group.batchTarget;
  assert.equal(goal.min,expected[group.id][0]);
  assert.equal(goal.max,expected[group.id][1]);
  assert(goal.grouping.length>=15);
  assert(group.goal.includes('コミットSHA'));
  assert(group.goal.includes('対象ID別'));
 }
 const html=fs.readFileSync('batch-monitor.html','utf8');
 assert(html.includes('一括処理の目標'));
 assert(html.includes('目標値であり実績ではありません'));
 assert(html.includes('data.batchTarget'));
});

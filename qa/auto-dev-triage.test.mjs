import test from 'node:test';
import assert from 'node:assert/strict';
import {categoryFor,actionable,marker,clean,failedJobs,issueBody,triage} from '../scripts/auto-dev-triage.mjs';
const now=Date.parse('2026-11-18T10:00:00Z');
const run=(id,name='Face and hair QA')=>({id,name,conclusion:'failure',event:'pull_request',
 created_at:'2026-11-18T09:00:00Z',head_sha:'a'.repeat(40),
 html_url:'https://github.com/yamadayoshitaka/hai-gin-rpg/actions/runs/'+id});
test('categorize failed workflows',()=>{
 for(const [n,c] of [['Manga chapter','anime'],['World six lane','world'],
 ['Creature wolf','creatureMonster'],['Outfit armor','outfit'],
 ['Female face hair','faceHair'],['Battle FPS','gameQuality']])
  assert.equal(categoryFor(n),c);
});
test('only fresh completed failures trigger handoff',()=>{
 assert(actionable(run(1),now));
 for(const bad of [{conclusion:'success'},{event:'unknown'},
  {created_at:'2026-11-16T00:00:00Z'},{name:'Auto-dev failure triage'}])
  assert.equal(actionable({...run(1),...bad},now),false);
});
test('stable keys and protected issue summary',()=>{
 assert.equal(marker('foo','world'),marker('foo','world'));
 assert.notEqual(marker('foo','world'),marker('foo','faceHair'));
 assert(!clean('Bearer secret ghp_abcdefghij123456').includes('secret'));
 const jobs=failedJobs([{name:'WebGL',conclusion:'failure',steps:[
  {name:'Export GLB',conclusion:'failure'},{name:'checkout',conclusion:'success'}]}]);
 assert.deepEqual(jobs[0].steps,['Export GLB']);
 const body=issueBody({marker:'m',category:'faceHair',name:'Face',
  url:'https://github.com/yamadayoshitaka/hai-gin-rpg/actions/runs/1',
  sha:'a'.repeat(40),at:'2026-11-18T10:00:00Z',jobs});
 assert.match(body,/mainへマージせず/);
});
test('skips same run; caps writes; never produces a code patch',async()=>{
 const calls=[];const name='Face and hair QA';
 const old={number:4,body:'<!-- '+marker(name,'faceHair')+' -->\n/actions/runs/1'};
 const api=async(route,options={})=>{
  calls.push({route,method:options.method});
  if(route.startsWith('actions/runs?'))return {workflow_runs:[run(1),run(2),run(3),run(4)]};
  if(route.startsWith('issues?'))return [old];
  if(route.endsWith('/jobs?per_page=100'))return {jobs:[]};
  if(route==='issues'&&options.method==='POST')return {number:20,html_url:'https://github.com/yamadayoshitaka/hai-gin-rpg/issues/20'};
  throw Error('unexpected '+route);
 };
 const out=await triage(api,now);
 assert.equal(out.issueWrites,3);
 assert.equal(out.records[0].runId,2);
 assert.equal(out.sourceCodeFixes,0);
 assert.equal(calls.filter(c=>c.method==='POST').length,3);
});

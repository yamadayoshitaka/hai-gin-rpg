import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import {EVOLUTION_PROFILE,validateEvolutionProfile,EVOLUTION_LIMITS}
 from '../src/character-system/quality-evolution-profile.js';
import {candidateValues,scoreCandidate,compareBrowser}
 from '../scripts/quality-evolution-loop.mjs';

test('production actually consumes shared quality profile in all 3 geometry generators',()=>{
 validateEvolutionProfile();
 for(const [key,file,mark] of [
  ['face','src/face-feature-meshes.js','EVOLUTION_PROFILE.face.eyeInsetRatio'],
  ['hair','src/face-scalp-wig.js','EVOLUTION_PROFILE.hair.fringeRootScale'],
  ['outfit','src/outfit-maintenance-model.js','EVOLUTION_PROFILE.outfit.fabricBumpScale']
 ]){
  const text=fs.readFileSync(file,'utf8');
  assert(text.includes(mark),key+' must affect actual 3D model source');
  const values=EVOLUTION_PROFILE[key];
  for(const [param,v] of Object.entries(values)){
   const [min,max]=EVOLUTION_LIMITS[key][param];
   assert(v>=min&&v<=max);
  }
 }
 assert.deepEqual(EVOLUTION_PROFILE.face,{eyeInsetRatio:.031});
 assert.deepEqual(EVOLUTION_PROFILE.hair,{fringeRootScale:1});
 assert.deepEqual(EVOLUTION_PROFILE.outfit,{fabricBumpScale:1});
});
test('a maximum of 3 small, stable, safe candidate changes are generated each run',()=>{
 for(const [group,key] of [
  ['face','eyeInsetRatio'],['hair','fringeRootScale'],['outfit','fabricBumpScale']
 ]){
  const candidates=candidateValues(group,EVOLUTION_PROFILE[group][key]);
  assert(candidates.length>0&&candidates.length<=3);
  for(const c of candidates){
   const [lo,hi]=EVOLUTION_LIMITS[group][key];
   assert(c>=lo&&c<=hi);
  }
 }
});
test('only an objective proxy gain can be considered; no invented outfit reference score',()=>{
 const face={domain:'face',hardGate:true,proxyScore:92,metrics:{faceTriangles:4096}};
 const after={domain:'face',hardGate:true,proxyScore:94,metrics:{faceTriangles:4096}};
 assert.equal(scoreCandidate('face',face,after).improved,true);
 assert.equal(scoreCandidate('face',face,{...after,metrics:{faceTriangles:5000}}).improved,false);
 assert.equal(scoreCandidate('face',face,{...after,hardGate:false}).improved,false);
 const outfit={domain:'outfit',hardGate:true,proxyScore:null,metrics:{jobCount:17}};
 assert.equal(scoreCandidate('outfit',outfit,outfit).improved,false);
 const hair={domain:'hair',hardGate:true,proxyScore:10,metrics:{meshTriangles:10000}};
 assert.equal(scoreCandidate('hair',hair,
  {domain:'hair',hardGate:true,proxyScore:12,metrics:{meshTriangles:10500}}).improved,false);
});
test('identical real WebGL scenario, screenshot and frame time are mandatory',()=>{
 const a={status:'measured_ci_fps',scenario:'50v50',
  environment:'github-actions-swiftshader-chromium',fps:48,p95Ms:24,
  drawCalls:470,runtimeErrors:0,screenshotBytes:34001};
 const b={...a,fps:47.5,p95Ms:24.5,drawCalls:472};
 assert.equal(compareBrowser(a,b).approved,true);
 for(const change of [
  {fps:40},{p95Ms:45},{runtimeErrors:1},{screenshotBytes:0},
  {scenario:'1000v1000'},{environment:'Android Pixel 8a'},
  {status:'failed'},{webglContextLost:true}
 ]){
  assert.equal(compareBrowser(a,{...b,...change}).approved,false,JSON.stringify(change));
 }
 assert.equal(compareBrowser({status:'not_run'},b).approved,false);
});
test('real model generators run and report objective Three.js metrics without calling a paid API',()=>{
 for(const domain of ['face','hair','outfit']){
  const r=spawnSync(process.execPath,['qa/quality-evolution-probe.mjs',domain],
   {encoding:'utf8',timeout:180000,maxBuffer:4*1024*1024});
  const match=/EVOLUTION_PROBE (\{[^\n]+\})/.exec(r.stdout||'');
  assert(match,'Probe emitted no structured report '+domain+' '+(r.stderr||'').slice(-900));
  const data=JSON.parse(match[1]);
  assert.equal(r.status,0,'Real model probe must pass: '+JSON.stringify(data).slice(0,850));
  assert.equal(data.hardGate,true);
  assert.equal(data.domain,domain);
  assert.equal(data.androidFpsMeasured,false);
  assert.equal(data.visualApproval,false);
 }
});
test('schedule is 3 independent domains and never auto-publishes unknown FF15 art',()=>{
 const yaml=fs.readFileSync('.github/workflows/quality-evolution-loop.yml','utf8');
 const script=fs.readFileSync('scripts/quality-evolution-loop.mjs','utf8');
 for(const domain of ['face','hair','outfit'])assert(yaml.includes(domain));
 assert.match(yaml,/workflow_dispatch/);
 assert.match(yaml,/node --test qa\/quality-evolution-loop.test.mjs/);
 assert.match(yaml,/steps.optimize.outputs.changed/);
 assert.match(script,/return \{improved:false,reason:'no objective aesthetic reference/);
 assert.match(script,/sourceCommitSha/);
 assert.match(script,/compareBrowser\(baselineBrowser,perf\)/);
 assert.match(script,/androidFpsMeasured:false/);
 assert.match(script,/actions\/workflows\/publish-pages\.yml\/dispatches/);
});

test('automatic face or hair parameter adoption requires actual rendered model screenshots',()=>{
 const script=fs.readFileSync('scripts/quality-evolution-loop.mjs','utf8');
 const workflow=fs.readFileSync('.github/workflows/quality-evolution-loop.yml','utf8');
 assert.match(script,/qa\/facehair-production-visual\.cjs/);
 assert.match(script,/blocked_facehair_visual_regression/);
 assert.match(script,/visualResult\.views\?\.length!==8/);
 assert.match(workflow,/FACE_QA_BASE_URL: http:\/\/127\.0\.0\.1:8765/);
 assert.match(workflow,/qa-screenshots\/facehair-production/);
});

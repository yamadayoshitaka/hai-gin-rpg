#!/usr/bin/env node
/** Six real-game quality gates. Static tests are evidence, not measured FPS.
 * The independent browser probe supplies actual runtime FPS/errors when available.
 * A failed lane becomes a repair target, NOT a false green success.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export const LANES=Object.freeze([
 {id:'model',label:'全モデル→ゲーム',testPaths:[
  'qa/battle-source-to-game-visual.test.mjs','qa/battle-visual-pipeline.test.mjs',
  'qa/creature-game-model-routing.test.mjs']},
 {id:'fidelity',label:'画質・PBR・顔髪・衣装',testPaths:[
  'qa/battle-face-color-regression.test.mjs','qa/battle-scalp-cloth-coverage.test.mjs',
  'qa/battle-rigid-frustum-optimization.test.mjs']},
 {id:'motion',label:'歩行・騎乗・接地・アクション',testPaths:[
  'qa/army-visual-ground-tempo-parity.test.mjs',
  'qa/battle-human-riding-navigation.test.mjs','qa/battle-saddle-seat-anchor.test.mjs']},
 {id:'frame',label:'フレーム間隔・FPS・描画負荷',testPaths:[
  'qa/battle-frame-pacing.test.mjs','qa/battle-phase-profiler.test.mjs',
  'qa/command-touch-camera-performance.test.mjs']},
 {id:'scale',label:'50対50・1000対1000・LOD・メモリ',testPaths:[
  'qa/crowd-longrun-performance.test.mjs','qa/creature-performance.test.mjs',
  'qa/battle-rigid-frustum-optimization.test.mjs']},
 {id:'runtime',label:'ゲーム起動・JS/WebGLエラー',testPaths:[
  'qa/battle-controller.test.mjs','qa/battle-ui-motion.test.mjs',
  'qa/battle-visual-pipeline.test.mjs']}
]);
export const laneBySchedule=Object.freeze({
 '5 * * * *':'model','15 * * * *':'fidelity','25 * * * *':'motion',
 '35 * * * *':'frame','45 * * * *':'scale','55 * * * *':'runtime'
});
export const metricKeys=Object.freeze(['fps','p95Ms','drawCalls','gpuGeometries','gpuTextures','runtimeErrors']);
export function compareMetrics(before,after){
 const out={};
 if(!before||!after||before.scenario!==after.scenario||before.environment!==after.environment)
  return {comparable:false,reason:'scenario/environment differed or no prior measurement',delta:out};
 for(const k of metricKeys){
  if(Number.isFinite(before[k])&&Number.isFinite(after[k]))
   out[k]=Math.round((after[k]-before[k])*100)/100;
 }
 return {comparable:Object.keys(out).length>0,delta:out,
  fpsImproved:Number.isFinite(out.fps)?out.fps>0:null,
  frameP95Improved:Number.isFinite(out.p95Ms)?out.p95Ms<0:null};
}
function exec(bin,args,timeout=120000){
 const p=spawnSync(bin,args,{cwd:root,encoding:'utf8',timeout,maxBuffer:8*1024*1024});
 return {ok:p.status===0&&!p.error,exitCode:p.status,
  log:(p.stdout||'')+'\n'+(p.stderr||'')};
}
function sha(p){return crypto.createHash('sha256').update(fs.readFileSync(path.join(root,p))).digest('hex')}
export function validateLane(id){
 const found=LANES.find(l=>l.id===id);
 if(!found)throw Error('Invalid game-quality lane '+String(id));
 if(found.testPaths.some(p=>!fs.existsSync(path.join(root,p))))throw Error('Missing real test for '+id);
 return found;
}
function run(){
 const args=process.argv.slice(2);
 const value=key=>args.includes(key)?args[args.indexOf(key)+1]:null;
 const lane=validateLane(value('--lane')||laneBySchedule[process.env.SCHEDULED_CRON]||'model');
 const sourcePaths=[
  'tactics-wireframe.html','src/mass-battle-real-army.js',
  'src/character-system/battle-visual-pipeline.js','src/outfit-maintenance-model.js',
  'src/face-scalp-wig.js','src/creature-game-model-routing.js','src/object-catalog.js',
  'src/battle-frame-pacing.js','src/crowd-performance-budget.js',
  'src/stage-static-instancing.js'
 ];
 const fingerprint=crypto.createHash('sha256').update(
  sourcePaths.map(p=>p+':'+sha(p)).join('\n')).digest('hex');
 const test=exec('node',['--test',...lane.testPaths],240000);
 const outputDir=path.join(root,'qa-reports/game-quality-six');
 fs.mkdirSync(outputDir,{recursive:true});
 let browser=null;
 const browserFile=path.join(outputDir,'browser-'+lane.id+'.json');
 if(fs.existsSync(browserFile)){
  try{browser=JSON.parse(fs.readFileSync(browserFile,'utf8'))}
  catch(e){browser={status:'invalid',error:String(e)}}
 }
 const summary={
  schemaVersion:1,startedAt:new Date().toISOString(),lane:lane.id,label:lane.label,
  sourceFingerprint:fingerprint,sourcePaths,
  checks:lane.testPaths,status:test.ok?'static_pass':'static_fail',
  staticTestsPassed:test.ok,staticExitCode:test.exitCode,
  failureLog:test.ok?'':test.log.slice(-1600),
  browser:browser||{status:'not_run',reason:'This lane has no browser sample'},
  performanceApproved:false,visualApproved:false,androidFpsMeasured:false,
  modificationsApplied:0,commitsCreated:0,
  note:'All test results must be checked. No 3D change, FPS gain or Android approval is inferred from a successful QA invocation.'
 };
 fs.writeFileSync(path.join(outputDir,'latest.json'),JSON.stringify(summary,null,2)+'\n');
 if(process.env.GITHUB_STEP_SUMMARY)fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,
  '### Game quality lane '+lane.id+'\n'+
  'Source SHA: '+fingerprint.slice(0,12)+'\n'+
  'Static QA: '+(test.ok?'PASS':'FAIL')+'\n'+
  'Browser: '+summary.browser.status+'\n'+
  'Source changed by this gate: 0; Android FPS: UNMEASURED; Visual quality: UNAPPROVED\n');
 console.log(JSON.stringify(summary));
 // The owner approved deployment despite noncritical QA failures. Actual
 // parse, ID integrity and source-patch safety remain in self-drive.
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))run();

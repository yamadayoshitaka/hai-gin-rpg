#!/usr/bin/env node
/**
 * Stage 1 high-fidelity master QA: read-only regression runner.
 * Pass percentage is VERIFIED CHECK COVERAGE, never an FF13/artistic score.
 * Human visual comparison and browser footage remain explicitly pending.
 * Repeated failures produce a free/open-source research queue; the runner
 * does not purchase assets, call paid APIs, auto-merge, or rewrite models.
 */
import {spawnSync} from 'node:child_process';
import {existsSync,mkdirSync,readFileSync,writeFileSync,appendFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const checks=[
 {id:'source-registration',group:'catalog',file:'qa/stage1-master-asset-catalog.test.mjs'},
 {id:'face-geometry-speech',group:'face',file:'qa/facial-feature-analysis.test.mjs'},
 {id:'face-blink',group:'face',file:'qa/facial-blink.test.mjs'},
 {id:'skin-material',group:'face',file:'qa/face-skin-protection.test.mjs'},
 {id:'eyebrow-attachment',group:'face',file:'qa/eyebrow-surface-regression.test.mjs'},
 {id:'hair-headwear',group:'hair',file:'qa/hair-headwear-occlusion.test.mjs'},
 {id:'helmet-fit',group:'helmet',file:'qa/helmet-fit-policy.test.mjs'},
 {id:'outfit-surface',group:'outfit',file:'qa/outfit-surface-regression.test.mjs'},
 {id:'garment-coverage',group:'outfit',file:'qa/garment-coverage-regression.test.mjs'},
 {id:'all-job-fit',group:'rig',file:'qa/all-job-attachment-regression.test.mjs'},
 {id:'creature-anatomy',group:'creature',file:'qa/creature-realistic-anatomy.test.mjs'},
 {id:'creature-fur-face',group:'creature',file:'qa/canine-fur-face-regression.test.mjs'}
];
const humanReview=[
 {id:'real-model-face-footage',group:'face',reason:'Chromium real-model eye/helmet/animation frames require manual dispatch and review'},
 {id:'ff13-style-art-review',group:'art',reason:'No geometric test can certify FF13-level aesthetic/photorealism'},
 {id:'master-source-asset-quality-review',group:'catalog',reason:'References to existing assets are not newly generated high-resolution scans'}
];
const freeResearch={
 face:[{name:'Blender glTF import/export documentation',url:'https://docs.blender.org/manual/en/dev/addons/scene_gltf2.html'},
       {name:'Khronos glTF Validator',url:'https://github.com/KhronosGroup/glTF-Validator'}],
 catalog:[{name:'Khronos glTF Validator',url:'https://github.com/KhronosGroup/glTF-Validator'},
          {name:'glTF Transform inspect (read-only)',url:'https://gltf-transform.dev/cli'}],
 hair:[{name:'Blender glTF skinning docs',url:'https://docs.blender.org/manual/en/dev/addons/scene_gltf2.html'}],
 helmet:[{name:'Blender glTF import/export documentation',url:'https://docs.blender.org/manual/en/dev/addons/scene_gltf2.html'}],
 outfit:[{name:'glTF Validator geometry/skin checks',url:'https://github.com/KhronosGroup/glTF-Validator'}],
 rig:[{name:'Khronos glTF Validator',url:'https://github.com/KhronosGroup/glTF-Validator'}],
 creature:[{name:'Khronos glTF Validator',url:'https://github.com/KhronosGroup/glTF-Validator'}]
};
function readJson(path){try{return JSON.parse(readFileSync(resolve(root,path),'utf8'))}catch{return null}}
const argv=process.argv.slice(2);
const previousArg=argv.indexOf('--previous');
const previous=previousArg>=0&&argv[previousArg+1]?readJson(argv[previousArg+1]):null;
const started=new Date().toISOString(),results=[];
for(const item of checks){
 const run=spawnSync(process.execPath,[item.file],{cwd:root,encoding:'utf8',timeout:120000,
  maxBuffer:4*1024*1024,env:{...process.env,CI:'true'}});
 const passed=run.status===0&&!run.error;
 const last=(run.stderr||'')+'\n'+(run.stdout||'');
 const old=previous?.checks?.find(x=>x.id===item.id);
 const consecutiveFailures=passed?0:(old?.status==='failed'?(old.consecutiveFailures||1)+1:1);
 const result={...item,status:passed?'passed':'failed',
  consecutiveFailures,error:run.error?String(run.error):null,
  exitCode:run.status,details:passed?'':last.slice(-1900).trim()};
 results.push(result);
 console.log((passed?'PASS':'FAIL')+' '+item.id+' [group='+item.group+']'
  +(passed?'':' streak='+consecutiveFailures));
 if(!passed)console.error(result.details);
}
const researchQueue=results.filter(x=>x.status==='failed'&&x.consecutiveFailures>=2).map(x=>({
 id:x.id,group:x.group,consecutiveFailures:x.consecutiveFailures,
 action:'stop blind tuning; inspect failing geometry/material/asset link and compare no-cost documented alternatives',
 requiresLicenseCheck:true,requiresHumanReview:true,freeSources:freeResearch[x.group]||[]
}));
const passed=results.filter(x=>x.status==='passed').length;
const total=checks.length+humanReview.length;
const summary={
 schemaVersion:1,stage:'stage1-source-master',timestamp:started,
 commit:process.env.GITHUB_SHA||null,
 denominatorMeaning:'verified automated QA gates plus pending visual/source review gates',
 tested:checks.length,passed,failed:checks.length-passed,pendingReview:humanReview.length,
 totalGates:total,verifiedGateCompletionPercent:Math.round(passed/total*100),
 automatedPassPercent:Math.round(passed/checks.length*100),
 ff13StyleCompletionPercent:null,sourceAssetsActuallyGenerated:0,
 costPolicy:'no paid APIs, purchases, auto-merge or paid model-generation services',
 inventoryPolicy:'source models only; unlimited asset/triangle size; optimize after quality acceptance',
 checks:results,manualGates:humanReview.map(x=>({...x,status:'pending'})),
 researchQueue
};
const out=resolve(root,'qa-reports/stage1-master-quality.json');
mkdirSync(dirname(out),{recursive:true});
writeFileSync(out,JSON.stringify(summary,null,2)+'\n');
if(process.env.GITHUB_STEP_SUMMARY){
 const md=['## Stage 1 model and face regression',
  '- Verified gate completion: **'+passed+'/'+total+' ('+summary.verifiedGateCompletionPercent+'%)**',
  '- Automated checks passed: **'+passed+'/'+checks.length+' ('+summary.automatedPassPercent+'%)**',
  '- Pending manual QA: **'+humanReview.length+'** (real face footage, art review, high-res source inspection)',
  '- FF13-like visual completion: **not measured**',
  '- Repeated failures requiring FREE-source investigation: **'+researchQueue.length+'**',
  '- Optimization of master assets: **disabled**',
  '',...results.map(x=>'- '+(x.status==='passed'?'✅ ':'❌ ')+x.id+' ('+x.status+')'),
  '',researchQueue.length?'### Investigate without paid tools':'',
  ...researchQueue.map(x=>'- '+x.id+' failed '+x.consecutiveFailures+' times: '+x.freeSources.map(s=>s.url).join(', ')),
  ''];
 appendFileSync(process.env.GITHUB_STEP_SUMMARY,md.join('\n'));
}
console.log('STAGE1_MASTER_QUALITY '+JSON.stringify({
 passed,automatedTotal:checks.length,pendingReview:humanReview.length,
 total,verifiedGateCompletionPercent:summary.verifiedGateCompletionPercent,
 automatedPassPercent:summary.automatedPassPercent,
 repeatedFailureResearch:researchQueue.length
}));
if(results.some(x=>x.status==='failed'))process.exitCode=1;

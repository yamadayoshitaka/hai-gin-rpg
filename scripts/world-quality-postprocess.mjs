#!/usr/bin/env node
/** 2D reference -> actual WebGL captures -> bounded PBR variant regression.
 * Writes candidate settings to review branch ONLY. No human QA is claimed.
 */
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {byId} from './world-quality-catalog.mjs';
const root=path.resolve(new URL('..',import.meta.url).pathname);
const runPath='qa-reports/world-quality/run-targets.json';
const run=JSON.parse(fs.readFileSync(path.join(root,runPath),'utf8'));
const updates=[];
const dir='qa-reports/world-quality/previews';
const script='src/world-quality-pbr.js',pbrFile=path.join(root,script);
let moduleText=fs.readFileSync(pbrFile,'utf8');
const begin=' // WORLD_QUALITY_AUTO_BEGIN',end=' // WORLD_QUALITY_AUTO_END';
if(!moduleText.includes(begin)||!moduleText.includes(end))throw Error('PBR patch markers missing');
const candidates=[];
const invoke=(exe,args)=>{
 const p=spawnSync(exe,args,{cwd:root,encoding:'utf8',timeout:240000,maxBuffer:10*1024*1024});
 if(p.status!==0)throw Error(exe+' '+args[0]+': '+(p.stderr||p.stdout).slice(-700));
 return p.stdout;
};
for(const key of run.targets){
 const target=byId.get(key);
 if(!target)throw Error('Unknown world target '+key);
 const reference='assets/world-quality/references/'+target.id+'.webp';
 if(!fs.existsSync(path.join(root,reference)))continue;
 const entry={key,comparisonReport:null,gameScreenshot:null,chosenRoughnessScale:1,
  review:'SCREENSHOT_NOT_YET_VERIFIED',productionApplied:false};
 try{
  if(target.type==='object'){
   invoke('node',['scripts/world-quality-capture.cjs',target.id,dir]);
   const manifest=path.join(dir,target.id+'-capture.json'),compare=path.join(dir,target.id+'-comparison.json');
   invoke('python3',['scripts/world-quality-compare.py',reference,manifest,compare]);
   const result=JSON.parse(fs.readFileSync(compare,'utf8'));
   entry.comparisonReport=compare;
   entry.gameScreenshot=dir+'/'+target.id+'-rough-1.png';
   entry.chosenRoughnessScale=result.chosenRoughnessScale;
   entry.review=result.proxyImproved?'PBR_PROPOSED_HUMAN_QA_PENDING':'BASELINE_RETAINED_HUMAN_QA_PENDING';
   if(result.proxyImproved){
    const line=' '+JSON.stringify(target.id)+':Object.freeze({roughnessScale:'+result.chosenRoughnessScale+'}),\n';
    if(!moduleText.includes(JSON.stringify(target.id)+':Object.freeze(')){
     moduleText=moduleText.replace(end,line+end);
    }
    candidates.push({id:target.id,scale:result.chosenRoughnessScale,score:result.bestProxyScore});
   }
  }else{
   invoke('node',['scripts/world-quality-stage-capture.cjs',target.id,dir]);
   entry.gameScreenshot=dir+'/'+target.id+'-stage-baseline.png';
   entry.review='REAL_STAGE_CAPTURE_HUMAN_QA_PENDING';
  }
 }catch(error){
  entry.review='WEBGL_CAPTURE_OR_COMPARE_BLOCKED';
  entry.error=String(error.message).slice(0,600);
 }
 updates.push(entry);
}
fs.mkdirSync(path.join(root,'qa-reports/world-quality'),{recursive:true});
fs.writeFileSync(path.join(root,'qa-reports/world-quality/result-updates.json'),JSON.stringify(updates,null,2)+'\n');
if(candidates.length)fs.writeFileSync(pbrFile,moduleText);
console.log(JSON.stringify({processed:updates.length,proposed:candidates,
 blocked:updates.filter(x=>x.error).map(x=>({key:x.key,error:x.error})),
 humanQAPassed:0,productionMerge:false}));

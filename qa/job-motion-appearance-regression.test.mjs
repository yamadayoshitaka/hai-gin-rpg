import assert from 'node:assert/strict';
import {PLAYER_JOBS} from '../src/game-content.js';
import {characterAssetRecipe} from '../src/character-asset-registry.js';
import {sampleHumanClip,validateHumanClips} from '../src/human-motion-clips.js';
import {FANTASY_JOB_MOTION} from '../src/fantasy-job-roster.js';
assert.equal(validateHumanClips(),true);
const states=['idle','walk','run','attack','guard','hit','dead'];
const periods={idle:3.2,walk:.88,run:.63,attack:.9,guard:2,hit:.58,dead:1.15};
const channels=['hips','knees','ankles','shoulders','elbows','wrists'];
const jobs=Object.keys(PLAYER_JOBS);
const issues=[],report=[];
const flat=p=>[...channels.flatMap(k=>p[k]),p.spineY,p.spineZ,p.headX,p.bob];
function sample(state,t,motion){return sampleHumanClip(state,t,{...motion,attack:motion.attack});}
for(const job of jobs)for(const sex of ['male','female']){
 const r=characterAssetRecipe(job,sex);
 assert.equal(r.job,job);assert.equal(r.sex,sex);
 assert.ok(FANTASY_JOB_MOTION[job],job+' lacks motion archetype');
 const entry={job,sex,model:r.modelId,outfit:r.slots.outfit,weapon:r.slots.equipment,attack:r.motion.attack};
 for(const state of states){
  let previous=null,maxStep=0,peak=0;
  for(let i=0;i<=60;i++){
   const t=i/60*periods[state],v=flat(sample(state,t,r.motion));
   assert.ok(v.every(Number.isFinite),job+'/'+sex+'/'+state+' invalid keyframe '+i);
   const abs=Math.max(...v.map(Math.abs));peak=Math.max(peak,abs);
   if(previous)maxStep=Math.max(maxStep,...v.map((x,j)=>Math.abs(x-previous[j])));
   previous=v;
  }
  if(peak>2.5)issues.push(job+'/'+sex+'/'+state+' joint rotation outside expected range '+peak.toFixed(2));
  if(maxStep>0.85)issues.push(job+'/'+sex+'/'+state+' abrupt joint step '+maxStep.toFixed(2));
  if(['idle','walk','run','guard'].includes(state)){
   const a=flat(sample(state,0,r.motion)),b=flat(sample(state,periods[state],r.motion));
   if(Math.max(...a.map((x,i)=>Math.abs(x-b[i])))>0.001)issues.push(job+'/'+sex+'/'+state+' loop seam');
  }
 }
 report.push(entry);
}
const byModel=new Map();
for(const r of report){const list=byModel.get(r.model)||[];list.push(r.job+'/'+r.sex);byModel.set(r.model,list);}
const uniqueAppearances=new Set(report.map(x=>x.model)).size;
console.log('Motion regression: '+report.length+' job/sex recipes x '+states.length+' actions x 61 sampled frames = '+(report.length*states.length*61)+' samples');
console.log('Visual source audit: '+uniqueAppearances+' external models for '+jobs.length+' jobs (outfits are JSON slots, not verified to be on GLTF meshes).');
console.log('Source model reuse: '+JSON.stringify(Object.fromEntries([...byModel].map(([k,v])=>[k,v.length]))));
if(issues.length)console.error('Pose warnings:\n'+issues.join('\n'));
assert.deepEqual(issues,[],'Motion regression abnormalities detected');

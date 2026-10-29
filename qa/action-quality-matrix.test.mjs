import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PLAYER_JOBS} from '../src/game-content.js';
import {characterAssetRecipe} from '../src/character-asset-registry.js';
import {sampleHumanClip} from '../src/human-motion-clips.js';
const actions=['idle','walk','run','attack','guard','hit','dead'];
const durations={idle:3.2,walk:.88,run:.63,attack:.9,guard:2,hit:.58,dead:1.15};
const contract=JSON.parse(fs.readFileSync(new URL('./human-motion-quality-contract.json',import.meta.url),'utf8'));
const fields=Object.keys(contract.joints);
const summary={tested:0,failures:[],warnings:[],jobs:[]};
function fail(context,message){summary.failures.push({context,message});}
function pose(action,time,motion){return sampleHumanClip(action,time,{...motion,attack:motion.attack});}
const flatten=p=>[...fields.flatMap(x=>p[x]),p.spineY,p.spineZ,p.headX,p.bob];
for(const [job,jobData] of Object.entries(PLAYER_JOBS)){
 for(const sex of ['male','female']){
  const recipe=characterAssetRecipe(job,sex),subject=job+'/'+sex;
  assert.ok(recipe.slots.outfit&&recipe.slots.equipment,subject);
  for(const action of contract.motion.actions){
   let last=null;
   for(let frame=0;frame<contract.motion.sampleFrames;frame++){
    const t=durations[action]*frame/(contract.motion.sampleFrames-1),values=flatten(pose(action,t,recipe.motion));
    summary.tested++;
    if(values.some(v=>!Number.isFinite(v)))fail(subject+'/'+action+'/'+frame,'non-finite joint');
    if(last&&Math.max(...values.map((v,i)=>Math.abs(v-last[i])))>contract.motion.maxFrameDelta)fail(subject+'/'+action+'/'+frame,'abrupt single-frame joint change');
    const current=pose(action,t,recipe.motion);
    for(const field of fields)for(const [side,angle] of current[field].entries()){
     const range=contract.joints[field];
     if(angle<range.min||angle>range.max)fail(subject+'/'+action+'/'+frame,field+'['+side+'] outside data-defined joint range: '+angle);
    }
    last=values;
   }
  }
  const attack=pose('attack',.45,recipe.motion),walk=pose('walk',.25,recipe.motion),run=pose('run',.25,recipe.motion);
  if(!attack.shoulders.some(v=>Math.abs(v)>.3))fail(subject,'attack lacks arm extension');
  if(!attack.wrists.some(v=>Math.abs(v)>.1))fail(subject,'attack lacks wrist rotation');
  if(JSON.stringify(walk.hips)===JSON.stringify(run.hips))fail(subject,'walk/run indistinguishable');
  summary.jobs.push({job:jobData.label,sex,model:recipe.modelId,outfit:recipe.slots.outfit,equipment:recipe.slots.equipment,attack:recipe.motion.attack});
 }
}
const editor=fs.readFileSync(new URL('../action-test.html',import.meta.url),'utf8');
const importer=fs.readFileSync(new URL('../src/cc0-town-npc-visuals.js',import.meta.url),'utf8');
for(const [label,condition] of [
 ['stale async guard',editor.includes('generation!==modelGeneration')],
 ['all motion button',editor.includes("queue=[...motions]")],
 ['hair style forwarding',importer.includes('style:preset.hair||null')],
 ['visible weapon attachment',importer.includes('syncImportedEquipment')],
 ['visible finger posing',importer.includes('fingerBones')],
 ['contextual weapon grip',importer.includes('previewAction')&&importer.includes('const grasp=')],
 ['no studio preview teleport',!editor.includes('distance%5.2')],
 ['smoothed attack torso',editor.includes('MathUtils.damp(j.spine.rotation.y')],
 ['old fallback hidden',editor.includes('旧モデル非表示')&&editor.includes('generation!==modelGeneration')]
])if(!condition)fail('integration',label+' absent');
for(const [action,rule] of Object.entries(contract.contact))if(rule.required&&rule.mode==='IK_NOT_IMPLEMENTED')summary.warnings.push(action+' ground contact IK not implemented; numerical joint-range pass does not mean foot lock passes.');
if(contract.equipment.grip.required&&contract.equipment.grip.mode==='HAND_TARGET_NOT_VERIFIED')summary.warnings.push('Equipment grip target / hand collision not verified against rendered model.');
summary.warnings.push('Browser screenshot/video testing is still needed for 7 action transitions and all 20 job outfits.');
fs.mkdirSync('qa-reports',{recursive:true});
fs.writeFileSync('qa-reports/action-quality-report.json',JSON.stringify(summary,null,2));
console.log('Action regression: '+summary.tested+' samples; '+summary.failures.length+' failures; 40 character recipes');
if(summary.failures.length){console.error(JSON.stringify(summary.failures.slice(0,25),null,2));process.exitCode=1;}

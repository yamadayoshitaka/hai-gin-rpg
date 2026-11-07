// Candidate-only Tripo H3.1 assets. Secret TRIPO_API_KEY must be configured in GitHub Actions.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
const ROOT='https://openapi.tripo3d.ai/v3', MODEL='v3.1-20260211';
const TARGET='assets/characters/ai-generated/knight';
const KEY=process.env.TRIPO_API_KEY;
if(!KEY)throw Error('TRIPO_API_KEY missing: configure a repository Actions secret (never commit the key)');
const ASSETS=[
 {id:'knight_male_body',
  prompt:'A realistic full-body seven-and-a-half-head tall adult MALE human anatomy mannequin, perfectly symmetrical relaxed A-pose, standing upright. Detailed convincing natural face, head, eyebrows, ears, scalp and short hairstyle. Anatomically correct neck, shoulders, torso, arms, elbows, hands, FIVE SEPARATE fingers on each hand, hips, thighs, knees, calves, ankles, bare feet and toes. Matte neutral light skin. No clothes, no armor, no gloves, no helmet, no weapon, no base, no accessories. Nonsexual smooth neutral mannequin pelvic anatomy with no explicit genital details. COMPLETE FRONT AND BACK and sides. Photoreal 3D video game character reference with realistic human proportions.',
  negative_prompt:'clothing, armor, robe, helmet, props, fused fingers, extra limbs, cartoon, missing backside, sexual detail, gore'},
 {id:'knight_full_plate_armor',
  prompt:'An EMPTY wearable high-fantasy MEDIEVAL KNIGHT FULL PLATE ARMOR, no person inside, scaled for a realistic seven-and-a-half-head tall adult male in relaxed A-pose. Separate articulated fitted helmet with visor, breastplate, backplate, shoulder pauldrons, upper-arm plates, elbow couters, forearm vambraces, five-finger gauntlets, waist faulds, thigh cuisses, knee poleyns, shin greaves, ankle armor, boots and metal sabatons. Accurate hollow wearable metal shells and joints. Complete FRONT and BACK armor panels, no bare back. Deep brushed silver steel, discreet gold engravings, rivets, micro-scratches, physically based metallic reflections and realistic fine details, full-height symmetrically aligned 3D game asset. No skin, no body, no face, no clothes, no weapon, no cape, no display base.',
  negative_prompt:'human body, skin, face, costume on person, merged statue, giant helmet, cape, weapon, floating parts, missing back, cartoon'}
];
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function api(route,request){
 const c=new AbortController(),timer=setTimeout(()=>c.abort(),30000);
 try{
  const r=await fetch(ROOT+route,{method:request?'POST':'GET',
   headers:{Authorization:'Bearer '+KEY,Accept:'application/json',...(request?{'Content-Type':'application/json'}:{})},
   body:request?JSON.stringify(request):undefined,signal:c.signal});
  const body=await r.text();
  if(!r.ok)throw Error('Tripo HTTP '+r.status+': '+body.slice(0,400));
  const data=JSON.parse(body);
  if(data.code!==undefined&&data.code!==0)throw Error('Tripo code '+data.code+': '+String(data.message||'error').slice(0,150));
  return data.data;
 }finally{clearTimeout(timer)}
}
async function wait(id,label){
 const start=Date.now();
 while(Date.now()-start<12*60*1000){
  const data=await api('/tasks/'+encodeURIComponent(id));
  const state=String(data.status||'').toLowerCase();
  console.log(label+' '+state+' '+(data.progress??0)+'%');
  if(state==='success'||state==='succeeded')return data;
  if(['failed','cancelled','canceled','banned'].includes(state))throw Error(label+' failed ('+state+')');
  await delay(5000);
 }
 throw Error(label+' task timed out');
}
async function download(url){
 if(typeof url!=='string'||!url.startsWith('https://'))throw Error('Missing secure Tripo GLB URL');
 const c=new AbortController(),timer=setTimeout(()=>c.abort(),120000),chunks=[];
 try{
  const response=await fetch(url,{signal:c.signal});
  if(!response.ok)throw Error('GLB download failed HTTP '+response.status);
  let size=0;
  for await (const chunk of response.body){
   size+=chunk.length;
   if(size>85*1024*1024){c.abort();throw Error('GLB exceeds 85MB GitHub asset limit')}
   chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks,size);
 }finally{clearTimeout(timer)}
}
function audit(bytes){
 if(bytes.length<28||bytes.toString('utf8',0,4)!=='glTF'||bytes.readUInt32LE(4)!==2
  ||bytes.readUInt32LE(8)!==bytes.length||bytes.readUInt32LE(16)!==0x4e4f534a)
  throw Error('Invalid binary glTF 2.0 header');
 const n=bytes.readUInt32LE(12);
 if(n<2||20+n>bytes.length)throw Error('Bad GLB JSON length');
 const json=JSON.parse(bytes.toString('utf8',20,20+n).trim());
 if(!json.meshes?.length||!json.nodes?.length)throw Error('GLB lacks geometry');
 return {bytes:bytes.length,meshes:json.meshes.length,skins:(json.skins||[]).length,
  materials:(json.materials||[]).length,
  sha256:crypto.createHash('sha256').update(bytes).digest('hex')};
}
await fs.mkdir(TARGET,{recursive:true});
const manifest={provider:'Tripo AI',model:MODEL,createdAt:new Date().toISOString(),
  approval:'candidate-only',policy:'garment-first independent GLBs; no production replacement',
  warning:'AI armor may have no rig, non-hollow geometry or incomplete rear/part coverage. Visual QA required.',
  assets:{}};
for(const item of ASSETS){
 console.log('Request '+item.id);
 const submitted=await api('/generation/text-to-model',{
  prompt:item.prompt,negative_prompt:item.negative_prompt,model:MODEL,
  face_limit:160000,texture:true,pbr:true,texture_quality:'detailed'});
 if(!submitted?.task_id)throw Error('No generation task id for '+item.id);
 const finished=await wait(submitted.task_id,item.id);
 const raw=await download(finished.output?.model_url||finished.output?.model_urls?.glb);
 const info=audit(raw);
 const file=TARGET+'/'+item.id+'.glb';
 await fs.writeFile(file,raw);
 manifest.assets[item.id]={file,taskId:submitted.task_id,prompt:item.prompt,...info};
 console.log('Saved '+file+': '+info.bytes+' bytes');
}
await fs.writeFile(TARGET+'/manifest.json',JSON.stringify(manifest,null,2)+'\n');
console.log('2 candidate GLBs generated; characters not changed in game.');

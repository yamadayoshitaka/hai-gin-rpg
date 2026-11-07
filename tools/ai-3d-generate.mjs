/**
 * Universal AI→GLB candidate pipeline.
 * DRY-RUN is FREE and never creates a model.
 * Hunyuan: needs a private HTTPS GPU API URL and committed reference image.
 * Tripo: paid API call requires TWO explicit gates: provider=tripo and allow_paid=true.
 * All successful GLBs remain isolated in assets/ai-generated; gameplay is never changed.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT=process.cwd();
const PROVIDERS=new Set(['dry-run','hunyuan','tripo']);
const CATEGORIES=new Set(['human','monster','summon','animal','armor','weapon']);
const provider=process.env.AI_PROVIDER||'dry-run';
const requestedPreset=process.env.AI_PRESET_ID||'knight_armor';
const name=process.env.AI_ASSET_ID||requestedPreset;
const category=process.env.AI_CATEGORY||'armor';
const imagePath=process.env.AI_IMAGE_PATH||'';
const imageUrl=process.env.AI_IMAGE_URL||'';
const paid=process.env.AI_ALLOW_PAID==='true';
const unsafeModel=process.env.AI_TRIPO_MODEL||'v3.1-20260211';
const MAX_MODEL_BYTES=75*1024*1024;
const OUTPUT_DIR='assets/ai-generated';
const reportFile='qa/ai-3d-preflight-report.json';
if(!PROVIDERS.has(provider))throw Error('Unsupported provider');
if(!CATEGORIES.has(category))throw Error('Unsupported asset category');
if(!/^[a-z][a-z0-9_-]{1,40}$/.test(name))throw Error('Asset id must be 2–41 ASCII letters/digits/_/- starting with a letter');
if(!/^[a-z][a-z0-9_-]{1,40}$/.test(requestedPreset))throw Error('Unsafe preset id');

const presets=JSON.parse(await fs.readFile('data/ai-model-presets.json','utf8'));
const preset=presets.presets.find(row=>row.id===requestedPreset);
if(!preset)throw Error('Unknown model preset: '+requestedPreset);
const userPrompt=(process.env.AI_PROMPT||'').trim();
const prompt=(userPrompt||preset.prompt).slice(0,2600);
const negativePrompt=(process.env.AI_NEGATIVE_PROMPT||preset.negative||'').slice(0,1000);
if(prompt.length<10)throw Error('Prompt too short');
if(category!==preset.category&&!userPrompt)throw Error('Preset/category mismatch: supply a custom prompt for other categories');
if(imagePath&&imageUrl)throw Error('Specify either reference image path or URL, not both');
if(imageUrl&&(!/^https:\/\/[^ ]+$/i.test(imageUrl)||imageUrl.length>1800))
  throw Error('Image URL must be public HTTPS');
if(provider==='hunyuan'&&!imagePath)throw Error('Local Hunyuan requires AI_IMAGE_PATH pointing to a reference PNG/JPEG/WebP image');
if(provider==='tripo'&&!paid)throw Error('Paid API disabled: set allow_paid=true explicitly for this run');
if(provider==='tripo'&&!process.env.TRIPO_API_KEY)throw Error('Missing TRIPO_API_KEY GitHub Actions secret');
if(provider==='hunyuan'&&!process.env.HUNYUAN_API_URL)throw Error('Missing private HUNYUAN_API_URL GPU server secret');

async function verifiedImage(){
 if(!imagePath)return null;
 const full=path.resolve(ROOT,imagePath);
 const prefix=path.resolve(ROOT,'assets')+path.sep;
 if(!full.startsWith(prefix))throw Error('Reference images must be committed under assets/');
 if(!/\.(?:png|jpe?g|webp)$/i.test(imagePath))throw Error('Reference must be PNG, JPEG or WebP');
 const stat=await fs.stat(full);
 if(stat.size>10*1024*1024||stat.size<100)throw Error('Reference image invalid file size');
 const binary=await fs.readFile(full);
 const signature=binary.subarray(0,12);
 const png=signature.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
 const jpg=signature[0]===255&&signature[1]===216;
 const webp=signature.subarray(0,4).toString()==='RIFF'&&signature.subarray(8,12).toString()==='WEBP';
 if(!png&&!jpg&&!webp)throw Error('Reference content does not match PNG/JPEG/WebP');
 return binary;
}
function getTaskPayload(input){
 const options={model:unsafeModel,texture:true,pbr:true,texture_quality:'detailed'};
 return input?{...options,input}:{...options,prompt,negative_prompt:negativePrompt};
}
async function requestTripo(route,post=null){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),45000);
 try{
  const response=await fetch('https://openapi.tripo3d.com/v3'+route,{
   method:post?'POST':'GET',signal:controller.signal,headers:{
    Authorization:'Bearer '+process.env.TRIPO_API_KEY,
    Accept:'application/json',...(post?{'Content-Type':'application/json'}:{})
   },body:post?JSON.stringify(post):undefined});
  const raw=await response.text();
  if(!response.ok)throw Error('Tripo HTTP '+response.status+': '+raw.slice(0,250));
  const value=JSON.parse(raw);
  if(value.code!==0)throw Error('Tripo API error code '+value.code+' '+String(value.message||'').slice(0,200));
  return value.data;
 }finally{clearTimeout(timer)}
}
async function downloadGlb(url){
 const parsed=new URL(url);
 if(parsed.protocol!=='https:')throw Error('Non-HTTPS generated model URL rejected');
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),120000);
 try{
  const response=await fetch(parsed.toString(),{signal:controller.signal});
  if(!response.ok)throw Error('GLB download returned HTTP '+response.status);
  const chunks=[];let size=0;
  for await(const piece of response.body){
   size+=piece.length;
   if(size>MAX_MODEL_BYTES){controller.abort();throw Error('GLB exceeds 75MB max')}
   chunks.push(Buffer.from(piece));
  }
  return Buffer.concat(chunks,size);
 }finally{clearTimeout(timer)}
}
async function runTripo(image){
 // Local image upload is not enabled; use an HTTPS public reference or text prompt.
 if(image)throw Error('Tripo image input from repo is unsupported here; use public AI_IMAGE_URL');
 if(imageUrl&&!/^https:\/\/[^ ]+$/i.test(imageUrl))throw Error('Bad image URL');
 const route=imageUrl?'/generation/image-to-model':'/generation/text-to-model';
 const submitted=await requestTripo(route,getTaskPayload(imageUrl||null));
 if(!submitted?.task_id)throw Error('Tripo did not return a task id');
 const started=Date.now();
 while(Date.now()-started<12*60*1000){
  const task=await requestTripo('/tasks/'+encodeURIComponent(submitted.task_id));
  const status=String(task.status||'').toLowerCase();
  console.log('Tripo',status,Number(task.progress||0)+'%');
  if(status==='success'){
   const url=task.output?.model_url||task.output?.model_urls?.glb;
   return {binary:await downloadGlb(url),taskId:submitted.task_id};
  }
  if(['failed','cancelled','canceled'].includes(status))throw Error('Tripo generation failed: '+status);
  await new Promise(resolve=>setTimeout(resolve,5000));
 }
 throw Error('Tripo generation exceeded 12 minute maximum');
}
async function runHunyuan(image){
 if(!image)throw Error('Hunyuan requires a reference image');
 const endpoint=process.env.HUNYUAN_API_URL;
 const parsed=new URL(endpoint);
 if(parsed.protocol!=='https:'||parsed.username||parsed.password||parsed.search)
  throw Error('Hunyuan GPU endpoint must be private HTTPS (no URL userinfo/query)');
 if(!/\/generate\/?$/.test(parsed.pathname))throw Error('Hunyuan API URL must end with /generate');
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),18*60*1000);
 try{
  const response=await fetch(parsed.toString(),{
   method:'POST',signal:controller.signal,
   headers:{'Content-Type':'application/json',...(process.env.HUNYUAN_API_TOKEN?{Authorization:'Bearer '+process.env.HUNYUAN_API_TOKEN}:{})},
   body:JSON.stringify({image:image.toString('base64'),texture:true,type:'glb',
     seed:1234,octree_resolution:256,num_inference_steps:8,face_count:160000})
  });
  if(!response.ok)throw Error('Hunyuan GPU HTTP '+response.status+' '+(await response.text()).slice(0,200));
  const declared=Number(response.headers.get('content-length')||0);
  if(declared>MAX_MODEL_BYTES)throw Error('Hunyuan GLB too large');
  const binary=Buffer.from(await response.arrayBuffer());
  if(binary.length>MAX_MODEL_BYTES)throw Error('Hunyuan GLB exceeds max');
  return {binary,taskId:'local-hunyuan'};
 }finally{clearTimeout(timer)}
}
function inspectGlb(buffer){
 if(buffer.length<28||buffer.toString('ascii',0,4)!=='glTF'||buffer.readUInt32LE(4)!==2
    ||buffer.readUInt32LE(8)!==buffer.length)
  throw Error('Invalid binary GLB 2.0 header');
 const jsonLen=buffer.readUInt32LE(12);
 if(buffer.readUInt32LE(16)!==0x4e4f534a||jsonLen<2||jsonLen+20>buffer.length)
  throw Error('GLB missing valid JSON chunk');
 const doc=JSON.parse(buffer.toString('utf8',20,20+jsonLen).trim());
 const meshes=doc.meshes||[],materials=doc.materials||[],skins=doc.skins||[];
 if(!meshes.length||!doc.nodes?.length)throw Error('Generated GLB has no mesh/node');
 const primitives=meshes.flatMap(m=>m.primitives||[]);
 const triangles=primitives.reduce((acc,p)=>{
  if(p.mode!=null&&p.mode!==4)return acc;
  const accessor=doc.accessors?.[p.indices??p.attributes?.POSITION];
  return acc+(accessor?.count?Math.floor(accessor.count/3):0);
 },0);
 const hasPbr=materials.some(m=>m.pbrMetallicRoughness);
 const skinned=skins.length>0;
 return {bytes:buffer.length,meshCount:meshes.length,materialCount:materials.length,
  skinned,skins:skins.length,animations:doc.animations?.length||0,triangles,hasPbr,
  textures:doc.textures?.length||0,
  sha256:crypto.createHash('sha256').update(buffer).digest('hex'),
  warnings:[
   ...(!hasPbr?['PBR material missing']:[]),
   ...(triangles<4000?['Geometry detail below provisional 4k triangle threshold']:[]),
   ...((category==='human'||category==='summon'||category==='monster'||category==='animal')&&!skinned?['Rig/animation not provided: must rig before gameplay']:[])
  ]};
}
const request={schema:'hai-gin/ai-3d-request/v1',provider,category,id:name,presetId:requestedPreset,
 prompt,negativePrompt,imagePath:imagePath||null,imageUrl:imageUrl||null,
 paidGenerationEnabled:paid,jobState:'preflight',notes:presets.style};
await fs.mkdir('qa',{recursive:true});
if(provider==='dry-run'){
 await fs.writeFile(reportFile,JSON.stringify({...request,jobState:'validated-only',
  generated:false,cost:'0 paid requests',next:'Connect a local GPU endpoint or explicitly approve a paid API call'},null,2)+'\n');
 console.log('DRY RUN validated:',category,name,'(no 3D model generated or charged)');
 process.exit(0);
}
const image=await verifiedImage();
const generated=provider==='tripo'?await runTripo(image):await runHunyuan(image);
const audit=inspectGlb(generated.binary);
const output=path.posix.join(OUTPUT_DIR,category,name);
const full=path.resolve(ROOT,output);
if(!full.startsWith(path.resolve(ROOT,OUTPUT_DIR)+path.sep))throw Error('Invalid destination');
try{await fs.access(full);throw Error('Candidate already exists; choose a new AI_ASSET_ID')}catch(e){if(e.code!=='ENOENT')throw e}
await fs.mkdir(full,{recursive:true});
const modelPath=path.posix.join(output,'candidate.glb');
await fs.writeFile(modelPath,generated.binary);
const entry={id:name,category,provider,presetId:requestedPreset,prompt,referenceImage:imagePath||imageUrl||null,
 model:modelPath,metadata:path.posix.join(output,'manifest.json'),
 status:'pending-visual-qa',approvedForGame:false,commercialRightsVerified:false,
 generatedAt:new Date().toISOString(),sourceTaskId:generated.taskId,
 ...audit};
await fs.writeFile(entry.metadata,JSON.stringify(entry,null,2)+'\n');
const registryPath='data/ai-model-registry.json';
const registry=JSON.parse(await fs.readFile(registryPath,'utf8'));
if(registry.generated.some(x=>x.id===entry.id&&x.category===entry.category))
 throw Error('Asset registry already has this id; choose another');
registry.generated.push({id:entry.id,category:entry.category,model:entry.model,
 metadata:entry.metadata,provider:entry.provider,status:entry.status});
await fs.writeFile(registryPath,JSON.stringify(registry,null,2)+'\n');
await fs.writeFile(reportFile,JSON.stringify({...request,jobState:'generated-candidate',generated:true,audit},null,2)+'\n');
console.log('REAL model generated:',modelPath,'meshes='+audit.meshCount,'triangles='+audit.triangles);
console.log('Production game models unchanged. Requires visual and license QA.');

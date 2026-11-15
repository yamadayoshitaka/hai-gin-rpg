#!/usr/bin/env node
/** No paid APIs. Rebuild changed sources only; human/monster switches fail closed. */
import fs from 'node:fs';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';

export function validateSource(source){
 if(typeof source!=='string'||!/^assets\/(?!battle-lod-candidates\/)[a-zA-Z0-9._/-]+\.glb$/.test(source)||
    source.split('/').includes('..')||source.split('/').includes('.'))
  throw Error('Unsafe GLB source '+source);
 return source;
}
export function planLodBatch(catalog,switches,read=p=>fs.readFileSync(p)){
 if(catalog.schema!=='hai-gin/battle-lod-sources/v1'||!Array.isArray(catalog.targets))
  throw Error('Invalid battle LOD catalog');
 if(typeof switches?.groups?.human?.enabled!=='boolean'||typeof switches?.groups?.monster?.enabled!=='boolean')
  throw Error('Unverified quality switch; fail closed');
 const seen=new Set(),pending=[];
 for(const target of catalog.targets){
  if(!/^[a-z0-9][a-z0-9_-]{0,49}$/.test(target.id)||seen.has(target.id))throw Error('Invalid/duplicate model ID');
  seen.add(target.id);
  if(!['human','monster'].includes(target.group))throw Error('Invalid source group');
  validateSource(target.source);
  if(!switches.groups[target.group].enabled)continue;
  const hash=crypto.createHash('sha256').update(read(target.source)).digest('hex');
  const output='assets/battle-lod-candidates/'+target.id+'/manifest.json';
  let manifest=null;
  try{manifest=JSON.parse(read(output).toString('utf8'));}
  catch(e){if(e.code!=='ENOENT')throw e;}
  const complete=manifest?.schema==='hai-gin/battle-lod-candidate/v1' &&
   manifest.source===target.source&&manifest.sourceSha256===hash&&
   ['near','mid','far'].every(t=>{
    const v=manifest.tiers?.[t];
    if(!v||v.path!=='assets/battle-lod-candidates/'+target.id+'/'+t+'.glb')return false;
    try{return crypto.createHash('sha256').update(read(v.path)).digest('hex')===v.sha256;}
    catch{return false;}
   });
  if(!complete)pending.push({...target,sourceSha256:hash});
 }
 return pending;
}
if(process.argv[1]?.endsWith('battle-lod-batch.mjs')){
 const id=process.argv.find(x=>x.startsWith('--target='))?.slice(9)||'all';
 const execute=process.argv.includes('--execute');
 const catalog=JSON.parse(fs.readFileSync('data/battle-lod-sources.json','utf8'));
 const switches=JSON.parse(fs.readFileSync('data/batch-center-switches.json','utf8'));
 if(id!=='all'&&!catalog.targets.some(x=>x.id===id))throw Error('Unknown model ID');
 const queue=planLodBatch(catalog,switches).filter(x=>id==='all'||x.id===id);
 console.log(JSON.stringify({pending:queue.map(x=>({id:x.id,group:x.group,source:x.source})),count:queue.length}));
 if(execute)for(const model of queue){
  const args=['--background','--factory-startup','--python','scripts/build-battle-lods.py','--',
    '--input',model.source,'--id',model.id,'--out','assets/battle-lod-candidates'];
  const result=spawnSync('blender',args,{stdio:'inherit',timeout:20*60*1000});
  if(result.status!==0||result.error)throw Error('Blender build failed: '+model.id+' '+(result.error?.message||result.status));
 }
}

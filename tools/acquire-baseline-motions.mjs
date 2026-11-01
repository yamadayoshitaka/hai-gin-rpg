// Fetch verified baseline BVH files and register only genuinely matching shared actions.
// No video pose inference or profession-specific capture is claimed here.
import fs from 'node:fs/promises';
import path from 'node:path';
const base='https://raw.githubusercontent.com/una-dinosauria/cmu-mocap/master/data/';
const clips={walk:'002/02_01.bvh',run:'002/02_03.bvh'};
const registry=JSON.parse(await fs.readFile('job-motion-registry.json','utf8'));
await fs.mkdir('motions/approved',{recursive:true});
for(const [action,remote] of Object.entries(clips)){
 const target='motions/approved/cmu-'+action+'.bvh';
 const response=await fetch(base+remote,{signal:AbortSignal.timeout(60000)});
 if(!response.ok)throw Error(remote+': HTTP '+response.status);
 const body=await response.text();
 if(!body.trimStart().startsWith('HIERARCHY')||!body.includes('MOTION')||!body.includes('Frames:'))throw Error(remote+': invalid BVH');
 await fs.writeFile(target,body);
 for(const job of registry.jobs){
  const entry=job.actions.find(a=>a.id===action);
  if(!entry)throw Error(job.name+': missing '+action);
  entry.status='recorded';
  entry.source={file:target,license:'CMU Graphics Lab Motion Capture Database; verify redistribution terms for release',origin:base+remote,kind:'shared-baseline',retargeted:false};
 }
 console.log('Downloaded '+remote+' -> '+target+' ('+body.length+' chars)');
}
await fs.writeFile('job-motion-registry.json',JSON.stringify(registry,null,2)+'\n');

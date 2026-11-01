// Auto-assign verified motions across the 40 job registry.
import fs from 'node:fs/promises';
const registry=JSON.parse(await fs.readFile('job-motion-registry.json','utf8'));
const manifest=JSON.parse(await fs.readFile('motions/extracted/approved-manifest.json','utf8').catch(()=>'{"clips":[]}'));
const approved=new Map();
for(const c of manifest.clips||[]){
 if(c.visualQA!==true||c.licenseVerified!==true||c.contactQA!==true||c.retargetQA!==true)continue;
 if(!/^motions\\/extracted\\/[a-z0-9_-]+\\.bvh$/i.test(c.file||''))continue;
 try{await fs.access(c.file)}catch{continue}
 approved.set(c.family+'/'+c.action,c);
}
let assigned=0;
for(const job of registry.jobs)for(const action of job.actions){
 if(action.status==='recorded')continue;
 const c=approved.get(job.family+'/'+action.id);
 if(!c)continue;
 action.status='recorded';
 action.source={file:c.file,license:c.license,origin:c.origin,kind:'ai-video-retargeted',retargeted:true};
 assigned++;
}
await fs.writeFile('job-motion-registry.json',JSON.stringify(registry,null,2)+'\n');
console.log(JSON.stringify({jobs:registry.jobs.length,approvedClips:approved.size,assigned}));

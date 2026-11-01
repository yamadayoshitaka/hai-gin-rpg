// Prepare a deterministic capture/retarget work queue from actual registry gaps.
// Candidates are review-only; no unrecorded motion is mislabeled.
import fs from 'node:fs/promises';
const registry=JSON.parse(await fs.readFile('job-motion-registry.json','utf8'));
const catalog=JSON.parse(await fs.readFile('motions/candidates/catalog.json','utf8'));
const groups=new Map();
for(const job of registry.jobs)for(const action of job.actions){
 if(action.status==='recorded')continue;
 const key=job.family+'/'+action.id;
 if(!groups.has(key))groups.set(key,{family:job.family,action:action.id,jobs:[],candidates:[],stage:'needs-source'});
 groups.get(key).jobs.push(job.name);
}
for(const item of catalog.clips){
 const key=item.family+'/'+item.action;
 const task=groups.get(key);
 if(!task||item.status!=='candidate-needs-review')continue;
 try{await fs.access(item.file)}catch{continue}
 task.candidates.push({file:item.file,origin:item.origin,license:item.license,review:'pending'});
 task.stage='needs-visual-and-license-review';
}
const tasks=[...groups.values()].sort((a,b)=>b.jobs.length-a.jobs.length||a.family.localeCompare(b.family)||a.action.localeCompare(b.action));
await fs.mkdir('reports',{recursive:true});
const summary={jobs:registry.jobs.length,unrecordedAssignments:tasks.reduce((n,t)=>n+t.jobs.length,0),uniqueFamilyActions:tasks.length,reviewableCandidates:tasks.reduce((n,t)=>n+t.candidates.length,0)};
await fs.writeFile('reports/motion-capture-queue.json',JSON.stringify({schema:1,summary,tasks},null,2)+'\n');
console.log(JSON.stringify(summary));

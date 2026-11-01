// Generate an honest coverage report. Never promote candidate/placeholder clips.
import fs from 'node:fs/promises';
const registry=JSON.parse(await fs.readFile('job-motion-registry.json','utf8'));
let candidates=[];
try{candidates=JSON.parse(await fs.readFile('motions/candidates/catalog.json','utf8')).clips||[]}catch{}
const rows=[];const totals={jobs:registry.jobs.length,recorded:0,unrecorded:0,candidateAvailable:0};
for(const job of registry.jobs)for(const action of job.actions){
 const candidate=candidates.find(c=>c.family===job.family&&c.action===action.id&&c.status==='candidate-needs-review');
 const row={job:job.name,family:job.family,action:action.id,status:action.status,candidateFile:candidate?.file||null,needsReview:!!candidate};
 if(action.status==='recorded')totals.recorded++;else totals.unrecorded++;
 if(candidate&&action.status!=='recorded')totals.candidateAvailable++;
 rows.push(row);
}
await fs.mkdir('reports',{recursive:true});
await fs.writeFile('reports/job-motion-coverage.json',JSON.stringify({generatedAt:new Date().toISOString(),totals,rows},null,2)+'\n');
console.log(JSON.stringify(totals));
if(totals.unrecorded)console.log('Unrecorded motions remain. Candidates are NOT recorded assets.');

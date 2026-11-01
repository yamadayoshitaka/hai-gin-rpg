// Node 20+. Validate job-action coverage and provenance before using motion assets.
import fs from 'node:fs/promises';
const registry=JSON.parse(await fs.readFile('job-motion-registry.json','utf8'));
const sources=JSON.parse(await fs.readFile('motion-sources.json','utf8'));
const expected=['idle','walk','run','dodge','guard','hit','down','getup','victory'];
const errors=[],stats={jobs:registry.jobs.length,actions:0,recorded:0,unrecorded:0};
if(registry.jobs.length!==40)errors.push('Expected exactly 40 jobs');
const names=new Set(),sourceIds=new Set();
for(const src of sources.sources){
 if(sourceIds.has(src.id))errors.push('Duplicate source: '+src.id);
 sourceIds.add(src.id);
 if(src.permission!=='owner-authorized')errors.push('Missing permission: '+src.id);
 if(!/^https:\/\//.test(src.url||''))errors.push('HTTPS required: '+src.id);
}
for(const job of registry.jobs){
 if(names.has(job.name))errors.push('Duplicate job: '+job.name);
 names.add(job.name);
 const ids=new Set();
 for(const action of job.actions){
  stats.actions++;
  if(ids.has(action.id))errors.push(job.name+': duplicate '+action.id);
  ids.add(action.id);
  if(action.status==='unrecorded'){
   stats.unrecorded++;
   if(action.source!==null)errors.push(job.name+'/'+action.id+': unrecorded with source');
  }else if(action.status==='recorded'){
   stats.recorded++;
   if(!action.source?.file || !action.source?.license || !action.source?.origin)errors.push(job.name+'/'+action.id+': missing file/license/origin');
   else {
    try{await fs.access(action.source.file)}catch{errors.push(job.name+'/'+action.id+': missing file '+action.source.file)}
   }
  }else errors.push(job.name+'/'+action.id+': unknown status');
 }
 for(const id of expected)if(!ids.has(id))errors.push(job.name+': missing basic '+id);
}
console.log(JSON.stringify({...stats,errors},null,2));
if(errors.length)process.exitCode=1;

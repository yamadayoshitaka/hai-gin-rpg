// Node 20+; fetch authorized MP4 and extract sampled poses with MediaPipe Tasks Vision.
// Usage: node tools/import-motion.mjs
import fs from 'node:fs/promises';
import {mkdir} from 'node:fs/promises';
const config=JSON.parse(await fs.readFile('motion-sources.json','utf8'));
await mkdir('motions',{recursive:true});
const summary=[];
for(const source of config.sources){
  if(!source.enabled)continue;
  if(!/^[a-z0-9_-]+$/i.test(source.id))throw Error('Invalid source id');
  const u=new URL(source.url);
  if(u.protocol!=='https:')throw Error('HTTPS URL required');
  if(source.permission!=='owner-authorized')throw Error('Explicit permission required');
  const r=await fetch(u,{redirect:'follow',signal:AbortSignal.timeout(60000)});
  if(!r.ok)throw Error(source.id+': HTTP '+r.status);
  const contentType=r.headers.get('content-type')||'';
  if(!/video\/|application\/octet-stream/i.test(contentType))throw Error(source.id+': not a video response');
  const data=new Uint8Array(await r.arrayBuffer());
  if(data.byteLength>100*1024*1024)throw Error('File too large');
  await fs.writeFile('motions/'+source.id+'.mp4',data);
  summary.push({id:source.id,bytes:data.byteLength,status:'downloaded',note:'Pose extraction is performed by browser mocap-test.html after loading this MP4; no automatic pose inference in this downloader.'});
}
await fs.writeFile('motions/import-report.json',JSON.stringify(summary,null,2));
console.log(JSON.stringify(summary));

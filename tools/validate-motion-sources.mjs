// Validate authorized source manifests before any video ingestion.
// Usage: node tools/validate-motion-sources.mjs
import fs from 'node:fs/promises';
const manifest=JSON.parse(await fs.readFile('motion-sources.json','utf8'));
if(!Array.isArray(manifest.sources))throw Error('sources must be an array');
const ids=new Set();
for(const s of manifest.sources){
 if(!/^[a-z0-9_-]+$/i.test(s.id||''))throw Error('Invalid id');
 if(ids.has(s.id))throw Error('Duplicate source '+s.id);
 ids.add(s.id);
 if(s.enabled!==true)continue;
 if(s.permission!=='owner-authorized')throw Error('Missing explicit authorization '+s.id);
 if(!s.creator||!s.license||!s.permissionEvidence||!s.allowedDerivativeUse)throw Error('Missing provenance or derivative-use evidence '+s.id);
 const u=new URL(s.url);
 if(u.protocol!=='https:')throw Error('HTTPS required '+s.id);
 if(/(?:youtube\.com|youtu\.be)/i.test(u.hostname))throw Error('YouTube watch URLs are not direct downloadable MP4 sources; provide authorized downloadable asset '+s.id);
 if(!/\.mp4(?:$|[?#])/i.test(s.url))throw Error('Direct MP4 URL required '+s.id);
}
console.log(JSON.stringify({sources:manifest.sources.length,enabled:manifest.sources.filter(x=>x.enabled).length,valid:true}));

/**
 * Model intake from FREE consumer 3D-generation websites (no API bypass).
 * Upload .glb and add manifest entry to assets/ai-model-inbox via GitHub Web.
 * This runs automatically in Actions and never activates the game actor.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import {auditGLB} from './ai-3d-glb-audit.mjs';

const INBOX='assets/ai-model-inbox';
const MANIFEST=INBOX+'/manifest.json';
const OUTPUT='assets/ai-generated';
const REGISTRY='data/ai-model-registry.json';
const REPORT='qa/ai-3d-inbox-report.json';
const MAX_BYTES=75*1024*1024;
const ID=/^[a-z][a-z0-9_-]{1,40}$/;
const MODEL=/^[a-z][a-z0-9_-]{1,70}\.glb$/;
const CATEGORY=new Set(['human','monster','summon','animal','armor','weapon']);
const VALID_URL=/^https:\/\/[^\s]+$/i;

async function readJson(file){return JSON.parse(await fs.readFile(file,'utf8'))}
const index=await readJson(MANIFEST);
const registry=await readJson(REGISTRY);
if(index.schema!=='hai-gin/ai-3d-inbox/v1'||!Array.isArray(index.entries))
 throw Error('Invalid AI GLB inbox manifest');
if(registry.schema!=='hai-gin/ai-3d-registry/v1'||!Array.isArray(registry.generated))
 throw Error('Invalid AI model registry');
if(index.entries.length>15)throw Error('Maximum 15 candidates per import');
const ids=new Set(registry.generated.map(e=>e.category+'/'+e.id));
const unique=new Set();
const reports=[],pending=[];
await fs.mkdir('qa',{recursive:true});
for(const entry of index.entries){
 if(!entry||!ID.test(entry.id)||!CATEGORY.has(entry.category)||!MODEL.test(entry.filename))
  throw Error('Invalid candidate id, category, or filename');
 const key=entry.category+'/'+entry.id;
 if(ids.has(key)||unique.has(key))throw Error('Duplicate model ID: '+key);
 unique.add(key);
 if(!/^[a-zA-Z0-9 ._-]{2,100}$/.test(entry.provider||''))throw Error('Invalid AI origin/provider label for '+key);
 if(typeof entry.sourceUrl!=='string'||!VALID_URL.test(entry.sourceUrl)||entry.sourceUrl.length>2000)
  throw Error('Source website URL required for '+key);
 if(typeof entry.license!=='string'||entry.license.length>100||entry.license.length<2)
  throw Error('Specify origin license/terms for '+key+' ("unknown" is allowed but not approved)');
 const source=path.join(INBOX,entry.filename);
 const stat=await fs.stat(source);
 if(!stat.isFile()||stat.size<40||stat.size>MAX_BYTES)throw Error('Source GLB size invalid: '+entry.filename);
 const bytes=await fs.readFile(source);
 const audit=auditGLB(bytes,{category:entry.category});
 const output=path.posix.join(OUTPUT,entry.category,entry.id);
 const outFile=path.posix.join(output,'candidate.glb');
 try{await fs.access(output);throw Error('Candidate output already exists: '+output)}
 catch(e){if(e.code!=='ENOENT')throw e}
 pending.push({entry,source,outFile,output,audit});
 reports.push({id:entry.id,category:entry.category,provider:entry.provider,sourceUrl:entry.sourceUrl,
  state:'valid-candidate-pending-visual-review',...audit});
 console.log('GLB candidate',key,stat.size+'B',audit.triangles+' triangles',audit.warnings.join('; '));
}
if(!pending.length){
 console.log('No GLB uploaded. Upload a model and register it in the inbox manifest.');
 await fs.writeFile(REPORT,JSON.stringify({schema:'hai-gin/ai-3d-inbox-report/v1',
  imported:0,report:[]},null,2)+'\n');
 process.exit(0);
}
// First validate *all* items before mutating any file. A malformed member
// must block the batch without half-registering a different model.
for(const {entry,source,outFile,output,audit} of pending){
 await fs.mkdir(output,{recursive:true});
 await fs.rename(source,outFile);
 const license=entry.license.trim();
 const asset={
  schema:'hai-gin/ai-3d-candidate/v1',
  id:entry.id,category:entry.category,model:outFile,provider:entry.provider,
  sourceUrl:entry.sourceUrl,sourceLicense:license,
  licenseVerified:false,commercialRightsVerified:false,
  prompt:typeof entry.prompt==='string'?entry.prompt.slice(0,2500):null,
  generationMethod:'Free web AI - manually downloaded GLB, automatically imported and audited',
  importedAt:new Date().toISOString(),
  approvedForGame:false,status:'pending-visual-qa',audit,
  mandatoryReview:['license','human/creature anatomy','front and back surfaces','face/eyes/fur',
   'seams/mesh intersection','skinning/rig','combat animations','LOD/performance']
 };
 const manifest=path.posix.join(output,'manifest.json');
 await fs.writeFile(manifest,JSON.stringify(asset,null,2)+'\n');
 registry.generated.push({
   id:entry.id,category:entry.category,model:outFile,metadata:manifest,
   provider:entry.provider,status:'pending-visual-qa'
 });
}
index.entries=[];
index.instructions='Entries reset after importing. Add GLB files and entries together for the next batch.';
await fs.writeFile(MANIFEST,JSON.stringify(index,null,2)+'\n');
await fs.writeFile(REGISTRY,JSON.stringify(registry,null,2)+'\n');
await fs.writeFile(REPORT,JSON.stringify({schema:'hai-gin/ai-3d-inbox-report/v1',
 imported:pending.length,report:reports},null,2)+'\n');
console.log('Imported',pending.length,'candidates. NONE activated in the live game.');

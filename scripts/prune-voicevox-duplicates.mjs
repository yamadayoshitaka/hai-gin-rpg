#!/usr/bin/env node
/**
 * Conservative, FREE audio cleanup. Only exact byte-for-byte duplicates of
 * live manifest clips are eligible; do not guess unused historical keys.
 *
 * node scripts/prune-voicevox-duplicates.mjs             # audit only
 * node scripts/prune-voicevox-duplicates.mjs --apply     # remap then delete
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const manifestFile=path.resolve('audio/voicevox/manifest.json');
const clipDir=path.resolve('audio/voicevox/clips');
const apply=process.argv.includes('--apply');
const raw=await fs.readFile(manifestFile,'utf8');
const manifest=JSON.parse(raw);
if(!manifest.clips||typeof manifest.clips!=='object')throw Error('Missing clips');
const files=(await fs.readdir(clipDir)).filter(n=>/^[a-f0-9]{16}\.(wav|mp3)$/.test(n)).sort();
const referenced=new Set(Object.values(manifest.clips).map(s=>path.posix.basename(s)));
if([...referenced].some(name=>!files.includes(name)))throw Error('Manifest references nonexistent files');
const groups=new Map(),bytes=new Map();
for(const name of files){
 const buffer=await fs.readFile(path.join(clipDir,name));
 // Protect files not used by this manifest; another runtime may refer to them.
 if(!referenced.has(name))continue;
 const hash=crypto.createHash('sha256').update(buffer).digest('hex');
 const key=name.split('.').at(-1)+':'+hash;
 const group=groups.get(key)||[];
 group.push(name);groups.set(key,group);bytes.set(name,buffer.length);
}
const renames=new Map();
for(const group of groups.values()){
 if(group.length<2)continue;
 const keeper=group[0];
 for(const redundant of group.slice(1))renames.set(redundant,keeper);
}
const next={...manifest,clips:{...manifest.clips}};
for(const [key,location] of Object.entries(next.clips)){
 const name=path.posix.basename(location);
 if(renames.has(name))next.clips[key]=path.posix.join('audio/voicevox/clips',renames.get(name));
}
const actualNewNames=new Set(Object.values(next.clips).map(s=>path.posix.basename(s)));
if([...renames.keys()].some(n=>actualNewNames.has(n)))throw Error('Unsafe duplicate still referenced');
const after=JSON.stringify(next,null,2)+'\n';
const savings=[...renames.keys()].reduce((sum,name)=>sum+(bytes.get(name)||0),0);
if(apply){
 // Save all playable locations first; interrupted deletion can only leave
 // extra files, never a broken key -> file reference.
 if(await fs.readFile(manifestFile,'utf8')!==raw)throw Error('Manifest changed during scan');
 const temporary=manifestFile+'.dedup-tmp';
 await fs.writeFile(temporary,after,'utf8');
 await fs.rename(temporary,manifestFile);
 for(const name of renames.keys())await fs.unlink(path.join(clipDir,name));
}
const report={mode:apply?'applied':'dry-run',references:Object.keys(next.clips).length,
 uniqueReferencedFiles:actualNewNames.size,duplicateFiles:renames.size,
 savedBytes:savings,skippedUnreferencedFiles:files.filter(n=>!referenced.has(n)).length};
console.log(JSON.stringify(report,null,2));

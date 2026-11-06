// A GitHub API blob upload once truncated the base64 payload for the large
// motion studio HTML. The result was binary data served as a public webpage,
// even though the workflow itself reported deployment success.
// Reject that kind of corruption before uploading a Pages artifact.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const repo=path.resolve(__dirname,'..');
const files=[
  'index.html',
  'motion-external-test.html',
  'outfit-maintenance.html',
  'src/character-system/rigged-outfit-runtime.js',
  'src/character-system/hair-attachment-runtime.js',
  'src/character-system/hair-headwear-occlusion.js'
];
for(const relative of files){
  const bytes=fs.readFileSync(path.join(repo,relative));
  assert.ok(bytes.length>1500,`${relative}: unexpectedly short publication file`);
  const content=new TextDecoder('utf-8',{fatal:true}).decode(bytes);
  assert.ok(!content.includes('\0'),`${relative}: binary NUL byte in published source`);
  if(relative.endsWith('.html')){
    assert.match(content.replace(/^\uFEFF/,'').trimStart(),/^<!doctype html>/i,
      `${relative}: no HTML doctype, probable binary/corrupted blob`);
    assert.match(content,/<\/html>/i,`${relative}: HTML ending is missing`);
  }else{
    assert.ok(/\b(import|export)\b/.test(content),
      `${relative}: missing JavaScript module structure`);
  }
}
console.log(`PASS Pages publication integrity: ${files.length} source files are complete UTF-8`);


// JavaScript/asset preflight: GitHub Pages can successfully deploy files that
// contain invalid JavaScript or reference missing GLTF buffers. Compile the
// actual HTML entrypoints and modules without executing game code.
const vm=require('node:vm');
const htmlPaths=['motion-external-test.html','outfit-maintenance.html'];
let scriptCount=0, moduleCount=0, localImports=0, assetCount=0;
function localPath(from,request){
 const clean=decodeURIComponent(request.split(/[?#]/,1)[0]);
 return path.resolve(path.dirname(path.join(repo,from)),clean);
}
function verifyImports(source,relative){
 const regex=/(?:\bfrom\s*|\bimport\s*\(?\s*)['"](\.{1,2}\/[^'"]+)['"]/g;
 for(const found of source.matchAll(regex)){
   const target=localPath(relative,found[1]);
   assert.ok(target.startsWith(repo+path.sep),relative+': import escaped repository: '+found[1]);
   assert.ok(fs.existsSync(target),relative+': missing imported script '+found[1]);
   localImports++;
 }
}
function checkModule(relative){
 const source=fs.readFileSync(path.join(repo,relative),'utf8');
 new vm.SourceTextModule(source,{identifier:relative});
 verifyImports(source,relative);
 moduleCount++;
}
for(const relative of htmlPaths){
 const html=fs.readFileSync(path.join(repo,relative),'utf8');
 const regex=/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;
 for(const match of html.matchAll(regex)){
   const attrs=match[1],script=match[2],type=/\btype\s*=\s*["']([^"']+)["']/i.exec(attrs)?.[1]||'';
   if(type==='importmap'||!script.trim())continue;
   if(type==='module')new vm.SourceTextModule(script,{identifier:relative+'#inline-module'});
   else new vm.Script(script,{filename:relative+'#inline-script'});
   verifyImports(script,relative);
   scriptCount++;
 }
}
for(const relative of [
 'src/character-system/shared-character-runtime.js',
 'src/character-system/rigged-outfit-runtime.js',
 'src/character-system/hair-attachment-runtime.js',
 'src/character-system/hair-headwear-occlusion.js',
 'src/character-system/retarget-adapter.js',
 'src/combat-action-spec.js',
 'src/combat-world-object-renderer.js'
])checkModule(relative);
const inventory=JSON.parse(fs.readFileSync(path.join(repo,'motion-external-inventory.json'),'utf8'));
const jobMap=JSON.parse(fs.readFileSync(path.join(repo,'job-command-motion-map.json'),'utf8')).jobs;
const motionAssets=new Map(inventory.map(item=>[item.file,new Set(item.clips)]));
for(const item of inventory){
 assert.ok(Array.isArray(item.clips)&&item.clips.length,'empty motion inventory '+item.file);
 assert.ok(fs.existsSync(path.join(repo,item.file)),'missing motion asset '+item.file);
 assetCount++;
}
for(const [job,rows] of Object.entries(jobMap)){
 for(const row of rows){
   if(!row.available)continue;
   assert.ok(motionAssets.has(row.asset),job+': missing inventory entry '+row.asset);
   assert.ok(motionAssets.get(row.asset).has(row.clip),job+': missing playable clip '+row.clip);
 }
}
for(const name of ['Male','Female']){
 const relative='assets/characters/quaternius-base/Superhero_'+name+'_FullBody.gltf';
 const file=path.join(repo,relative);
 const gltf=JSON.parse(fs.readFileSync(file,'utf8'));
 for(const dependency of [...(gltf.buffers||[]),...(gltf.images||[])]){
   if(!dependency.uri||dependency.uri.startsWith('data:'))continue;
   assert.ok(fs.existsSync(localPath(relative,dependency.uri)),
     relative+': missing buffer or texture '+dependency.uri);
   assetCount++;
 }
}
console.log('PASS motion studio preflight:',scriptCount,'HTML scripts,',moduleCount,
 'modules,',localImports,'local imports,',assetCount,'motion/GLTF assets');

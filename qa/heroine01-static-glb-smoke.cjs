// Quick isolated GLB export verification, independent of the full roster E2E.
// Must result in an actual downloadable glTF/GLB with real source triangles.
const {chromium}=require('playwright');
const fs=require('node:fs');
const path=require('node:path');
const out='qa-screenshots/heroine01-export-smoke';
fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({
  headless:true,args:['--use-gl=angle','--use-angle=swiftshader']
 });
 try{
  const page=await browser.newPage({
   viewport:{width:780,height:820},deviceScaleFactor:1,acceptDownloads:true
  });
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{
   if(m.type()==='error')errors.push(m.text());
   if(m.text().includes('HEROINE_GLTF_PORTABLE_EXPORT_READY'))
    console.log('PORTABLE_EXPORT_DIAGNOSTIC',m.text());
  });
  await page.goto(
   'http://127.0.0.1:8765/master-swordsman-prototype.html?qa=1&featured=hero-girl-01&view=face',
   {waitUntil:'domcontentloaded',timeout:45000}
  );
  await page.waitForFunction(()=>{
   const d=window.__heroSwordsmanQA?.();
   return d?.loaded===true&&d.featuredKey==='hero-girl-01'&&
    d.referenceHeroineHairReport?.individualFilamentCount===100000;
  },null,{timeout:130000,polling:250});
  const before=await page.evaluate(()=>window.__heroineWireframeQA());
  if(before.strandCount!==100000)throw Error('Preview must display 100k hairs');
  const wait=page.waitForEvent('download',{timeout:45000});
  await page.locator('#exportCharacterGlb').click();
  let download;
  try{download=await wait;}catch(e){
   const d=await page.locator('#diagnostics').textContent();
   throw Error('Portable GLB download did not start in 45s: '+
    JSON.stringify({errors,details:d.slice(-1200),error:String(e)}));
  }
  const file=path.join(out,'hero-girl-01-portable-3d.glb');
  await download.saveAs(file);
  const buf=fs.readFileSync(file);
  if(buf.length<50000||buf.toString('ascii',0,4)!=='glTF'||
     buf.readUInt32LE(8)!==buf.length)
   throw Error('Invalid GLB binary header or payload: '+buf.length);
  const jsonLength=buf.readUInt32LE(12),jsonType=buf.toString('ascii',16,20);
  if(jsonType!=='JSON')throw Error('Missing glTF JSON chunk');
  const gltf=JSON.parse(buf.subarray(20,20+jsonLength).toString('utf8').trim());
  const primitives=(gltf.meshes||[]).flatMap(m=>m.primitives||[]);
  const triangles=primitives.filter(p=>p.mode===undefined||p.mode===4).length;
  const lines=primitives.filter(p=>p.mode===1).length;
  if(triangles<5||lines<1)
   throw Error('GLB lacks real human mesh or sampled hair curves: '+
    JSON.stringify({triangles,lines}));
  const after=await page.evaluate(()=>window.__heroineWireframeQA());
  if(after.strandCount!==100000||after.strandSegments!==before.strandSegments||
     after.triangles!==before.triangles)
   throw Error('Export mutated or decimated the visible heroine model');
  if(errors.length)throw Error('Browser emitted errors: '+JSON.stringify(errors));
  console.log('HEROINE_GLTF_PORTABLE_SMOKE_SUCCESS '+
   JSON.stringify({bytes:buf.length,meshes:gltf.meshes.length,
    trianglePrimitives:triangles,hairLinePrimitives:lines,
    previewStrands:after.strandCount}));
 }finally{await browser.close();}
})().catch(e=>{console.error('HEROINE_GLTF_PORTABLE_SMOKE_FAIL',e);process.exitCode=1;});

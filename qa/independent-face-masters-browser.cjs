const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path');
const out='qa-screenshots/independent-faces';
fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,args:[
  '--use-gl=angle','--use-angle=swiftshader']});
 try{
  const page=await browser.newPage({
   viewport:{width:900,height:880},deviceScaleFactor:1,acceptDownloads:true
  });
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:8765/face-mesh-studio.html?gender=female&view=front',
   {waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(()=>window.__faceMasterQA?.().loaded===true,
   null,{timeout:100000,polling:250});
  const original=await page.evaluate(()=>window.__faceMasterQA());
  if(original.gender!=='female'||original.bodyMeshes!==0||
     original.visibleFaceMeshes!==1||original.sourceUntouched!==true||
     original.female?.sourceVertices<1100||original.male?.sourceVertices<1100||
     original.female?.headOnly!==true||original.male?.headOnly!==true||
     !original.female?.sourceGeometryIndependent||
     !original.male?.sourceGeometryIndependent||
     original.female?.facePartMeshCount!==16||
     original.male?.facePartMeshCount!==12||
     original.visiblePartMeshes!==16)
   throw Error('Not two independent source-derived face meshes: '+JSON.stringify(original));
  const canvas=page.locator('#faceCanvas');
  for(const g of ['female','male']){
   await page.locator('#'+g).click();
   for(const view of ['front','threeQuarter','side','back']){
    await page.locator('#'+view).click();
    await page.waitForTimeout(200);
    const report=await page.evaluate(()=>window.__faceMasterQA());
    if(report.gender!==g||report.view!==view||report.visibleFaceMeshes!==1||report.visiblePartMeshes!==(g==='female'?16:12))
     throw Error('Face viewer controls failed '+JSON.stringify(report));
    await canvas.screenshot({path:path.join(out,g+'-'+view+'.png'),
     timeout:90000,animations:'disabled'});
   }
   // Each gender exports a standalone binary GLB with real mesh triangles.
   const next=page.waitForEvent('download',{timeout:45000});
   await page.locator('#export').click();
   const download=await next;
   const file=path.join(out,g+'-face-base-v1.glb');
   await download.saveAs(file);
   const buf=fs.readFileSync(file);
   if(buf.length<20000||buf.toString('ascii',0,4)!=='glTF'||
      buf.readUInt32LE(8)!==buf.length)
    throw Error('Malformed actual 3D face GLB: '+g+' '+buf.length);
   const length=buf.readUInt32LE(12);
   if(buf.toString('ascii',16,20)!=='JSON')throw Error('GLB JSON chunk missing');
   const gltf=JSON.parse(buf.subarray(20,20+length).toString('utf8').trim());
   const tri=(gltf.meshes||[]).flatMap(m=>m.primitives||[])
    .filter(p=>p.mode===undefined||p.mode===4);
   if(tri.length!==(g==='female'?17:13))throw Error('Exported face + anatomical meshes mismatch: '+g+' '+tri.length);
   console.log('FACE_CLAY_GLB_EXPORT',JSON.stringify({
    gender:g,bytes:buf.length,trianglePrimitives:tri.length
   }));
  }
  const left=fs.readFileSync(path.join(out,'female-front.png'));
  const right=fs.readFileSync(path.join(out,'male-front.png'));
  if(Buffer.compare(left,right)===0)
   throw Error('Male and female rendered faces are identical');
  await page.locator('#female').click();
  await page.locator('#parts').click();
  if((await page.evaluate(()=>window.__faceMasterQA())).visiblePartMeshes!==0)
   throw Error('Facial mesh parts cannot be hidden independently');
  await canvas.screenshot({path:path.join(out,'female-face-only-no-parts.png')});
  // Face-only export remains available when evaluating the base surface.
  {
   const next=page.waitForEvent('download',{timeout:45000});
   await page.locator('#export').click();
   const file=path.join(out,'female-structural-face-only.glb');
   await (await next).saveAs(file);
   const buf=fs.readFileSync(file),size=buf.readUInt32LE(12);
   const gltf=JSON.parse(buf.subarray(20,20+size).toString('utf8').trim());
   if((gltf.meshes||[]).length!==1)
    throw Error('Face-only mode exported hidden facial parts');
  }
  await page.locator('#parts').click();
  await page.locator('#wire').click();
  if((await page.evaluate(()=>window.__faceMasterQA())).wire!==true)
   throw Error('Wireframe is not active');
  await canvas.screenshot({path:path.join(out,'female-wire.png')});
  if((await page.evaluate(()=>window.__faceMasterQA())).visiblePartMeshes!==16)
   throw Error('Facial parts did not restore after toggling');
  if(errors.length)throw Error('Browser errors: '+JSON.stringify(errors));
  console.log('INDEPENDENT_MALE_FEMALE_CLAY_FACES_SUCCESS '+
   JSON.stringify({femaleVertices:original.female.sourceVertices,
    maleVertices:original.male.sourceVertices,
    femaleTriangles:original.female.triangles,
    maleTriangles:original.male.triangles}));
 }finally{await browser.close();}
})().catch(e=>{console.error('INDEPENDENT_FACE_BROWSER_FAIL',e);process.exitCode=1;});

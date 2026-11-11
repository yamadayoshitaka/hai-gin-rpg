const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path');
const out='qa-screenshots/independent-faces';
fs.mkdirSync(out,{recursive:true});
// Verify displayed controls, not only the internally stored 3D parameter
// object: mobile form restoration can overwrite a slider without an input
// event, leaving a stale value visible while the actual mesh uses defaults.
async function expectVisibleV8Preset(page,context,contact='brown'){
 const expected={
  irisDiameter:1,eyeSize:1,jawSharpness:2.5,noseTipLift:0,
  nostrilCover:1,noseBridgeSharpness:2.5,eyeAngle:0,
  lipstickX:0,lipstickY:0,lipstickWidth:1,lipstickHeight:1
 };
 const actual=await page.evaluate(keys=>{
  const result={};
  for(const key of keys)result[key]={
   input:document.getElementById(key).value,
   output:document.getElementById(key+'Value').value
  };
  return {result,contact:document.getElementById('contactPreset').value,
   color:document.getElementById('contactColor').value,
   model:window.__faceMasterQA().femaleControls};
 },Object.keys(expected));
 for(const [key,value] of Object.entries(expected)){
  const ui=actual.result[key];
  const suffix=key==='eyeAngle'?'°':
   ['irisDiameter','eyeSize','jawSharpness','lipstickWidth','lipstickHeight'].includes(key)?'×':'';
  if(Number(ui.input)!==value||ui.output!==String(value)+suffix||
     actual.model[key]!==value)
   throw Error('Displayed v8 standard mismatch ('+context+': '+key+'): '+
    JSON.stringify({ui,actualModel:actual.model[key],expected:value}));
 }
 const colors={brown:'#514139',green:'#5c886b'};
 if(actual.contact!==contact||actual.color!==colors[contact])
  throw Error('Contact lens display mismatch ('+context+'): '+JSON.stringify(actual));
}
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
  await expectVisibleV8Preset(page,'fresh-open');
  // Simulate a mobile browser restoring an outdated range thumb/label
  // without dispatching input; pageshow must re-align UI with model state.
  await page.evaluate(()=>{
   document.getElementById('lipstickX').value='.05';
   document.getElementById('lipstickXValue').value='0.05';
   window.dispatchEvent(new Event('pageshow'));
  });
  await expectVisibleV8Preset(page,'browser-form-restoration');
  const original=await page.evaluate(()=>window.__faceMasterQA());
  if(original.gender!=='female'||original.bodyMeshes!==0||
     original.visibleFaceMeshes!==1||original.sourceUntouched!==true||
     original.female?.sourceVertices<1100||original.male?.sourceVertices<1100||
     original.female?.headOnly!==true||original.male?.headOnly!==true||
     original.female?.code!=='female-saved-preset-contact-makeup-v8'||
     original.female?.headTemplate!=='realistic-head-animation.glb'||
     original.female?.sourceVertices!==original.male?.sourceVertices||
     !original.female?.sourceGeometryIndependent||
     !original.male?.sourceGeometryIndependent||
     original.female?.facePartMeshCount!==30||
     original.male?.facePartMeshCount!==19||
     original.visiblePartMeshes!==30||
     original.faceMode!=='color'||
     original.femaleControls.irisDiameter!==1||
     original.femaleControls.jawSharpness!==2.5||
     original.femaleControls.noseTipLift!==0||
     original.femaleControls.nostrilCover!==1||
     original.femaleControls.noseBridgeSharpness!==2.5||
     !original.maleWithoutMakeup)
   throw Error('Not two independent source-derived face meshes: '+JSON.stringify(original));
  // Mobile category tabs must expose the requested controls without
  // forcing the user to scroll past a dozen unrelated sliders.
  const faceTabs=page.locator('#faceGroupTabs button');
  if(await faceTabs.count()!==5)throw Error('Female category tabs missing');
  await faceTabs.filter({hasText:'カラコン'}).click();
  if(!await page.locator('#contactPreset').isVisible())
   throw Error('Color picker hidden after selecting contact category');
  // A user who touches ONLY the contact color must not inadvertently
  // inherit lipstickX=.05 or another visible slider value.
  await page.locator('#contactPreset').selectOption('green');
  await expectVisibleV8Preset(page,'change-contact-only','green');
  await page.locator('#contactPreset').selectOption('brown');
  await expectVisibleV8Preset(page,'contact-back-to-standard');
  const canvas=page.locator('#faceCanvas');
  for(const g of ['female','male']){
   await page.locator('#'+g).click();
   for(const view of ['front','threeQuarter','side','back']){
    await page.locator('#'+view).click();
    await page.waitForTimeout(200);
    const report=await page.evaluate(()=>window.__faceMasterQA());
    if(report.gender!==g||report.view!==view||report.visibleFaceMeshes!==1||report.visiblePartMeshes!==(g==='female'?30:19))
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
   if(tri.length!==(g==='female'?31:20))throw Error('Exported face + anatomical meshes mismatch: '+g+' '+tri.length);
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
  await page.locator('#wire').click();
  await page.locator('#color').click();
  const colorQA=await page.evaluate(()=>window.__faceMasterQA());
  if(colorQA.faceMode!=='color')throw Error('Color mode was not activated');
  await page.locator('#front').click();
  await canvas.screenshot({path:path.join(out,'female-color-v7-front.png')});
  await page.locator('#threeQuarter').click();
  await canvas.screenshot({path:path.join(out,'female-color-v7-threeQuarter.png')});
  // Real eyebrow/lash angle control and front nasal tip sculpt.
  await page.locator('#contactPreset').selectOption('blue');
  for(const [control,value] of [['eyeAngle','12'],['eyeSize','1.2'],
   ['lipstickX','.04'],['lipstickY','-.025'],
   ['lipstickWidth','1.2'],['lipstickHeight','.8'],
   ['noseTipLift','1.8'],['nostrilCover','1.6'],
   ['noseBridgeSharpness','1.9']]){
   await page.locator('#'+control).evaluate((el,v)=>{
    el.value=v;el.dispatchEvent(new Event('input',{bubbles:true}));
    el.dispatchEvent(new Event('change',{bubbles:true}));
   },value);
  }
  const changed=await page.evaluate(()=>window.__faceMasterQA());
  if(changed.femaleControls.noseTipLift!==1.8||
     changed.femaleControls.nostrilCover!==1.6||
     changed.femaleControls.eyeSize!==1.2||
     changed.femaleControls.lipstickX!==.04||
     changed.femaleControls.lipstickY!==-.025||
     changed.currentFeatureAngles?.eyeAngle!==12||
     changed.currentFeatureAngles?.browAngle!==6||
     changed.currentFeatureAngles?.lashAngle!==7||
     changed.contactColor!=='#467fa7'||
     changed.visiblePartMeshes!==30)
   throw Error('Live nose/eyebrow/lash controls do not affect the displayed 3D: '+JSON.stringify(changed));
  await page.locator('#front').click();
  await canvas.screenshot({path:path.join(out,'female-color-nose-brow-adjusted.png')});
  // The GLB must retain actual v7 colored face, eyebrow and lash geometry.
  {
   const next=page.waitForEvent('download',{timeout:45000});
   await page.locator('#export').click();
   const file=path.join(out,'female-face-v7-colored.glb');
   await (await next).saveAs(file);
   const buf=fs.readFileSync(file),size=buf.readUInt32LE(12);
   const gltf=JSON.parse(buf.subarray(20,20+size).toString('utf8').trim());
   const meshes=gltf.meshes||[],materials=gltf.materials||[];
   if(meshes.length!==31||materials.length<5)
    throw Error('Colored female GLB did not preserve eyebrow/eyelash meshes and palette');
   console.log('FACE_V7_COLORED_GLB_EXPORT',JSON.stringify({
    bytes:buf.length,meshes:meshes.length,materials:materials.length
   }));
  }
  if((await page.evaluate(()=>window.__faceMasterQA())).visiblePartMeshes!==30)
   throw Error('Facial parts did not restore after toggling');
  await page.locator('#resetPreset').click();
  await expectVisibleV8Preset(page,'reset-button');
  const reset=await page.evaluate(()=>window.__faceMasterQA());
  if(reset.femaleControls.irisDiameter!==1||
     reset.femaleControls.jawSharpness!==2.5||
     reset.femaleControls.noseTipLift!==0||
     reset.femaleControls.noseBridgeSharpness!==2.5||
     reset.contactColor!=='#514139'||reset.faceMode!=='color')
    throw Error('Screenshot standard preset was not restored '+JSON.stringify(reset));
  await canvas.screenshot({path:path.join(out,'female-default-v9-lip-eye-blush.png')});
  if(reset.female?.detailedParts.eyelinerMeshCount!==4||
     reset.female?.detailedParts.eyeAccentMeshCount!==2||
     reset.female?.detailedParts.blushMeshCount!==0||
     !reset.female?.detailedParts.lipstickPlacement?.attachedToLipMesh)
   throw Error('V9 lipstick/eye-cheek makeup did not load actual surface');
  // The current jaw of 2.5 remains standard; higher values remain reachable.
  await page.locator('#jawSharpness').evaluate(el=>{
   el.value='4.5';el.dispatchEvent(new Event('input',{bubbles:true}));
   el.dispatchEvent(new Event('change',{bubbles:true}));
  });
  const strongerJaw=await page.evaluate(()=>window.__faceMasterQA());
  if(strongerJaw.femaleControls.jawSharpness!==4.5)
   throw Error('Female jaw extension above 2.5 is not operational');
  await canvas.screenshot({path:path.join(out,'female-v9-jaw-4-5.png')});
  await page.locator('#resetPreset').click();
  // Simulate a real pinch/zoom before changing a sculpt slider.
  // The rebuilt face mesh must not reset OrbitControls.
  await page.locator('#front').click();
  await canvas.hover();
  await page.mouse.wheel(0,-620);
  await page.waitForTimeout(450);
  const zoomBefore=await page.evaluate(()=>window.__faceMasterQA().cameraDistance);
  await page.locator('#faceGroupTabs button').filter({hasText:'顎・輪郭'}).click();
  if(!await page.locator('#jawSharpness').isVisible())
   throw Error('Jaw slider not visible in face category');
  const plus=page.locator('label[for="jawSharpness"] .stepRow button').last();
  if(!await plus.isVisible())throw Error('Precise + jaw stepper missing');
  await plus.click();
  const stepJaw=await page.evaluate(()=>window.__faceMasterQA());
  if(Math.abs(stepJaw.femaleControls.jawSharpness-2.6)>1e-6)
   throw Error('Fine adjustment step failed');
  if(Math.abs(stepJaw.cameraDistance-zoomBefore)>1e-4)
   throw Error('Rebuilding after slider step reset zoom '+stepJaw.cameraDistance+' / '+zoomBefore);
  await page.locator('#resetPreset').click();
  await page.locator('#eyeAngle').evaluate(el=>{
   el.value='20';el.dispatchEvent(new Event('input',{bubbles:true}));
  });
  await canvas.screenshot({path:path.join(out,'female-eye-angle-plus20-brows.png')});
  await page.locator('#eyeAngle').evaluate(el=>{
   el.value='-20';el.dispatchEvent(new Event('input',{bubbles:true}));
  });
  await canvas.screenshot({path:path.join(out,'female-eye-angle-minus20-brows.png')});
  await page.locator('#resetPreset').click();
  await page.locator('#male').click();
  const neutralMale=await page.evaluate(()=>window.__faceMasterQA());
  if(neutralMale.maleControls.jawSharpness!==1.15||
     neutralMale.maleControls.beardDensity!==.35||
     neutralMale.male.detailedParts.beardMeshCount!==5||
     (await page.locator('#maleJawSharpness').inputValue())!=='1.15'||
     (await page.locator('#maleBeardDensity').inputValue())!=='0.35')
   throw Error('Male face/beard controls did not restore canonical defaults');
  await page.locator('#maleJawSharpness').evaluate(el=>{
   el.value='4.5';el.dispatchEvent(new Event('input',{bubbles:true}));
   el.dispatchEvent(new Event('change',{bubbles:true}));
  });
  await page.locator('#maleBeardDensity').evaluate(el=>{
   el.value='.85';el.dispatchEvent(new Event('input',{bubbles:true}));
   el.dispatchEvent(new Event('change',{bubbles:true}));
  });
  await page.locator('#maleBeardLength').evaluate(el=>{
   el.value='2';el.dispatchEvent(new Event('input',{bubbles:true}));
   el.dispatchEvent(new Event('change',{bubbles:true}));
  });
  await page.locator('#maleEyeAngle').evaluate(el=>{
   el.value='16';el.dispatchEvent(new Event('input',{bubbles:true}));
  });
  const adjustedMale=await page.evaluate(()=>window.__faceMasterQA());
  if(adjustedMale.maleControls.jawSharpness!==4.5||
     adjustedMale.maleControls.beardDensity!==.85||
     adjustedMale.maleControls.beardLength!==2||
     adjustedMale.maleControls.eyeAngle!==16||
     adjustedMale.male.detailedParts.beardDensity!==.85||
     adjustedMale.visiblePartMeshes!==19)
   throw Error('Male jaw/eye/beard sliders do not change actual 3D '+JSON.stringify(adjustedMale));
  await page.locator('#front').click();
  await canvas.screenshot({path:path.join(out,'male-v9-beard-high-jaw.png')});
  // The modified male 3D beard/jaw must survive independent GLB export.
  {
   const next=page.waitForEvent('download',{timeout:45000});
   await page.locator('#export').click();
   const file=path.join(out,'male-v9-beard.glb');
   await (await next).saveAs(file);
   const buf=fs.readFileSync(file),len=buf.readUInt32LE(12);
   const gltf=JSON.parse(buf.subarray(20,20+len).toString('utf8').trim());
   if((gltf.meshes||[]).length!==20)throw Error('Male beard GLB geometry missing');
  }
  await page.locator('#resetMalePreset').click();
  const maleQA=await page.evaluate(()=>window.__faceMasterQA());
  if(maleQA.maleWithoutMakeup!==true||
     maleQA.male.detailedParts.lipstickMeshCount!==0||
     maleQA.male.detailedParts.underEyeShadowMeshCount!==0||
     maleQA.male.detailedParts.eyeScale>=maleQA.female.detailedParts.eyeScale)
   throw Error('Male must use shared female head with smaller eyes and no makeup');
  await canvas.screenshot({path:path.join(out,'male-v8-no-makeup.png')});
  if(errors.length)throw Error('Browser errors: '+JSON.stringify(errors));
  console.log('INDEPENDENT_MALE_FEMALE_CLAY_FACES_SUCCESS '+
   JSON.stringify({femaleVertices:original.female.sourceVertices,
    maleVertices:original.male.sourceVertices,
    femaleTriangles:original.female.triangles,
    maleTriangles:original.male.triangles}));
 }finally{await browser.close();}
})().catch(e=>{console.error('INDEPENDENT_FACE_BROWSER_FAIL',e);process.exitCode=1;});

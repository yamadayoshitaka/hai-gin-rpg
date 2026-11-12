const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path');
const out='qa-screenshots/independent-faces';
fs.mkdirSync(out,{recursive:true});
// Verify displayed controls, not only the internally stored 3D parameter
// object: mobile form restoration can overwrite a slider without an input
// event, leaving a stale value visible while the actual mesh uses defaults.
async function expectVisibleLibraryPreset(page,context,contact='brown'){
 const expected={
  irisDiameter:1,eyeSize:1,jawSharpness:5,noseTipLift:0,
  nostrilCover:2,noseBridgeSharpness:2.5,eyeAngle:0,
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
   throw Error('Displayed Library-saved preset mismatch ('+context+': '+key+'): '+
    JSON.stringify({ui,actualModel:actual.model[key],expected:value}));
 }
 const colors={brown:'#514139',green:'#5c886b'};
 if(actual.contact!==contact||actual.color!==colors[contact])
  throw Error('Contact lens display mismatch ('+context+'): '+JSON.stringify(actual));
}
async function expectCenteredFaceSliders(page,gender){
 const snapshot=await page.evaluate(sex=>{
  const keys=sex==='female'?
   ['irisDiameter','eyeSize','jawSharpness','noseTipLift','nostrilCover',
    'noseBridgeSharpness','eyeAngle','lipstickX','lipstickY',
    'lipstickWidth','lipstickHeight']:
   ['jawSharpness','eyeSize','irisDiameter','noseTipLift',
    'nostrilCover','noseBridgeSharpness','eyeAngle'];
  const model=window.__faceMasterQA();
  const selected=sex==='female'?model.femaleControls:model.maleControls;
  return keys.map(key=>{
   const id=sex==='male'?'male'+key[0].toUpperCase()+key.slice(1):key;
   const el=document.getElementById(id);
   return {key,value:+el.value,min:+el.min,max:+el.max,
    saved:+el.dataset.savedValue,model:selected[key],
    center:+el.dataset.savedPosition};
  });
 },gender);
 for(const p of snapshot){
  const mid=(p.min+p.max)/2;
  if(Math.abs(mid-p.value)>1e-8||
     Math.abs(p.value-p.saved)>1e-8||
     Math.abs(p.model-p.saved)>1e-8||
     p.center!==.5)
   throw Error('Saved GLB is not centered at 50%: '+gender+' '+JSON.stringify(p));
 }
 const exact=Object.fromEntries(snapshot.map(x=>[x.key,[x.min,x.max,x.value]]));
 if(JSON.stringify(exact.jawSharpness)!==JSON.stringify([0,10,5])||
    JSON.stringify(exact.nostrilCover)!==JSON.stringify([0,4,2])||
    JSON.stringify(exact.noseBridgeSharpness)!==JSON.stringify([0,5,2.5]))
  throw Error('Face center/upper sculpt ranges differ from request: '+JSON.stringify(exact));
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
  await expectVisibleLibraryPreset(page,'fresh-open');
  await expectCenteredFaceSliders(page,'female');
  // Simulate a mobile browser restoring an outdated range thumb/label
  // without dispatching input; pageshow must re-align UI with model state.
  await page.evaluate(()=>{
   document.getElementById('lipstickX').value='.05';
   document.getElementById('lipstickXValue').value='0.05';
   window.dispatchEvent(new Event('pageshow'));
  });
  await expectVisibleLibraryPreset(page,'browser-form-restoration');
  await expectCenteredFaceSliders(page,'female');
  const original=await page.evaluate(()=>window.__faceMasterQA());
  if(!original.savedNoseJawApplied||
     original.savedNoseJawDefaults?.jawSharpness!==5||
     original.savedNoseJawDefaults?.nostrilCover!==2||
     original.savedNoseJawDefaults?.noseBridgeSharpness!==2.5||
     !original.female?.detailedParts?.eyeProfileLateralMargins?.every(v=>v>.002)||
     !original.male?.detailedParts?.eyeProfileLateralMargins?.every(v=>v>.002))
   throw Error('Saved nose/chin or lateral eye visibility broken '+JSON.stringify(original));
  if(original.gender!=='female'||original.bodyMeshes!==0||
     original.visibleFaceMeshes!==1||original.sourceUntouched!==true||
     original.female?.sourceVertices<1100||original.male?.sourceVertices<1100||
     original.female?.headOnly!==true||original.male?.headOnly!==true||
     original.female?.code!=='female-saved-preset-contact-makeup-v8'||
     original.female?.headTemplate!=='realistic-head-animation.glb'||
     original.female?.sourceVertices!==original.male?.sourceVertices||
     !original.female?.sourceGeometryIndependent||
     !original.male?.sourceGeometryIndependent||
     original.female?.facePartMeshCount!==32||
     original.male?.facePartMeshCount!==19||
     original.visiblePartMeshes!==32||
     original.faceMode!=='color'||
     original.femaleControls.irisDiameter!==1||
     original.femaleControls.jawSharpness!==5||
     original.femaleControls.noseTipLift!==0||
     original.femaleControls.nostrilCover!==2||
     original.femaleControls.noseBridgeSharpness!==2.5||
     !original.maleWithoutMakeup)
   throw Error('Not two independent source-derived face meshes: '+JSON.stringify(original));
  // Mobile category tabs must expose the requested controls without
  // forcing the user to scroll past a dozen unrelated sliders.
  const faceTabs=page.locator('#faceGroupTabs button');
  if(await faceTabs.count()!==6)throw Error('Female face + wig category tabs missing');
  await faceTabs.filter({hasText:'カラコン'}).click();
  if(!await page.locator('#contactPreset').isVisible())
   throw Error('Color picker hidden after selecting contact category');
  // A user who touches ONLY the contact color must not inadvertently
  // inherit lipstickX=.05 or another visible slider value.
  await page.locator('#contactPreset').selectOption('green');
  await expectVisibleLibraryPreset(page,'change-contact-only','green');
  await page.locator('#contactPreset').selectOption('brown');
  await expectVisibleLibraryPreset(page,'contact-back-to-standard');
  const canvas=page.locator('#faceCanvas');
  for(const g of ['female','male']){
   await page.locator('#'+g).click();
   for(const view of ['front','threeQuarter','side','back']){
    await page.locator('#'+view).click();
    await page.waitForTimeout(200);
    const report=await page.evaluate(()=>window.__faceMasterQA());
    if(report.gender!==g||report.view!==view||report.visibleFaceMeshes!==1||report.visiblePartMeshes!==(g==='female'?32:19))
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
   if(tri.length!==(g==='female'?35:20))throw Error('Exported face + anatomical meshes mismatch: '+g+' '+tri.length);
   const master=(gltf.nodes||[]).find(n=>n.name===g.toUpperCase()+'_FACE_MASTER_SOURCE_CLONE');
   const saved=master?.extras?.faceMasterReport;
   const controls=g==='female'?saved?.femaleControls:saved?.maleControls;
   if(controls?.jawSharpness!==5||controls?.nostrilCover!==2||
      controls?.eyeSize!==1||controls?.irisDiameter!==1)
    throw Error('Exported '+g+' GLB lost Library defaults '+JSON.stringify(controls));
   if(g==='female'){
    const nodes=(gltf.nodes||[]).map(n=>n.name);
    if(!nodes.includes('REAL_ROOTED_SWEPT_HAIR_LOCKS')||
       !nodes.includes('REAL_SCALP_TRIANGLE_HAIR_CAP'))
     throw Error('Female GLB did not include scalp-rooted wig');
   }
   if(g==='male'&&(!saved?.maleNoMakeup||saved?.femaleControls!==null))
    throw Error('Male GLB contains female cosmetic settings');
   console.log('FACE_CLAY_GLB_EXPORT',JSON.stringify({
    gender:g,bytes:buf.length,trianglePrimitives:tri.length
   }));
  }
  const left=fs.readFileSync(path.join(out,'female-front.png'));
  const right=fs.readFileSync(path.join(out,'male-front.png'));
  if(Buffer.compare(left,right)===0)
   throw Error('Male and female rendered faces are identical');
  await page.locator('#female').click();
  const wigQA=await page.evaluate(()=>window.__faceMasterQA());
  if(!wigQA.wigVisible||wigQA.wigReport?.rootCount!==1440||
     wigQA.wigStyleId!=='center-part-gravity-long'||
     !wigQA.wigIsSeparateAsset||
     wigQA.wigReport?.hairstyleId!=='center-part-gravity-long'||
     !wigQA.wigReport?.gravityRestShape||
     !wigQA.wigReport?.centerPart||
     !wigQA.wigReport?.exactFaceSurfaceCollision||
     wigQA.wigReport?.hairShape!=='head-hugging-salon-layered-pointcut'||
     wigQA.wigReport?.rearRootPolicy!=='actual-posterior-scalp-only'||
     !wigQA.wigReport?.faceCurtainPrevention||
     wigQA.wigReport?.faceTrimmedStrands<10||
     !['templeLeft','templeRight','backLeft','backRight','napeLeft','napeRight'].every(
       zone=>wigQA.wigReport.rootDistribution?.[zone]>=64)||
     !wigQA.wigReport?.collisionTypes.includes('face')||
     !wigQA.wigReport?.collisionTypes.includes('chest'))
   throw Error('Scalp wig and collision proxy not initialized '+JSON.stringify(wigQA.wigReport));
  await page.locator('#front').click();
  await canvas.screenshot({path:path.join(out,'female-v16-salon-hair-front.png')});
  await page.locator('#back').click();
  await canvas.screenshot({path:path.join(out,'female-v16-real-rear-scalp-hair.png')});
  await page.locator('#side').click();
  await canvas.screenshot({path:path.join(out,'female-v18-scalp-follow-side.png')});
  await page.locator('#crown').click();
  await canvas.screenshot({path:path.join(out,'female-v18-true-crown-and-hair-roots.png')});
  if((await page.locator('#crown').getAttribute('aria-pressed'))!=='true')
   throw Error('Crown inspection mode is not active');
  await page.locator('#front').click();
  const distanceWithHair=await page.evaluate(()=>window.__faceMasterQA().cameraDistance);
  await page.locator('#parts').click();
  await page.locator('#wig').click();
  await page.locator('#front').click();
  const distanceWithoutHair=await page.evaluate(()=>window.__faceMasterQA().cameraDistance);
  if(Math.abs(distanceWithHair-distanceWithoutHair)>1e-6)
   throw Error('Wig changed face camera zoom '+distanceWithHair+'/'+distanceWithoutHair);
  if((await page.evaluate(()=>window.__faceMasterQA())).wigVisible)
   throw Error('Wig toggle did not hide wig');
  // In the old QA the parts switch was OFF in profile photos.
  // Enable actual anatomical eyes for profile and makeup verification.
  await page.locator('#parts').click();
  if((await page.evaluate(()=>window.__faceMasterQA())).visiblePartMeshes!==32)
   throw Error('Eye profile tests must render actual orbital meshes');
  // As sliders move, all upper/lower eyeliner meshes must reproject to
  // their real eyelids, not be left behind in old eye-angle coordinates.
  for(const value of ['-20','0','20']){
   await page.locator('#eyeAngle').evaluate((el,v)=>{
    el.value=v;el.dispatchEvent(new Event('input',{bubbles:true}));
   },value);
   const angles=await page.evaluate(()=>window.__faceMasterQA().currentFeatureAngles);
   if(angles?.eyeAngle!==Number(value)||angles?.eyelinerMeshesRefitted!==4)
    throw Error('Eye tilt did not refit eyeliner to both eyelids '+JSON.stringify(angles));
   await page.locator('#front').click();
   await canvas.screenshot({path:path.join(out,
    'female-v16-eyeliner-angle-'+value.replace('-','minus')+'.png')});
  }
  await page.locator('#eyeAngle').evaluate(el=>{
   el.value='0';el.dispatchEvent(new Event('input',{bubbles:true}));
  });
  await page.locator('#side').click();
  await canvas.screenshot({path:path.join(out,'female-v15-actual-eyes-side.png')});
  await page.locator('#threeQuarter').click();
  await canvas.screenshot({path:path.join(out,'female-v15-actual-eyes-45deg.png')});
  await page.locator('#front').click();
  await canvas.screenshot({path:path.join(out,'female-v15-makeup-no-wig-front.png')});
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
  await page.locator('#wig').click();
  if(!(await page.evaluate(()=>window.__faceMasterQA())).wigVisible)
   throw Error('Wig toggle did not restore wig');
  await page.locator('#wire').click();
  if((await page.evaluate(()=>window.__faceMasterQA())).wire!==true)
   throw Error('Wireframe is not active');
  await canvas.screenshot({path:path.join(out,'female-wire.png')});
  await page.locator('#wire').click();
  await page.locator('#color').click();
  const colorQA=await page.evaluate(()=>window.__faceMasterQA());
  if(colorQA.faceMode!=='color')throw Error('Color mode was not activated');
  await page.locator('#front').click();
  await canvas.screenshot({path:path.join(out,'female-color-v12-hair-front.png')});
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
     changed.visiblePartMeshes!==32)
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
   if(meshes.length!==35||materials.length<5)
    throw Error('Colored female GLB did not preserve eyebrow/eyelash meshes and palette');
   console.log('FACE_V7_COLORED_GLB_EXPORT',JSON.stringify({
    bytes:buf.length,meshes:meshes.length,materials:materials.length
   }));
  }
  if((await page.evaluate(()=>window.__faceMasterQA())).visiblePartMeshes!==32)
   throw Error('Facial parts did not restore after toggling');
  await page.locator('#resetPreset').click();
  await expectVisibleLibraryPreset(page,'reset-button');
  const reset=await page.evaluate(()=>window.__faceMasterQA());
  if(reset.femaleControls.irisDiameter!==1||
     reset.femaleControls.jawSharpness!==5||
     reset.femaleControls.noseTipLift!==0||
     reset.femaleControls.noseBridgeSharpness!==2.5||
     reset.contactColor!=='#514139'||reset.faceMode!=='color')
    throw Error('Screenshot standard preset was not restored '+JSON.stringify(reset));
  await canvas.screenshot({path:path.join(out,'female-default-v9-lip-eye-blush.png')});
  const makeupQA=await page.evaluate(()=>window.__faceMasterQA());
  if(makeupQA.female.detailedParts.upperEyeshadowMeshCount!==2||
     !makeupQA.female.detailedParts.shadowOnRealEyelids||
     !makeupQA.female.detailedParts.lipstickPlacement.appliedToSourceHead)
   throw Error('V15 makeup must attach to sculpted head and real eyelids');
  // Four fast lipstick inputs should immediately recolor actual head
  // vertices without any expensive head or 1440-strand wig rebuild.
  const beforePerf=makeupQA.performanceMetrics;
  await page.locator('#faceGroupTabs button').filter({hasText:'口紅'}).click();
  for(const value of ['.01','.02','.03','.04']){
   await page.locator('#lipstickX').evaluate((el,v)=>{
    el.value=v;el.dispatchEvent(new Event('input',{bubbles:true}));
   },value);
  }
  const afterPaint=await page.evaluate(()=>window.__faceMasterQA());
  if(afterPaint.performanceMetrics.headRebuilds!==beforePerf.headRebuilds||
     afterPaint.performanceMetrics.wigRebuilds!==beforePerf.wigRebuilds||
     afterPaint.performanceMetrics.fastLipstickRepaints-beforePerf.fastLipstickRepaints!==4)
   throw Error('Dragging lipstick rebuilt heavy face/wig '+JSON.stringify(afterPaint.performanceMetrics));
  await canvas.screenshot({path:path.join(out,'female-v15-real-lipstick-and-eyeshadow.png')});
  await page.locator('#resetPreset').click();
  if(!reset.savedNoseJawApplied||
     reset.female?.detailedParts.eyelinerMeshCount!==4||
     reset.female?.detailedParts.eyelinerCornersClosed!==true||
     reset.female?.detailedParts.blushOpacityFactor!==.78||
     reset.female?.detailedParts.eyeAccentMeshCount!==2||
     reset.female?.detailedParts.blushMeshCount!==0||
     !reset.female?.detailedParts.lipstickPlacement?.appliedToSourceHead)
   throw Error('V9 lipstick/eye-cheek makeup did not load actual surface');
  // The saved Library jaw value 5 is the standard; users can still reduce it.
  await page.locator('#jawSharpness').evaluate(el=>{
   el.value='4.5';el.dispatchEvent(new Event('input',{bubbles:true}));
   el.dispatchEvent(new Event('change',{bubbles:true}));
  });
  const strongerJaw=await page.evaluate(()=>window.__faceMasterQA());
  if(strongerJaw.performanceMetrics.wigRebuilds!==afterPaint.performanceMetrics.wigRebuilds)
   throw Error('Jaw control incorrectly regenerated 1440-strand wig');
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
  await page.locator('#jawSharpness').evaluate(el=>{
   el.value='4.5';el.dispatchEvent(new Event('input',{bubbles:true}));
   el.dispatchEvent(new Event('change',{bubbles:true}));
  });
  const plus=page.locator('label[for="jawSharpness"] .stepRow button').last();
  if(!await plus.isVisible())throw Error('Precise + jaw stepper missing');
  await plus.click();
  const stepJaw=await page.evaluate(()=>window.__faceMasterQA());
  if(Math.abs(stepJaw.femaleControls.jawSharpness-4.6)>1e-6)
   throw Error('Fine adjustment step failed');
  if(Math.abs(stepJaw.cameraDistance-zoomBefore)>1e-4)
   throw Error('Rebuilding after slider step reset zoom '+stepJaw.cameraDistance+' / '+zoomBefore);
  await page.locator('#resetPreset').click();
  await page.locator('#eyeAngle').evaluate(el=>{
   el.value='20';el.dispatchEvent(new Event('input',{bubbles:true}));
  });
  await canvas.screenshot({path:path.join(out,'female-eye-angle-plus20-brows.png')});
  const beforeHairControls=await page.evaluate(()=>window.__faceMasterQA().femaleControls);
  await page.locator('#faceGroupTabs button').filter({hasText:'髪'}).click();
  for(const [id,value] of [['wigDensity','480'],['wigLength','1.5']]){
   await page.locator('#'+id).evaluate((el,v)=>{
    el.value=v;el.dispatchEvent(new Event('input',{bubbles:true}));
    el.dispatchEvent(new Event('change',{bubbles:true}));
   },value);
  }
  const hairAdjusted=await page.evaluate(()=>window.__faceMasterQA());
  if(hairAdjusted.wigReport?.rootCount!==480||
     hairAdjusted.wigReport?.lengthScale!==1.5||
     JSON.stringify(hairAdjusted.femaleControls)!==JSON.stringify(beforeHairControls))
   throw Error('Hair sliders affected face settings or wig '+JSON.stringify(hairAdjusted.wigReport));
  // Independent wigs may be selected and exported without changing any
  // anatomical face slider or forcing the user to export the full head.
  {
   const styleBefore=await page.evaluate(()=>window.__faceMasterQA());
   if(styleBefore.wigStyles.length<2||styleBefore.wigStyleId!=='center-part-gravity-long')
    throw Error('Independent wig catalog not present');
   const started=page.waitForEvent('download',{timeout:60000});
   await page.locator('#exportWig').click();
   const download=await started;
   if(!download.suggestedFilename().includes('center-part-gravity-long'))
    throw Error('Independent wig GLB lacks hairstyle ID');
   const file=path.join(out,'standalone-center-part-gravity-wig.glb');
   await download.saveAs(file);
   const buf=fs.readFileSync(file);
   if(buf.toString('ascii',0,4)!=='glTF')throw Error('Wig-only GLB magic mismatch');
   const gltf=JSON.parse(buf.subarray(20,20+buf.readUInt32LE(12)).toString('utf8').trim());
   const styleNode=(gltf.nodes||[]).find(n=>n.name==='FEMALE_SCALP_ANCHORED_LONG_WIG');
   if(styleNode?.extras?.hairStyleId!=='center-part-gravity-long')
    throw Error('Independent wig GLB lost own registry ID '+JSON.stringify(styleNode));
   if((gltf.nodes||[]).some(n=>(n.name||'').includes('FACE_MASTER')))
    throw Error('Standalone wig exported the facial head too');
   console.log('FACE_V17_STANDALONE_WIG_GLB_EXPORT',JSON.stringify({
    bytes:buf.length,hairstyleId:styleNode.extras.hairStyleId
   }));
   await page.locator('#wigStyle').selectOption('salon-layered-long');
   const alternate=await page.evaluate(()=>window.__faceMasterQA());
   if(alternate.wigReport?.hairstyleId!=='salon-layered-long'||
      alternate.wigIsSeparateAsset!==true||
      JSON.stringify(alternate.femaleControls)!==JSON.stringify(beforeHairControls))
    throw Error('Changing wig ID affected face settings or style registration');
   await page.locator('#wigStyle').selectOption('center-part-gravity-long');
   if((await page.evaluate(()=>window.__faceMasterQA())).wigReport?.centerPart!==true)
    throw Error('Restoring crown center-part wig failed');
  }
  await canvas.screenshot({path:path.join(out,'female-v13-wig-480-long.png')});
  for(const [id,value] of [['wigDensity','1440'],['wigLength','1']]){
   await page.locator('#'+id).evaluate((el,v)=>{
    el.value=v;el.dispatchEvent(new Event('input',{bubbles:true}));
    el.dispatchEvent(new Event('change',{bubbles:true}));
   },value);
  }
  await page.locator('#eyeAngle').evaluate(el=>{
   el.value='-20';el.dispatchEvent(new Event('input',{bubbles:true}));
  });
  await canvas.screenshot({path:path.join(out,'female-eye-angle-minus20-brows.png')});
  await page.locator('#resetPreset').click();
  // Browser state must initialize BOTH genders from the exported GLB
  // settings, not merely display the old hard-coded slider defaults.
  await page.locator('#male').click();
  const neutralMale=await page.evaluate(()=>window.__faceMasterQA());
  await expectCenteredFaceSliders(page,'male');
  for(const [key,value] of Object.entries({
   jawSharpness:5,nostrilCover:2,irisDiameter:1,eyeSize:1,
   noseTipLift:0,noseBridgeSharpness:2.5,eyeAngle:0
  })){
   if(neutralMale.maleControls[key]!==value)
    throw Error('Saved Library male default '+key+' drifted: '+neutralMale.maleControls[key]);
  }
  if(neutralMale.maleControls.jawSharpness!==5||
     neutralMale.maleControls.beardDensity!==.35||
     neutralMale.male.detailedParts.beardMeshCount!==5||
     (await page.locator('#maleJawSharpness').inputValue())!=='5'||
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
  await expectCenteredFaceSliders(page,'male');
  if(maleQA.maleWithoutMakeup!==true||
     maleQA.male.detailedParts.lipstickMeshCount!==0||
     maleQA.male.detailedParts.underEyeShadowMeshCount!==0||
     maleQA.male.detailedParts.eyelinerMeshCount!==0||
     maleQA.male.detailedParts.blushVertexTint!==false||
     Math.abs(maleQA.male.detailedParts.eyeScale-
      maleQA.female.detailedParts.eyeScale)>1e-8)
   throw Error('Male must match the saved female eye scale without any cosmetics');
  await canvas.screenshot({path:path.join(out,'male-v11-library-no-makeup.png')});
  // The NEW right half of the female and male nose/chin sliders must
  // rebuild real geometry, then reset to exactly the saved center.
  await page.locator('#maleJawSharpness').evaluate(el=>{
   el.value='9';el.dispatchEvent(new Event('input',{bubbles:true}));
   el.dispatchEvent(new Event('change',{bubbles:true}));
  });
  await page.locator('#maleNostrilCover').evaluate(el=>{
   el.value='3.6';el.dispatchEvent(new Event('input',{bubbles:true}));
   el.dispatchEvent(new Event('change',{bubbles:true}));
  });
  await page.locator('#maleNoseBridgeSharpness').evaluate(el=>{
   el.value='4.5';el.dispatchEvent(new Event('input',{bubbles:true}));
   el.dispatchEvent(new Event('change',{bubbles:true}));
  });
  const high=await page.evaluate(()=>window.__faceMasterQA());
  if(high.maleControls.jawSharpness!==9||
     high.maleControls.nostrilCover!==3.6||
     high.maleControls.noseBridgeSharpness!==4.5||
     high.male.sourceGeometryIndependent!==true)
   throw Error('Extended right half did not modify independent male mesh');
  await canvas.screenshot({path:path.join(out,'male-v14-beyond-saved-standard.png')});
  await page.locator('#resetMalePreset').click();
  await expectCenteredFaceSliders(page,'male');

  // v19 integrated heroine: true source torso, separate sculpted face,
  // matching Chapter One reference portrait and actual body-triangle contacts.
  {
   const hero=await browser.newPage({
    viewport:{width:1000,height:880},deviceScaleFactor:1,acceptDownloads:true
   });
   const errorsHero=[];hero.on('pageerror',e=>errorsHero.push(e.message));
   await hero.goto('http://127.0.0.1:8765/face-body-studio.html',
    {waitUntil:'domcontentloaded',timeout:60000});
   await hero.waitForFunction(()=>window.__heroineBodyQA?.().loaded===true,
    null,{timeout:120000,polling:250});
   const info=await hero.evaluate(()=>window.__heroineBodyQA());
   if(info.characterId!=='hero-girl-01'||info.artMatched!==false||
      !info.artReference.includes('commander/female-master.webp'))
    throw Error('Unregistered or falsely approved art character '+JSON.stringify(info));
   if(!info.attachedBody||info.donorHeadRemoved<1||info.headBustRemoved<1||
      info.bodyMeshes<1||
      !info.sourceHeadUnchanged||!info.sourceBodyUnchanged)
    throw Error('Body/head integration failed '+JSON.stringify(info));
   if(Math.abs(info.roundPupilAspectRatio-1)>.016)
    throw Error('Black pupil is not round: '+info.roundPupilAspectRatio);
   if(!info.wig?.usesRealBodyTriangleContacts||
      info.bodyCollision?.collisionTriangleCount<1)
    throw Error('Real female body mesh is not used for hair collision');
   const c=hero.locator('#bodyCanvas');
   await c.screenshot({path:path.join(out,'heroine-v19-front-body.png')});
   await hero.locator('#portrait').click();
   await c.screenshot({path:path.join(out,'heroine-v19-round-eyes-closeup.png')});
   // Isolate eye geometry from wig strands and verify the actual face
   // remains visible when the head decoration is hidden.
   await hero.locator('#toggleWig').click();
   await c.screenshot({path:path.join(out,'heroine-v19-eyes-no-hair.png')});
   await hero.locator('#toggleWig').click();
   await hero.screenshot({path:path.join(out,'heroine-v19-art-versus-3d.png')});
   await hero.locator('#side').click();
   await c.screenshot({path:path.join(out,'heroine-v19-hair-body-side.png')});
   await hero.locator('#back').click();
   await c.screenshot({path:path.join(out,'heroine-v19-hair-body-back.png')});
   await hero.locator('#front').click();
   await hero.locator('#full').click();
   const artOk=await hero.locator('#artImage').evaluate(el=>
    el.complete&&el.naturalWidth>0);
   if(!artOk)throw Error('Actual registered heroine illustration did not load');
   const before=hero.waitForEvent('download',{timeout:100000});
   await hero.locator('#saveGlb').click();
   const dl=await before;
   if(!dl.suggestedFilename().includes('hero-girl-01'))
    throw Error('GLB filename lost character identity');
   const file=path.join(out,'heroine-v19-connected-full-model.glb');
   await dl.saveAs(file);
   const buf=fs.readFileSync(file);
   if(buf.toString('ascii',0,4)!=='glTF')throw Error('Not GLB');
   const gltf=JSON.parse(buf.subarray(20,
    20+buf.readUInt32LE(12)).toString('utf8').trim());
   const names=(gltf.nodes||[]).map(n=>n.name||'');
   if(!names.includes('HEROINE_REAL_BODY_ATTACHMENT')||
      !names.some(n=>n.includes('FEMALE_INDEPENDENT_CLAY_FACE'))||
      !names.includes('CC0_CLIPPED_FEMALE_BODY')||
      !names.includes('FEMALE_SCALP_ANCHORED_LONG_WIG'))
    throw Error('Integrated GLB missing face/body/wig meshes '+JSON.stringify(names.slice(0,40)));
   if(errorsHero.length)throw Error('Connected heroine JS errors '+JSON.stringify(errorsHero));
   console.log('FACE_V19_CONNECTED_HEROINE_GLB_EXPORT',JSON.stringify({
    bodyTriangles:info.bodyMeshes,trimmedHeadTriangles:info.donorHeadRemoved,
    pupilAspect:info.roundPupilAspectRatio,wigStyle:info.styleId,
    bytes:buf.length
   }));
   await hero.close();
  }
  if(errors.length)throw Error('Browser errors: '+JSON.stringify(errors));
  console.log('INDEPENDENT_MALE_FEMALE_CLAY_FACES_SUCCESS '+
   JSON.stringify({femaleVertices:original.female.sourceVertices,
    maleVertices:original.male.sourceVertices,
    femaleTriangles:original.female.triangles,
    maleTriangles:original.male.triangles}));
 }finally{await browser.close();}
})().catch(e=>{console.error('INDEPENDENT_FACE_BROWSER_FAIL',e);process.exitCode=1;});

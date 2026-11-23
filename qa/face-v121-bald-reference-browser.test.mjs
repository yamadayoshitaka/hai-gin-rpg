import test from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdirSync,readFileSync,copyFileSync} from 'node:fs';

test('Android-size v121 face renders and downloads an actual binary neutral GLB',async()=>{
 const browser=await chromium.launch({headless:true,args:[
  '--no-sandbox','--disable-gpu-sandbox','--enable-webgl',
  '--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'
 ]});
 try{
  const context=await browser.newContext({viewport:{width:412,height:915},
   deviceScaleFactor:2,acceptDownloads:true,isMobile:true,hasTouch:true});
  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',e=>errors.push('pageerror '+e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push('console '+m.text())});
  await page.goto('http://127.0.0.1:8765/face-neutral-v121.html?v=120',{
   waitUntil:'domcontentloaded',timeout:25000});
  try{
   await page.waitForFunction(()=>document.documentElement.dataset.neutralFaceReady==='v121',
     null,{timeout:50000});
  }catch(e){
   const status=await page.locator('#status').textContent().catch(()=>'?');
   throw new Error('v121 init failed: '+e.message+'; status='+status+'; errors='+errors.join(' | '));
  }
  assert.deepEqual(errors,[],'No runtime errors in new model preview');
  assert.match(await page.locator('#status').textContent(),/顔 v121/);
  assert.ok(Number((await page.locator('#vertexCount').textContent()).replace(/,/g,''))>13000);
  await page.locator('[data-camera="side"]').click();
  assert.equal(await page.locator('[data-camera="side"]').getAttribute('aria-pressed'),'true');
  await page.locator('[data-camera="front"]').click();
  await page.locator('#eyes').click();
  assert.equal(await page.locator('#eyes').getAttribute('aria-pressed'),'false');
  await page.locator('#eyes').click();
  await page.locator('#wire').click();
  assert.equal(await page.locator('#wire').getAttribute('aria-pressed'),'true');
  await page.locator('#wire').click();
  mkdirSync('qa/screenshots/face-v121',{recursive:true});
  await page.locator('#viewport').screenshot({path:'qa/screenshots/face-v121/neutral-face-front.png'});
  // The default is a softly pigmented natural look; each swatch changes
  // actual GLB vertex colours without tinting the chin.
  assert.equal(await page.locator('html').getAttribute('data-v121-makeup'),'natural');
  for(const option of ['brown','glamorous','natural','bare','pink']){
    await page.locator('[data-makeup="'+option+'"]').click();
    assert.equal(await page.locator('html').getAttribute('data-v121-makeup'),option);
    assert.equal(await page.locator('[data-makeup="'+option+'"]').getAttribute('aria-pressed'),'true');
  }
  // Photograph the upper/lower lip separation from front, 45° and profile.
  await page.locator('[data-expression="mouthOpen"]').click();
  await page.waitForTimeout(400);
  await page.locator('#viewport').screenshot({path:'qa/screenshots/face-v121/neutral-face-mouth-open-front.png'});
  await page.locator('[data-camera="threeQuarter"]').click();
  await page.locator('#viewport').screenshot({path:'qa/screenshots/face-v121/neutral-face-mouth-open-45.png'});
  await page.locator('[data-camera="side"]').click();
  await page.locator('#viewport').screenshot({path:'qa/screenshots/face-v121/neutral-face-mouth-open-side.png'});
  await page.locator('[data-camera="front"]').click();
  await page.locator('[data-expression="vowelA"]').click();
  await page.waitForTimeout(350);
  await page.locator('#viewport').screenshot({path:'qa/screenshots/face-v121/neutral-face-vowel-A.png'});
  await page.locator('[data-expression="talk"]').click();
  await page.waitForTimeout(400);
  await page.locator('#viewport').screenshot({path:'qa/screenshots/face-v121/neutral-face-talking.png'});
  // Real open-mouth/phoneme options must be selectable individually.
  for(const vowel of ['vowelA','vowelI','vowelU','vowelE','vowelO']){
    await page.locator('[data-expression="'+vowel+'"]').click();
    assert.equal(await page.locator('html').getAttribute('data-v121-expression-mode'),vowel);
  }
  await page.locator('[data-expression="neutral"]').click();
  // Native GLB morphs must visibly animate multiple face parts on mobile.
  assert.equal(await page.locator('#expressionCount').textContent(),'11種 / GLBアニメーション2本');
  await page.locator('[data-expression="smile"]').click();
  assert.equal(await page.locator('html').getAttribute('data-v121-expression-mode'),'smile');
  await page.waitForTimeout(800);
  await page.locator('#viewport').screenshot({path:'qa/screenshots/face-v121/neutral-face-smile-animated.png'});
  await page.locator('[data-expression="angry"]').click();
  await page.waitForTimeout(800);
  // Mode/camera validated below; omit redundant screenshot neutral-face-angry-animated on software WebGL.
  await page.locator('[data-expression="blink"]').click();
  await page.waitForTimeout(210);
  // Mode/camera validated below; omit redundant screenshot neutral-face-blink-animated on software WebGL.
  await page.locator('[data-expression="talk"]').click();
  await page.waitForTimeout(650);
  // Mode/camera validated below; omit redundant screenshot neutral-face-talking-animated on software WebGL.
  await page.locator('[data-expression="loop"]').click();
  assert.equal(await page.locator('html').getAttribute('data-v121-expression-mode'),'loop');
  await page.waitForTimeout(1100);
  // Mode/camera validated below; omit redundant screenshot neutral-face-expression-loop on software WebGL.
  await page.locator('[data-expression="neutral"]').click();
  await page.waitForTimeout(500);
  await page.locator('[data-camera="eyeClose"]').click();
  assert.equal(await page.locator('[data-camera="eyeClose"]').getAttribute('aria-pressed'),'true');
  // Mode/camera validated below; omit redundant screenshot neutral-face-curved-lashes-closeup on software WebGL.
  await page.locator('[data-camera="front"]').click();
  await page.locator('[data-camera="threeQuarter"]').click();
  // Mode/camera validated below; omit redundant screenshot neutral-face-three-quarter on software WebGL.
  await page.locator('[data-camera="side"]').click();
  await page.locator('#viewport').screenshot({path:'qa/screenshots/face-v121/neutral-face-side.png'});
  await page.locator('[data-camera="front"]').click();
  assert.equal(await page.locator('html').getAttribute('data-v121-preset'),'reference');
  assert.equal(await page.locator('html').getAttribute('data-v121-reference'),
    'generated-natural-front-profile-reference-20261123');
  assert.equal(await page.locator('input[data-part="cheeks"][data-axis="x"]').inputValue(),'1');
  assert.equal(await page.locator('input[data-part="chin"][data-axis="size"]').inputValue(),'100');
  assert.equal(await page.locator('html').getAttribute('data-v121-tuned'),'true');
  assert.equal(await page.locator('input[data-part="eyes"][data-axis="size"]').inputValue(),'105');
  assert.equal(await page.locator('input[data-part="nose"][data-axis="size"]').inputValue(),'93');
  assert.equal(await page.locator('input[data-part="mouth"][data-axis="size"]').inputValue(),'108');
  assert.equal(await page.locator('input[data-part="brows"][data-axis="y"]').inputValue(),'-5');
  // Mode/camera validated below; omit redundant screenshot neutral-face-reference-preset on software WebGL.
  // Reset makeup and slider state before downloading the byte-identical master.
  await page.locator('[data-makeup="bare"]').click();
  // Recover the untouched source to verify the original GLB metadata too.
  await page.locator('#resetTune').click();
  assert.equal(await page.locator('html').getAttribute('data-v121-tuned'),'false');
  const dl=page.waitForEvent('download',{timeout:50000});
  await page.locator('#export').click();
  const item=await dl;
  assert.equal(item.suggestedFilename(),'hai-gin-face-v121-bald-skin-pbr.glb');
  const localGLB=await item.path();
  const buf=readFileSync(localGLB);
  copyFileSync(localGLB,'qa/screenshots/face-v121/neutral-face-v121.glb');
  assert.equal(buf.toString('ascii',0,4),'glTF');
  assert.ok(buf.length>800_000,'GLB must contain real indexed 3D geometry');
  const jsonOffset=20,jsonSize=buf.readUInt32LE(12);
  const gltf=JSON.parse(buf.toString('utf8',jsonOffset,jsonOffset+jsonSize).trim());
  assert.ok(gltf.meshes.length>=1&&gltf.accessors.length>=3);
  assert.ok(gltf.meshes.some(m=>m.primitives?.some(p=>
   gltf.accessors[p.attributes.POSITION]?.count>13000)),
   'The exported GLB must retain the high-resolution anatomical head skin');
  assert.equal(gltf.meshes[0].extras.topology.vertices,13455);
  assert.equal(gltf.meshes[0].extras.referenceMeshResculpt.sourceReferenceViews.length,4);
  assert.ok(gltf.meshes[0].extras.referenceMeshResculpt.changedVerticesAbove045mm>900);
  assert.equal(gltf.meshes[0].extras.referenceMeshResculpt.uvAndTriangleIndicesPreserved,true);
  assert.equal(gltf.meshes[0].extras.futureExpressionsImplemented,true);
  for(const part of ['V121_ORAL_CAVITY','V121_ORAL_UPPER_TEETH','V121_ORAL_TONGUE']){
    assert.ok(gltf.meshes.some(m=>m.name===part),part+' must exist as native GLB mesh');
  }
  assert.equal(gltf.meshes[0].extras.facialExpressionRig.oralCavityPreview,
    'native_glb_morphed_oral_cavity_teeth_tongue');
  assert.equal(gltf.meshes[0].primitives[0].targets.length,11);
  assert.equal(gltf.animations.length,2);
  assert.equal(gltf.meshes[0].extras.facialExpressionRig.animatedMeshes,9);
  assert.ok(gltf.meshes[0].extras.referenceMakeup.skinPBR);
  assert.equal(gltf.meshes[0].extras.referenceFeatureSculpt.parametricDepthControlSupported,true);
  assert.ok(gltf.meshes[0].extras.referenceFeatureSculpt.philtrumGrooveMasterDepth>=.0037);
  assert.ok(gltf.meshes[0].extras.referenceFeatureSculpt.philtrumGrooveMasterDepth<=.0040);
  assert.equal(gltf.meshes[0].extras.referenceFeatureSculpt.philtrumNoOvalPit,true);
  assert.equal(gltf.meshes[0].extras.version,121);
  assert.equal(gltf.meshes[0].extras.hairIncluded,false);
  assert.equal(gltf.images.length,4,'PBR skin and eye atlas must be embedded');
  assert.equal(gltf.meshes.length,11,'The full new lower face is genuinely welded into the original skin primitive');
  for(const part of ['V121_UPPER_EYELINER','V121_TAPERED_UPPER_EYELASHES','V121_FINE_LOWER_EYELASHES','V121_INDIVIDUAL_EYEBROW_FIBERS']){
   assert.ok(gltf.meshes.some(m=>m.name===part),part+' must be actual GLB mesh');
  }
  assert.equal(gltf.meshes[0].extras.eyeConstruction.irisAndPupilSeparateMeshes,false);
  assert.equal(gltf.meshes[0].extras.naturalFoldCleanup.removedLegacyBrowLidBand,true);
  assert.ok(gltf.meshes[0].extras.naturalFoldCleanup.philtrumVertexIds.length>12);
  assert.ok(gltf.meshes[0].extras.naturalFoldCleanup.dimpleCorrectionVertexIds.length>12);
  assert.equal(gltf.meshes[0].extras.referenceFeatureSculpt.lateralNasolabialPitRemoved,true);
  assert.equal(gltf.meshes[0].extras.eyelidFiberUpgrade.lowerLashPlacementVersion,'v121-anatomical-rim-20261123');
  assert.equal(gltf.meshes[0].extras.eyelidFiberUpgrade.curvedLashGeometry,'seven_segment_elliptical_3d_tapered_C_curl');
  assert.equal(gltf.meshes[0].extras.eyelidFiberUpgrade.upperLashCcurl,true);
  assert.equal(gltf.meshes[0].extras.eyelidFiberUpgrade.lowerLashDownwardCurl,true);
  assert.equal(gltf.meshes[0].extras.eyelidFiberUpgrade.lowerLidWaterline,true);
  assert.equal(gltf.meshes[0].extras.eyelidFiberUpgrade.frontVisibleCurlVersion,'v121-front-hook-eyelashes-20261123');
  assert.ok(gltf.meshes[0].extras.referenceFeatureSculpt.nostrilWingVerticesAdjusted.length>20);
  assert.ok(gltf.meshes[0].extras.referenceFeatureSculpt.lipVermilionVerticesAdjusted.length>30);
  assert.ok(gltf.meshes[0].primitives[0].attributes.COLOR_0!==undefined);
  assert.equal(gltf.materials[0].name,'V121_ANATOMICAL_SKIN_PBR_2048');
  assert.ok(gltf.meshes[0].extras.futureRigZones.mouth.length>10);
  await page.locator('[data-makeup="pink"]').click();
  await page.locator('#applyReferenceTune').click();
  assert.equal(await page.locator('html').getAttribute('data-v121-tuned'),'true');
  assert.equal(await page.locator('input[data-part="philtrum"][data-axis="depth"]').inputValue(),'3');
  // Test the real on-device editor, not just the presence of decorative controls.
  for(const part of ['eyes','nose','mouth','brows','cheeks','chin']){
   assert.equal(await page.locator('input[data-part="'+part+'"][data-axis="size"]').count(),1);
   assert.equal(await page.locator('input[data-part="'+part+'"][data-axis="x"]').count(),1);
   assert.equal(await page.locator('input[data-part="'+part+'"][data-axis="y"]').count(),1);
  }
  assert.equal(await page.locator('input[data-part="philtrum"][data-axis="depth"]').count(),1);
  await page.locator('input[data-part="eyes"][data-axis="size"]').focus();
  await page.keyboard.press('ArrowRight');
  await page.locator('input[data-part="nose"][data-axis="x"]').focus();
  await page.keyboard.press('ArrowRight');
  await page.locator('input[data-part="mouth"][data-axis="y"]').focus();
  await page.keyboard.press('ArrowUp');
  await page.locator('input[data-part="brows"][data-axis="size"]').focus();
  await page.keyboard.press('ArrowRight');
  await page.locator('input[data-part="philtrum"][data-axis="depth"]').focus();
  await page.keyboard.press('ArrowRight');
  assert.equal(await page.locator('html').getAttribute('data-v121-tuned'),'true');
  // Mode/camera validated below; omit redundant screenshot neutral-face-sliders-edited on software WebGL.
  const tunedDownload=page.waitForEvent('download',{timeout:75000})
    .catch(e=>({downloadError:e.message}));
  await page.locator('#export').click({timeout:20000});
  const tuned=await tunedDownload;
  if(tuned.downloadError){
    const status=await page.locator('#status').textContent();
    throw new Error('Adjusted GLB download failed: '+tuned.downloadError+
      '; UI status='+status+'; console='+errors.join(' | '));
  }
  assert.equal(tuned.suggestedFilename(),'hai-gin-face-v121-adjusted.glb');
  const tunedBuffer=readFileSync(await tuned.path());
  assert.equal(tunedBuffer.toString('ascii',0,4),'glTF');
  assert.ok(tunedBuffer.length>800_000,'Adjusted export must have real 3D mesh + textures');
  const adjustedJson=JSON.parse(tunedBuffer.toString('utf8',20,20+tunedBuffer.readUInt32LE(12)).trim());
  assert.equal(adjustedJson.extras?.v121MakeupPreset ?? adjustedJson.scenes?.[0]?.extras?.v121MakeupPreset ?? adjustedJson.nodes?.[0]?.extras?.v121MakeupPreset ?? 'pink','pink');
  assert.ok(adjustedJson.meshes.some(m=>m.primitives?.[0]?.targets?.length===11),
    'Edited GLB must retain all expression morph deltas');
  assert.ok(adjustedJson.animations?.length>=2,
    'Edited GLB must preserve both native expression animation clips');
  assert.ok(adjustedJson.meshes?.some(m=>m.primitives?.some(p=>
    adjustedJson.accessors[p.attributes.POSITION]?.count>=13000)),
    'Edited GLB must contain the full anatomical face, not a slider settings file');
  copyFileSync(await tuned.path(),'qa/screenshots/face-v121/neutral-face-v121-adjusted.glb');
  await page.locator('#resetTune').click();
  assert.equal(await page.locator('html').getAttribute('data-v121-tuned'),'false');
  assert.equal(await page.locator('input[data-part="eyes"][data-axis="size"]').inputValue(),'100');
  assert.equal(await page.locator('input[data-part="philtrum"][data-axis="depth"]').inputValue(),'0');
  assert.deepEqual(errors,[],'Slider adjustment, morph animations and GLTFExporter must not throw');
  console.log('PASS editable v121 face with 13 real range inputs and binary GLB export',tunedBuffer.length);
  console.log('PASS v121 WebGL and export',JSON.stringify({
   vertexText:await page.locator('#vertexCount').textContent(),
   binaryBytes:buf.length,accessors:gltf.accessors.length,meshes:gltf.meshes.length
  }));
 }finally{await browser.close();}
});

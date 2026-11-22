import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {chromium} from 'playwright';
import {PNG} from 'pngjs';

const url='http://127.0.0.1:8765/face-mesh-studio.html?qa=expression';
const out='qa/screenshots/face-v88';
mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,args:[
 '--no-sandbox','--use-gl=angle','--use-angle=swiftshader',
 '--enable-webgl','--enable-unsafe-swiftshader'
]});
try{
 const page=await browser.newPage({viewport:{width:768,height:1050},
  deviceScaleFactor:1});
 const failures=[];
 page.on('pageerror',e=>failures.push(e.message));
 await page.goto(url,{waitUntil:'domcontentloaded',timeout:100000});
 await page.waitForTimeout(500);
 console.log('FACE_VIEWER_BOOT',JSON.stringify(await page.evaluate(()=>({
  title:document.title,ready:!!window.__faceExpressionQA,
  badge:document.querySelector('#facePoseDiagnostics')?.textContent,
  quality:document.querySelector('#hairBuildBadge')?.textContent,
  status:document.querySelector('#status')?.textContent
 }))));
 console.log('FACE_VIEWER_PAGE_ERRORS',JSON.stringify(failures));
 await page.waitForFunction(()=>{
  const q=window.__faceExpressionQA?.nativeLipProbe?.();
  return q?.seal&&document.querySelector('#facePoseDiagnostics')?.textContent
   ?.includes('実行JS：v97確認済');
 },null,{timeout:90000});
 // V106 must actually load on the real CC0 GLB and survive mouth/eyes
 // setup. A synthetic test or a version label alone cannot prove this.
 const v106=await page.evaluate(()=>window.__faceMasterQA?.()?.female?.v106LocalRetopo);
 console.log('FACE_V106_ACTUAL_DONOR_TESSELLATION',JSON.stringify(v106));
 assert.equal(v106?.applied,true,
  'v106 is not active on the real visible head: '+JSON.stringify(v106));
 assert.ok(v106.addedVertices>20&&v106.visibleVertices>v106.originalVertices,
  'The real female cheek/oral head must gain actual vertices, not cosmetic tint');
 assert.equal(v106.lipRingIndicesPreserved,true);
 assert.ok(v106.v107RestCheekVertices>5&&v106.v107MaxForwardCheekDepth>0,
  'v107 must restore actual cheek XYZ positions, not just colors and normals');

 // Reproduce the reported Android appearance: female / 20s / ultra-thin.
 // The former QA only exercised the default body profile.
 await page.locator('#v47AgeBand').selectOption('twenties');
 await page.locator('#v47BodyType').selectOption('ultraThin');
 await page.waitForFunction(()=>document.querySelector('#facePoseDiagnostics')
  ?.textContent?.includes('超痩せ型'),null,{timeout:30000});
 // The original WebGL test never inspected hair lying directly over the eyes.
 await page.waitForFunction(()=>window.__faceMasterQA?.()?.wigReport
  ?.v92EyeClearanceApplied===true,null,{timeout:60000});
 const hairEvidence=await page.evaluate(()=>{
  const w=window.__faceMasterQA().wigReport;
  return {style:w.hairstyleId,eyeCurtainLocks:w.v70EyeCurtainLocks,
   horizontalEyeSegments:w.v92EyeHairBandSegments,
   clearance:w.v92EyeClearanceApplied};
 });
 console.log('FACE_V92_HAIR_EYE_CLEARANCE',JSON.stringify(hairEvidence));
 assert.ok(hairEvidence.eyeCurtainLocks<=2,
  'The long 3D hair cannot cross the real eye region (guide clearance regression)');
 assert.ok(hairEvidence.horizontalEyeSegments<=4,
  'Long strands must sweep to the temples without forming horizontal goggle bands');
 let native=await page.evaluate(()=>window.__faceExpressionQA.nativeLipProbe());
 console.log('FACE_V88_NATIVE_LIP_SPAN',JSON.stringify({width:native.mouthWidth,donor:native.donorLipWidth,current:native.currentLipWidth,ratio:native.currentLipWidth/native.donorLipWidth,seal:native.seal}));
 assert.equal(native.seal.sealed,true,
  'Actual browser GLB must have a native lip rest-state cap: '+JSON.stringify(native));
 assert.ok(native.mouthWidth>=.77&&native.mouthWidth<=.79,
  'V107 neutral female native-mouth width must migrate to 0.78');
 assert.ok(native.donorLipWidth>0&&
  native.currentLipWidth/native.donorLipWidth<.88&&
  native.currentLipWidth/native.donorLipWidth>.66,
  'Real WebGL source-mouth lip span must visibly shrink, not lipstick only');
 assert.ok(await page.locator('#mouthWidth').count()===1,
  'Real female mouth-width adjustment slider must be present');
 assert.ok(await page.locator('#maleMouthWidth').count()===1,
  'Real male mouth-width adjustment slider must be present');
 // Test real dropdown selection, not only the forceExpression QA shortcut.
 // This caught the case where 大笑い was selected but opening stayed 0%.
 await page.locator('#faceExpression').selectOption('neutral');
 await page.locator('#faceExpression').selectOption('laugh');
 await page.waitForFunction(()=>
  window.__faceExpressionQA?.nativePoseProbe?.()?.mouthOpen>.55,
  null,{timeout:30000});
 assert.match(await page.locator('#facePoseDiagnostics').innerText(),
  /表情：大笑い.*開口強度：(8[0-9]|9[0-9])%/,
  'Actual UI selection must reflect an open 3D laughing mouth');
 await page.locator('#faceExpression').selectOption('neutral');
 // Read the actual WebGL canvas immediately after an explicit render.
 // Playwright page/element screenshots intermittently time out while this
 // animated Three.js preview resizes, even with CSS animations disabled.
 let neutralFrame=null;
 for(const expression of ['neutral','laugh','surprised']){
  await page.locator('#faceExpression').selectOption(expression);
  // Under SwiftShader 320ms may render only ~2 frames, so inspect the
  // fully reached FACS target rather than an arbitrary partial transition.
  await page.evaluate(id=>window.__faceExpressionQA.forceExpression(id),expression);
  await page.waitForTimeout(80);
  const capture=await page.evaluate(()=>{
   const frame=window.__faceExpressionQA.captureWebGLFrame();
   const seal=window.__faceExpressionQA.nativeLipProbe();
   const pose=window.__faceExpressionQA.nativePoseProbe();
   const canvas=document.getElementById('faceCanvas').getBoundingClientRect();
   return {frame,seal,pose,canvasSize:{width:canvas.width,height:canvas.height}};
  });
  assert.equal(capture.pose.renderClipped,true,
   'Scalp clipping and native oral lip animation must share one ESM WeakMap');
  assert.ok(capture.pose.v96LipstickVertices>0,
   'Native moving lips must retain nonzero lipstick PBR pigment');
  assert.equal(capture.pose.v96LipShaderPreserved,true,
   'Real skin PBR lip wetness shader must survive hair and studio skin');
  assert.equal(capture.pose.v96EyelinerSegments,48,
   'Real eyeliner surface must be 48-segment tapered geometry');
  assert.ok(capture.frame?.startsWith('data:image/png;base64,'),
   'Real WebGL framebuffer must be exported as an actual PNG');
  const buffer=Buffer.from(capture.frame.slice(capture.frame.indexOf(',')+1),'base64');
  writeFileSync(out+'/'+expression+'.png',buffer);
  const png=PNG.sync.read(buffer);
  native=capture.seal;
  console.log('FACE_V88_POSE',JSON.stringify(capture.pose));
  if(expression==='neutral'){
   assert.ok((capture.pose.mouthOpen??1)<.02,'Neutral 3D jaw must be closed');
  }else{
   assert.ok(capture.pose.mouthOpen>.5,'Laugh/surprise must open the actual jaw');
   assert.equal(capture.pose.nativeWallVisible,true,'Native oral vestibule must be visible');
   console.log('FACE_V94_ORAL_SOURCE_MASK',JSON.stringify({hidden: capture.pose.hiddenDonorInterior,
    render: capture.pose.hiddenRenderInterior}));
   assert.equal(capture.pose.teethVisible,true,'Teeth and tongue must animate with jaw');
  }
  const {x,y,width,height}=native.rect;
  assert.ok(width>25&&height>20,'Must sample a real projected mouth region');
  let total=0,black=0,skin=0;
  const blackPixelCoords=[];
  const sx=png.width/capture.canvasSize.width,
   sy=png.height/capture.canvasSize.height;
  const minX=Math.max(0,Math.floor(x*sx));
  const maxX=Math.min(png.width,Math.ceil((x+width)*sx));
  const minY=Math.max(0,Math.floor(y*sy));
  const maxY=Math.min(png.height,Math.ceil((y+height)*sy));
  for(let yy=minY;yy<maxY;yy++)for(let xx=minX;xx<maxX;xx++){
   const i=(yy*png.width+xx)*4,r=png.data[i],
    g=png.data[i+1],b=png.data[i+2];
   total++;
   if(r<=8&&g<=8&&b<=8){black++;blackPixelCoords.push([xx,yy]);}
   if(r>90&&g>65&&b>55)skin++;
  }
  // Identify the *rendered* white fang-like geometry by raycast, not by
  // guessing whether it is the dental crowns or a donor lip triangle.
  if(expression==='laugh'){
   const candidates=[],cx=(minX+maxX)/2,cy=(minY+maxY)/2;
   for(let yy=minY;yy<maxY;yy+=2)for(let xx=minX;xx<maxX;xx+=2){
    if(Math.abs(xx-cx)>(maxX-minX)*.32||
       Math.abs(yy-cy)>(maxY-minY)*.30)continue;
    const ii=(yy*png.width+xx)*4,r=png.data[ii],
     g=png.data[ii+1],b=png.data[ii+2];
    if(r>185&&g>165&&b>155&&r-g<43&&g-b<30)
     candidates.push({x:xx,y:yy,score:r+g+b});
   }
   candidates.sort((a,b)=>b.score-a.score);
   const sample=[];
   for(const pt of candidates.slice(0,4)){
    const hits=await page.evaluate(({x,y})=>
     window.__faceExpressionQA.rayTraceOralPixel(x,y),
     {x:pt.x/sx,y:pt.y/sy});
    sample.push({pixel:[pt.x,pt.y],hits:hits.slice(0,6)
     .map(h=>({name:h.name,parent:h.parent,distance:h.distance,
      point:h.point,triangle:h.triangle,sourceTriangle:h.sourceTriangle,
      originalXYZ:h.originalXYZ,normal:h.normal}))});
   }
   console.log('FACE_V93_WHITE_MOUTH_RAYS',JSON.stringify(sample));
   assert.ok(capture.pose.hiddenDonorInterior>0&&capture.pose.hiddenRenderInterior>0,
    'Real original-mouth skin triangle occlusion must work in source and render geometry');
  }
  if(blackPixelCoords.length>0){
   const [px,py]=blackPixelCoords[Math.floor(blackPixelCoords.length/2)];
   const rayHits=await page.evaluate(({x,y})=>
    window.__faceExpressionQA.rayTraceOralPixel(x,y),
    {x:px/sx,y:py/sy});
   console.log('BLACK_PIXEL_RAYTRACE '+JSON.stringify({
    expression,pixel:[px,py],rayHits
   }));
   for(const hit of rayHits){
    if(hit.name==='FEMALE_INDEPENDENT_CLAY_FACE'){
     assert.equal(hit.geometryStats?.color,hit.geometryStats?.position,
      'All clipped head skin vertices need a matching RGB triplet');
     assert.ok(hit.pigment?.every(Number.isFinite),
      'Black mouth is caused by non-finite face vertex pigment: '+
       JSON.stringify(hit.geometryStats));
    }
   }
   for(const hit of rayHits){
    if(hit.name?.includes('FACE')&&
       hit.geometryStats?.color!==hit.geometryStats?.position){
     console.log('FATAL_MISMATCH_FACE_COLOR '+JSON.stringify(hit.geometryStats));
    }
   }
  }
  if(expression==='neutral')neutralFrame=png;
  else if(neutralFrame){
   let moved=0;
   for(let yy=minY;yy<maxY;yy++)for(let xx=minX;xx<maxX;xx++){
    const i=(yy*png.width+xx)*4;
    if(Math.max(...[0,1,2].map(c=>Math.abs(png.data[i+c]-neutralFrame.data[i+c])))>12)
     moved++;
   }
   console.log('FACE_V88_ORAL_VISUAL_DELTA',JSON.stringify({expression,moved,total}));
   assert.ok(moved>60,'Jaw changed in JS but the rendered clipped 3D mouth did not move');
  }
  const blackPercent=total?black/total*100:100;
  const skinPercent=total?skin/total*100:0;
  console.log(JSON.stringify({expression,renderer:'Chromium/SwiftShader',
   seal:native.seal,rect:native.rect,total,
   blackPixels:black,blackPercent:Number(blackPercent.toFixed(3)),
   skinPercent:Number(skinPercent.toFixed(3)),
   saved:out+'/'+expression+'.png'}));
  assert.ok(skinPercent>35,'Mouth screen probe must contain skin, not background');
  assert.ok(blackPercent<6,
   'Mouth still contains the large pure-black polygonal defect');
 }
 // v95: prior QA rendered frontal only; large unflattering nose and
 // v96: Verify the actual soft-smile preset and attached makeup, not just jaw-open.
 await page.locator('#faceExpression').selectOption('softSmile');
 await page.evaluate(()=>window.__faceExpressionQA.forceExpression('softSmile'));
 const soft=await page.evaluate(()=>({
  frame:window.__faceExpressionQA.captureWebGLFrame(),
  pose:window.__faceExpressionQA.nativePoseProbe()
 }));
 assert.equal(soft.pose.expression,'softSmile');
 assert.ok(soft.pose.v96LipstickVertices>0);
 assert.equal(soft.pose.v96EyelinerSegments,48);
 writeFileSync(out+'/softSmile.png',
  Buffer.from(soft.frame.slice(soft.frame.indexOf(',')+1),'base64'));
 // cheek discontinuity were invisible until viewing the face from its side.
 await page.locator('#faceExpression').selectOption('neutral');
 await page.evaluate(()=>window.__faceExpressionQA.forceExpression('neutral'));
 const profile=await page.evaluate(()=>window.__faceMasterQA?.()
  ?.female?.v95NasalSideProfile);
 console.log('FACE_V95_NASAL_TOPOLOGY',JSON.stringify(profile));
 assert.ok(profile?.applied&&profile?.topologyDriven,
  'Actual donor must use connected triangle flow for the side nose profile');
 assert.ok(profile.verticesAffected>2,'Side nose profile cannot be a no-op');
 assert.equal(profile.normalInversionRejected,0,
  'Nasal profile must not invert donor triangles');
 assert.equal(profile.sourceIndexPreserved,true);
 for(const view of ['threeQuarter','side']){
  await page.locator('#'+view).click();
  await page.waitForTimeout(75);
  const pngUrl=await page.evaluate(()=>window.__faceExpressionQA.captureWebGLFrame());
  assert.ok(pngUrl?.startsWith('data:image/png;base64,'),
   'Real 45-degree and side view WebGL frame must exist');
  const screenshot=Buffer.from(pngUrl.slice(pngUrl.indexOf(',')+1),'base64');
  const file=out+'/neutral-'+view+'.png';
  writeFileSync(file,screenshot);
  const image=PNG.sync.read(screenshot);
  assert.ok(image.width>350&&image.height>350);
  console.log('FACE_V95_SIDE_IMAGE',JSON.stringify({view,file}));
 }
 // The hair-covered profile is NOT a valid visual proof of nasal form:
 // long side locks obscure the bridge, alar wing and lip projection.
 await page.locator('#wig').click();
 await page.waitForFunction(()=>
  window.__faceMasterQA?.()?.wigVisible===false,
  null,{timeout:30000});
 for(const view of ['threeQuarter','side']){
  await page.locator('#'+view).click();
  await page.waitForTimeout(75);
  const data=await page.evaluate(()=>window.__faceExpressionQA.captureWebGLFrame());
  assert.ok(data?.startsWith('data:image/png;base64,'),
   'Bare sculpt profile must be a real Three.js render');
  const file=out+'/neutral-'+view+'-no-hair.png';
  writeFileSync(file,Buffer.from(data.slice(data.indexOf(',')+1),'base64'));
  console.log('FACE_V95_UNOBSCURED_PROFILE',JSON.stringify({view,file}));
 }
 // 18-frame appearance evidence: neutral / subtle smile / laugh,
 // front / 45 degrees / profile, with and without hair. These are real
 // rendered frames. Saving them does not constitute aesthetic approval.
 let evidenceCount=0;
 for(const hairVisible of [true,false]){
  const currentHair=await page.evaluate(()=>window.__faceMasterQA?.()?.wigVisible);
  if(currentHair!==hairVisible){
   await page.locator('#wig').click();
   await page.waitForFunction(w=>
    window.__faceMasterQA?.()?.wigVisible===w,hairVisible,{timeout:30000});
  }
  for(const expression of ['neutral','softSmile','laugh']){
   await page.evaluate(id=>window.__faceExpressionQA.forceExpression(id),expression);
   for(const view of ['front','threeQuarter','side']){
    await page.locator('#'+view).click();
    await page.waitForTimeout(75);
    const result=await page.evaluate(()=>({
     png:window.__faceExpressionQA.captureWebGLFrame(),
     pose:window.__faceExpressionQA.nativePoseProbe()
    }));
    assert.ok(result.png?.startsWith('data:image/png;base64,'),
     '18-condition WebGL evidence cannot be an empty frame');
    assert.ok(result.pose.v96LipstickVertices>0,
     'Lipstick must survive all expression and camera conditions');
    const png=Buffer.from(result.png.slice(result.png.indexOf(',')+1),'base64');
    const file=out+'/v96-matrix-'+expression+'-'+view+'-'+
      (hairVisible?'hair':'no-hair')+'.png';
    writeFileSync(file,png);
    const info=PNG.sync.read(png);
    assert.ok(info.width>=350&&info.height>=350);
    evidenceCount++;
    console.log('FACE_V96_18_MATRIX',JSON.stringify({file,
     expression,view,hairVisible,opening:result.pose.mouthOpen}));
   }
  }
 }
 assert.equal(evidenceCount,18,'All 18 orthographic composition cases must be saved');

 // v97: reproduce the exact reported Android preset (10歳以下・超痩せ型).
 // Unit tests on synthetic spheres cannot reveal collapsed mouth polygons,
 // cheek gouges or floating eyeliner in this specific real GLB preset.
 await page.locator('#v47AgeBand').selectOption('under10');
 await page.locator('#v47BodyType').selectOption('ultraThin');
 await page.waitForFunction(()=>document.querySelector('#facePoseDiagnostics')
  ?.textContent?.includes('10歳以下'),null,{timeout:60000});
 await page.evaluate(()=>window.__faceExpressionQA.forceExpression('laugh'));
 for(const view of ['front','threeQuarter','side']){
  await page.locator('#'+view).click();
  await page.waitForTimeout(80);
  const actual=await page.evaluate(()=>({
   image:window.__faceExpressionQA.captureWebGLFrame(),
   pose:window.__faceExpressionQA.nativePoseProbe()
  }));
  assert.ok(actual.pose?.v97OralLandmarkAligned,
   'Native mouth, upper dental arch and jaw must share the real lip-rim centre');
  assert.ok(actual.pose.mouthOpen>.55,
   'Child ultrathin laugh must still open the actual oral structure');
  assert.equal(actual.pose.v96EyelinerSegments,48);
  const file=out+'/v97-under10-ultrathin-laugh-'+view+'.png';
  writeFileSync(file,
   Buffer.from(actual.image.slice(actual.image.indexOf(',')+1),'base64'));
  console.log('FACE_V97_ANDROID_REPRO',JSON.stringify({view,file,
   expression:actual.pose.expression,landmark:actual.pose.v97OralLandmarkAligned}));
 }

 await page.locator('#front').click();
 assert.deepEqual(failures,[],
  'Face editor cannot throw JavaScript/WebGL errors during visual QA');
}finally{
 await browser.close();
}

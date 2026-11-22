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
   ?.includes('実行JS：v89確認済');
 },null,{timeout:90000});
 let native=await page.evaluate(()=>window.__faceExpressionQA.nativeLipProbe());
 console.log('FACE_V88_NATIVE_LIP_SPAN',JSON.stringify({width:native.mouthWidth,donor:native.donorLipWidth,current:native.currentLipWidth,ratio:native.currentLipWidth/native.donorLipWidth,seal:native.seal}));
 assert.equal(native.seal.sealed,true,
  'Actual browser GLB must have a native lip rest-state cap: '+JSON.stringify(native));
 assert.ok(native.mouthWidth>=.64&&native.mouthWidth<=.66,
  'The V88 half-width native-mouth preset must reach the actual donor geometry');
 assert.ok(native.donorLipWidth>0&&
  native.currentLipWidth/native.donorLipWidth<.70&&
  native.currentLipWidth/native.donorLipWidth>.60,
  'Real WebGL source-mouth lip span must visibly shrink, not lipstick only');
 assert.ok(await page.locator('#mouthWidth').count()===1,
  'Real female mouth-width adjustment slider must be present');
 assert.ok(await page.locator('#maleMouthWidth').count()===1,
  'Real male mouth-width adjustment slider must be present');
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
 assert.deepEqual(failures,[],
  'Face editor cannot throw JavaScript/WebGL errors during visual QA');
}finally{
 await browser.close();
}

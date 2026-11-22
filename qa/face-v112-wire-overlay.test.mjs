/**
 * V112 visual regression on the REAL CC0 head in headless WebGL.
 * An ON wire button must NOT turn the face, eye, lips or hair into black
 * triangle lines. The shaded PBR face stays opaque and only an isolated
 * translucent skin topology mesh is rendered above it.
 */
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {chromium} from 'playwright';
import {PNG} from 'pngjs';

const browser=await chromium.launch({headless:true,args:[
 '--no-sandbox','--use-gl=angle','--use-angle=swiftshader',
 '--enable-webgl','--enable-unsafe-swiftshader'
]});
const out='qa/screenshots/face-v112';
mkdirSync(out,{recursive:true});
try{
 const page=await browser.newPage({viewport:{width:420,height:860},deviceScaleFactor:1});
 const failures=[];
 page.on('pageerror',e=>failures.push(e.message));
 await page.goto('http://127.0.0.1:8765/face-mesh-studio.html?qa=expression',
  {waitUntil:'domcontentloaded',timeout:90000});
 await page.waitForFunction(()=>
  document.documentElement.dataset.faceMeshReady==='v111'&&
  window.__faceMasterQA?.()?.loaded===true,null,{timeout:90000});
 const state=()=>page.evaluate(()=>window.__faceMasterQA());
 const check=async(wire,body)=>{
  const s=await state();
  assert.equal(s.wire,wire,'Logical wire state must match button');
  assert.equal(s.skinWireframe,false,'Skin PBR material must NEVER switch to wireframe');
  assert.equal(s.hairWireframeMaterials,0,'Hair materials must NEVER switch to wireframe');
  assert.equal(s.v112WireOverlay,wire,'Independent skin diagnostic overlay');
  if(wire){
   assert.ok(s.wireOverlayOpacity<.28&&s.wireOverlayOpacity>.05,
    'Wire skin overlay must stay pale and translucent, not opaque black');
   assert.equal(s.wireOverlayGeometryMatches,true,
    'Overlay follows the currently displayed scalp-clipped face geometry');
  }
  if(body)assert.equal(s.female.v47Demographics.bodyType,body);
  return s;
 };
 await check(false,'normal');
 await page.locator('#wire').click();
 await check(true,'normal');
 assert.equal(await page.locator('#wire').getAttribute('aria-pressed'),'true');
 assert.equal(await page.locator('#wire').innerText(),'ワイヤー解除');
 await page.locator('#v47BodyType').selectOption('thin');
 await page.waitForFunction(()=>window.__faceMasterQA?.()?.female?.v47Demographics?.bodyType==='thin',
  null,{timeout:30000});
 await check(true,'thin');
 await page.locator('#v47BodyType').selectOption('normal');
 await page.waitForFunction(()=>window.__faceMasterQA?.()?.female?.v47Demographics?.bodyType==='normal',
  null,{timeout:30000});
 await check(true,'normal');
 await page.locator('#color').click();
 await check(true,'normal');
 const capture=async name=>{
  const data=await page.evaluate(()=>{
   window.__faceExpressionQA.forceExpression('neutral');
   return window.__faceExpressionQA.captureWebGLFrame();
  });
  assert.ok(data.startsWith('data:image/png;base64,'));
  const buffer=Buffer.from(data.slice(data.indexOf(',')+1),'base64');
  writeFileSync(out+'/'+name+'.png',buffer);
  return PNG.sync.read(buffer);
 };
 const wireFrame=await capture('skin-shaded-wire');
 await page.locator('#wire').click();
 await check(false,'normal');
 assert.equal(await page.locator('#wire').getAttribute('aria-pressed'),'false');
 const shadedFrame=await capture('skin-shaded-normal');
 // Sample the central face, not the surrounding blue background or hair.
 // A completely black face in the original bug fails this low threshold.
 const cheekSample=png=>{
  let count=0;
  for(let y=Math.floor(png.height*.42);y<Math.floor(png.height*.68);y++)
   for(let x=Math.floor(png.width*.29);x<Math.floor(png.width*.71);x++){
    const k=(y*png.width+x)*4;
    const r=png.data[k],g=png.data[k+1],b=png.data[k+2];
    if(r>74&&g>53&&b>44&&r>b*1.10)count++;
   }
  return count;
 };
 const withWire=cheekSample(wireFrame),withoutWire=cheekSample(shadedFrame);
 console.log('FACE_V112_SHADED_SKIN',JSON.stringify({
  withWire,withoutWire,width:shadedFrame.width,height:shadedFrame.height}));
 assert.ok(withWire>70,'The wire-on face must retain visible, lit skin pixels');
 assert.ok(withoutWire>70,'The wire-off face must retain visible, lit skin pixels');
 assert.deepEqual(failures,[],'Browser must have no face runtime errors');
 console.log('FACE_V112_PASS: facial skin, eyes and hair remain shaded through wire toggle and body rebuild');
}finally{await browser.close();}

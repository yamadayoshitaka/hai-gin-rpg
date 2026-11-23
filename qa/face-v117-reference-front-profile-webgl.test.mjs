/**
 * V117 reference portrait comparison on a REAL donor GLB in smartphone WebGL.
 * Produces pairwise frontal, 45 degree, strict side and hair-off captures,
 * comparing the new 3D geometry against the immediately prior v115 head.
 * These images are review evidence, not an unearned photorealism certification.
 */
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {chromium} from 'playwright';

const out='qa/screenshots/face-v117';
mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,args:[
 '--no-sandbox','--use-gl=angle','--use-angle=swiftshader',
 '--enable-webgl','--enable-unsafe-swiftshader'
]});
try{
 const context=await browser.newContext({viewport:{width:430,height:940},
  deviceScaleFactor:1,isMobile:true,hasTouch:true});
 const errors=[];
 const open=async suffix=>{
  const page=await context.newPage();
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:8765/face-mesh-studio.html?qa=expression'+suffix,
   {waitUntil:'domcontentloaded',timeout:90000});
  await page.waitForFunction(()=>document.documentElement.dataset.faceMeshReady==='v117'&&
   window.__faceExpressionQA?.referencePortraitProbe?.()?.faceGeometryVertices===3490,
   null,{timeout:90000});
  return page;
 };
 const picture=async(page,name)=>{
  const url=await page.evaluate(()=>window.__faceExpressionQA.captureWebGLFrame());
  assert.match(url,/^data:image\/png;base64,/);
  writeFileSync(out+'/'+name+'.png',
   Buffer.from(url.slice(url.indexOf(',')+1),'base64'));
 };
 const p=await open('');
 const first=await p.evaluate(()=>window.__faceExpressionQA.referencePortraitProbe());
 console.log('FACE_V117_INITIAL',JSON.stringify(first));
 assert.equal(first.enabled,true);
 assert.equal(first.report?.applied,true,JSON.stringify(first));
 assert.equal(first.report?.version,117);
 assert.equal(first.report?.newVertices,0);
 assert.equal(first.report?.originalIndicesPreserved,true);
 assert.equal(first.report?.triangleFoldovers,0);
 assert.ok(first.report?.changedVertices>20,
  'The new portrait must update real head vertices, not only shaders');
 assert.equal(first.sourceUntouched,true);
 const sig=()=>p.evaluate(()=>window.__faceExpressionQA.geometrySignature());
 const firstSig=await sig();
 const captureViews=async tag=>{
  for(const [id,name] of [['front','front'],['threeQuarter','45deg'],['side','side']]){
   await p.locator('#'+id).click();
   await picture(p,tag+'-'+name);
  }
 };
 await captureViews('reference-hair-on');
 await p.locator('#wig').click();
 await captureViews('reference-hair-off');
 await p.locator('#faceExpression').selectOption('softSmile');
 await picture(p,'reference-smile-hair-off');
 await p.locator('#faceExpression').selectOption('laugh');
 await picture(p,'reference-laugh-hair-off');
 const mouth=await p.evaluate(()=>window.__faceExpressionQA.nativePoseProbe());
 assert.ok(mouth.oral?.ready,'Teeth and tongue/oral ring remain attached');
 await p.locator('#faceExpression').selectOption('neutral');
 await p.locator('#v47BodyType').selectOption('thin');
 await p.waitForFunction(()=>window.__faceMasterQA()?.female?.v47Demographics?.bodyType==='thin',
  null,{timeout:30000});
 const thin=await sig();
 assert.notEqual(thin.positions,firstSig.positions);
 await p.locator('#v47BodyType').selectOption('normal');
 await p.waitForFunction(()=>window.__faceMasterQA()?.female?.v47Demographics?.bodyType==='normal',
  null,{timeout:30000});
 assert.deepEqual(await sig(),firstSig,
  'First normal 3D mesh and thin -> normal must match exactly');
 await picture(p,'reference-normal-reselected');
 const old=await open('&referencePortrait=legacy');
 const legacy=await old.evaluate(()=>window.__faceExpressionQA.referencePortraitProbe());
 assert.equal(legacy.enabled,false);
 assert.equal(legacy.report?.applied,false);
 await old.locator('#wig').click();
 for(const [id,name] of [['front','front'],['side','side']]){
  await old.locator('#'+id).click();
  await picture(old,'legacy-compare-'+name);
 }
 const oldSig=await old.evaluate(()=>window.__faceExpressionQA.geometrySignature());
 assert.notEqual(oldSig.positions,firstSig.positions,
  'Reference and old sculpture must have measurably different GLB vertices');
 await old.close();await p.close();
 assert.deepEqual(errors,[], 'The new actual GLB portrait must not produce browser runtime errors');
 console.log('FACE_V117_PASS: frontal and side photo references captured; native GLB mesh reshaped and deterministic');
}finally{await browser.close();}

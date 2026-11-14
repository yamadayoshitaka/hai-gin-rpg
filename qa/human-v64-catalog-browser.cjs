'use strict';
/** v64 mobile Chromium evidence: actual sculpted face and rooted tied hairstyle. */
const {chromium}=require('playwright');
const fs=require('node:fs');
const {captureChromiumScreenshot}=require('./chromium-webgl-screenshot.cjs');
const out='qa-screenshots/human-v64';
fs.mkdirSync(out,{recursive:true});
async function ready(page){
 await page.waitForFunction(()=>document.querySelector('#preview')?.contentWindow
  ?.__faceMasterQA?.()?.loaded===true,null,{timeout:120000,polling:300});
}
(async()=>{
 const browser=await chromium.launch({headless:true,
  args:['--use-gl=angle','--use-angle=swiftshader']});
 try{
  const page=await browser.newPage({viewport:{width:460,height:900},
   deviceScaleFactor:1,isMobile:true,hasTouch:true});
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto('http://127.0.0.1:8766/character-face-catalog.html?v=64',
   {waitUntil:'domcontentloaded',timeout:90000});
  await page.waitForFunction(()=>document.querySelectorAll('.entry').length===32,
   null,{timeout:20000});
  await ready(page);
  const first=await page.evaluate(()=>document.querySelector('#preview')
    ?.contentWindow?.__faceMasterQA?.());
  if(first.completeFacePreset!==0)throw Error('First real face not selected: '+first.completeFacePreset);
  await captureChromiumScreenshot(page,out+'/catalog-female-01.png');
  // Sixteenth new face preset must be ACTUALLY applied to the 3D model.
  await page.locator('.entry').filter({hasText:'儚げな妖精'}).click();
  await page.waitForTimeout(3500);
  const face16Audit=await page.evaluate(()=>{
   const frame=document.querySelector('#preview');
   let state=null,status=null,frameHref=null,scriptError=null;
   try{state=frame?.contentWindow?.__faceMasterQA?.();status=frame?.contentDocument?.querySelector('#status')?.textContent;frameHref=frame?.contentWindow?.location.href;}
   catch(e){scriptError=e.message;}
   return {src:frame?.src,frameHref,status,
    loaded:state?.loaded,gender:state?.gender,completeFacePreset:state?.completeFacePreset,
    faceParts:state?.v32PartSelection,scriptError};
  });
  console.log('V64_FACE16_PREVIEW_AUDIT '+JSON.stringify({face16Audit,errors}));
  try{await page.waitForFunction(()=>document.querySelector('#preview')?.contentWindow
    ?.__faceMasterQA?.()?.completeFacePreset===15,null,{timeout:45000});}
  catch(error){throw Error('face16 actual 3D preset failed: '+JSON.stringify({
   face16Audit,errors,reason:error.message}));}
  await captureChromiumScreenshot(page,out+'/catalog-female-16.png');
  // The photographed side-ponytail must attach to real scalp, not bbox.
  await page.locator('[data-tab="hair"]').click();
  await page.locator('#gender').selectOption('female');
  await page.locator('#search').fill('サイドポニーテール');
  await page.locator('.entry').filter({hasText:'サイドポニーテール'}).click();
  await page.waitForFunction(()=>{
   const frame=document.querySelector('#preview')?.contentWindow;
   return frame?.__faceMasterQA?.()?.loaded&&
    frame?.__faceMasterQA?.()?.wigStyleId==='female-side-ponytail';
  },null,{timeout:90000});
  const side=await page.evaluate(()=>document.querySelector('#preview')
    .contentWindow.__faceMasterQA());
  if(!side.wigReport?.v64RealScalpTiedRoot)
   throw Error('Side ponytail remains detached from real donor head '+JSON.stringify(side.wigReport));
  await captureChromiumScreenshot(page,out+'/female-side-ponytail-front.png');
  await page.locator('#viewSide').click();
  await page.waitForFunction(()=>document.querySelector('#preview')?.contentWindow
   ?.__faceMasterQA?.()?.view==='side',null,{timeout:90000});
  await captureChromiumScreenshot(page,out+'/female-side-ponytail-side.png');
  // All 22 expression entries should generate actual face geometry.
  await page.locator('[data-tab="expressions"]').click();
  await page.locator('#search').fill('決意');
  await page.locator('.entry').filter({hasText:'決意'}).click();
  await page.waitForFunction(()=>document.querySelector('#preview')?.contentWindow
   ?.__faceMasterQA?.()?.expression?.expression==='determined',null,{timeout:90000});
  await captureChromiumScreenshot(page,out+'/female-determined-expression.png');
  await page.locator('#gender').selectOption('male');
  await page.locator('[data-tab="faces"]').click();
  await page.locator('#search').fill('貴公子');
  await page.locator('.entry').filter({hasText:'中性的な貴公子'}).click();
  await page.waitForFunction(()=>{
   const state=document.querySelector('#preview')?.contentWindow?.__faceMasterQA?.();
   return state?.loaded&&state.gender==='male'&&state.completeFacePreset===15;
  },null,{timeout:90000});
  await captureChromiumScreenshot(page,out+'/catalog-male-16.png');
  if(errors.length)throw Error('Browser page errors '+errors.slice(0,5).join(' | '));
  console.log('HUMAN_V64_CATALOG_REAL_WEBGL_OK faces=32 expressions=22 ponytail=real-scalp viewport=460x900');
 }finally{await browser.close();}
})().catch(e=>{console.error('HUMAN_V64_CATALOG_BROWSER_FAIL',e.stack||e);process.exitCode=1;});
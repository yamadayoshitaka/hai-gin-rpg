'use strict';
/** v65 mobile Chromium: actual WebGL proof, not generated 2D concept art. */
const fs=require('node:fs');
const {chromium}=require('playwright');
const {captureChromiumScreenshot}=require('./chromium-webgl-screenshot.cjs');
const out='qa-screenshots/human-v65';
fs.mkdirSync(out,{recursive:true});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
(async()=>{
 const browser=await chromium.launch({headless:true,
  args:['--use-gl=angle','--use-angle=swiftshader']});
 try{
  const page=await browser.newPage({viewport:{width:460,height:900},
   deviceScaleFactor:1,isMobile:true,hasTouch:true});
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto('http://127.0.0.1:8766/face-mesh-studio.html?preview=1&gender=female&view=front',
   {waitUntil:'domcontentloaded',timeout:90000});
  await page.waitForFunction(()=>window.__faceMasterQA?.()?.loaded===true,
   null,{timeout:120000,polling:400});
  const check=async(where)=>{
   const state=await page.evaluate(()=>window.__faceMasterQA?.());
   if(!(state&&state.v65IrisOptics===true&&state.v65MoistSclera===true))
    throw Error(where+': v65 actual curved optics not present '+JSON.stringify({
     loaded:state?.loaded,v65IrisOptics:state?.v65IrisOptics,
     v65MoistSclera:state?.v65MoistSclera,gender:state?.gender}));
   if(errors.length)throw Error(where+': browser errors '+errors.slice(0,4).join('|'));
   return state;
  };
  await check('female initial');
  await captureChromiumScreenshot(page,out+'/female-neutral-front.png',
   {selector:'#faceCanvas'});
  // Force the real style implementation through the same selector as users.
  await page.evaluate(()=>{
   const el=document.querySelector('#wigStyle');
   el.value='female-side-ponytail';
   el.dispatchEvent(new Event('change',{bubbles:true}));
  });
  await page.waitForFunction(()=>window.__faceMasterQA?.()?.wigReport
   ?.v65BatchedPonytailFiberCount===48,
   null,{timeout:60000,polling:400});
  const hair=await check('female tied hair');
  if(hair.wigReport.v65BatchedPonytailDrawMeshes!==1)
   throw Error('v65 hair must remain batched into a single detail mesh');
  await captureChromiumScreenshot(page,out+'/female-pony-front.png',
   {selector:'#faceCanvas'});
  for(const [view,file]of [['threeQuarter','female-pony-45.png'],
    ['side','female-pony-profile.png'],['crown','female-crown.png']]){
   await page.evaluate(view=>document.getElementById(view)?.click(),view);
   await page.waitForFunction(view=>window.__faceMasterQA?.()?.view===view,
    view,{timeout:15000});
   await sleep(300);
   await captureChromiumScreenshot(page,out+'/'+file,{selector:'#faceCanvas'});
   if(view==='crown'){
    const probe=await page.evaluate(()=>{
     const positions=[[.49,.47],[.50,.476],[.49,.49],[.50,.45],[.52,.48],
      [.50,.52],[.50,.41],[.44,.48]];
     return positions.map(([u,v])=>({u,v,hits:window.__v65PickRenderedSurface?.(u,v)}));
    });
    const state=await page.evaluate(()=>window.__faceMasterQA?.());
    console.log('HUMAN_V65_CROWN_SURFACE '+JSON.stringify({
     picks:probe,repairCount:state?.wigReport?.v65CrownTopologyRepairCount,
     repairTriangles:state?.wigReport?.v65CrownTopologyRepairTriangles
    }));
   }
  }
  await page.evaluate(()=>document.getElementById('front')?.click());
  for(const expression of ['smile','angry','surprised','tearful']){
   await page.evaluate(expression=>{
    const el=document.getElementById('faceExpression');
    el.value=expression;el.dispatchEvent(new Event('change',{bubbles:true}));
   },expression);
   await page.waitForFunction(id=>window.__faceMasterQA?.()?.expression?.expression===id,
    expression,{timeout:15000});
   await captureChromiumScreenshot(page,out+'/female-'+expression+'.png',
    {selector:'#faceCanvas'});
  }
  await page.evaluate(()=>document.getElementById('male')?.click());
  await page.waitForFunction(()=>window.__faceMasterQA?.()?.gender==='male',
   null,{timeout:20000});
  await check('male face optics');
  await captureChromiumScreenshot(page,out+'/male-neutral-front.png',
   {selector:'#faceCanvas'});
  await page.evaluate(()=>document.getElementById('side')?.click());
  await page.waitForFunction(()=>window.__faceMasterQA?.()?.view==='side',
   null,{timeout:15000});
  await captureChromiumScreenshot(page,out+'/male-nose-profile.png',
   {selector:'#faceCanvas'});
  console.log('HUMAN_V65_REAL_WEBGL_OK female-pony-fibers=48 genders=2 expressions=4 nose-profile=1');
 }finally{await browser.close();}
})().catch(e=>{console.error('HUMAN_V65_REAL_WEBGL_FAIL',e.stack||e);process.exitCode=1;});

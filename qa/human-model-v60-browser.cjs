'use strict';
/** v60 real Android-sized Chromium/WebGL evidence; never substitute drawings. */
const {chromium}=require('playwright');
const fs=require('node:fs');
const {captureChromiumScreenshot}=require('./chromium-webgl-screenshot.cjs');
const out='qa-screenshots/human-model-v60';
fs.mkdirSync(out,{recursive:true});

async function ready(page,qa){
 await page.waitForFunction(key=>{
  const state=window[key]?.();
  return state?.loaded===true&&state?.v36RealBattleCostume?.active===true&&
   state.v36RealBattleCostume.proportions?.neckContinuity?.unifiedSkinNeckApplied;
 },qa,{timeout:180000,polling:500});
}

async function main(){
 for(const [gender,source,qa,preview] of [
  ['female','face-body-studio.html','__heroineBodyQA','__heroineBodyPreview'],
  ['male','male-body-studio.html','__maleBodyQA','__maleBodyPreview']
 ]){
  const browser=await chromium.launch({headless:true,args:[
   '--use-gl=angle','--use-angle=swiftshader'
  ]});
  try{
   const page=await browser.newPage({
    viewport:{width:460,height:900},deviceScaleFactor:1,
    isMobile:true,hasTouch:true
   });
   const errors=[];
   page.on('pageerror',error=>errors.push(error.message));
   await page.goto('http://127.0.0.1:8766/'+source+'?v=60',
    {waitUntil:'commit',timeout:120000});
   await ready(page,qa);
   const options=await page.locator('#v47BodyType option').evaluateAll(nodes=>
    nodes.map(node=>node.value));
   if(JSON.stringify(options)!==JSON.stringify(['ultraThin','thin','normal','fat']))
    throw Error(gender+' incorrect body selector '+JSON.stringify(options));
   const jobs=await page.locator('#heroJob option').count();
   if(jobs<10)throw Error(gender+' job/outfit selector does not cover 10 occupations: '+jobs);
   for(const build of ['ultraThin','thin','normal','fat']){
    await page.locator('#v47BodyType').selectOption(build);
    await page.waitForFunction(({qa,build})=>{
     const state=window[qa]?.();
     return state?.v36RealBattleCostume?.bodyType===build&&
      state?.v36RealBattleCostume?.proportions?.neckContinuity?.unifiedSkinNeckApplied;
    },{qa,build},{timeout:45000});
    await page.waitForTimeout(250);
    const state=await page.evaluate(key=>window[key](),qa);
    const one=state.v36RealBattleCostume;
    const neck=one.proportions.neckContinuity;
    const ratio=neck.visibleSkinNeckLength;
    if(!(neck.v60NapeRise===(gender==='male'?.018:.012)&&
      neck.actualCollarSource&&neck.raisedInnerCollarApplied&&
     neck.unifiedNeckBottomHeight<neck.actualCollarHeight&&
     ratio>.015&&ratio<.026&&neck.reusedFaceMaterial&&
     neck.separateNeckGeometryHidden&&neck.v61WidenedNeck===true&&
     neck.v61WidthGainAtMid>=1.099&&neck.v61DepthGainAtMid>=1.079&&
     neck.v61NeckMidHalfWidth>.02&&neck.v61NeckMidHalfDepth>.017&&
     neck.v61CollarTopHalfWidth>=.03&&neck.v61CollarTopHalfDepth>=.029))
     throw Error(gender+' '+build+' neck/cloth fit failed '+JSON.stringify(neck));
    console.log('V60_NECK_METRICS '+JSON.stringify({gender,build,napeRise:neck.v60NapeRise,
      visibleSkin:neck.visibleSkinNeckLength,collar:neck.actualCollarHeight,
      bottom:neck.unifiedNeckBottomHeight,jawRatio:neck.neckToHeadRatio,
      midHalfWidth:neck.v61NeckMidHalfWidth,midHalfDepth:neck.v61NeckMidHalfDepth,
      topCollarHalfWidth:neck.v61CollarTopHalfWidth}));
     const buildMorph=one.proportions.buildMorph;
    if(!(buildMorph?.geometryFromSource&&buildMorph?.accumulative===false&&
     buildMorph.bodyType===build&&buildMorph.meshes>0))
     throw Error(gender+' '+build+' build morph missing '+JSON.stringify(buildMorph));
    // Capture all four body types to verify chest/arm/neck proportion consistency.
    await page.locator('#full').click();
    await page.evaluate(args=>window[args.preview].setQAView('front'),{preview});
    await page.waitForTimeout(220);
    await captureChromiumScreenshot(page,out+'/'+gender+'-'+build+'-full-front.png',
     {selector:'#bodyCanvas'});
   }
   // Return to standard build for five matched neck / jaw / nape views.
   await page.locator('#v47BodyType').selectOption('normal');
   await page.waitForFunction(key=>window[key]?.().v36RealBattleCostume?.bodyType==='normal',qa,
    {timeout:45000});
   await page.evaluate(args=>window[args.preview].setQAZoom('portrait'),{preview});
   for(const view of ['front','left','side','back','threeQuarterLeft','threeQuarterRight']){
    await page.evaluate(args=>window[args.preview].setQAView(args.view),{preview,view});
    await page.waitForTimeout(220);
    const cam=await page.evaluate(args=>window[args.preview].getCameraState(),{preview});
    if(cam.view!==view)throw Error('Camera orientation was not applied: '+gender+'/'+view);
    await captureChromiumScreenshot(page,out+'/'+gender+'-normal-'+view+'-portrait.png',
     {selector:'#bodyCanvas'});
   }
   if(errors.length)throw Error(gender+' browser errors '+errors.slice(0,4).join(' | '));
   // Export the real Chromium pixels to test logs for visual review by
   // connected CI consumers; JPEG/painted surrogate renders are forbidden.
   for(const view of ['front','side']){
    const filename=out+'/'+gender+'-normal-'+view+'-portrait.png';
    const base64=fs.readFileSync(filename).toString('base64');
    for(let at=0;at<base64.length;at+=6000)
     console.log('V60_REVIEW_PNG '+gender+' '+view+' '+at+' '+base64.slice(at,at+6000));
   }
   console.log('HUMAN_MODEL_V61_WEBGL_OK '+gender+' jobs='+jobs+' views=6 builds=4');
  }finally{await browser.close()}
 }
 console.log('HUMAN_MODEL_V60_WEBGL_OK BOTH_GENDERS');
}
main().catch(err=>{console.error('HUMAN_MODEL_V60_WEBGL_FAIL',err);process.exitCode=1});

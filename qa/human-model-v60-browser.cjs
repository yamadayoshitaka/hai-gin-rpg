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
    if(!one.v63CoveredSkinMasked||!one.v63BareAnatomyRestorable)
     throw Error(gender+' '+build+' v63 reversible skin coverage inactive');
    const neck=one.proportions.neckContinuity;
    const ratio=neck.visibleSkinNeckLength;
    if(!(neck.v60NapeRise===(gender==='male'?.018:.012)&&
      neck.actualCollarSource&&neck.raisedInnerCollarApplied&&
     neck.v62SkinFirst===true&&neck.v62ClothingFittedAfterSkin===true&&
      neck.v62BareBodyNeckSamples>=12&&neck.v62SkinToTorsoOverlap>=.012&&
      neck.unifiedNeckBottomHeight<neck.actualTorsoTopY-.008&&
     ratio>.015&&ratio<.026&&neck.reusedFaceMaterial&&
     neck.separateNeckGeometryHidden&&neck.v61WidenedNeck===true&&
     neck.v61WidthGainAtMid>=1.099&&neck.v61DepthGainAtMid>=1.079&&
     neck.v61NeckRingCount>=11&&
     neck.v61NeckMidHalfWidth>.02&&neck.v61NeckMidHalfDepth>.017&&
     neck.v61CollarTopHalfWidth>=.03&&neck.v61CollarTopHalfDepth>=.029))
     throw Error(gender+' '+build+' neck/cloth fit failed '+JSON.stringify(neck));
    console.log('V60_NECK_METRICS '+JSON.stringify({gender,build,napeRise:neck.v60NapeRise,
      visibleSkin:neck.visibleSkinNeckLength,collar:neck.actualCollarHeight,
      bottom:neck.unifiedNeckBottomHeight,jawRatio:neck.neckToHeadRatio,
      midHalfWidth:neck.v61NeckMidHalfWidth,midHalfDepth:neck.v61NeckMidHalfDepth,
      v62BareBodyNeckSource:neck.v62BareBodyNeckSource,
      v62BareBodyNeckSamples:neck.v62BareBodyNeckSamples,
      v62SkinToTorsoOverlap:neck.v62SkinToTorsoOverlap,
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
   // Verify real shaded scalp and optical fibers through native 3D meshes.
   const optics=await page.evaluate(args=>{
    const preview=window[args.preview],wig=preview?.getWig?.();
    const layered=wig?.getObjectByName('SINGLE_MESH_NORMAL_LAYERED_HAIR');
    const iris=preview?.getEyeParts?.()?.getObjectByName('LEFT_CURVED_IRIS');
    return {wig:!!layered,wigColors:layered?.geometry?.getAttribute('color')?.count||0,
      iris:!!iris,irisColors:iris?.geometry?.getAttribute('color')?.count||0,
      irisDetail:iris?.userData?.v63RadialCrypts===true,
      opticVersion:iris?.userData?.opticalDetailVersion||null};
   },{preview});
   if(!(optics.wig&&optics.wigColors>1000&&optics.iris&&
      optics.irisColors>1000&&optics.irisDetail))
    throw Error(gender+' v63 optics/fiber mesh not active '+JSON.stringify(optics));
   console.log('V63_VISUAL_QUALITY '+JSON.stringify({gender,...optics}));
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
   // Bare-skin QA is obligatory: the skin-to-skin seam must remain when
   // the entire clothing object (including the synthetic inner collar) is off.
   const bare=await page.evaluate(args=>window[args.preview].setQABareMode(true),{preview});
   if(!bare?.bare||bare.outfitVisible||!bare.skinVisible)
    throw Error(gender+' bare body mode missing '+JSON.stringify(bare));
   for(const view of ['front','side','back']){
    await page.evaluate(args=>window[args.preview].setQAView(args.view),{preview,view});
    await page.waitForTimeout(200);
    await captureChromiumScreenshot(page,out+'/'+gender+'-normal-BARE-'+view+'.png',
     {selector:'#bodyCanvas'});
   }
   const dressed=await page.evaluate(args=>window[args.preview].setQABareMode(false),{preview});
   if(!dressed?.outfitVisible)throw Error(gender+' clothing could not be restored');
   await page.evaluate(args=>window[args.preview].setQAView('front'),{preview});
   await captureChromiumScreenshot(page,out+'/'+gender+'-normal-DRESSED-front.png',
    {selector:'#bodyCanvas'});
   if(errors.length)throw Error(gender+' browser errors '+errors.slice(0,4).join(' | '));
   // Export the real Chromium pixels to test logs for visual review by
   // connected CI consumers; JPEG/painted surrogate renders are forbidden.
   for(const view of ['front','side']){
    const filename=out+'/'+gender+'-normal-'+view+'-portrait.png';
    const base64=fs.readFileSync(filename).toString('base64');
    for(let at=0;at<base64.length;at+=6000)
     console.log('V60_REVIEW_PNG '+gender+' '+view+' '+at+' '+base64.slice(at,at+6000));
   }
   console.log('HUMAN_MODEL_V62_WEBGL_OK '+gender+' jobs='+jobs+' views=6 builds=4 bare=3 dressed=1');
  }finally{await browser.close()}
 }
 console.log('HUMAN_MODEL_V60_WEBGL_OK BOTH_GENDERS');
}
main().catch(err=>{console.error('HUMAN_MODEL_V60_WEBGL_FAIL',err);process.exitCode=1});

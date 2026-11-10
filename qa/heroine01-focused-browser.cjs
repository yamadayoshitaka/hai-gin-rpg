// Independent, fast, real-WebGL QA for approved-design heroine 01.
// Confirms all 100,000 source-rooted 3D filaments and captures actual
// face close-up + wireframe images without the unrelated full roster suite.
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path');
const dir='qa-screenshots/heroine01-focused';
fs.mkdirSync(dir,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader']});
 try{
  const page=await browser.newPage({viewport:{width:1024,height:820},deviceScaleFactor:1});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:8765/master-swordsman-prototype.html?qa=1&featured=hero-girl-01&view=portrait',{
   waitUntil:'domcontentloaded',timeout:60000});
  try{
   await page.waitForFunction(()=>{
    const d=window.__heroSwordsmanQA?.();
    return d?.loaded===true&&d.featuredKey==='hero-girl-01'&&
     d.referenceHeroineHairReport?.individualFilamentCount===100000;
   },null,{timeout:120000,polling:300});
  }catch(e){
   console.error('HEROINE01_DIAGNOSTICS',await page.locator('#diagnostics').textContent());
   console.error('HEROINE01_ERRORS',errors);
   throw e;
  }
  const d=await page.evaluate(()=>window.__heroSwordsmanQA());
  const p=d.appearance?.proportions,h=d.referenceHeroineHairReport;
  if(errors.length||d.hairError||d.sourceGender!=='female'||
     d.longBlondeHeroineHairShown!==true||h?.scalpAnchored!==true||
     h?.individualFilamentCount!==100000||h?.strandSegmentCount!==600000||
     h?.allStrandsRendered!==true||h?.noWidePolygonCards!==true||
     d.heroineOldScalpHidden!==true||d.heroineBaldHeadSingleWig!==true||
     d.heroineActualBodyClearance!==true||
     d.heroineWigCrownVisible!==true||
     d.heroineWigCrown?.coverageRatio<.95||
     h?.bodyClearanceMeasured!==true||h?.bodyCollisionCorrections<1||
     h?.frontEyeZoneVertices>10||
     h?.neckSideSplitCorrections<1||h?.beardFreeFrontNeck!==true||
     h?.neckBeardIntrusionVertices!==0||
     d.appearance?.youthfulness<.68||
     h?.lengthInHeads<3||h?.fringeTipMinYNormalized<.64||
     p?.preEarFullness>=.8||p?.parotidWidth>=.8||
     p?.lowerCheekLateral>=1||p?.cheekRoundness<=1||
     p?.noseTip<.75||p?.mouthCorner<0)
   throw Error('Failed heroine 01 genuine 3D head/scalp/hair/face QA: '+
    JSON.stringify({errors,gender:d.sourceGender,hairError:d.hairError,hair:h,face:p}));
  const wig=await page.evaluate(()=>window.__heroineWigQA?.());
  if(wig?.sourceScalpVisible!==false||wig?.donorHairVisible!==false||
     wig?.oldVikingScalpVisible!==false||wig?.torsoCorrections<1||
     wig?.crownVisible!==true||wig?.crownCoverage<.95)
   throw Error('Bald original, only wig, measured shoulder/back clearance must be real '+JSON.stringify(wig));
  // Reproduce the user's real regression: morph eye width, height, spacing,
  // vertical position and tilt. Both eyeballs/irises/lashes must remain
  // visible and lash transforms MUST be attached to the upper eyelids.
  const originalProportions=d.appearance.proportions;
  const baseEye=d.facialQA;
  if(baseEye?.visibleNativeEyeballCount!==2||baseEye?.visibleIrisOverlayCount!==2||
     baseEye?.visibleEyelashMeshCount!==2||baseEye?.lashFollowsUpperLid!==true)
   throw Error('Original heroine is missing real eyes or eyelash rigs '+JSON.stringify(baseEye));
  for(const change of [
    {eyeWidth:1.26},{eyeHeight:1.20},{eyeSpacing:1.09},
    {eyeVertical:.015},{eyeTilt:.085}]){
   const state=await page.evaluate(p=>window.__heroSwordsmanUpdate({proportions:p}),change);
   const eye=state.facialQA;
   if(eye?.visibleNativeEyeballCount!==2||eye?.visibleIrisOverlayCount!==2||
      eye?.visibleEyelashMeshCount!==2||eye?.lashFollowsUpperLid!==true||
      eye?.attachedEyelashMeshCount!==2)
    throw Error('Eye morph lost eye/lid/lash geometry '+JSON.stringify({change,eye}));
  }
  const changedEye=await page.evaluate(()=>window.__heroSwordsmanQA().facialQA);
  if(changedEye.ocularGeometryDigest===baseEye.ocularGeometryDigest||
     changedEye.eyelashPoseDigest===baseEye.eyelashPoseDigest)
   throw Error('Eye slider failed to deform native sclera and eyelash pose');
  await page.locator('#portrait').click();
  await page.waitForTimeout(350);
  await page.screenshot({path:path.join(dir,'hero-girl-01-eye-morph-lashes.png'),
   clip:await page.locator('#canvas').boundingBox(),timeout:90000,animations:'disabled'});
  await page.evaluate(p=>window.__heroSwordsmanUpdate({proportions:p}),originalProportions);
  await page.waitForTimeout(400);
  const restoredEye=await page.evaluate(()=>window.__heroSwordsmanQA().facialQA);
  if(restoredEye.visibleNativeEyeballCount!==2||restoredEye.visibleIrisOverlayCount!==2||
     restoredEye.visibleEyelashMeshCount!==2||restoredEye.lashFollowsUpperLid!==true||
     restoredEye.ocularGeometryDigest!==baseEye.ocularGeometryDigest)
   throw Error('Reset did not restore both real eyes and eyelashes '+JSON.stringify({baseEye,restoredEye}));
  const w=await page.evaluate(()=>window.__heroineWireframeQA?.());
  if(w?.strandCount!==100000||w?.strandSegments!==600000||w?.triangles<1000)
   throw Error('Real hair and face/source geometry not present '+JSON.stringify(w));
  const canvas=page.locator('#canvas');
  await page.locator('#portrait').click();
  await page.waitForTimeout(200);
  await page.screenshot({path:path.join(dir,'hero-girl-01-face-100k.png'),
   clip:await canvas.boundingBox(),timeout:90000,animations:'disabled'});
  await page.locator('#meshMode').selectOption('wire');
  await page.waitForTimeout(200);
  const wire=await page.evaluate(()=>window.__heroineWireframeQA());
  if(wire.mode!=='wire'||wire.triangles!==w.triangles||
     wire.strandCount!==100000||wire.strandSegments!==600000)
   throw Error('Wire mode must preserve all real hair filaments '+JSON.stringify(wire));
  await page.screenshot({path:path.join(dir,'hero-girl-01-wire-100k.png'),
   clip:await canvas.boundingBox(),timeout:90000,animations:'disabled'});
  await page.locator('#meshMode').selectOption('solid');
  const reset=await page.evaluate(()=>window.__heroineWireframeQA());
  if(reset.mode!=='solid'||reset.strandCount!==100000)
   throw Error('Solid/wire switch lost hair geometry');
  await page.locator('#back').click();
  await page.waitForTimeout(200);
  await page.screenshot({path:path.join(dir,'hero-girl-01-back-shoulder-clearance.png'),
   clip:await canvas.boundingBox(),timeout:90000,animations:'disabled'});
  console.log('HEROINE01_FACE_WIRE_100K_SUCCESS '+JSON.stringify({
   fibers:h.individualFilamentCount,segments:h.strandSegmentCount,
   cheek:p.cheekRoundness,preEar:p.preEarFullness,parotid:p.parotidWidth,
   sourceFaceTriangles:w.triangles,wigCollisionCorrections:h.bodyCollisionCorrections,
   oldScalpHidden:d.heroineOldScalpHidden,
   wigCrownCoverage:wig.crownCoverage,eyelashCount:wig.eyelashCount,
   eyeMorphRestores:restoredEye.ocularGeometryDigest===baseEye.ocularGeometryDigest,
   images:['hero-girl-01-face-100k.png','hero-girl-01-eye-morph-lashes.png','hero-girl-01-wire-100k.png','hero-girl-01-back-shoulder-clearance.png']
  }));
 }finally{await browser.close();}
})().catch(e=>{console.error('HEROINE01_FOCUSED_QA_FAILED',e);process.exitCode=1;});

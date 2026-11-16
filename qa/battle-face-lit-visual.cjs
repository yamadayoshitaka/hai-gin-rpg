const assert=require('node:assert/strict');
const fs=require('node:fs');
const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,args:[
  '--use-gl=angle','--use-angle=swiftshader','--enable-webgl','--disable-gpu-sandbox'
 ]});
 try{
  const page=await browser.newPage({viewport:{width:512,height:512},deviceScaleFactor:1});
  const consoleErrors=[];
  page.on('pageerror',e=>consoleErrors.push(String(e)));
  page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text())});
  await page.goto('http://127.0.0.1:4177/qa/battle-face-lit-visual.html',
   {waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(()=>Boolean(window.__battleFaceVisualQA?.ready||window.__battleFaceVisualQA?.error),
   null,{timeout:120000});
  const audit=await page.evaluate(()=>window.__battleFaceVisualQA);
  console.log('VISUAL_FACE_AUDIT',JSON.stringify(audit));
  fs.mkdirSync('qa-screenshots/battle-face',{recursive:true});
  await page.screenshot({path:'qa-screenshots/battle-face/50v50-head-pbr-after.png',timeout:20000});
  assert.ok(!audit.error,audit.error||'Failed face rendering');
  assert.equal(audit.sourceUv,true);
  assert.equal(audit.corrected,true);
  assert.equal(audit.expected,audit.renderVersion);
  assert.equal(audit.sharedAlbedo,'battle-original-uv-warm-skin-albedo-v1');
  assert.ok(audit.shaderPrograms>0,'Real PBR shader was not compiled');
  assert.ok(audit.actualDonorRigHead?.samples>=30,'True skinned donor has no head vertices');
  assert.ok(audit.actualDonorRigHead?.sourceMeshTransformApplied,
   'Source GLB nested transforms must be applied');
  assert.ok(audit.actualDonorRigHead?.shoulderWidthExcludedFromFit,
   'Wide neck/shoulder mesh must not determine face dimensions');
  assert.ok(audit.actualDonorRigHead?.sourceShoulderToSkullWidthRatio>1.45,
   'Master GLB should show measurable shoulder-width inflation');
  assert.ok(audit.actualDonorRigHead?.cranialSamples>3000,
   'Skull must be measured from actual source vertices');
  assert.ok(audit.actualDonorRigHead?.cranialHeightRatio>=.99,
   'True head height must fill the animated human skull');
  assert.ok(audit.actualDonorRigHead?.widthRatio>=.99,
   'Face must occupy its actual animated head width, not tiny clay mask');
  console.log('REAL_RIG_BATTLE_HEAD_PROPORTIONS',JSON.stringify(audit.actualDonorRigHead));

  assert.ok(audit.sample.occupied>350,'No real skin pixels visible in the frame');
  assert.ok(audit.sample.changed>200,'RGB pixels did not visibly respond to skin correction');
  assert.ok(audit.sample.after[0]<audit.sample.before[0]-6,
   'Corrected battle skin must visibly reduce red-channel whitewash');
  assert.ok(audit.sample.after[0]>audit.sample.after[1]+4,
   'Skin should retain warm complexion instead of grayscale clay');
  assert.equal(audit.sample.rgbaOutliers,0,'No bright-white clipped skin pixels');
  assert.deepEqual(consoleErrors,[],'Browser or GLSL renderer errors');
  console.log('PASS: WebGL-rendered battle face is warm and visibly less overexposed');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});

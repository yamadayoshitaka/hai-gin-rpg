const fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright'),{PNG}=require('pngjs');
const out='qa-screenshots/blender-human-source';
fs.mkdirSync(out,{recursive:true});
function changedPixels(a,b){
 const left=PNG.sync.read(fs.readFileSync(a)),right=PNG.sync.read(fs.readFileSync(b));
 if(left.width!==right.width||left.height!==right.height)throw Error('Source comparison frame sizes differ');
 let changed=0;
 for(let i=0;i<left.data.length;i+=4){
  const diff=Math.abs(left.data[i]-right.data[i])+Math.abs(left.data[i+1]-right.data[i+1])+Math.abs(left.data[i+2]-right.data[i+2]);
  if(diff>50)changed++;
 }
 return changed;
}
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader']});
 try{
  const page=await browser.newPage({viewport:{width:1080,height:850},deviceScaleFactor:1});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:8765/master-human-source-inspector.html?qa=1',{waitUntil:'domcontentloaded',timeout:50000});
  await page.waitForFunction(()=>window.__blenderHumanSourceQA?.()?.loaded===true,null,{timeout:55000,polling:350});
  let report=await page.evaluate(()=>window.__blenderHumanSourceQA());
  if(report.sourceId!=='realistic-head-animation'||report.meshes!==5||report.real3dMorphCount<7)
   throw Error('Real head GLB or anatomical morphs missing: '+JSON.stringify(report));
  const canvas=page.locator('#scene');
  await canvas.screenshot({path:path.join(out,'head-neutral.png')});
  await page.locator('#presetSwordsman').click();
  await page.waitForTimeout(150);
  await canvas.screenshot({path:path.join(out,'head-swordsman.png')});
  const change=changedPixels(path.join(out,'head-neutral.png'),path.join(out,'head-swordsman.png'));
  if(change<100)throw Error('The 3D face presets do not modify rendered head anatomy: '+change);
  await page.locator('#wire').click();
  await page.waitForTimeout(120);
  await canvas.screenshot({path:path.join(out,'head-wire.png')});
  const wireDiff=changedPixels(path.join(out,'head-swordsman.png'),path.join(out,'head-wire.png'));
  if(wireDiff<500)throw Error('Real topology wireframe did not visibly change pixels: '+wireDiff);
  for(const [id,name] of [
   ['realistic-head-sculpt','head-sculpt.png'],
   ['realistic-body-male','male-body.png'],
   ['realistic-body-female','female-body.png'],
   ['viking-outfit-source','viking-source-outfit.png']
  ]){
   await page.locator('#model').selectOption(id);
   await page.waitForFunction(expected=>window.__blenderHumanSourceQA?.()?.sourceId===expected&&window.__blenderHumanSourceQA()?.loaded===true,id,{timeout:45000});
   await page.locator('#solid').click();
   await canvas.screenshot({path:path.join(out,name)});
   const status=await page.evaluate(()=>window.__blenderHumanSourceQA());
   if(status.vertices<3000||status.triangles<6000)throw Error('Model contains fallback simplified geometry '+id);
   if(id.includes('head')&&status.real3dMorphCount<7)throw Error('Sculpt head has no true 3D morphs');
   if(id==='viking-outfit-source'&&status.photoTextureMapCount<5)
    throw Error('Viking garment lost original UV and its photo colour textures');
  }
  if(errors.length)throw Error('Browser page errors: '+errors.join(' / '));
  report={...report,faceVariantChangedPixels:change,wireframeChangedPixels:wireDiff,
   allFourRealMeshesRendered:true,realVikingTexturedOutfitRendered:true,realMorphDifferencesVerified:true,errors,
   officialSourceModelOnly:true,ff13ArtApproved:false,gameplayModelReplaced:false};
  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
  console.log('BLENDER_REAL_HEAD_BROWSER_PASS '+JSON.stringify(report));
 }finally{await browser.close();}
})().catch(e=>{console.error('BLENDER_REAL_HEAD_BROWSER_FAILED',e);process.exitCode=1;});

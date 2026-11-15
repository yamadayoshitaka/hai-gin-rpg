'use strict';
/** Capture the 3D stage selected by its campaign blueprint; screenshot is evidence,
 * not a photoreal result. 200 stages reuse existing scene presets.
 */
const {chromium}=require('playwright');
const fs=require('node:fs');
const path=require('node:path');
(async()=>{
 const {CAMPAIGN_STAGE_BY_ID}=await import('../src/campaign-stage-plan.js');
 const stageId=process.argv[2],folder=process.argv[3]||'qa-reports/world-quality/previews';
 const target=CAMPAIGN_STAGE_BY_ID[stageId];
 if(!target)throw Error('Unknown campaign stage '+stageId);
 fs.mkdirSync(folder,{recursive:true});
 const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl','--ignore-gpu-blocklist']});
 const page=await browser.newPage({viewport:{width:1024,height:576},deviceScaleFactor:1});
 let errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto('http://127.0.0.1:8765/tactics-wireframe.html?stage='+encodeURIComponent(target.scenePreset)+'&army=50&worldQualityQA=1',
   {waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(()=>typeof window.getCurrentStage==='function',{timeout:55000});
  await page.waitForTimeout(4500);
  const loaded=await page.evaluate(()=>window.getCurrentStage());
  if(loaded.id!==target.scenePreset)throw Error('Wrong stage: requested '+target.scenePreset+', got '+loaded.id);
  const canvas=page.locator('canvas').filter({visible:true});
  const sizes=await canvas.evaluateAll(xs=>xs.map((e,i)=>({i,area:e.getBoundingClientRect().width*e.getBoundingClientRect().height})));
  const best=sizes.sort((a,b)=>b.area-a.area)[0];
  if(!best||best.area<50000)throw Error('No usable 3D canvas');
  const file=path.join(folder,stageId+'-stage-baseline.png');
  await canvas.nth(best.i).screenshot({path:file,timeout:30000});
  if(fs.statSync(file).size<10000)throw Error('Likely blank stage render');
  const result={key:'stage:'+stageId,requestedPreset:target.scenePreset,
   confirmedPreset:loaded.id,gameScreenshot:file,realWebGLCapture:true,
   cameraReproducibility:'PENDING',humanVisualQA:'PENDING',
   semanticQualityValidated:false,qaWarnings:errors.slice(0,4)};
  fs.writeFileSync(path.join(folder,stageId+'-stage-capture.json'),JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify(result));
 }finally{await page.close();await browser.close()}
})().catch(e=>{console.error('STAGE_3D_CAPTURE_FAILED '+e.message);process.exit(2)});

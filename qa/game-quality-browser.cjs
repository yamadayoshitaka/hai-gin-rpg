#!/usr/bin/env node
/* Actual Chromium/WebGL probe of the production battle page.
 * CI SwiftShader FPS is a laboratory proxy, NEVER Android measured FPS.
 * Screenshots are captured from WebGL pixels; no reference illustration
 * or source static test can substitute for live browser execution.
 */
const fs=require('node:fs');
const {chromium}=require('playwright');
const {launchBattleViaThreeStepWizard}=require('./opening-three-stage.cjs');
const args=process.argv.slice(2);
const lane=(args.find(x=>x.startsWith('--lane='))||'--lane=runtime').split('=')[1];
const rawWizardTimeout=(args.find(x=>x.startsWith('--wizard-timeout-ms='))||'').split('=')[1];
const wizardTimeout=rawWizardTimeout?
 Math.min(240000,Math.max(10000,Number(rawWizardTimeout)||60000)):240000;
if(!['frame','scale','runtime'].includes(lane))throw Error('unsupported WebGL lane '+lane);
const dir='qa-reports/game-quality-six';
fs.mkdirSync(dir,{recursive:true});
const result={schemaVersion:1,lane,at:new Date().toISOString(),
 environment:'github-actions-swiftshader-chromium',scenario:lane==='frame'?'50v50':'1000v1000',
 status:'starting',runtimeErrors:0,errorMessages:[],fps:null,p95Ms:null,
 drawCalls:null,gpuGeometries:null,gpuTextures:null,webglContextLost:null,
 screenshotBytes:0,visualApproved:false,androidFpsMeasured:false};
const save=()=>fs.writeFileSync(dir+'/browser-'+lane+'.json',JSON.stringify(result,null,2)+'\n');
(async()=>{
 let browser;
 try{
  browser=await chromium.launch({headless:true,args:[
   '--use-gl=angle','--use-angle=swiftshader','--enable-webgl',
   '--ignore-gpu-blocklist','--autoplay-policy=no-user-gesture-required']});
  const page=await browser.newPage({viewport:{width:430,height:932},deviceScaleFactor:1});
  page.on('pageerror',e=>{result.errorMessages.push(String(e.message||e).slice(0,300))});
  page.on('crash',()=>{result.browserCrash=true;result.errorMessages.push('Chromium page crashed during 3D battle startup')});
  page.on('close',()=>{if(result.status==='starting')result.pageClosedBeforeResult=true});
  const scenario=result.scenario==='50v50'?'?army=50':'?army=1000';
  await page.goto('http://127.0.0.1:8765/tactics-wireframe.html'+scenario+'&qualityProbe=1',
   {waitUntil:'domcontentloaded',timeout:60000});
  if(lane==='frame'){
   await launchBattleViaThreeStepWizard(page,{timeout:wizardTimeout});
   await page.waitForFunction(()=>window.getBattleStartupStats?.().ready||
    document.querySelector('#runtimeError')?.style.display==='block',
    null,{timeout:200000,polling:500});
   const readings=[];
   // Warm up first, then read engine's real rolling FPS and frame P95,
   // not requestAnimationFrame callbacks from an empty HTML page.
   for(let i=0;i<4;i++){
    await page.waitForTimeout(2000);
    readings.push(await page.evaluate(()=>{
     const q=window.getSkirmishPerformanceStats?.();
     return q?{fps:q.fps,p95Ms:q.frameP95Ms,drawCalls:q.drawCalls,
      gpuGeometries:q.memory?.gpuGeometries,gpuTextures:q.memory?.gpuTextures,
      webglContextLost:q.gpuContextLost}:null;
    }));
   }
   const valid=readings.filter(x=>x&&Number.isFinite(x.fps)&&x.fps>0);
   if(!valid.length)throw Error('Actual battle frame statistics were not measured');
   const last=valid.at(-1);
   for(const key of ['fps','p95Ms','drawCalls','gpuGeometries','gpuTextures'])
    result[key]=Number.isFinite(last[key])?last[key]:null;
   result.webglContextLost=last.webglContextLost===true;
   // Only claim actual scene pixels when the GPU readback succeeds.
   try{
    const canvas=page.locator('canvas').first();
    const rect=await canvas.boundingBox({timeout:15000});
    if(rect&&rect.width>20&&rect.height>20){
     const cdp=await page.context().newCDPSession(page);
     const shot=await Promise.race([
      cdp.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false,
       clip:{x:rect.x,y:rect.y,width:rect.width,height:rect.height,scale:1}}),
      new Promise((_,reject)=>setTimeout(()=>reject(Error('GPU capture timeout')),18000))
     ]);
     const bytes=Buffer.from(shot.data,'base64');
     if(bytes.length>10000){
      fs.writeFileSync(dir+'/frame-webgl.png',bytes);
      result.screenshotBytes=bytes.length;
     }
     await cdp.detach();
    }
   }catch(e){result.screenshotError=String(e.message||e).slice(0,250)}
  }else{
   // 1000v1000 module boot is independent from the 3-stage wizard and
   // catches Worker/import failures that a Node-only QA does not detect.
   await page.waitForFunction(()=>typeof window.getMassBattleStats==='function'||
    document.querySelector('#runtimeError')?.style.display==='block',
    null,{timeout:120000,polling:600});
   const boot=await page.evaluate(()=>({
    mass:window.getMassBattleStats?.(),startup:window.getBattleStartupStats?.(),
    error:document.querySelector('#runtimeError')?.textContent||null,
    visibleError:document.querySelector('#runtimeError')?.style.display==='block'
   }));
   if(boot.visibleError)throw Error('1000v1000 runtime error: '+boot.error);
   if(boot.mass?.sideCount!==1000)throw Error('1000v1000 Worker did not initialize');
   result.massPerSide=boot.mass.sideCount;
   result.pixelRatio=boot.startup?.pixelRatio??null;
   result.antiAliasing=boot.startup?.antiAliasing??null;
  }
  result.runtimeErrors=result.errorMessages.length;
  if(result.runtimeErrors)throw Error('Browser runtime error: '+result.errorMessages.join(' | '));
  if(result.webglContextLost)throw Error('WebGL context loss detected');
  result.status=lane==='frame'?'measured_ci_fps':'boot_verified_no_fps';
 }catch(e){
  result.status='failed';result.error=String(e.stack||e).slice(0,800);
  process.exitCode=1;
 }finally{
  save();
  if(browser)await browser.close().catch(()=>{});
  console.log('GAME_QUALITY_BROWSER '+JSON.stringify(result));
 }
})().catch(e=>{result.status='failed';result.error=String(e);save();process.exitCode=1});

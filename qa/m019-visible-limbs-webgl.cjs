'use strict';
// Real Chromium/WebGL smoke for m019's previously invisible four legs.
// Produces actual front + side captures for human inspection. Passing only
// means meshes render and stay grounded; it is NOT visual-art approval.
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path');
const out=process.argv[2]||'qa-reports/m019-visible-limbs';
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 const browser=await chromium.launch({headless:true,args:[
  '--use-gl=angle','--use-angle=swiftshader',
  '--enable-webgl','--ignore-gpu-blocklist'
 ]});
 const report=[];
 try{
  const page=await browser.newPage({viewport:{width:720,height:940},deviceScaleFactor:1});
  const errors=[];
  page.on('pageerror',error=>errors.push(String(error)));
  await page.goto('http://127.0.0.1:8765/monster-manager.html?monster=m019&qa=v10-visible-limbs',
   {waitUntil:'domcontentloaded',timeout:90000});
  await page.waitForFunction(()=>window.__m019LimbVisibilityQA?.()?.ready===true,
   {timeout:60000});
  for(const action of ['idle','walk','run']){
   await page.locator('#actions button[title="'+action+'"]').click({timeout:10000});
   await page.waitForFunction(a=>
    window.__monsterViewerLayoutQA?.()?.selectedMotion===a,
    action,{timeout:10000});
   for(const angle of ['front','side']){
    const cam=await page.evaluate(a=>window.__beastFaceCameraQA?.(a),angle);
    if(!cam||cam.id!=='m019')throw Error('missing real '+angle+' view '+JSON.stringify(cam));
    await page.waitForTimeout(240);
    const state=await page.evaluate(()=>window.__m019LimbVisibilityQA?.());
    if(!state?.ready||state.gpuSkinnedLimbs!==0||state.meshCount!==4)
     throw Error('m019 limbs invisible '+action+' '+angle+': '+JSON.stringify(state));
    const canvas=page.locator('#view canvas');
    const filename=path.join(out,'m019-'+action+'-'+angle+'.png');
    const capture=await canvas.screenshot({path:filename,timeout:45000});
    if(capture.byteLength<10000)throw Error('empty WebGL frame '+action+' '+angle);
    report.push({action,angle,filename,bytes:capture.length,
     limbs:state.limbs,visualApproved:false});
   }
  }
  if(errors.length)throw Error('viewer JS: '+errors.join('; '));
  fs.writeFileSync(path.join(out,'report.json'),
   JSON.stringify({id:'m019',source:'actual-chromium-webgl',report,
    visualApproved:false,androidDeviceVerified:false},null,2)+'\n');
  console.log('PASS: m019 four real mesh limbs present in 6 actual WebGL views');
 }finally{await browser.close();}
})().catch(e=>{console.error('M019_VISUAL_FAILED '+e.stack);process.exit(2)});

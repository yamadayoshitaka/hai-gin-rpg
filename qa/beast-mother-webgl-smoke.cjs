'use strict';
// Actual WebGL model preview, not a static mesh count or synthetic screenshot.
// Record all captures as QA candidates. No automatic aesthetic acceptance.
const {chromium}=require('playwright');
const fs=require('node:fs');
const path=require('node:path');
const root=process.argv[2]||'qa-reports/beast-mother-visual';
const ids=['m002','m003','m004','m007','m008','m009','m010'];
(async()=>{
 fs.mkdirSync(root,{recursive:true});
 const browser=await chromium.launch({
  headless:true,args:['--use-gl=angle','--use-angle=swiftshader',
   '--enable-webgl','--ignore-gpu-blocklist']});
 const report=[];
 try{
  for(const id of ids){
   const page=await browser.newPage({viewport:{width:960,height:700},
    deviceScaleFactor:1});
   const errors=[];
   page.on('pageerror',e=>errors.push(String(e)));
   await page.goto('http://127.0.0.1:8765/monster-manager.html?monster='+id+
     '&v=beast-copy-v5',{waitUntil:'domcontentloaded',timeout:90000});
   await page.waitForFunction(expected=>{
    const q=window.__monsterQualityQA?.();
    return q?.id===expected&&Number(q.meshes)>5;
   },id,{timeout:60000});
   const state=await page.evaluate(()=>window.__monsterQualityQA());
   if(errors.length)throw Error(id+': viewer JS '+errors.join('; '));
   if(!Number.isFinite(Number(state.triangles))||state.triangles<=1000)
    throw Error(id+': missing WebGL geometry '+JSON.stringify(state));
   const frames=[];
   for(const action of ['idle','run','attack']){
    const button=page.locator('#actions button[title="'+action+'"]');
    await button.click({timeout:10000});
    await page.waitForFunction(a=>
      window.__monsterViewerLayoutQA?.()?.selectedMotion===a,action,{timeout:10000});
    await page.waitForTimeout(170);
    const name=id+'-'+action+'.png';
    const filename=path.join(root,name);
    const result=await page.locator('#view canvas').screenshot({path:filename,
     timeout:45000});
    if(result.byteLength<12000)
     throw Error(id+' '+action+': empty rendered frame');
    frames.push({action,bytes:result.byteLength,filename});
   }
   if(errors.length)throw Error(id+': runtime error after motion '+errors.join('; '));
   report.push({id,geometry:state.triangles,meshes:state.meshes,
    frames,visualApproved:false,androidFpsVerified:false});
   await page.close();
  }
  fs.writeFileSync(path.join(root,'capture-report.json'),
   JSON.stringify({kind:'real-browser-model-candidates',report},null,2)+'\n');
  console.log('PASS: '+report.length+' actually rendered wolf/feline donor species, 3 pose frames each');
 }finally{await browser.close()}
})().catch(e=>{console.error('BEAST_WEBGL_BLOCKED '+e.stack);process.exit(2)});

'use strict';
/** Real WebGL screenshot; no inference of photorealism from a screenshot alone. */
const {chromium}=require('playwright');
const fs=require('node:fs');
const path=require('node:path');
(async()=>{
 const id=process.argv[2],dir=process.argv[3]||'qa-reports/world-quality/previews';
 const baselineOnly=process.argv[4]==='--baseline';
 if(!id||!/^[a-z0-9_]+$/.test(id))throw Error('Safe catalog object ID required');
 fs.mkdirSync(dir,{recursive:true});
 const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl','--ignore-gpu-blocklist']});
 let result={assetId:id,kind:'REAL_WEBGL_CAPTURE_CANDIDATES_NOT_APPROVED',captures:[]};
 try{
  for(const roughnessScale of (baselineOnly?[1]:[1,.83,.92,1.08])){
   const page=await browser.newPage({viewport:{width:1024,height:576},deviceScaleFactor:1});
   let errors=[];page.on('pageerror',err=>errors.push(err.message));
   const url='http://127.0.0.1:8765/world-quality-preview.html?object='+id+'&roughnessScale='+roughnessScale;
   await page.goto(url,{waitUntil:'domcontentloaded',timeout:45000});
   await page.waitForFunction(()=>['true','error'].includes(document.body.dataset.qaReady),null,{timeout:30000});
   const state=await page.locator('body').evaluate(e=>({...e.dataset}));
   if(state.qaReady!=='true'||errors.length)throw Error('Failed WebGL capture '+id+' '+roughnessScale+' '+JSON.stringify({state,errors}));
   if(baselineOnly&&(!Number.isFinite(Number(state.drawCalls))||Number(state.drawCalls)>18||!Number.isFinite(Number(state.triangles))||Number(state.triangles)>25000))
    throw Error('Physical object exceeded small-static-mesh GPU budget: '+JSON.stringify({id,drawCalls:state.drawCalls,triangles:state.triangles}));
   const filename=path.join(dir,id+'-rough-'+String(roughnessScale).replace('.','_')+'.png');
   await page.locator('canvas').screenshot({path:filename,timeout:25000});
   const stat=fs.statSync(filename);
   if(stat.size<10000)throw Error('Suspiciously empty screenshot');
   result.captures.push({roughnessScale,filename,bytes:stat.size,materials:Number(state.materials),drawCalls:Number(state.drawCalls),triangles:Number(state.triangles),status:'CAPTURED_QA_PENDING'});
   await page.close();
  }
  fs.writeFileSync(path.join(dir,id+'-capture.json'),JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify(result));
 }finally{await browser.close();}
})().catch(e=>{console.error('QUALITY_CAPTURE_BLOCKED '+e.stack);process.exit(2)});

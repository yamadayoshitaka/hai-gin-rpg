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
   // Element screenshots wait for document.fonts.ready. A remote font can
   // stall forever even after WebGL reports qaReady=true. Capture the actual
   // rendered canvas rectangle via Chromium CDP instead; this reads pixels
   // without a misleading font-loading timeout or any synthetic image.
   const canvasBox=await page.locator('canvas').boundingBox();
   if(!canvasBox||canvasBox.width<10||canvasBox.height<10)
    throw Error('WebGL canvas has no drawable bounds for '+id);
   const cdp=await page.context().newCDPSession(page);
   try{
    const shot=await cdp.send('Page.captureScreenshot',{
     format:'png',captureBeyondViewport:false,
     clip:{x:canvasBox.x,y:canvasBox.y,width:canvasBox.width,
      height:canvasBox.height,scale:1}
    });
    fs.writeFileSync(filename,Buffer.from(shot.data,'base64'));
   }finally{await cdp.detach();}
   const stat=fs.statSync(filename);
   if(stat.size<10000)throw Error('Suspiciously empty screenshot');
   result.captures.push({roughnessScale,filename,bytes:stat.size,materials:Number(state.materials),drawCalls:Number(state.drawCalls),triangles:Number(state.triangles),status:'CAPTURED_QA_PENDING'});
   await page.close();
  }
  fs.writeFileSync(path.join(dir,id+'-capture.json'),JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify(result));
 }finally{await browser.close();}
})().catch(e=>{console.error('QUALITY_CAPTURE_BLOCKED '+e.stack);process.exit(2)});

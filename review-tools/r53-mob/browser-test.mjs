import {chromium} from 'playwright';
import fs from 'node:fs/promises';
const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
try{
 const page=await browser.newPage({viewport:{width:412,height:850},deviceScaleFactor:1,isMobile:true,hasTouch:true});
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.goto('http://127.0.0.1:8765/',{waitUntil:'networkidle'});await page.waitForFunction(()=>window.reviewReady,{timeout:120000});
 const models=await page.evaluate(()=>window.review.manifest.models),results=[],bench=[];
 const report=async(extra={})=>fs.writeFile('browser-report.json',JSON.stringify({verified:results.length,models:results,benchmark:bench,classification:'headless Chromium software rendering; not Pixel or game FPS',productionApproved:false,...extra},null,2));
 for(const m of models)for(const level of ['lod0','lod1','lod2']){
   const r=await page.evaluate(async({id,level})=>window.review.load(id,level),{id:m.id,level});
   const evidence=await page.evaluate(({m})=>{for(const a of m.clips)window.review.applyAction(a);for(const x of m.morphs)if(window.review.applyExpression(x,1)<1)throw Error('missing morph '+x);window.review.applyExpression('',0);return window.review.health()},{m});
   if(evidence.renderError||r.morphs<13||r.clips<10)throw Error('runtime regression '+m.id+' '+level);
   results.push({...r,expressionControlsVerified:13,actionControlsVerified:10});
   await report({status:'model-check-in-progress'});console.log('R53 loaded',m.id,level,results.length);
 }
 if(results.length!==60)throw Error('incomplete browser inventory');
 // Capture before the stress workload to avoid waiting on queued software GPU work.
 await page.evaluate(({id})=>window.review.load(id,'lod0'),{id:models[0].id});
 const data=await page.evaluate(()=>window.review.capture());
 const png=Buffer.from(data.split(',')[1],'base64');
 if(png.length<1000||!png.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))throw Error('invalid canvas PNG');
 await fs.writeFile('review-browser.png',png);
 await report({status:'model-check-complete',canvasCaptureVerified:true});
 console.log('R53 browser verified',results.length,'GLB files; canvas captured');
 for(const level of ['lod0','lod1','lod2']){
   await page.evaluate(({id,level})=>window.review.load(id,level),{id:models[0].id,level});
   for(const n of [1,20,50]){const b=await page.evaluate(n=>window.review.benchmark(n,8),n);if(!Number.isFinite(b.medianMs)||b.medianMs<=0||b.triangles<=0||b.drawCalls<=0)throw Error('invalid benchmark');bench.push({level,...b});await report({status:'benchmark-in-progress',canvasCaptureVerified:true});console.log('R53 workload',level,n,b.medianMs,b.triangles);}
 }
 await page.evaluate(()=>{window.review.setCount(1);window.review.pause()});
 const health=await page.evaluate(()=>window.review.health());
 if(errors.length||health.renderError)throw Error([...errors,health.renderError].filter(Boolean).join('\n'));
 if(bench.length!==9)throw Error('incomplete workload checks');
 await report({status:'completed',canvasCaptureVerified:true});
 console.log('R53 browser verified',results.length,'GLB files');
}finally{await browser.close()}

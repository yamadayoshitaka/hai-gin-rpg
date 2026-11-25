import {chromium} from 'playwright';
import fs from 'node:fs/promises';
const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
try{
 const page=await browser.newPage({viewport:{width:412,height:850},deviceScaleFactor:1,isMobile:true,hasTouch:true});
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.goto('http://127.0.0.1:8765/',{waitUntil:'networkidle'});await page.waitForFunction(()=>window.reviewReady,{timeout:120000});
 const models=await page.evaluate(()=>window.review.manifest.models),results=[];
 for(const m of models)for(const level of ['lod0','lod1','lod2']){
   const r=await page.evaluate(async({id,level})=>window.review.load(id,level),{id:m.id,level});
   const evidence=await page.evaluate(({m})=>{for(const a of m.clips)window.review.applyAction(a);for(const x of m.morphs)if(window.review.applyExpression(x,1)<1)throw Error('missing morph '+x);window.review.applyExpression('',0);return window.review.health()},{m});
   if(evidence.renderError||r.morphs<13||r.clips<10)throw Error('runtime regression '+m.id+' '+level);
   results.push({...r,expressionControlsVerified:13,actionControlsVerified:10});
 }
 const bench=[];for(const level of ['lod0','lod1','lod2']){
   await page.evaluate(({id,level})=>window.review.load(id,level),{id:models[0].id,level});
   for(const n of [1,20,50])bench.push({level,...await page.evaluate(n=>window.review.benchmark(n,8),n)});
 }
 await page.evaluate(()=>window.review.setCount(1));await page.screenshot({path:'review-browser.png'});
 if(errors.length)throw Error(errors.join('\n'));
 await fs.writeFile('browser-report.json',JSON.stringify({verified:results.length,models:results,benchmark:bench,classification:'headless Chromium software rendering; not Pixel or game FPS',productionApproved:false},null,2));
 if(results.length!==60)throw Error('incomplete browser inventory');
 console.log('R53 browser verified',results.length,'GLB files');
}finally{await browser.close()}

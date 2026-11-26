import {chromium} from 'playwright';import fs from 'node:fs/promises';
const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
try{
 const page=await browser.newPage({viewport:{width:412,height:850},deviceScaleFactor:1,isMobile:true,hasTouch:true});
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.goto('http://127.0.0.1:8765/',{waitUntil:'networkidle'});await page.waitForFunction(()=>window.reviewReady,null,{timeout:120000});
 const manifest=await page.evaluate(()=>window.review.manifest),models=manifest.models,rows=[];
 const expected=manifest.mode==='updated'?126:82;if(models.length!==42)throw Error('roster');
 await page.evaluate(()=>window.review.pause());
 for(const m of models)for(const level of Object.keys(m.levels)){
   const r=await page.evaluate(({id,level})=>window.review.load(id,level),{id:m.id,level});
   await page.evaluate(m=>{for(const n of m.clips)window.review.applyAction(n);for(const n of m.morphs)if(window.review.applyExpression(n,1)<1)throw Error('missing '+n);window.review.applyExpression('',0);window.review.applyAction('Idle_Loop');if(window.review.setParts('body')<1||window.review.setParts('hair')<1)throw Error('part selector empty');window.review.setParts('all')},m);
   if(level==='lod0'){
     for(const mode of (m.group==='cast'?['front','face']:['front'])){
       const data=await page.evaluate(mode=>{window.review.setView(mode);return window.review.capture()},mode);const png=Buffer.from(data.split(',')[1],'base64');
       if(png.length<1000||!png.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))throw Error('canvas capture');
       await fs.mkdir('captures',{recursive:true});await fs.writeFile('captures/'+m.id+'-'+mode+'.png',png);
       await page.evaluate(()=>window.review.pause());
     }
   }
   const health=await page.evaluate(()=>window.review.health());if(health.renderError)throw Error(health.renderError);
   rows.push(r);await fs.writeFile('all42-browser-report.json',JSON.stringify({verified:rows.length,expected,rows,productionApproved:false,classification:'software Chromium, not real device FPS'},null,2));
   console.log('R53 ALL42 loaded',m.id,level,rows.length);
 }
 if(errors.length||rows.length!==expected)throw Error(errors.join('\n')||'inventory');
 console.log('R53 ALL42 verified',rows.length);
}finally{await browser.close()}

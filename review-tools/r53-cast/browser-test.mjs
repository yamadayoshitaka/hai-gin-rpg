import {chromium} from 'playwright';
import fs from 'node:fs/promises';
const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
try{
 const page=await browser.newPage({viewport:{width:412,height:850},deviceScaleFactor:1,isMobile:true,hasTouch:true});
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.goto('http://127.0.0.1:8765/',{waitUntil:'networkidle'});await page.waitForFunction(()=>window.reviewReady,null,{timeout:120000});
 const models=await page.evaluate(()=>window.review.manifest.models),rows=[];
 for(const m of models)for(const level of ['lod0','fifth']){
  const r=await page.evaluate(({id,level})=>window.review.load(id,level),{id:m.id,level});
  await page.evaluate(m=>{for(const n of m.clips)window.review.applyAction(n);for(const n of m.morphs)if(window.review.applyExpression(n,1)<1)throw Error('morph '+n);window.review.applyExpression('',0);window.review.applyAction('Idle_Loop')},m);
  for(const mode of ['front','face','side','rear']){
   const data=await page.evaluate(mode=>{window.review.setView(mode);return window.review.capture()},mode);
   const png=Buffer.from(data.split(',')[1],'base64');if(png.length<1000||!png.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))throw Error('invalid canvas capture');
   await fs.writeFile(m.id+'-'+level+'-'+mode+'.png',png);
  }
  rows.push(r);await fs.writeFile('cast-browser-report.json',JSON.stringify({rows,productionApproved:false,classification:'headless mobile viewport, not real device visual approval'},null,2));
 }
 await page.evaluate(()=>window.review.pause());if(errors.length||rows.length!==4)throw Error(errors.join('\n')||'inventory');
 console.log('R53 cast browser checks',rows.length);
}finally{await browser.close()}

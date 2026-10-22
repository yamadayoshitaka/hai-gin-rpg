const { chromium } = require('playwright');
const fs = require('node:fs');
const base = process.env.QA_URL || 'http://127.0.0.1:8765/';
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl','--ignore-gpu-blocklist']});
 const dir='qa-screenshots';fs.mkdirSync(dir,{recursive:true});
 const results=[];
 for(const id of [0,2,5,8,9,11]){
  const page=await browser.newPage({viewport:{width:430,height:932},deviceScaleFactor:1});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const url=new URL(base);url.searchParams.set('qaShot',String(id));url.searchParams.set('qa','0');url.searchParams.set('build','qa');
  await page.goto(url.toString(),{waitUntil:'domcontentloaded',timeout:45000});
  try{await page.waitForFunction(()=>document.body.dataset.qaShotReady==='true',null,{timeout:25000});await page.waitForTimeout(3500)}catch(e){errors.push('QA shot not ready: '+e.message)}
  const shot=await page.screenshot({path:dir+'/building-'+String(id).padStart(2,'0')+'.png'});
  // Sample pixels to detect almost-uniform or black renders (a blank screenshot is not success).
  const {PNG}=require('pngjs');
  const png=PNG.sync.read(shot), colors=new Set(),stride=12;
  for(let y=220;y<Math.min(png.height-130,800);y+=stride)
   for(let x=20;x<png.width-20;x+=stride){
    const i=(y*png.width+x)*4;
    colors.add([png.data[i]>>4,png.data[i+1]>>4,png.data[i+2]>>4].join(','));
   }
  if(colors.size<28)errors.push('Likely blank or visually uniform render: '+colors.size+' color buckets');
  if(!await page.locator('canvas').count())errors.push('Missing WebGL canvas');
  const build=await page.locator('.brand small').textContent().catch(()=>null);
  results.push({id,build,colorBuckets:colors.size,errors});
  await page.close();
 }
 fs.writeFileSync(dir+'/report.json',JSON.stringify(results,null,2));
 await browser.close();
 console.log(JSON.stringify(results,null,2));
 if(results.some(r=>r.errors.length))process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1});
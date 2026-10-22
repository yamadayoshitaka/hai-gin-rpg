const { chromium } = require('playwright');
const fs = require('node:fs');
const base = process.env.QA_URL || 'http://127.0.0.1:8765/';
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl','--ignore-gpu-blocklist']});
 const dir='qa-screenshots';fs.mkdirSync(dir,{recursive:true});
 const results=[];
 for(const scenario of [...[0,2,5,8,9,11].map(id=>({id,indoor:false})),...[0,2,8,10].map(id=>({id,indoor:true}))]){
  const {id,indoor}=scenario;
  const page=await browser.newPage({viewport:{width:430,height:932},deviceScaleFactor:1});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const url=new URL(base);url.searchParams.set(indoor?'qaIndoor':'qaShot',String(id));url.searchParams.set('qa','0');url.searchParams.set('build','qa');
  await page.goto(url.toString(),{waitUntil:'domcontentloaded',timeout:45000});
  try{await page.waitForFunction(()=>document.body.dataset.qaShotReady==='true',null,{timeout:25000});await page.waitForTimeout(3500)}catch(e){errors.push('QA shot not ready: '+e.message)}
  // Asset reviews compare geometry, not HUD/UI overlays.
  await page.addStyleTag({content:'.hud,.brand,.objective,.location,#ai-status,#audio-controls,#furniture-status,.bottom,.credits,#input-status{visibility:hidden!important}'});
  const shot=await page.screenshot({path:dir+'/'+(indoor?'interior-':'building-')+String(id).padStart(2,'0')+'.png'});
  // Sample pixels to detect almost-uniform or black renders (a blank screenshot is not success).
  const {PNG}=require('pngjs');
  const png=PNG.sync.read(shot), colors=new Set(),stride=12;
  for(let y=220;y<Math.min(png.height-130,800);y+=stride)
   for(let x=20;x<png.width-20;x+=stride){
    const i=(y*png.width+x)*4;
    colors.add([png.data[i]>>4,png.data[i+1]>>4,png.data[i+2]>>4].join(','));
   }
  if(colors.size<28)errors.push('Likely blank or visually uniform render: '+colors.size+' color buckets');
  // Interior floor regression: dark background showing through most of the walkable area.
  let uncovered=0,sampled=0;
  if(indoor)for(let y=440;y<Math.min(830,png.height-90);y+=7)
   for(let x=55;x<Math.min(png.width-55,375);x+=7){
    const p=(y*png.width+x)*4;sampled++;
    if(Math.abs(png.data[p]-52)<3&&Math.abs(png.data[p+1]-59)<3&&Math.abs(png.data[p+2]-70)<3)uncovered++;
   }
  const floorVoidRatio=sampled?uncovered/sampled:0;
  if(indoor&&floorVoidRatio>.33)errors.push('Floor missing: '+Math.round(floorVoidRatio*100)+'% of lower scene is background');

  if(!await page.locator('canvas').count())errors.push('Missing WebGL canvas');
  const build=await page.locator('.brand small').textContent().catch(()=>null);
  const status=await page.evaluate(()=>({
   ready:document.body.dataset.qaShotReady==='true',
   report:window.__haiGinQA?.reports?.map(r=>({invalid:r.invalid,oversize:r.oversize}))||[]
  }));
  if(!status.ready)errors.push('Screenshot never became ready');
  if(status.report.some(r=>r.invalid||r.oversize))errors.push('Invalid model geometry');
  if(await page.locator('#loading').isVisible().catch(()=>false))errors.push('Loading overlay still visible');
  const size=await page.locator('canvas').first().boundingBox().catch(()=>null);
  if(!size||size.width<300||size.height<500)errors.push('WebGL viewport invalid');
  results.push({id,indoor,build,colorBuckets:colors.size,floorVoidRatio,status,errors});
  await page.close();
 }
 fs.writeFileSync(dir+'/report.json',JSON.stringify(results,null,2));
 await browser.close();
 console.log(JSON.stringify(results,null,2));
 if(results.some(r=>r.errors.length))process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1});
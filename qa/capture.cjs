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

  // Non-blocking composition diagnostics. These are proxies, NOT semantic comparison
  // with the aspirational target image (which is not a game screenshot).
  let centralVar=0,centralN=0,lowDetail=0,lowN=0;
  for(let y=240;y<Math.min(690,png.height);y+=8)for(let x=85;x<Math.min(345,png.width);x+=8){
    const p=(y*png.width+x)*4,a=png.data[p],b=png.data[p+1],c=png.data[p+2];
    const p2=(y*png.width+Math.min(x+8,png.width-1))*4;
    centralVar+=Math.abs(a-png.data[p2])+Math.abs(b-png.data[p2+1])+Math.abs(c-png.data[p2+2]);centralN++;
    if(y>490){lowN++;if(Math.max(a,b,c)-Math.min(a,b,c)<13)lowDetail++;}
  }
  const composition={edgeActivity:Math.round(centralVar/Math.max(1,centralN)),lowerGrayShare:+(lowDetail/Math.max(1,lowN)).toFixed(3)};
  const warnings=[];
  if(!indoor&&composition.edgeActivity<15)warnings.push('Low architectural texture variation; inspect facade density');
  if(!indoor&&composition.lowerGrayShare>.76)warnings.push('Lower area is predominantly gray; inspect street material and camera');
  if(indoor&&composition.edgeActivity<12)warnings.push('Low interior visual detail; inspect furniture/lighting');
  // Never auto-pass a design review from an image metric alone.
    if(!await page.locator('canvas').count())errors.push('Missing WebGL canvas');
  const build=await page.locator('.brand small').textContent().catch(()=>null);
  const status=await page.evaluate(()=>({
   ready:document.body.dataset.qaShotReady==='true',
   report:window.__haiGinQA?.reports?.map(r=>({invalid:r.invalid,oversize:r.oversize}))||[],
   assetQA:window.__haiGinAssetQA||null,
   fountainQA:window.__haiGinFountainQA||null
  }));
  // Scene-specific diagnostics make the target comparison actionable, without
  // pretending these pixel proxies can judge the concept art's aesthetics.
  if(!indoor&&id===8){
   if(composition.edgeActivity<13)warnings.push('Inn is visually flat: revise roof pitch and facade massing');
   if(colors.size<55)warnings.push('Inn screenshot has low color/material diversity');
  }
  if(indoor&&id===8&&colors.size<55)warnings.push('Inn interior appears visually sparse or monotone');
    if(!indoor&&!status.fountainQA?.present)errors.push('Town fountain did not initialize');
  if(!indoor&&status.fountainQA?.present&&status.fountainQA.jetCount!==12)errors.push('Missing fountain water jets');
  if(!indoor&&status.fountainQA?.present&&(status.fountainQA.fallingDroplets||0)<64)errors.push('Missing falling water particles');
  if(!indoor&&status.fountainQA?.present&&(status.fountainQA.sprayDroplets||0)<70)errors.push('Missing fountain spray');
  if(!status.ready)errors.push('Screenshot never became ready');
  if(status.assetQA?.loadingFinished&&status.assetQA.texturedRoofs===0&&!indoor){
   warnings.push('No textured roof actually installed: check CDN glTF .bin and texture requests');
  }
  if(status.report.some(r=>r.invalid||r.oversize))errors.push('Invalid model geometry');
  if(await page.locator('#loading').isVisible().catch(()=>false))errors.push('Loading overlay still visible');
  const size=await page.locator('canvas').first().boundingBox().catch(()=>null);
  if(!size||size.width<300||size.height<500)errors.push('WebGL viewport invalid');
  results.push({id,indoor,build,colorBuckets:colors.size,floorVoidRatio,composition,warnings,visualReview:'required',status,errors});
  await page.close();
 }
 fs.writeFileSync(dir+'/report.json',JSON.stringify(results,null,2));
 fs.writeFileSync(dir+'/design-review.json',JSON.stringify({
  target:'qa/TARGET_V10.md',method:'heuristics_plus_scene_specific_warnings',
  requiresHumanOrVisionReview:true,
  scenes:results.map(({id,indoor,composition,warnings})=>({id,indoor,composition,warnings}))
 },null,2));
 await browser.close();
 console.log(JSON.stringify(results,null,2));
 if(results.some(r=>r.errors.length))process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1});
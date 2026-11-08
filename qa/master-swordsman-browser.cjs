// Real WebGL source gate. This is NOT a FF13 art certification.
const {chromium}=require('playwright');
const {PNG}=require('pngjs');
const fs=require('node:fs'),path=require('node:path');
const dir='qa-screenshots/hero-swordsman';fs.mkdirSync(dir,{recursive:true});
const read=name=>PNG.sync.read(fs.readFileSync(path.join(dir,name)));
function changed(a,b,threshold=48){
 const l=read(a),r=read(b);
 if(l.width!==r.width||l.height!==r.height)throw Error('Camera dimensions changed');
 let n=0;
 for(let i=0;i<l.data.length;i+=4){
  if(Math.abs(l.data[i]-r.data[i])+Math.abs(l.data[i+1]-r.data[i+1])+
   Math.abs(l.data[i+2]-r.data[i+2])>threshold)n++;
 }
 return n;
}
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader']});
 try{
  const page=await browser.newPage({viewport:{width:1090,height:850},deviceScaleFactor:1});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('response',r=>{if(r.status()>=400&&/assets\/master-sources/.test(r.url()))errors.push('Missing source '+r.status()+' '+r.url())});
  await page.goto('http://127.0.0.1:8765/master-swordsman-prototype.html?qa=1',{waitUntil:'domcontentloaded',timeout:60000});
  try{
   await page.waitForFunction(()=>window.__heroSwordsmanQA?.().loaded===true,null,{timeout:65000,polling:250});
  }catch(e){
   console.error('HERO_READ_ERROR',await page.locator('#diagnostics').textContent());
   await page.screenshot({path:path.join(dir,'load-failed.png')});throw e;
  }
  const data=await page.evaluate(()=>window.__heroSwordsmanQA());
  if(!data.actualBody||!data.actualFace||!data.actualTexturedCloth||data.nativeGarmentMaps<5||
      data.faceMorphs.length!==7||data.skinned||data.ff13ArtGatePassed)
   throw Error('Invalid integrated geometry or misleading art-quality claim '+JSON.stringify(data));
  const canvas=page.locator('#canvas');
  await page.locator('#autoBlink').uncheck();
  await page.waitForTimeout(250);
  await canvas.screenshot({path:path.join(dir,'full-swordsman.png')});
  await page.locator('#portrait').click();
  await page.waitForTimeout(450);
  await page.evaluate(()=>window.__heroSwordsmanHoldBlink(0));
  await canvas.screenshot({path:path.join(dir,'head-swordsman-open.png')});
  await page.evaluate(()=>window.__heroSwordsmanHoldBlink(1));
  await page.waitForTimeout(150);
  await canvas.screenshot({path:path.join(dir,'head-swordsman-closed.png')});
  const eyeDelta=changed('head-swordsman-open.png','head-swordsman-closed.png');
  if(eyeDelta<150)throw Error('Blink does not visibly cover real iris: '+eyeDelta);
  await page.evaluate(()=>window.__heroSwordsmanHoldBlink(0));
  await page.evaluate(()=>window.__heroSwordsmanPreset('mage'));
  await page.waitForTimeout(200);
  await canvas.screenshot({path:path.join(dir,'head-mage-shape.png')});
  const faceDelta=changed('head-swordsman-open.png','head-mage-shape.png');
  if(faceDelta<120)throw Error('Swordsman and mage do not have visibly distinct 3D anatomy: '+faceDelta);
  await page.locator('#full').click();
  await page.waitForTimeout(400);
  await canvas.screenshot({path:path.join(dir,'full-dressed.png')});
  await page.locator('#outfitOn').uncheck();
  await page.waitForTimeout(210);
  await canvas.screenshot({path:path.join(dir,'full-undressed-source.png')});
  const wardrobeDelta=changed('full-dressed.png','full-undressed-source.png');
  if(wardrobeDelta<600)throw Error('Real clothing source not actually visible: '+wardrobeDelta);
  await page.locator('#outfitOn').check();
  await page.locator('#preset').selectOption('swordsman');
  await page.locator('#side').click();
  await page.waitForTimeout(350);
  await canvas.screenshot({path:path.join(dir,'full-side.png')});
  await page.locator('#back').click();
  await page.waitForTimeout(350);
  await canvas.screenshot({path:path.join(dir,'full-back.png')});
  if(errors.length)throw Error('Browser errors: '+errors.join(' / '));
  const report={...data,eyeChangedPixels:eyeDelta,faceChangedPixels:faceDelta,
   wardrobeChangedPixels:wardrobeDelta,realScreenshots:8,
   actualCC0SourceMeshes:true,previewOnly:true,
   normalOrRoughnessScanApplied:false,rigOrWalkValidated:false,
   artGradeCertified:false,errors};
  fs.writeFileSync(path.join(dir,'report.json'),JSON.stringify(report,null,2)+'\n');
  console.log('HERO_SWORDSMAN_INTEGRATED_BROWSER_PASS '+JSON.stringify(report));
 }finally{await browser.close();}
})().catch(e=>{console.error('HERO_SWORDSMAN_INTEGRATED_BROWSER_FAILED',e);process.exitCode=1});

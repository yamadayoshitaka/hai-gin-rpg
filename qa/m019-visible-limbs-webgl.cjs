'use strict';
// Pixel-level WebGL evidence: visible skin is not inferred from skeleton
// locations, shadow silhouettes, or a Mesh.visible flag.
const {chromium}=require('playwright');
const {PNG}=require('pngjs');
const fs=require('node:fs'),path=require('node:path');
const out=process.argv[2]||'qa-reports/m019-visible-limbs';
const decode=buffer=>PNG.sync.read(buffer);
function measure(normal,magenta,hidden){
 const a=decode(normal),b=decode(magenta),c=decode(hidden);
 if(a.width!==b.width||a.height!==b.height||
    a.width!==c.width||a.height!==c.height)
  throw Error('m019 WebGL screenshots differ in canvas dimensions');
 let projected=0,physicallyVisible=0,lum=0;
 for(let i=0;i<a.data.length;i+=4){
  const mag=b.data[i]>190&&b.data[i+2]>160&&b.data[i+1]<105;
  if(!mag)continue;
  projected++;
  const dr=Math.abs(a.data[i]-c.data[i])+
   Math.abs(a.data[i+1]-c.data[i+1])+
   Math.abs(a.data[i+2]-c.data[i+2]);
  if(dr>29)physicallyVisible++;
  lum+=a.data[i]*.2126+a.data[i+1]*.7152+a.data[i+2]*.0722;
 }
 return {projected,physicallyVisible,
  visibilityFraction:physicallyVisible/Math.max(1,projected),
  averageLuminance:lum/Math.max(1,projected)};
}
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 const browser=await chromium.launch({headless:true,args:[
  '--use-gl=angle','--use-angle=swiftshader',
  '--enable-webgl','--ignore-gpu-blocklist'
 ]});
 const report=[];
 try{
  const page=await browser.newPage({viewport:{width:720,height:940},deviceScaleFactor:1});
  const errors=[];
  page.on('pageerror',error=>errors.push(String(error)));
  await page.goto('http://127.0.0.1:8765/monster-manager.html?monster=m019&qa=v11-real-visible',
   {waitUntil:'domcontentloaded',timeout:90000});
  await page.waitForFunction(()=>window.__m019LimbVisibilityQA?.()?.ready===true,
   {timeout:60000});
  for(const action of ['idle','walk','run']){
   await page.locator('#actions button[title="'+action+'"]').click({timeout:10000});
   await page.waitForFunction(a=>
    window.__monsterViewerLayoutQA?.()?.selectedMotion===a,
    action,{timeout:10000});
   for(const angle of ['front','side']){
    const cam=await page.evaluate(a=>window.__beastFaceCameraQA?.(a),angle);
    if(!cam||cam.id!=='m019')throw Error('missing real '+angle+' view');
    await page.waitForTimeout(180);
    const state=await page.evaluate(()=>window.__m019LimbVisibilityQA?.());
    if(!state?.ready||state.gpuSkinnedLimbs!==0||state.meshCount!==4)
     throw Error('m019 leg mesh setup failed '+JSON.stringify(state));
    const canvas=page.locator('#view canvas');
    const save=mode=>page.evaluate(m=>window.__m019LimbPixelProbeQA?.(m),mode);
    let normal,magenta,hidden;
    try{
     await save('natural');
     normal=await canvas.screenshot({timeout:45000});
     await save('magenta');
     magenta=await canvas.screenshot({timeout:45000});
     await save('hidden');
     hidden=await canvas.screenshot({timeout:45000});
    }finally{await save('restore')}
    const pixels=measure(normal,magenta,hidden);
    // The old v10 code cast large leg-shaped SHADOWS but exposed almost no
    // visible limb pixels. This test disables shadows and requires actual
    // rasterized geometry with a visible basalt-vs-background contrast.
    if(pixels.projected<260||pixels.physicallyVisible<130||
       pixels.visibilityFraction<.35||pixels.averageLuminance<19)
     throw Error('m019 SHADOW-ONLY LEGS '+action+' '+angle+
      ': '+JSON.stringify(pixels));
    const filename=path.join(out,'m019-'+action+'-'+angle+'.png');
    fs.writeFileSync(filename,normal);
    report.push({action,angle,filename,bytes:normal.length,
     pixels,limbs:state.limbs,visualApproved:false});
   }
  }
  if(errors.length)throw Error('viewer JS: '+errors.join('; '));
  fs.writeFileSync(path.join(out,'report.json'),
   JSON.stringify({id:'m019',source:'actual-chromium-webgl',
    gate:'pixel-projected-skin-vs-shadow-off-hidden',
    report,visualApproved:false,androidDeviceVerified:false},null,2)+'\n');
  console.log('PASS: m019 real basalt limb pixels visible in six actual WebGL views');
 }finally{await browser.close();}
})().catch(e=>{console.error('M019_PIXEL_VISUAL_FAILED '+e.stack);process.exit(2)});

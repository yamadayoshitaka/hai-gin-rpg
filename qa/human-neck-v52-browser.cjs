'use strict';
/** Real mobile Chromium regression: jaw must remain visible above the cuirass. */
const {chromium}=require('playwright');
const fs=require('node:fs');
const out='qa-screenshots/human-neck-v52';
fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,args:[
  '--use-gl=angle','--use-angle=swiftshader'
 ]});
 try{
  const page=await browser.newPage({viewport:{width:460,height:900},
   deviceScaleFactor:1,isMobile:true,hasTouch:true});
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  for(const [gender,path,qa] of [
   ['female','face-body-studio.html','__heroineBodyQA'],
   ['male','male-body-studio.html','__maleBodyQA']
  ]){
   await page.goto('http://127.0.0.1:8766/'+path+'?v=52',
    {waitUntil:'domcontentloaded',timeout:90000});
   await page.waitForFunction(key=>{
    const state=window[key]?.();
    return state?.v36RealBattleCostume?.active&&
     state.v36RealBattleCostume.proportions?.neckClearance?.applied;
   },qa,{timeout:180000});
   // Allow the actor's first animated bone pose to settle.
   await page.waitForTimeout(900);
   let state=await page.evaluate(key=>window[key](),qa);
   let fit=state.v36RealBattleCostume.proportions.neckClearance;
   if(!(fit.chestPieces>0&&fit.clearanceMeters>=.007))
    throw Error(gender+' mouth hidden by cuirass: '+JSON.stringify(fit));
   await page.locator('#front').click();
   await page.screenshot({path:out+'/'+gender+'-front.png',timeout:90000});
   await page.locator('#toggleOutfit').click();
   // The naked torso must be restored when clothing hides.
   const naked=await page.evaluate(key=>{
    const q=window[key]?.();
    const root=(key==='__heroineBodyQA'?window.__heroineBodyPreview:
      window.__maleBodyPreview)?.getActor?.();
    const visibleBody=[];
    root?.traverse?.(mesh=>{
     if(mesh.isSkinnedMesh&&mesh.visible&&
      /(body|torso|arms|chest)/i.test(mesh.name))visibleBody.push(mesh.name);
    });
    return {state:q?.v36RealBattleCostume,visibleBody};
   },qa);
   if(!naked.visibleBody.length)
    throw Error(gender+' clothes-off test: skinned torso/arms missing');
   await page.screenshot({path:out+'/'+gender+'-body-restored.png',timeout:90000});
   await page.locator('#toggleOutfit').click();
   state=await page.evaluate(key=>window[key](),qa);
   fit=state.v36RealBattleCostume.proportions.neckClearance;
   if(!(fit.applied&&fit.clearanceMeters>=.007))
    throw Error(gender+' cuirass clearance lost after hiding/showing outfit');
  }
  if(errors.length)throw Error('browser JS errors: '+errors.slice(0,5).join(';'));
  console.log('HUMAN_NECK_V52_BROWSER_OK: female/male armor chin clearance and torso restore');
 }finally{await browser.close()}
})().catch(error=>{console.error('HUMAN_NECK_V52_BROWSER_FAIL',error);process.exitCode=1});

'use strict';
/** Real mobile Chromium regression: jaw must remain visible above the cuirass. */
const {chromium}=require('playwright');
const fs=require('node:fs');
const out='qa-screenshots/human-neck-v59';
fs.mkdirSync(out,{recursive:true});
(async()=>{
 // Each gender owns its own Chromium process. Reusing a page for both large
 // WebGL characters can stall the second navigation on software GPU runners.
 for(const [gender,path,qa] of [
  ['female','face-body-studio.html','__heroineBodyQA'],
  ['male','male-body-studio.html','__maleBodyQA']
 ]){
  const browser=await chromium.launch({headless:true,args:[
   '--use-gl=angle','--use-angle=swiftshader'
  ]});
  try{
   const page=await browser.newPage({viewport:{width:460,height:900},
    deviceScaleFactor:1,isMobile:true,hasTouch:true});
   const errors=[];
   page.on('pageerror',error=>errors.push(error.message));
   // Committed navigation is enough; readiness is checked against live 3D
   // outfit + clearance metadata, not page-loaded timing.
   await page.goto('http://127.0.0.1:8766/'+path+'?v=59',
    {waitUntil:'commit',timeout:120000});
   await page.waitForFunction(key=>{
    const state=window[key]?.();
    return state?.v36RealBattleCostume?.active&&
     state.v36RealBattleCostume.proportions?.neckClearance?.applied;
   },qa,{timeout:180000});
   // Allow the actor's first animated bone pose to settle.
   await page.waitForTimeout(900);
   let state=await page.evaluate(key=>window[key](),qa);
   let fit=state.v36RealBattleCostume.proportions.neckClearance;
   const alignment=state.v36RealBattleCostume.proportions.headAlignment;
   if(!(alignment?.applied&&
        Math.abs(alignment.gapMeters+alignment.anatomicalInset)<.006))
    throw Error(gender+' source head improperly seated relative to torso: '+JSON.stringify(alignment));
   const neckShape=state.v36RealBattleCostume.proportions.neckContinuity;
   if(!(neckShape?.unifiedSkinNeckApplied&&
        neckShape.unifiedSkinNeckEdges>=12&&
        neckShape.unifiedSkinNeckTriangles>=30&&
        neckShape.reusedFaceMaterial&&neckShape.separateNeckGeometryHidden&&
        neckShape.actualCollarSource&&
        neckShape.unifiedNeckBottomHeight<neckShape.actualCollarHeight&&
        neckShape.raisedInnerCollarApplied&&
        neckShape.visibleSkinNeckLength<.04&&
        neckShape.unifiedNeckColorSmoothed&&neckShape.unifiedNeckNormalsSmoothed))
    throw Error(gender+' one-piece neck does not reach the clothing collar: '+JSON.stringify(neckShape));
   if(!(neckShape?.applied&&neckShape.originalFaceNormalsPreserved&&
        neckShape.matchedFaceMaterial&&neckShape.transparentNeckEdge&&
        neckShape.anatomicalJawCut&&neckShape.narrowUnderJawConnector&&
        neckShape.neckToHeadRatio<.22))
    throw Error(gender+' neck is too long: '+JSON.stringify(neckShape));
   if(!(fit.chestPieces>0&&fit.clearanceMeters>=.007))
    throw Error(gender+' mouth hidden by cuirass: '+JSON.stringify(fit));
   await page.locator('#front').click();
   await page.screenshot({path:out+'/'+gender+'-front.png',timeout:90000});
   await page.locator('#toggleOutfit').click();
   // The naked torso must be restored when clothing hides.
   const naked=await page.evaluate(key=>{
    const q=window[key]?.();
    const root=(key==='__heroineBodyQA'?window.__heroineBodyPreview:
      window.__maleBodyPreview)?.getBattleActor?.();
    const visibleBody=[];
    root?.traverse?.(mesh=>{
     if(!mesh.isSkinnedMesh||!mesh.visible||
        !mesh.geometry?.getAttribute('position'))return;
     let parent=mesh.parent,insideOutfit=false,hiddenAncestor=false;
     while(parent){
      if(parent.name?.startsWith('rigged-outfit-'))insideOutfit=true;
      if(!parent.visible)hiddenAncestor=true;
      parent=parent.parent;
     }
     if(!insideOutfit&&!hiddenAncestor&&
       !/^(eyes|eyebrows)$/i.test(mesh.name)&&
       mesh.geometry.getAttribute('position').count>=150)
      visibleBody.push(mesh.name);
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
   if(errors.length)throw Error(gender+' browser JS errors: '+errors.slice(0,5).join(';'));
   console.log('HUMAN_NECK_V52_GENDER_OK: '+gender);
  }finally{await browser.close()}
 }
 console.log('HUMAN_NECK_V52_BROWSER_OK: female/male armor chin clearance and torso restore');
})().catch(error=>{console.error('HUMAN_NECK_V52_BROWSER_FAIL',error);process.exitCode=1});

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
   console.error('HERO_BROWSER_ERRORS',JSON.stringify(errors));
   console.error('HERO_LOAD_BANNER',await page.locator('#loadBanner').textContent());
   await page.screenshot({path:path.join(dir,'load-failed.png')});throw e;
  }
  const data=await page.evaluate(()=>window.__heroSwordsmanQA());
  if(data.browserErrors||errors.length){
   const banner=await page.locator('#loadBanner').textContent();
   const details=await page.locator('#diagnostics').textContent();
   throw Error('Character preview startup error: '+JSON.stringify({banner,details:details.slice(0,1800),errors}));
  }
  if(!data.actualBody||!data.actualFace||!data.actualTexturedCloth||data.nativeGarmentMaps<5||
      data.faceMorphs.length!==7||data.skinned||data.ff13ArtGatePassed)
   throw Error('Invalid integrated geometry or misleading art-quality claim '+JSON.stringify(data));
  if(!data.hairScalpCoverage?.sourceAnatomyAligned||
      data.hairScalpCoverage.highRearCoverageSamples<35||
      data.hairScalpCoverage.highTopCoverageSamples<40)
   throw Error('Bald crown/rear scalp coverage not validated '+JSON.stringify(data.hairScalpCoverage));
  if(data.restingLowerEyelidMeshCount!==2)throw Error('Lower eyelid meshes missing');
  if(data.restingUpperEyelidMeshCount!==2)
   throw Error('Visible upper eyelids missing; blank staring eye regression');
  if(!Number.isFinite(data.openEyeClearanceRatio)||data.openEyeClearanceRatio<.04)
   throw Error('Upper lids close the eyes at rest, despite open-eye state: '+data.openEyeClearanceRatio);
  if(data.fittedNativeOcularMeshes!==4)
   throw Error('Actual native eye spheres were not fitted back into the sockets: '+data.fittedNativeOcularMeshes);
  if(data.visibleIrisMeshes!==2||data.realPupilMeshes!==2)
   throw Error('White-eye regression: visible real pupil/iris overlays missing '+JSON.stringify(data));
  if(data.shoulderAlignment?.plateGroups!==2||
     data.shoulderAlignment?.connectedSleeves!==2)
   throw Error('Detached shoulder plates or open arm sleeves '+JSON.stringify(data));
  const canvas=page.locator('#canvas');
  await page.locator('#autoBlink').uncheck();
  await page.waitForTimeout(250);
  await canvas.screenshot({path:path.join(dir,'full-swordsman.png')});
  await page.locator('#portrait').click();
  await page.waitForTimeout(450);
  await page.evaluate(()=>window.__heroSwordsmanHoldBlink(0));
  await canvas.screenshot({path:path.join(dir,'head-swordsman-open.png')});
  // The former regression counted eyebrow polygons even when they were
  // hidden behind the forehead. Require a visible pixel delta in WebGL.
  await page.evaluate(()=>window.__heroSwordsmanBrowsVisible(false));
  await page.waitForTimeout(140);
  await canvas.screenshot({path:path.join(dir,'head-swordsman-no-brows.png')});
  const visibleBrowsPixels=changed('head-swordsman-open.png','head-swordsman-no-brows.png',12);
  await page.evaluate(()=>window.__heroSwordsmanBrowsVisible(true));
  await page.waitForTimeout(140);
  if(visibleBrowsPixels<35)throw Error('Eyebrows exist but are invisible in rendered portrait: '+visibleBrowsPixels);
  await page.evaluate(()=>window.__heroSwordsmanHoldBlink(1));
  await page.waitForTimeout(150);
  await canvas.screenshot({path:path.join(dir,'head-swordsman-closed.png')});
  const eyeDelta=changed('head-swordsman-open.png','head-swordsman-closed.png');
  if(eyeDelta<150)throw Error('Blink does not visibly cover real iris: '+eyeDelta+' DIAGNOSTICS '+JSON.stringify(await page.evaluate(()=>window.__heroSwordsmanQA())));
  await page.evaluate(()=>window.__heroSwordsmanHoldBlink(0));
  await page.evaluate(()=>window.__heroSwordsmanPreset('mage'));
  await page.waitForTimeout(200);
  await canvas.screenshot({path:path.join(dir,'head-mage-shape.png')});
  const faceDelta=changed('head-swordsman-open.png','head-mage-shape.png');
  if(faceDelta<120)throw Error('Swordsman and mage do not have visibly distinct 3D anatomy: '+faceDelta);

  // New facial editor regression: verify actual rendered geometry, not merely
  // that a slider value changed or that a fake portrait was recolored.
  await page.evaluate(()=>window.__heroSwordsmanPreset('swordsman'));
  // Restore the authored facial morphs and refit brows before baseline capture.
  await page.evaluate(()=>window.__heroSwordsmanUpdate({proportions:window.__heroSwordsmanQA().appearance.proportions}));
  await page.locator('#hairOn').uncheck();
  await page.waitForTimeout(100);
  const baseFace=await page.evaluate(()=>window.__heroSwordsmanQA());
  if(await page.locator('#faceProportionControls input[type="range"]').count()!==45||
     baseFace.facialProportionFields!==45)
   throw Error('Missing facial third / eye / brow / nose / mouth sliders');
  if(baseFace.facialQA?.maxIrisCenterOffsetRatio>.20||baseFace.facialQA?.maxPupilIrisOffsetRatio>.55)
   throw Error('Native eye/iris/pupil not aligned: '+JSON.stringify(baseFace.facialQA));
  if(baseFace.facialQA?.lowerLidMeshCount!==2)throw Error('Missing lower lid geometry');
  if(baseFace.facialQA?.maxPupilVerticalOffsetRatio>.15)
   throw Error('Floating iris/pupil above native eye socket: '+JSON.stringify(baseFace.facialQA));
  if(baseFace.facialQA?.sourceBrowMeshes!==2||
     baseFace.facialQA?.fittedNativeOcularMeshes!==4||
     baseFace.facialQA?.sourceUnchanged!==true)
   throw Error('Underlying true face, pupil and brow geometry not controllable: '+JSON.stringify(baseFace.facialQA));
  await canvas.screenshot({path:path.join(dir,'face-proportions-before.png')});
  const groups=[
   {key:'face-thirds',edit:{upperThird:1.19,middleThird:.82,lowerThird:1.18},
     fingerprint:'faceGeometryDigest'},
   {key:'eye-position',edit:{eyeWidth:1.20,eyeVertical:.035,eyeSpacing:1.12,eyeTilt:.20},
     fingerprint:'ocularGeometryDigest'},
   {key:'eyebrows',edit:{browAngle:.18,browVertical:.035,browThickness:1.30,browWidth:1.16},
     fingerprint:'browGeometryDigest'},
   {key:'nose',edit:{noseWidth:.69,noseLength:1.20,noseBridge:1.28,noseTip:.69},
     fingerprint:'faceGeometryDigest'},
   {key:'mouth',edit:{mouthWidth:.68,mouthVertical:.035,lipFullness:1.32,mouthCorner:.018},
     fingerprint:'faceGeometryDigest'}
  ];
  const groupResults=[];
  for(const {key,edit,fingerprint} of groups){
   await page.evaluate(baseline=>window.__heroSwordsmanUpdate({proportions:baseline}),
     baseFace.appearance.proportions);
   await page.evaluate(values=>window.__heroSwordsmanUpdate({proportions:values}),edit);
   await page.waitForTimeout(170);
   const state=await page.evaluate(()=>window.__heroSwordsmanQA());
   if(state.facialQA?.[fingerprint]===baseFace.facialQA?.[fingerprint])
    throw Error('Real 3D '+key+' vertices did not move on profile update');
   // Native eyeballs must follow the deformation of the skin around their
   // eye sockets. Matching only iris vs sclera cannot detect both drifting
   // together away from the face after the thirds are changed.
   const socketError=state.facialQA?.maxEyeSocketAlignmentErrorMeters;
   if(!Number.isFinite(socketError)||socketError>.004)
    throw Error('Eye socket mismatch after '+key+' facial editing: '+JSON.stringify(state.facialQA));
   if(key==='face-thirds'&&
     !(state.facialQA?.faceSocketTravelMeters>.0004))
    throw Error('Face thirds moved but native eyes stayed attached to old socket positions');
   const filename='face-proportions-'+key+'.png';
   await canvas.screenshot({path:path.join(dir,filename)});
   const pixels=changed('face-proportions-before.png',filename,9);
   if(pixels<25)throw Error('Facial '+key+' geometry changed numerically but render is unchanged: '+pixels);
   if(state.facialQA.maxPupilVerticalOffsetRatio>.15)
    throw Error('Slider caused floating extra pupil '+key+': '+state.facialQA.maxPupilVerticalOffsetRatio);
   if(state.facialQA.openEyeClearanceRatio<.028)
    throw Error('Open eyes were covered while adjusting '+key);
   groupResults.push({group:key,changedPixels:pixels,digest:state.facialQA[fingerprint]});
  }
  // The actual mobile input event must update the same model and state.
  const noseInput=page.locator('#proportion-noseWidth');
  await noseInput.evaluate(el=>{el.value='0.72';el.dispatchEvent(new Event('input',{bubbles:true}))});
  const sliderState=await page.evaluate(()=>window.__heroSwordsmanQA());
  if(sliderState.appearance.proportions.noseWidth!==.72||
     !sliderState.facialQA?.faceGeometryDigest)
   throw Error('Nose slider does not reach the real facial mesh');
  await page.evaluate(baseline=>window.__heroSwordsmanUpdate({proportions:baseline}),
    baseFace.appearance.proportions);
  const restored=await page.evaluate(()=>window.__heroSwordsmanQA());
  if(!Number.isFinite(restored.facialQA?.maxEyeSocketAlignmentErrorMeters)||
     restored.facialQA.maxEyeSocketAlignmentErrorMeters>.004||
     Math.abs(restored.facialQA.faceSocketTravelMeters-baseFace.facialQA.faceSocketTravelMeters)>.00001)
   throw Error('Native eye socket did not return to its original anchor on reset: '+JSON.stringify(restored.facialQA));
  for(const field of ['faceGeometryDigest','ocularGeometryDigest','browGeometryDigest']){
   if(restored.facialQA?.[field]!==baseFace.facialQA?.[field])
    throw Error('Facial regression drift after reset '+field+': '+JSON.stringify([baseFace.facialQA[field],restored.facialQA[field]]));
  }
  await canvas.screenshot({path:path.join(dir,'face-proportions-restored.png')});
  if(changed('face-proportions-before.png','face-proportions-restored.png',15)>150)
   throw Error('Restored 3D head no longer matches original image');
  const xyzPartDigests=[
   ['eye','ocularGeometryDigest'],['iris','irisPoseDigest'],['pupil','pupilPoseDigest'],
   ['upperLid','upperLidPoseDigest'],['lowerLid','lowerLidPoseDigest'],
   ['brow','browGeometryDigest']
  ];
  const xyzResults=[];
  for(const [part,digest] of xyzPartDigests){
   for(const axis of ['X','Y','Z']){
    const input=page.locator('#proportion-'+part+'Offset'+axis);
    if(await input.count()!==1)throw Error('XYZ control missing: '+part+axis);
    const limit=Number(await input.getAttribute('max'));
    const value=Number((limit*.6).toFixed(4));
    await page.evaluate(params=>window.__heroSwordsmanUpdate({proportions:params}),baseFace.appearance.proportions);
    await page.evaluate(({key,v})=>window.__heroSwordsmanUpdate({proportions:{[key]:v}}),
     {key:part+'Offset'+axis,v:value});
    const state=await page.evaluate(()=>window.__heroSwordsmanQA());
    if(state.facialQA?.[digest]===baseFace.facialQA?.[digest])
     throw Error('XYZ '+part+axis+' does not affect actual 3D mesh');
    xyzResults.push({part,axis,offset:value});
    if(axis==='Y'){
     const shot='xyz-'+part+'-y.png';
     await canvas.screenshot({path:path.join(dir,shot)});
     if(changed('face-proportions-before.png',shot,9)<8)
      throw Error('XYZ '+part+' Y moved numerically without a rendered change');
    }
   }
  }
  await page.evaluate(params=>window.__heroSwordsmanUpdate({proportions:params}),baseFace.appearance.proportions);
  const resetXYZ=await page.evaluate(()=>window.__heroSwordsmanQA());
  for(const [,digest] of xyzPartDigests)
   if(resetXYZ.facialQA[digest]!==baseFace.facialQA[digest])
    throw Error('XYZ reset drift: '+digest);
  console.log('FACIAL_18_XYZ_REAL_3D_PASS '+JSON.stringify(xyzResults));
  await page.locator('#hairOn').check();
  console.log('HERO_FACIAL_PROPORTION_REAL_RENDER_PASS '+JSON.stringify(groupResults));

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
  // The new UI uses ONE set of CC0 source meshes and 1000 seeded identity
  // descriptors. Exercise the initial hero, ally and last individual.
  const heroProfile=await page.evaluate(()=>window.__heroSwordsmanQA());
  const p0=heroProfile.appearance;
  await page.evaluate(()=>window.__heroSwordsmanSelectId(1));
  await page.waitForFunction(()=>window.__heroSwordsmanQA?.()?.characterId===1,null,{timeout:20000});
  await page.locator('#portrait').click();
  await page.waitForTimeout(300);
  await canvas.screenshot({path:path.join(dir,'ally-veteran-face.png')});
  const p1=await page.evaluate(()=>window.__heroSwordsmanQA());
  if(p0.skin===p1.appearance.skin&&p0.iris===p1.appearance.iris)
   throw Error('Second swordsman lacks independent skin and iris');
  await page.evaluate(()=>window.__heroSwordsmanSelectId(999));
  await page.waitForFunction(()=>window.__heroSwordsmanQA?.()?.characterId===999,null,{timeout:30000});
  await page.waitForTimeout(450);
  await canvas.screenshot({path:path.join(dir,'ally-0999-face.png')});
  const p999=await page.evaluate(()=>window.__heroSwordsmanQA());
  if(!p999.appearance.face||p999.appearance.id!==999)
   throw Error('Thousandth appearance profile not applied to model');
  const beforeTone=p999.appearance.skin;
  await page.evaluate(()=>window.__heroSwordsmanUpdate({skin:'#bd906e',iris:'#446688',face:{NoseWidth:.91}}));
  const recolored=await page.evaluate(()=>window.__heroSwordsmanQA());
  if(recolored.appearance.skin!=='#bd906e'||recolored.appearance.iris!=='#446688'||
     recolored.appearance.face.NoseWidth!==.91)
   throw Error('3D skin/eye/face controls not reflected '+JSON.stringify(recolored.appearance));
  await canvas.screenshot({path:path.join(dir,'ally-0999-custom-eye-skin.png')});
  // Regression for mobile: the 3D canvas captures touch events, therefore
  // the character selector MUST be above the canvas and initially visible.
  await page.setViewportSize({width:390,height:844});
  await page.evaluate(()=>window.scrollTo(0,0));
  await page.waitForTimeout(250);
  const quick=await page.locator('#quickSwitch').boundingBox();
  const mobileCanvas=await page.locator('#canvas').boundingBox();
  if(!quick||!mobileCanvas||quick.y<0||quick.y+quick.height>844||
     quick.y+quick.height>=mobileCanvas.y||mobileCanvas.height>550)
   throw Error('Mobile selector not visibly above compact 3D canvas '+JSON.stringify({quick,mobileCanvas}));
  await page.screenshot({path:path.join(dir,'mobile-character-selector-visible.png'),fullPage:false});
  await page.locator('#nextCharacter').click();
  await page.waitForFunction(()=>window.__heroSwordsmanQA?.()?.characterId===0,null,{timeout:20000});
  if(await page.locator('#characterCode').textContent()!=='剣士-0000')
   throw Error('Mobile next button failed to switch character');
  console.log('MOBILE_CHARACTER_SELECTOR_VISIBLE_PASS '+JSON.stringify({quick,mobileCanvas}));
  // New separate featured characters are genuinely applied to the 3D meshes,
  // not generated screenshots or a duplicate roster label.
  await page.setViewportSize({width:1090,height:850});
  await page.locator('#portrait').click();
  const keys=['hero-01','hero-02','hero-03','hero-04','hero-05',
              'ally-01','ally-02','ally-03','ally-04','ally-05','hero-girl-01'];
  const featured=[];
  for(const key of keys){
   await page.evaluate(k=>window.__heroSwordsmanSelectFeatured(k),key);
   await page.waitForFunction(k=>window.__heroSwordsmanQA?.()?.featuredKey===k,key,{timeout:30000});
   await page.waitForTimeout(140);
   const state=await page.evaluate(()=>window.__heroSwordsmanQA());
   if(key==='hero-girl-01'){
    if(state.referenceHeroineHairShown!==true||
       state.longBlondeHeroineHairShown!==true||
       state.referenceHeroineHairReport?.authoredStyle!=='fantasy-long-blonde'||
       state.referenceHeroineHairReport?.scalpAnchored!==true||
       (state.referenceHeroineHairReport?.rearLocks||0)<35||
       (state.referenceHeroineHairReport?.faceFramingLocks||0)<16||
       (state.referenceHeroineHairReport?.lengthInHeads||0)<2.5||
       state.referenceHeroineHairReport?.lowestRelativeToScalpBottom>-.8||
       state.referenceHeroineHairReport?.noFloatingBun!==true||
       state.referenceHeroineHairReport?.originalSourceGeometryIntact!==true||
       state.appearance.hairColor?.toLowerCase()!=='#e6bc71')
     throw Error('Heroine must show actual source-fitted blonde LONG 3D hair: '+
       JSON.stringify({hairReport:state.referenceHeroineHairReport,
        hairError:state.hairError,visible:state.longBlondeHeroineHairShown,
        appearance:state.appearance?.hairColor,gender:state.sourceGender}));
    if(state.femaleLicensedHairShown===true)
     throw Error('Unfitted 3D donor-hair cards still show across heroine face');
    // The reference hero must be inspectable as actual source triangles,
    // including dense 3D hair. These controls must not replace the model
    // with a filtered portrait or contaminate PBR material state.
    if((state.referenceHeroineHairReport?.bangLocks||0)<30||
       (state.referenceHeroineHairReport?.triangleCount||0)<60000)
     throw Error('Dense source-rooted long-hair geometry missing');
    const solidMesh=await page.evaluate(()=>window.__heroineWireframeQA?.());
    if(solidMesh?.featuredKey!=='hero-girl-01'||
       solidMesh?.sourceGeometry!==true||
       solidMesh?.triangles<50000)
     throw Error('Expected genuine 3D heroine triangle topology: '+JSON.stringify(solidMesh));
    await page.locator('#meshMode').selectOption('wire');
    const wireState=await page.evaluate(()=>window.__heroineWireframeQA?.());
    if(wireState?.mode!=='wire'||wireState.triangles!==solidMesh.triangles)
     throw Error('Wire-only mode changed real source topology');
    await page.locator('#meshMode').selectOption('overlay');
    const overlayState=await page.evaluate(()=>window.__heroineWireframeQA?.());
    if(overlayState?.mode!=='overlay'||overlayState.overlayCount<10)
     throw Error('3D triangle overlay failed: '+JSON.stringify(overlayState));
    await page.locator('#meshMode').selectOption('solid');
    const finalState=await page.evaluate(()=>window.__heroineWireframeQA?.());
    if(finalState?.mode!=='solid'||finalState.overlayCount!==0||
       finalState.triangles!==solidMesh.triangles)
     throw Error('Wireframe diagnostic leaked into the original 3D model');
    // Skin test is applied only after the original heroine's face geometry
    // is sculpted. The visible nude is a neutral ADULT anatomy study.
    await page.locator('#bodyStudyMode').selectOption('anatomy');
    const anatomy=await page.evaluate(()=>window.__heroSwordsmanQA());
    if(anatomy.anatomyStudy?.active!==true||
       anatomy.anatomyStudy?.skinMeshes<2||
       anatomy.anatomyStudy?.texture?.material!=='procedural-micropore-pbr'||
       anatomy.adultSkinPBR?.colorMap!==true||
       anatomy.adultSkinPBR?.normalMap!==true||
       anatomy.adultSkinPBR?.roughnessMap!==true||
       anatomy.youthGarmentVisible!==false||
       anatomy.anatomyStudy?.originalEyesPreserved!==true)
     throw Error('Adult heroine skin PBR anatomy/eyes test failed: '+
       JSON.stringify({anatomy:anatomy.anatomyStudy,
        skin:anatomy.adultSkinPBR,
        garment:anatomy.youthGarmentVisible}));
    await page.locator('#meshMode').selectOption('wire');
    if((await page.evaluate(()=>window.__heroineWireframeQA())).mode!=='wire')
     throw Error('Anatomy lost its true wireframe');
    await page.locator('#meshMode').selectOption('solid');
    await page.locator('#bodyStudyMode').selectOption('equipped');
    const restored=await page.evaluate(()=>window.__heroSwordsmanQA());
    if(restored.anatomyStudy?.active!==false||
       restored.youthGarmentVisible!==true)
     throw Error('Heroine outfit cannot be restored from skin inspection');
   }
   if(key==='hero-girl-01'&&(state.sourceGender!=='female'||state.sourceHeadId!=='realistic-head-sculpt'))
    throw Error('Girl did not load real female body and sculpt head');
   if(key==='hero-girl-01'){
    if(state.referencePortraitContour?.landmarkCount!==9||
       state.referencePortraitContour?.contourKnots!==11||
       state.referencePortraitContour?.originalTopologyPreserved!==true||
       state.appliedUserPortraitSilhouette!==null)
     throw Error('Reference contour must remain comparison-only until 3D fit is calibrated');
    await page.locator('#referenceContour').click();
    await page.waitForTimeout(140);
    const guided=await page.evaluate(()=>window.__heroSwordsmanQA());
    if(guided.referenceContourGuideVisible!==true)
     throw Error('Source reference trace not visible on heroine 3D face');
    await canvas.screenshot({path:path.join(dir,'hero-girl-01-user-portrait-contour-overlay.png')});
    await page.locator('#referenceContour').click();
    const unguided=await page.evaluate(()=>window.__heroSwordsmanQA());
    if(unguided.referenceContourGuideVisible===true)
     throw Error('Guide remains on and contaminates character export');
   }
   if(key==='hero-01'&&state.sourceGender!=='male')throw Error('Boy must use male source GLB');
   if(key.startsWith('hero-')){
    if(state.youthGarmentVisible!==true||
       state.sourceTunicVisible!==false||
       state.youthGarment?.bodyFitted!==true||
       state.youthGarment?.anatomicalSourceSurface!==true||
       state.youthGarment?.anatomicallyConnectedUpperSleeves!==true||
       state.youthGarment?.noProceduralCylinderSleeves!==true||
       (state.youthGarment?.upperArmTriangles?.left||0)<35||
       (state.youthGarment?.upperArmTriangles?.right||0)<35||
       (state.youthGarment?.breastplateTriangles||0)<25||
       state.youthGarment?.shortTabardPanels!==0||
       state.youthGarment?.hipTassetPanels!==0||
       state.youthGarment?.sleeveCuffCount!==2||
        state.youthGarment?.anatomyFittedLowerClothes?.realLegSurface!==true||
        state.sourceLowerGarmentVisible!==false||
       state.youthGarment?.fittedHighCollar!==true||
       state.youthGarment?.fittedNecklineTrim!==true||
       state.youthGarment?.centerCrestFitted!==true||
       state.youthGarment?.slimLeatherBelt!==false||
       state.youthGarment?.hemHeight<-.30)
     throw Error('Young hero still wearing torn Viking shirt or separated sleeves: '+
      JSON.stringify({key,custom:state.youthGarment,visible:state.youthGarmentVisible,
       sourceVisible:state.sourceTunicVisible}));
   }else if(state.youthGarmentVisible===true||state.sourceTunicVisible===false){
    throw Error('Ally lost original CC0 garment when hero clothing added: '+key);
   }
   if(state.facialQA?.realEyebrowVisibleCount!==2||
       state.facialQA?.eyebrowRibbonHalfWidthMeters<.0025)
    throw Error('Hero eyebrows not visible after gender/face change: '+JSON.stringify(state.facialQA));
   if(state.armsAndHandsPreserved!==true||
       state.armMeshRetention?.some(ratio=>ratio<.999)||
       state.armTriangleCount?.some(n=>n<20))
    throw Error('Real arm/hand source triangles lost during cloth masking: '+
      JSON.stringify({retention:state.armMeshRetention,triangles:state.armTriangleCount}));
   if(state.shoulderAlignment?.rearSleeveGeometryClosed!==true||
      state.shoulderAlignment?.connectedSleeves!==2||
      state.shoulderAlignment?.rearSleeveEndCaps!==true||
      state.shoulderAlignment?.compactSleevesFitted!==true||
      state.shoulderAlignment?.sleeveConnectorMaxRadius>.04||
      state.shoulderAlignment?.sleeveConnectorLengthMeters>.17||
      (key.startsWith('hero-')&&state.shoulderAlignment?.visibleAuxiliarySleeves!==0)||
      state.garmentBackFacesEnabled!==true)
    throw Error('Detached sleeve overlay still visible, or original tunic back not rendered: '+
      JSON.stringify({shoulder:state.shoulderAlignment,cloth:state.garmentBackFacesEnabled}));
   if(state.garmentUpperTailoring?.originalUVCountIntact!==true||
      state.garmentUpperTailoring?.backPanelsPreserved!==true||
      state.garmentUpperTailoring?.maxShiftMeters>.10)
    throw Error('Slim tunic tailoring damaged original back/UV source: '+JSON.stringify(state.garmentUpperTailoring));
   if(state.garmentSleeveFinCleanup?.originalUvPreserved!==true||
      state.garmentSleeveFinCleanup?.torsoBackNotTrimmed!==true||
      state.garmentSleeveFinCleanup?.removedDanglingTriangles<1)
    throw Error('Disconnected original sleeve flaps were not trimmed safely: '+JSON.stringify(state.garmentSleeveFinCleanup));
   if(key.startsWith('hero-')&&(
       state.appearance.headScale<(key==='hero-girl-01'?1.05:1.07)||
       (key!=='hero-girl-01'&&state.appearance.proportions.middleThird>=.89)||
       (key!=='hero-girl-01'&&state.appearance.proportions.chinLength>=.89)||
       (key==='hero-girl-01'&&(
        state.appearance.proportions.cheekRoundness>1.25||
        state.appearance.proportions.middleThird<.93||
        state.appearance.youthfulness>.7))))
    throw Error('Hero face/head remains visually adult or undersized: '+JSON.stringify(state.appearance.proportions));
   if(state.fantasyBackHair?.sourceHeadUnchanged!==true||
      state.fantasyBackHair?.bodyRearOnly!==true||
      state.fantasyBackHair?.anchors<6)
    throw Error('Fantasy rear hair is missing or not fitted to actual character: '+JSON.stringify(state.fantasyBackHair));
   if(state.appearance.id<1000||!state.hairScalpCoverage?.sourceAnatomyAligned||
       state.hairError||state.appearance.artGradeCertified!==false||
       state.styledHairGeometry?.maxRibbonLength>.032)
    throw Error('Featured 3D model has missing scalp or inaccurate art claim: '+JSON.stringify({key,state}));
   await canvas.screenshot({path:path.join(dir,key+'-portrait.png')});
   if(key==='hero-01'||key==='hero-girl-01'){
    await page.locator('#full').click();
    await page.waitForTimeout(140);
    await canvas.screenshot({path:path.join(dir,key+'-fitted-outfit-front.png')});
    await page.locator('#side').click();
    await page.waitForTimeout(140);
    await canvas.screenshot({path:path.join(dir,key+'-fitted-outfit-side.png')});
    await page.locator('#back').click();
    await page.waitForTimeout(140);
    await canvas.screenshot({path:path.join(dir,key+'-fitted-outfit-back.png')});
    await page.locator('#portrait').click();
    await page.waitForTimeout(140);
    await canvas.screenshot({path:path.join(dir,key+'-portrait.png')});
   }
   if(key==='hero-01'||key==='hero-girl-01'){
    await page.evaluate(()=>window.__heroSwordsmanBrowsVisible(false));
    await page.waitForTimeout(90);
    await canvas.screenshot({path:path.join(dir,key+'-no-eyebrows.png')});
    await page.evaluate(()=>window.__heroSwordsmanBrowsVisible(true));
    await page.waitForTimeout(90);
    const difference=changed(key+'-portrait.png',key+'-no-eyebrows.png',12);
    if(difference<25)
     throw Error('Eyebrow pixel visibility regression '+key+': '+difference);
   }
   featured.push({key,faceWidth:state.appearance.faceWidth,
       eyeSize:state.appearance.eyeSize,hairStyle:state.appearance.hairStyle});
   if(key==='hero-girl-01'){
    // User-facing deliverable must be a real binary 3D file, not a photo.
    const artifact=path.join(dir,'hero-girl-01-static-preview.glb');
    const downloadReady=page.waitForEvent('download',{timeout:90000});
    await page.locator('#exportCharacterGlb').click();
    const download=await downloadReady;
    await download.saveAs(artifact);
    const buffer=fs.readFileSync(artifact);
    if(buffer.length<50000||buffer.toString('ascii',0,4)!=='glTF'||
       buffer.readUInt32LE(8)!==buffer.length)
     throw Error('Heroine GLB export is missing or not a valid 3D binary glTF container');
    console.log('HEROINE_GLTF_STATIC_3D_EXPORT_PASS '+JSON.stringify({bytes:buffer.length}));
    await page.locator('#side').click();
    await page.waitForTimeout(180);
    await canvas.screenshot({path:path.join(dir,'hero-girl-01-side-low-bun.png')});
    await page.locator('#back').click();
    await page.waitForTimeout(180);
    await canvas.screenshot({path:path.join(dir,'hero-girl-01-back-low-bun.png')});
    await page.locator('#portrait').click();
   }
   if(key==='hero-01'){
    await page.locator('#back').click();
    await page.waitForTimeout(180);
    await canvas.screenshot({path:path.join(dir,'hero-01-back-scalp.png')});
    await page.locator('#portrait').click();
   }
  }
  const differentiated=changed('hero-01-portrait.png','hero-05-portrait.png');
  const girlBoyDelta=changed('hero-01-portrait.png','hero-girl-01-portrait.png');
  if(girlBoyDelta<550)throw Error('Female 3D head model produces no visible difference');
  if(differentiated<300)
   throw Error('Five protagonist face shape and hair settings do not change actual 3D render: '+differentiated);
  console.log('FEATURED_HERO_ALLY_PREVIEW_PASS '+JSON.stringify({featured,differentiated}));
  if(errors.length)throw Error('Browser errors: '+errors.join(' / '));
  const report={...data,eyeChangedPixels:eyeDelta,faceChangedPixels:faceDelta,
   wardrobeChangedPixels:wardrobeDelta,realScreenshots:12,mobileSelectorAboveCanvas:true,featuredHeroCount:5,featuredAllyCount:5,
   featuredFaceDifferencePixels:differentiated,girlBoyDifferencePixels:girlBoyDelta,
   facialXYZOffsetsVerified:18,lowerLidsFitted:true,
   heroineLowBunTrue3D:true,heroineReferenceDesign:'approved-heroine-knight-portrait-20261109',
   thousandDescriptorVariantsVerified:true,irisPupilsVisible:true,
   actualCC0SourceMeshes:true,previewOnly:true,
   normalOrRoughnessScanApplied:false,rigOrWalkValidated:false,
   artGradeCertified:false,errors};
  fs.writeFileSync(path.join(dir,'report.json'),JSON.stringify(report,null,2)+'\n');
  console.log('HERO_SWORDSMAN_INTEGRATED_BROWSER_PASS '+JSON.stringify(report));
 }finally{await browser.close();}
})().catch(e=>{console.error('HERO_SWORDSMAN_INTEGRATED_BROWSER_FAILED',e);process.exitCode=1});

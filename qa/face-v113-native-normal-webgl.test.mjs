/**
 * V113 approved smooth normal-face recovery test on the REAL CC0 donor GLB.
 * The previous "thin -> normal" path accidentally skipped retopology; that
 * was the smoother face the player wanted. Verify it is now the first frame,
 * and switching back is byte-for-byte identical including normals and
 * triangle connectivity. Preserve optional legacy retopo for isolated QA.
 */
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {chromium} from 'playwright';
import {PNG} from 'pngjs';
const out='qa/screenshots/face-v113';
mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,args:[
 '--no-sandbox','--use-gl=angle','--use-angle=swiftshader',
 '--enable-webgl','--enable-unsafe-swiftshader'
]});
try{
 const context=await browser.newContext({viewport:{width:420,height:860},deviceScaleFactor:1});
 const errors=[];
 const visit=async suffix=>{
  const page=await context.newPage();
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:8765/face-mesh-studio.html?qa=expression'+suffix,
   {waitUntil:'domcontentloaded',timeout:90000});
  await page.waitForFunction(()=>document.documentElement.dataset.faceMeshReady==='v113'&&
   window.__faceMasterQA?.()?.loaded===true&&
   typeof window.__faceExpressionQA?.geometrySignature==='function',
   null,{timeout:90000});
  return page;
 };
 const capture=async(page,file)=>{
  await page.locator('#faceExpression').selectOption('neutral');
  const raw=await page.evaluate(()=>window.__faceExpressionQA.captureWebGLFrame());
  assert.match(raw,/^data:image\/png;base64,/);
  const b=Buffer.from(raw.split(',')[1],'base64');
  writeFileSync(out+'/'+file+'.png',b);
  return PNG.sync.read(b);
 };
 const signature=page=>page.evaluate(()=>window.__faceExpressionQA.geometrySignature());
 const page=await visit('');
 const defaultSig=await signature(page);
 console.log('FACE_V113_NATIVE_FIRST',JSON.stringify(defaultSig));
 assert.equal(defaultSig.nativeNormal,true);
 assert.equal(defaultSig.v106RetopoApplied,false);
 assert.equal(defaultSig.vertices,3490,
  'First paint must show original smooth 3490-vertex donor, not rough 8029-vertex v106 mesh');
 assert.ok(defaultSig.triangles>5000&&defaultSig.triangles<9000,
  'Cheek should not receive thousands of extra v106 triangles');
 const firstImage=await capture(page,'normal-initial');
 await page.locator('#v47BodyType').selectOption('thin');
 await page.waitForFunction(()=>window.__faceMasterQA()?.female?.v47Demographics?.bodyType==='thin',
  null,{timeout:30000});
 const thinSig=await signature(page);
 assert.equal(thinSig.vertices,3490);
 assert.notEqual(thinSig.positions,defaultSig.positions,
  'Thin and normal must still have different real vertex positions');
 await page.locator('#v47BodyType').selectOption('normal');
 await page.waitForFunction(()=>window.__faceMasterQA()?.female?.v47Demographics?.bodyType==='normal',
  null,{timeout:30000});
 const afterSig=await signature(page);
 console.log('FACE_V113_NATIVE_RESELECT',JSON.stringify(afterSig));
 assert.deepEqual(afterSig,defaultSig,
  'First native smooth GLB and thin -> normal must match in XYZ, normals and indices');
 await capture(page,'normal-after-reselect');
 await page.locator('#threeQuarter').click();
 await capture(page,'normal-45deg');
 await page.locator('#side').click();
 await capture(page,'normal-side');
 await page.locator('#front').click();
 await page.locator('#faceExpression').selectOption('laugh');
 const facePose=await page.evaluate(()=>window.__faceExpressionQA.nativePoseProbe());
 assert.ok(facePose.oral?.ready,'Native teeth/mouth rig must survive the 3490-vertex source');
 assert.ok(facePose.mouthOpen>.50,'Laugh mouth opens on native source');
 await capture(page,'normal-smile-recovery');
 const old=await visit('&retopo=1');
 const oldSig=await signature(old);
 console.log('FACE_V113_LEGACY_BAD_REFERENCE',JSON.stringify(oldSig));
 assert.ok(oldSig.v106RetopoApplied&&oldSig.vertices>defaultSig.vertices,
  'Diagnostic old retopo must be the distinct previously broken face');
 const badImage=await capture(old,'experimental-retopo-do-not-ship');
 // Diagnostic side-by-side roughness evidence, NOT a substitute for
 // screenshot review by a human. Use the same image size / camera.
 const cheekTexture=p=>{
  const {width:w,height:h,data}=p;
  let n=0,dark=0,gradient=0;
  for(let y=Math.floor(h*.35);y<Math.floor(h*.68);y++)
   for(let x=Math.floor(w*.29);x<Math.floor(w*.71);x++){
    if(x>w*.43&&x<w*.57)continue;
    const id=(y*w+x)*4;
    const r=data[id],g=data[id+1],b=data[id+2];
    // Ignore dark blue canvas and blonde strand pixels.
    if(r<65||r<b*1.08||g<45)continue;
    n++;if(r<100)dark++;
    if(x+1<w){
     const ahead=id+4;
     gradient+=Math.abs(r-data[ahead])+
      Math.abs(g-data[ahead+1])+Math.abs(b-data[ahead+2]);
    }
   }
  return {samples:n,darkRatio:n?dark/n:0,gradient:n?gradient/n:0};
 };
 console.log('FACE_V113_BEFORE_AFTER_CHEEK_COMPARE',
  JSON.stringify({smooth:cheekTexture(firstImage),bad:cheekTexture(badImage)}));
 assert.ok(cheekTexture(firstImage).samples>100,'Smooth portrait actually shows visible skin');
 await old.close();await page.close();
 assert.deepEqual(errors,[],'Browser should not have runtime errors');
 console.log('FACE_V113_PASS: approved smooth normal GLB is initial state and rebuild-invariant');
}finally{await browser.close();}

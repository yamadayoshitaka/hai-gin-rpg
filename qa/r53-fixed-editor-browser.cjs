// Browser safety preflight. Fixtures are metadata only, not release models.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const base='http://127.0.0.1:8765';
const out='qa-screenshots/r53-fixed-preflight';
fs.mkdirSync(out,{recursive:true});
const catalog={revision:'R53',faces:['female','male'].flatMap((sex,s)=>Array.from({length:10},(_,i)=>{
 const id=sex+'_face_'+String(i+1).padStart(2,'0');
 return {id,sex,sourceSex:sex,glb:id+'.glb',thumbnail:id+'.png',sha256:(s*10+i).toString(16).padStart(64,'0')};
}))};
const custom='標準ベース 女性01';
async function inventory(page){
 return page.evaluate(()=>new Promise((resolve,reject)=>{
  const q=indexedDB.open('hai-gin-face-models-v2',1);
  q.onupgradeneeded=()=>q.result.createObjectStore('models',{keyPath:'id'});
  q.onerror=()=>reject(q.error);
  q.onsuccess=()=>{
   const db=q.result,tx=db.transaction('models','readonly'),r=tx.objectStore('models').getAll();
   tx.oncomplete=()=>{db.close();resolve(r.result.map(x=>({id:x.id,marker:x.marker,baseId:x.baseId,revision:x.identityRevision})))};
   tx.onerror=()=>reject(tx.error);
  };
 }));
}
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try{
  const page=await browser.newPage({viewport:{width:411,height:860},deviceScaleFactor:1});
  const errors=[],requests=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('request',r=>requests.push(r.url()));
  await page.route('https://cdn.jsdelivr.net/npm/three@0.160.1/**',async route=>{
    const u=new URL(route.request().url());
    const rel=u.pathname.split('/three@0.160.1/')[1];
    const file=path.resolve('node_modules/three',rel);
    if(!file.startsWith(path.resolve('node_modules/three')+path.sep)||!fs.existsSync(file))return route.abort();
    await route.fulfill({path:file,contentType:'application/javascript',headers:{'Access-Control-Allow-Origin':'*'}});
  });
  let mode='missing';
  await page.route('**/assets/face-r53/catalog.json',route=>mode==='missing'?route.fulfill({status:404,body:'missing'}):route.fulfill({json:catalog}));
  await page.route('**/assets/face-r53/*.glb',route=>route.fulfill({status:404,body:'fixture: intentionally absent'}));
  await page.route('**/assets/face-r53/*.png',route=>route.fulfill({status:404,body:''}));
  await page.goto(base+'/face-precision-r18.html?qa=r53',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.getElementById('fixedFaceStatus').textContent.includes('未完了'),null,{timeout:60000});
  assert.equal(await page.locator('#legacyShapeControls').isVisible(),false);
  assert.equal(await page.locator('#seedBases').isDisabled(),true);
  assert.equal(await page.locator('#fixedFaceGrid button').count(),0);
  assert.deepEqual(await inventory(page),[]);
  assert.ok(!requests.some(u=>u.includes('female_v121_v28_R18.glb')),'legacy fallback requested');
  // Persist a custom record using a standard-looking key; failure must not replace it.
  await page.evaluate(id=>new Promise((resolve,reject)=>{
   const q=indexedDB.open('hai-gin-face-models-v2',1);
   q.onerror=()=>reject(q.error);q.onsuccess=()=>{
    const db=q.result,tx=db.transaction('models','readwrite');
    tx.objectStore('models').put({id,marker:'preserve-me',glb:new Blob(['custom'])});
    tx.oncomplete=()=>{db.close();resolve()};tx.onerror=()=>reject(tx.error);
   };
  }),custom);
  mode='valid';await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.querySelectorAll('#fixedFaceGrid button').length===10,null,{timeout:60000});
  assert.equal(await page.locator('#fixedFaceGrid button[data-fixed-face^=female]').count(),10);
  await page.locator('#fixedFaceGrid button').first().click();
  await page.waitForFunction(()=>document.getElementById('fixedFaceStatus').textContent.includes('404'));
  assert.equal(await page.locator('#fixedFaceGrid button[aria-pressed=true]').count(),0);
  await page.locator('#motionSex').evaluate(el=>{el.value='male';el.dispatchEvent(new Event('change',{bubbles:true}));});
  await page.waitForFunction(()=>document.querySelectorAll('#fixedFaceGrid button[data-fixed-face^=male]').length===10);
  await page.locator('#fixedFaceGrid button').last().click();
  await page.waitForFunction(()=>document.getElementById('fixedFaceStatus').textContent.includes('male_face_10'));
  await page.waitForFunction(()=>document.getElementById('fixedFaceStatus').textContent.includes('404'));
  await page.locator('#seedBases').click();
  await page.waitForFunction(()=>document.getElementById('baseSeedStatus').textContent.includes('登録停止'));
  assert.deepEqual(await inventory(page),[{id:custom,marker:'preserve-me',baseId:undefined,revision:undefined}]);
  assert.deepEqual(errors,[]);
  await page.screenshot({path:out+'/mobile-fail-closed.png',timeout:30000});
  console.log('R53_BROWSER_PREFLIGHT_OK: missing catalog, twenty metadata choices, gender switch, failed downloads, custom record preservation');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});

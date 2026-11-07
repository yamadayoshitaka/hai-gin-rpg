/**
 * 3DAI Studio free-web browser adapter for independent knight armor.
 * One manual generation request at most per invocation. Official UI only.
 * Never bypass signup/captcha/queues/rate limits/credits; never use private APIs.
 * If high-quality textured mode is unavailable, do NOT generate white geometry.
 */
const {chromium}=require('playwright');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const ROOT=process.cwd(),OUT='qa-screenshots/3dai-auto';
const INBOX='assets/ai-model-inbox',BASE='assets/ai-reference/swordsman';
const SOURCE='https://3dai.dev/en';
const AI_ID='swordsman_armor_3dai_01';
const FILENAME=AI_ID+'.glb';
const MAX_WAIT=11*60*1000;
const requestId='swordsman-armor-3dai-001';
const mode=process.env.AI_AUTOMATION_MODE||'probe';
const allowedModes=new Set(['probe','generate']);
if(!allowedModes.has(mode))throw Error('Mode is invalid');
fs.mkdirSync(OUT,{recursive:true});
const report={
 schema:'hai-gin/3dai-browser-automation/v1',requestId,provider:'3DAI Studio',
 sourceUrl:SOURCE,sourceImages:['outfit-front.png','outfit-back.png','outfit-side.png'],
 intendedAsset:AI_ID,mode,
 attempts:0,generated:false,uploaded:false,gameReplaced:false,
 outputQuality:'textured-only',status:'started',screenshots:[],
 notes:'Uses site normal GUI; does not bypass any authentication or usage restrictions'
};
function log(phase,detail=''){console.log('3DAI_AUTO',phase,detail);report.status=phase;report.message=detail}
function saveReport(){fs.writeFileSync(path.join(OUT,'report.json'),JSON.stringify(report,null,2)+'\n')}
function shot(page,phase){
 return page.screenshot({path:path.join(OUT,phase+'.png'),fullPage:true,timeout:45000}).then(()=>report.screenshots.push(phase+'.png')).catch(e=>log('screenshot_unavailable',e.message))
}
function ensureLocalImages(){
 const files=['outfit-front.png','outfit-back.png','outfit-side.png'].map(name=>path.resolve(ROOT,BASE,name));
 for(const file of files){
  const stat=fs.statSync(file);
  if(!stat.isFile()||stat.size<10000||stat.size>8*1024*1024)throw Error('Invalid swordsman image '+file);
 }
 return files;
}
function assertSameOrigin(page){
 const url=new URL(page.url());
 if(url.origin!=='https://3dai.dev')throw Error('External redirect, auth or payment page detected: '+url.origin);
}
async function checkBlockers(page){
 const text=(await page.locator('body').innerText()).slice(0,8000);
 if(/captcha|verify you are human|robot verification|log in to continue|subscribe to continue|payment required/i.test(text))
  throw Error('Authentication, paywall or human-verification detected: stopping (not bypassing)');
}
async function uploadReference(page,file,index){
 const all=page.locator('input[type="file"]');
 if(await all.count()!==4)throw Error('Unexpected multi-view file controls, expected Front Back Left Right');
 await all.nth(index).setInputFiles(file);
 await page.waitForTimeout(250);
}
async function run(){
 const files=ensureLocalImages();
 const browser=await chromium.launch({headless:true,acceptDownloads:true,
  args:['--use-gl=angle','--use-angle=swiftshader']});
 try{
  const page=await browser.newPage({acceptDownloads:true,viewport:{width:1280,height:950},locale:'en-US'});
  page.setDefaultTimeout(20000);
  page.on('pageerror',err=>{report.pageErrors??=[];report.pageErrors.push(err.message.slice(0,300))});
  const response=await page.goto(SOURCE,{waitUntil:'domcontentloaded',timeout:80000});
  if(response?.status()!==200)throw Error('3DAI website HTTP '+response?.status());
  await page.waitForTimeout(4000);
  assertSameOrigin(page);await checkBlockers(page);
  log('site_opened');
  const multiview=page.locator('button[role="tab"]').filter({hasText:'Multi-view'}).first();
  if(await multiview.count()!==1)throw Error('3DAI multi-view UI has changed');
  await multiview.click();
  await page.waitForTimeout(700);
  if(await page.locator('input[type="file"]').count()!==4)throw Error('Unexpected multi-view inputs');
  await shot(page,'site-multiview');
  const textured=page.locator('button[role="radio"]').filter({hasText:'Textured'}).first();
  if(await textured.count()!==1)throw Error('Textured option not found');
  report.textureAvailable=await textured.isEnabled();
  report.textureOptionText=(await textured.innerText()).slice(0,280);
  // Requirement: do not generate a low-quality white geometry substitute.
  if(!report.textureAvailable){
    log('blocked_texture_unavailable','The site has disabled textured generation. White mesh fallback prohibited.');
    await shot(page,'texture-unavailable');
    return;
  }
  if(mode==='probe'){
    log('ready','Textured generation available. Site inspected; no generation submitted.');
    return;
  }
  await textured.click();
  const fine=page.locator('button').filter({hasText:'Fine detail'}).first();
  if(await fine.count()!==1||!(await fine.isEnabled()))throw Error('Fine detail option unavailable');
  await fine.click();
  // Front / Back / Left. Right is optional; use only real saved viewpoints.
  await uploadReference(page,files[0],0);
  await uploadReference(page,files[1],1);
  await uploadReference(page,files[2],2);
  await page.waitForTimeout(900);
  assertSameOrigin(page);await checkBlockers(page);
  await shot(page,'ready-to-generate');
  const generate=page.locator('button.primary-button').filter({hasText:/Generate.*3D/i}).first();
  if(await generate.count()!==1||!(await generate.isEnabled()))throw Error('Generate button not available after upload');
  if(/white mesh/i.test(await generate.innerText()))throw Error('Cannot submit white-mesh generation');
  report.attempts=1;
  await generate.click();
  log('request_submitted','ONE normal UI click; no retries or additional accounts.');
  await shot(page,'generation-requested');
  // Site may take several minutes. Poll DOM at a gentle interval, never resubmit.
  const started=Date.now();
  let dl=null;
  while(Date.now()-started<MAX_WAIT){
   assertSameOrigin(page);
   await checkBlockers(page);
   const candidate=page.locator('button,a').filter({hasText:/download.*glb/i}).first();
   if(await candidate.count()&&await candidate.isVisible()&&await candidate.isEnabled()){dl=candidate;break}
   const pageText=(await page.locator('body').innerText()).slice(0,9000);
   if(/generation failed|unable to generate|server is unavailable|too many requests|rate limit exceeded|queue full/i.test(pageText)){
    log('generation_failed_or_limited',pageText.slice(-450));
    await shot(page,'generation-unavailable');return;
   }
   await page.waitForTimeout(12000);
  }
  if(!dl){
   log('generation_timed_out','No GLB download button appeared before limit; no retry submitted.');
   await shot(page,'generation-timeout');return;
  }
  await shot(page,'generation-complete');
  const waitDownload=page.waitForEvent('download',{timeout:60000});
  await dl.click();
  const download=await waitDownload;
  if(download.failure()!==null){
   const error=await download.failure();
   if(error)throw Error('Download failed: '+error);
  }
  const src=await download.path();
  const bytes=fs.readFileSync(src);
  if(bytes.length>75*1024*1024)throw Error('GLB exceeds 75 MiB');
  const {auditGLB}=await import('../tools/ai-3d-glb-audit.mjs');
  const audit=auditGLB(bytes,{category:'armor'});
  if(!audit.pbrMaterials||!audit.textures.length||!audit.hasUV){
   log('rejected_texture_missing','GLB lacks PBR texture or UV data. Not registered.');
   report.audit=audit;return;
  }
  report.generated=true;report.audit=audit;
  const manifestPath=path.join(INBOX,'manifest.json');
  const incoming=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
  if(incoming.schema!=='hai-gin/ai-3d-inbox/v1'||incoming.entries.some(x=>x.id===AI_ID))
   throw Error('Inbox manifest not ready/ID already present');
  if(fs.existsSync(path.join(INBOX,FILENAME)))throw Error('GLB candidate already exists');
  // No game model replacement here. The normal inbox importer owns the final registry.
  fs.copyFileSync(src,path.join(INBOX,FILENAME));
  incoming.entries.push({id:AI_ID,category:'armor',filename:FILENAME,
    provider:'3DAI Studio Web',sourceUrl:SOURCE,license:'unknown',
    prompt:'Image-to-3D from the current RPG swordsman armor front/back/side reference. Textured, fine detail, multi-view.'});
  fs.writeFileSync(manifestPath,JSON.stringify(incoming,null,2)+'\n');
  report.uploaded=true;report.glb=path.join(INBOX,FILENAME);
  report.sha256=crypto.createHash('sha256').update(bytes).digest('hex');
  log('candidate_downloaded','GLB saved to inbox for standard validation; not activated in gameplay.');
 }finally{await browser.close()}
}
(async()=>{
 try{await run()}
 catch(e){report.error=e.message;report.status='failed';console.error('3DAI_AUTO_ERROR',e.message);process.exitCode=1}
 finally{saveReport();console.log('3DAI_FINAL',JSON.stringify({
  status:report.status,textureAvailable:report.textureAvailable,mode,
  attempts:report.attempts,generated:report.generated,uploaded:report.uploaded,
  error:report.error||null
 }))}
})();

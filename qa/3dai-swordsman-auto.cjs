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
const INBOX='assets/ai-model-inbox';
const FILE=process.env.AI_REQUEST_PATH||'data/ai-generation-requests/swordsman-armor-3dai-001.json';
if(!/^data\/ai-generation-requests\/[a-z][a-z0-9_-]{1,90}\.json$/.test(FILE))
 throw Error('Unsafe request file path');
const request=JSON.parse(fs.readFileSync(FILE,'utf8'));
const ID=/^[a-z][a-z0-9_-]{1,40}$/;
if(request.schema!=='hai-gin/3dai-studio-generation/v1'
  ||!ID.test(request.id)
  ||!['human','monster','summon','animal','armor','weapon'].includes(request.category)
  ||request.sourceUrl!=='https://3dai.dev/en'||!['multi-view','single'].includes(request.input)
  ||request.quality!=='fine-detail'
  ||typeof request.textureRequired!=='boolean'
  ||typeof request.allowWhiteMesh!=='boolean'
  ||request.textureRequired===request.allowWhiteMesh
  ||(request.allowWhiteMesh&&!(request.category==='armor'&&request.texturePipeline==='swordsman-photo-steel-pbr'||
    request.category==='human'&&request.texturePipeline==='swordsman-skin-preview'))
  ||request.paidAllowed!==false
  ||request.maxSubmissionsPerRun!==1)throw Error('Request violates free textured-only safety policy');
const refs=request.references;
if(!refs||typeof refs!=='object'||typeof refs.front!=='string')throw Error('A front reference is required');
const SOURCE=request.sourceUrl,AI_ID=request.id,FILENAME=AI_ID+'.glb';
const CATEGORY=request.category,MAX_WAIT=11*60*1000;
const requestId=path.basename(FILE,'.json');
const mode=process.env.AI_AUTOMATION_MODE||'probe';
const allowedModes=new Set(['probe','generate']);
if(!allowedModes.has(mode))throw Error('Mode is invalid');
fs.mkdirSync(OUT,{recursive:true});
const report={
 schema:'hai-gin/3dai-browser-automation/v1',requestId,provider:'3DAI Studio',
 sourceUrl:SOURCE,sourceImages:Object.values(refs),
 intendedAsset:AI_ID,category:CATEGORY,requestPath:FILE,mode,
 attempts:0,generated:false,uploaded:false,gameReplaced:false,
 outputQuality:request.allowWhiteMesh?request.texturePipeline:'textured',status:'started',screenshots:[],
 notes:'Uses site normal GUI; does not bypass any authentication or usage restrictions'
};
function log(phase,detail=''){console.log('3DAI_AUTO',phase,detail);report.status=phase;report.message=detail}
function saveReport(){fs.writeFileSync(path.join(OUT,'report.json'),JSON.stringify(report,null,2)+'\n')}
function shot(page,phase){
 return page.screenshot({path:path.join(OUT,phase+'.png'),fullPage:true,timeout:45000}).then(()=>report.screenshots.push(phase+'.png')).catch(e=>log('screenshot_unavailable',e.message))
}
function ensureLocalImages(){
 const files=[];
 for(const [view,index] of [['front',0],['back',1],['left',2],['right',3]]){
  const candidate=refs[view];
  if(!candidate)continue;
  if(typeof candidate!=='string'
   ||!/^assets\/[a-z0-9/_-]+\.(?:png|jpe?g|webp)$/i.test(candidate)
   ||candidate.includes('..'))throw Error('Unsafe reference image path: '+view);
  const file=path.resolve(ROOT,candidate);
  if(!file.startsWith(path.resolve(ROOT,'assets')+path.sep))throw Error('Reference outside assets');
  const stat=fs.statSync(file);
  if(!stat.isFile()||stat.size<10000||stat.size>8*1024*1024)throw Error('Bad reference: '+candidate);
  files.push({view,index,file});
 }
 if(!files.some(item=>item.view==='front'))throw Error('Front view is required');
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
 const expected=request.input==='single'?1:4;
 if(await all.count()!==expected)throw Error('Unexpected image input count: '+(await all.count())+', expected '+expected);
 await all.nth(request.input==='single'?0:index).setInputFiles(file);
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
  const requestedTab=request.input==='single'?'Single image':'Multi-view';
  const chosen=page.locator('button[role="tab"]').filter({hasText:requestedTab}).first();
  if(await chosen.count()!==1)throw Error('3DAI '+requestedTab+' UI has changed');
  await chosen.click();
  await page.waitForTimeout(700);
  const expected=request.input==='single'?1:4;
  if(await page.locator('input[type="file"]').count()!==expected)throw Error('Unexpected '+requestedTab+' inputs');
  await shot(page,'site-image-input-mode');
  const textured=page.locator('button[role="radio"]').filter({hasText:'Textured'}).first();
  if(await textured.count()!==1)throw Error('Textured option not found');
  report.textureAvailable=await textured.isEnabled();
  report.textureOptionText=(await textured.innerText()).slice(0,280);
  const white=page.locator('button[role="radio"]').filter({hasText:'White mesh'}).first();
  if(request.textureRequired&&!report.textureAvailable){
    log('blocked_texture_unavailable','The site has disabled textured generation. This request prohibits white mesh.');
    await shot(page,'texture-unavailable');
    return;
  }
  if(request.allowWhiteMesh&&(await white.count()!==1||!(await white.isEnabled()))){
    log('blocked_geometry_unavailable','White-mesh generation option is unavailable.');
    await shot(page,'geometry-unavailable');
    return;
  }
  if(mode==='probe'){
    log('ready','Selected generation mode is available. This is an availability check only.');
    return;
  }
  if(request.textureRequired)await textured.click();
  else await white.click();
  const fine=page.locator('button').filter({hasText:'Fine detail'}).first();
  if(await fine.count()!==1||!(await fine.isEnabled()))throw Error('Fine detail option unavailable');
  await fine.click();
  // Front / Back / Left. Right is optional; use only real saved viewpoints.
  for(const reference of files){
   if(request.input==='single'&&reference.view!=='front')continue;
   await uploadReference(page,reference.file,reference.index);
  }
  await page.waitForTimeout(900);
  assertSameOrigin(page);await checkBlockers(page);
  await shot(page,'ready-to-generate');
  const generate=page.locator('button.primary-button').filter({hasText:/Generate.*3D/i}).first();
  if(await generate.count()!==1||!(await generate.isEnabled()))throw Error('Generate button not available after upload');
  if(request.textureRequired&&/white mesh/i.test(await generate.innerText()))throw Error('Unexpected white-mesh option');
  if(request.allowWhiteMesh&&!/white/i.test(await generate.innerText()))throw Error('White mesh selection not confirmed');
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
  const failure=await download.failure();
  if(failure)throw Error('Download failed: '+failure);
  const src=await download.path();
  const bytes=fs.readFileSync(src);
  if(bytes.length>75*1024*1024)throw Error('GLB exceeds 75 MiB');
  const {auditGLB}=await import('../tools/ai-3d-glb-audit.mjs');
  const audit=auditGLB(bytes,{category:CATEGORY});
  if(request.textureRequired&&(!audit.pbrMaterials||!audit.textures.length||!audit.hasUV)){
   log('rejected_texture_missing','GLB lacks PBR texture or UV data. Not registered.');
   report.audit=audit;return;
  }
  if(audit.triangles<100)throw Error('Generated 3D geometry is too small to compare');
  report.generated=true;report.audit=audit;
  const manifestPath=path.join(INBOX,'manifest.json');
  const incoming=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
  if(incoming.schema!=='hai-gin/ai-3d-inbox/v1'||incoming.entries.some(x=>x.id===AI_ID))
   throw Error('Inbox manifest not ready/ID already present');
  if(fs.existsSync(path.join(INBOX,FILENAME)))throw Error('GLB candidate already exists');
  // No game model replacement here. The normal inbox importer owns the final registry.
  fs.copyFileSync(src,path.join(INBOX,FILENAME));
  incoming.entries.push({id:AI_ID,category:CATEGORY,filename:FILENAME,
    provider:'3DAI Studio Web',sourceUrl:SOURCE,license:'unknown',
    finish:request.allowWhiteMesh?'swordsman-photo-steel-pbr':'provider-pbr',
    prompt:String(request.prompt||'Image-to-3D from 3DAI Studio multi-view references, with post-process game steel texture').slice(0,2500)});
  fs.writeFileSync(manifestPath,JSON.stringify(incoming,null,2)+'\n');
  report.uploaded=true;report.glb=path.join(INBOX,FILENAME);
  report.sha256=crypto.createHash('sha256').update(bytes).digest('hex');
  log('candidate_downloaded','GLB saved to inbox for standard validation; not activated in gameplay.');
 }finally{await browser.close()}
}
(async()=>{
 try{await run()}
 catch(e){report.error=e.message;report.status='failed';console.error('3DAI_AUTO_ERROR',e.message);process.exitCode=1}
 finally{
  saveReport();
  console.log('3DAI_FINAL',JSON.stringify({
   status:report.status,textureAvailable:report.textureAvailable,mode,
   attempts:report.attempts,generated:report.generated,uploaded:report.uploaded,
   error:report.error||null
  }));
  if(mode==='generate'&&!report.uploaded){
   console.error('3DAI_GENERATION_NOT_COMPLETED: '+report.status+
     ' (no GLB downloaded; there is nothing new to publish)');
   process.exitCode=process.exitCode||2;
  }
 }
})();

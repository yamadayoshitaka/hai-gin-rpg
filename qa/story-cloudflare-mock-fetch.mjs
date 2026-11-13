/**
 * ONLY imported by the offline API integration regression test. Never referenced
 * by a production GitHub Actions image-generation step.
 */
import fs from 'node:fs';
import path from 'node:path';
let requests=0;
const logPath=process.env.MOCK_CLOUDFLARE_REQUEST_LOG;
const framesDir=process.env.MOCK_CLOUDFLARE_IMAGE_DIR;
if(!logPath||!framesDir)throw Error('Mock transport only usable with explicit test fixtures');
globalThis.fetch=async function(url,options){
 requests++;
 if(!String(url).endsWith('/ai/run/@cf/black-forest-labs/flux-2-klein-4b'))
  throw Error('Mock rejects non-Klein model/paid fallback');
 if(options.method!=='POST'||!(options.body instanceof FormData)||
  !String(options.headers.Authorization).startsWith('Bearer '))
  throw Error('P0 real multipart POST transport shape missing');
 const inputs=[...options.body.entries()];
 const refs=inputs.filter(([k])=>k.startsWith('input_image_'));
 if(refs.length<1||refs.length>4||refs.some(([k,v],i)=>
  k!=='input_image_'+i||!(v instanceof Blob)||v.size<100))
  throw Error('Real reference source bytes must be individually attached');
 const prompt=options.body.get('prompt');
 if(typeof prompt!=='string'||!prompt.includes('EXACTLY ONE single seamless')||
  !prompt.includes('No visible text')||prompt.includes('Frame 2 scene')||
  options.body.get('width')!=='1024'||options.body.get('height')!=='576')
  throw Error('P0 exactly one shot per POST');
 fs.appendFileSync(logPath,JSON.stringify({
  call:requests,referenceFields:refs.map(([k])=>k),
  referenceBytes:refs.map(([,v])=>v.size),
  promptSha:prompt.length,
  seed:options.body.get('seed')
 })+'\n');
 const bytes=fs.readFileSync(path.join(framesDir,'mock-'+String(requests)+'.png'));
 return new Response(JSON.stringify({success:true,result:{image:bytes.toString('base64')}}),
  {status:200,headers:{'Content-Type':'application/json'}});
};

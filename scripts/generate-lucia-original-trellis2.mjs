/**
 * ONE free/no-paid image-to-GLB experiment for Lucia.
 * Uses her chapter-1 source portrait already tracked in this repo.
 * No default paid fallbacks; no game actor replacement.
 * Run in GitHub Actions with @gradio/client installed.
 */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {Client,handle_file} from '@gradio/client';
import {auditGLB} from '../tools/ai-3d-glb-audit.mjs';

const source='assets/story/characters/lucia/master.webp';
const host='https://microsoft-trellis-2.hf.space';
const category='human',id='lucia_ch01_trellis2_trial_01';
const output='assets/ai-generated/human/'+id;
const report='qa-reports/lucia-original-ai-generation.json';
const result={
 schema:'hai-gin/lucia-original-3d-trial/v1',
 sourceImage:source,
 generator:'microsoft/TRELLIS.2',
 date:new Date().toISOString(),
 paidRequests:0,
 status:'started',
 approvedForGame:false,
 sourceIsFullBody:false,
 warnings:['Portrait source only: output is not a complete rigged character','User approval and commercial rights verification required']
};
await mkdir('qa-reports',{recursive:true});
const saveReport=async()=>writeFile(report,JSON.stringify(result,null,2)+'\n');
try{
 const data=await readFile(source);
 if(data.length>10*1024*1024||data.length<100)throw Error('Invalid source art');
 const auth=process.env.HF_TOKEN?.trim();
 console.log('Source image:',source,data.length,'bytes');
 console.log('Hugging Face authentication:',auth?'user token from GitHub secret':'anonymous shared quota');
 const options=auth?{token:auth}:{};
 const app=await Client.connect('microsoft/TRELLIS.2',options);
 console.log('Connected to official Space. Starting pre-processing.');
 const pre=await app.predict('/preprocess_image',{input:handle_file(data)});
 const processed=pre?.data?.[0];
 if(!processed)throw Error('Preprocessing yielded no image');
 console.log('Reference image uploaded and preprocessed by official Space.');
 result.status='original-uploaded';
 await saveReport();
 // Use low resolution/steps for a cost-free capability test; no expensive provider.
 const generated=await app.predict('/image_to_3d',{
  image:processed,seed:0,resolution:'512',
  ss_guidance_strength:7.5,ss_guidance_rescale:0.7,ss_sampling_steps:8,ss_rescale_t:5,
  shape_slat_guidance_strength:7.5,shape_slat_guidance_rescale:0.5,shape_slat_sampling_steps:8,shape_slat_rescale_t:3,
  tex_slat_guidance_strength:1,tex_slat_guidance_rescale:0,tex_slat_sampling_steps:8,tex_slat_rescale_t:3
 });
 console.log('Generation result count:',generated?.data?.length);
 const extracted=await app.predict('/extract_glb',{decimation_target:100000,texture_size:1024});
 console.log('Extract result types:',extracted?.data?.map(x=>typeof x==='object'?Object.keys(x||{}):typeof x));
 const fields=extracted?.data?.filter(x=>x&&typeof x==='object')||[];
 const asset=fields.find(x=>String(x?.url||x?.path||'').includes('.glb'));
 if(!asset)throw Error('The Space returned no GLB FileData');
 let assetUrl=asset.url;
 if(!assetUrl&&asset.path)assetUrl=host+'/gradio_api/file='+encodeURIComponent(asset.path);
 const parsed=new URL(assetUrl);
 if(parsed.protocol!=='https:'||parsed.hostname!=='microsoft-trellis-2.hf.space')throw Error('Invalid model download host');
 const response=await fetch(assetUrl,{headers:auth?{Authorization:'Bearer '+auth}:{}});
 if(!response.ok)throw Error('Cannot download generated GLB (HTTP '+response.status+')');
 const bin=Buffer.from(await response.arrayBuffer());
 if(bin.length>75*1024*1024)throw Error('Generated GLB exceeds 75MiB candidate cap');
 const audit=auditGLB(bin,{category});
 await mkdir(output,{recursive:true});
 await writeFile(output+'/candidate.glb',bin);
 const meta={
  schema:'hai-gin/ai-3d-candidate/v1',id,category,model:output+'/candidate.glb',
  provider:'Microsoft TRELLIS.2 ZeroGPU',sourceImage:source,
  sourceUrl:'https://huggingface.co/spaces/microsoft/TRELLIS.2',
  modelSourceUrl:'https://github.com/microsoft/TRELLIS.2',
  outputSource:'AI generated from existing first-chapter Lucia portrait',
  generatedAt:new Date().toISOString(),
  approvedForGame:false,commercialRightsVerified:false,licenseVerified:false,
  status:'pending-visual-qa',sourceIsFullBody:false,
  audit,
  mandatoryReview:['source art consistency','face eyes hairstyle','back of head and shoulder detail','missing legs/body','rig and animation','commercial license']
 };
 await writeFile(output+'/manifest.json',JSON.stringify(meta,null,2)+'\n');
 const registryPath='data/ai-model-registry.json';
 const registry=JSON.parse(await readFile(registryPath,'utf8'));
 if(!registry.generated.some(x=>x.category===category&&x.id===id)){
  registry.generated.push({id,category,model:meta.model,metadata:output+'/manifest.json',provider:meta.provider,status:meta.status});
  await writeFile(registryPath,JSON.stringify(registry,null,2)+'\n');
 }
 result.status='generated-candidate';
 result.output=meta.model;
 result.audit=audit;
 await saveReport();
 console.log('Generated candidate successfully:',meta.model,bin.length,'bytes');
}catch(error){
 result.status=result.status==='original-uploaded'?'original-uploaded-generation-blocked':'failed';
 result.error=String(error?.message||error);
 await saveReport();
 console.error('3D generation trial failed:',result.error);
 process.exitCode=1;
}

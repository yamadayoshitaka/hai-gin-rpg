// Motion extraction job contract: no fake BVH output on failed or missing inference.
// A real extractor must write a canonical skeleton file and a QA manifest.
import fs from 'node:fs/promises';
const cfg=JSON.parse(await fs.readFile('motion-sources.json','utf8'));
await fs.mkdir('reports',{recursive:true});
const tasks=cfg.sources.filter(s=>s.enabled).map(s=>({
 id:s.id,jobFamily:s.jobFamily??null,action:s.action??null,
 input:'motions/'+s.id+'.mp4',expectedOutput:'motions/extracted/'+s.id+'.bvh',
 pipeline:['decode-frames','estimate-2d-pose','reconstruct-3d','retarget-canonical-rig','foot-contact-correction','export-bvh','visual-qa'],
 status:'blocked-extractor-not-configured',reason:'No trained video-to-3D-motion backend configured in CI. No asset may be promoted.'
}));
await fs.writeFile('reports/video-motion-extraction.json',JSON.stringify({schema:1,taskCount:tasks.length,tasks},null,2)+'\n');
console.log('Video extraction jobs:',tasks.length,'; production extractor not configured');

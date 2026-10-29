// Optional semantic visual review. Requires GitHub secret OPENAI_API_KEY.
// Never writes to main or silently assumes a good reference image.
const fs=require('node:fs');
const path=require('node:path');
const root='qa-screenshots/vision-matrix';
const manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.json'),'utf8'));
const key=process.env.OPENAI_API_KEY;
if(!key){console.log('Vision AI evaluation not configured: OPENAI_API_KEY absent');process.exit(0);}
const items=manifest.shots.map(x=>({type:'input_image',image_url:'data:image/png;base64,'+fs.readFileSync(path.join(root,x.filename)).toString('base64'),detail:'low'}));
const text='Review these 14 sequential screenshots for the SAME job (male then female), actions idle walk run attack guard hit dead. Compare to anatomically plausible high-quality stylized fantasy RPG references from your visual understanding, NOT pixel identity. Respond ONLY JSON: {"issues":[{"sex":"male|female","action":"idle|walk|run|attack|guard|hit|dead","part":"hair|weapon|hands|feet|outfit|body|pose|camera","severity":"critical|major|minor","observation":"...","suggestedAdjustment":"..."}],"assessment":"..."}. Identify floating bowl-shaped hair, grip clipping, foot sliding signs, defensive stance, fall pose, and outfit mismatch. If uncertain explain; do not invent observations. Input frames are in manifest order: '+manifest.shots.map(x=>x.filename).join(', ');
(async()=>{
 const r=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{'Authorization':'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify({model:process.env.VISION_MODEL||'gpt-4.1-mini',store:false,max_output_tokens:2000,input:[{role:'user',content:[{type:'input_text',text},...items]}]})});
 const body=await r.json();if(!r.ok)throw Error('Vision API HTTP '+r.status+': '+JSON.stringify(body.error||body).slice(0,600));
 const output=(body.output||[]).flatMap(x=>x.content||[]).filter(x=>x.type==='output_text').map(x=>x.text).join('\n');
 let parsed;try{parsed=JSON.parse(output.replace(/^\x60\x60\x60json\s*/,'').replace(/\s*\x60\x60\x60$/,''));}catch{parsed={raw:output,issues:[]};}
 fs.writeFileSync(path.join(root,'vision-review.json'),JSON.stringify({model:process.env.VISION_MODEL||'gpt-4.1-mini',review:parsed},null,2));
 console.log('Vision QA issues:',parsed.issues?.length??'unparsed');
 if(parsed.issues?.some(x=>['critical','major'].includes(x.severity)))process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1});

// Static quality gate for BVH generated from video. This does NOT certify animation quality.
import fs from 'node:fs/promises';
const files=process.argv.slice(2);
if(!files.length){console.log('No BVH inputs; nothing to certify');process.exit(0)}
let failed=false;
for(const file of files){
 const data=await fs.readFile(file,'utf8');
 const errors=[];
 if(!/^HIERARCHY\s/m.test(data)||!/^MOTION\s*$/m.test(data))errors.push('missing BVH sections');
 const frames=Number(data.match(/^Frames:\s*(\d+)/m)?.[1]);
 const dt=Number(data.match(/^Frame Time:\s*([\d.]+)/m)?.[1]);
 const channels=[...data.matchAll(/CHANNELS\s+(\d+)/g)].reduce((s,m)=>s+Number(m[1]),0);
 const lines=data.split(/\r?\n/);const i=lines.findIndex(l=>/^Frame Time:/.test(l));
 const motion=lines.slice(i+1).filter(l=>l.trim());
 if(!Number.isInteger(frames)||frames<3)errors.push('invalid frame count');
 if(!(dt>0&&dt<1))errors.push('invalid frame time');
 if(channels<6)errors.push('insufficient channels');
 if(motion.length!==frames)errors.push('frame count mismatch');
 for(let j=0;j<motion.length;j++){
  const vals=motion[j].trim().split(/\s+/).map(Number);
  if(vals.length!==channels||vals.some(x=>!Number.isFinite(x))){errors.push('invalid frame '+j);break}
 }
 const report={file,frames,channels,frameTime:dt,staticPass:!errors.length,visualPass:false,approved:false,errors};
 console.log(JSON.stringify(report));
 if(errors.length)failed=true;
}
if(failed)process.exitCode=1;

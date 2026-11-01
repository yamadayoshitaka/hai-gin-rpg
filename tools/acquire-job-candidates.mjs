// Download candidate CMU BVH clips for manual review; never mark them production-recorded.
import fs from 'node:fs/promises';
const root='https://raw.githubusercontent.com/una-dinosauria/cmu-mocap/master/data/';
const candidates=[
 {id:'sword-slash-1',family:'sword',action:'slash',file:'002/02_07.bvh',note:'candidate only; inspect actual movement'},
 {id:'sword-slash-2',family:'sword',action:'combo',file:'002/02_09.bvh',note:'candidate only; inspect actual movement'},
 {id:'martial-strike',family:'martial',action:'punch',file:'002/02_05.bvh',note:'candidate only; inspect actual movement'},
 {id:'martial-combo',family:'martial',action:'combo',file:'015/15_13.bvh',note:'candidate only; inspect actual movement'},
 {id:'dance-motion',family:'dance',action:'dance',file:'005/05_02.bvh',note:'candidate only; inspect actual movement'},
 {id:'caster-gesture',family:'caster',action:'chant',file:'012/12_04.bvh',note:'tai chi / gesture candidate; NOT authentic spellcasting'}
];
await fs.mkdir('motions/candidates',{recursive:true});
const report=[];
for(const c of candidates){
 const response=await fetch(root+c.file,{signal:AbortSignal.timeout(60000)});
 if(!response.ok)throw Error(c.file+': HTTP '+response.status);
 const body=await response.text();
 if(!body.trimStart().startsWith('HIERARCHY')||!body.includes('MOTION')||!body.includes('Frames:'))throw Error(c.file+': invalid BVH');
 const file='motions/candidates/'+c.id+'.bvh';
 await fs.writeFile(file,body);
 report.push({id:c.id,family:c.family,action:c.action,file,origin:root+c.file,license:'CMU Graphics Lab Motion Capture Database; review redistribution conditions',status:'candidate-needs-review',note:c.note});
}
await fs.writeFile('motions/candidates/catalog.json',JSON.stringify({schema:1,clips:report},null,2)+'\n');
console.log('Downloaded '+report.length+' candidate clips; none promoted to recorded');

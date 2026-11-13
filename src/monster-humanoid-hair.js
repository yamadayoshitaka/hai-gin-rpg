/**
 * Full-crown groom for existing male/female Quaternius actors.
 *
 * Canonical actor loading deliberately hides its bundled hair/helmet. That
 * left angels with a visible bald crown and a detached frontal fringe.
 * This module samples the *actual skinned head* to fit a continuous underlay
 * and draws strand ribbons from the scalp to the shoulders, with no spheres,
 * loose wigs, or changes to the base playable humanoid model.
 */
import * as THREE from 'three';

const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const finite=(value)=>Number.isFinite(value);
const vec3=(a,b,c)=>new THREE.Vector3(a,b,c);

export function measureCanonicalScalp(model,headBone){
 const inv=headBone.matrixWorld.clone().invert();
 const points=[];
 model.updateMatrixWorld(true,true);
 model.traverse(mesh=>{
  if(!mesh.isSkinnedMesh||!mesh.geometry||!mesh.skeleton)return;
  const geo=mesh.geometry,verts=geo.getAttribute('position');
  const skinIndex=geo.getAttribute('skinIndex'),skinWeight=geo.getAttribute('skinWeight');
  if(!verts||!skinIndex||!skinWeight)return;
  const headIndex=mesh.skeleton.bones.findIndex(b=>b===headBone);
  if(headIndex<0)return;
  const stride=Math.max(1,Math.ceil(verts.count/16000)),v=new THREE.Vector3();
  for(let i=0;i<verts.count;i+=stride){
   let weight=0;
   for(let j=0;j<4;j++)if(skinIndex.getComponent(i,j)===headIndex)
    weight+=skinWeight.getComponent(i,j);
   if(weight<.70)continue;
   mesh.getVertexPosition(i,v);
   v.applyMatrix4(mesh.matrixWorld).applyMatrix4(inv);
   if([v.x,v.y,v.z].every(finite)&&Math.abs(v.x)<.32&&
    Math.abs(v.y)<.43&&Math.abs(v.z)<.32)points.push(v.clone());
  }
 });
 if(points.length<15){
  // This fallback only fits a scalp, not a substitute humanoid head.
  return {center:[0,.095,0],radius:[.111,.155,.117],samples:points.length,
   fitted:false};
 }
 const ys=points.map(p=>p.y).sort((a,b)=>a-b);
 const top=ys[Math.floor((ys.length-1)*.992)];
 const low=ys[Math.floor((ys.length-1)*.08)];
 const scalp=points.filter(p=>p.y>=low+(top-low)*.43);
 const cx=scalp.reduce((n,p)=>n+p.x,0)/scalp.length;
 const cz=scalp.reduce((n,p)=>n+p.z,0)/scalp.length;
 const rx=Math.max(.085,Math.min(.19,...[Math.max(...scalp.map(p=>Math.abs(p.x-cx)))]));
 const rz=Math.max(.090,Math.min(.20,...[Math.max(...scalp.map(p=>Math.abs(p.z-cz)))]));
 const ry=clamp((top-low)*.37,.110,.205);
 return {center:[cx,top-ry+.004,cz],radius:[rx+.006,ry+.004,rz+.007],
  samples:points.length,fitted:true};
}
function surfaceMesh(vertices,uvs,indices,tag){
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
 geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
 geometry.setIndex(indices);
 geometry.computeVertexNormals();
 geometry.userData.kind=tag;
 return geometry;
}
/** A continuous scalp covering the top and rear, with a higher forehead
 * hairline and natural sideburn coverage. Never a disconnected round cap. */
export function createCharacterCrownGeometry({
 center=[0,.095,0],radius=[.115,.16,.125],detail='high',
}={}){
 const cols=detail==='low'?18:40,rows=detail==='low'?7:16;
 const [cx,cy,cz]=center,[rx,ry,rz]=radius;
 const positions=[],uvs=[],indices=[];
 for(let i=0;i<=rows;i++){
  const t=i/rows;
  for(let j=0;j<=cols;j++){
   const phi=j/cols*Math.PI*2;
   // +Z points toward the face in the canonical source GLB. The
   // forward-facing front edge terminates above the eyebrows.
   const front=Math.max(0,Math.sin(phi));
   const maxTheta=1.68-.34*front;
   const theta=t*maxTheta,s=Math.sin(theta);
   positions.push(cx+rx*s*Math.cos(phi),cy+ry*Math.cos(theta),
    cz+rz*s*Math.sin(phi));
   uvs.push(j/cols,t);
   if(i<rows&&j<cols){
    const a=i*(cols+1)+j,b=a+cols+1;
    indices.push(a,a+1,b,a+1,b+1,b);
   }
  }
 }
 return surfaceMesh(positions,uvs,indices,'fully-covered-canonical-head-crown');
}
export function createCharacterHairStrandsGeometry({
 center=[0,.095,0],radius=[.115,.16,.125],
 style='long',detail='high',seed=1,
}={}){
 const [cx,cy,cz]=center,[rx,ry,rz]=radius;
 const groups=detail==='low'?44:style==='long'?180:115;
 const positions=[],uvs=[],indices=[];
 const maxLength=style==='long'?.39:style==='bob'?.19:
   style==='short'?.09:style==='swept'?.145:.20;
 let state=(seed>>>0)||1;
 const rand=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
 for(let i=0;i<groups;i++){
  const phi=(i+.3+rand()*.36)/groups*Math.PI*2;
  const front=Math.max(0,Math.sin(phi)),side=Math.abs(Math.cos(phi));
  const theta=(1.22+rand()*.19-.16*front);
  const sin=Math.sin(theta),cos=Math.cos(theta);
  const base=vec3(cx+rx*sin*Math.cos(phi),cy+ry*cos,
    cz+rz*sin*Math.sin(phi));
  // Frontal bangs are cropped above the eyes, while rear hair reaches
  // behind shoulder plates; side locks transition without bald temples.
  const tLen=maxLength*(front>.62?.25+rand()*.15:
    side>.68?.57+rand()*.30:.78+rand()*.22);
  const width=detail==='low'?.014:.009+rand()*.005;
  const sideVec=vec3(-Math.sin(phi),0,Math.cos(phi));
  const outward=vec3(Math.cos(phi),.06,Math.sin(phi));
  const start=positions.length/3;
  for(let k=0;k<=4;k++){
   const t=k/4;
   const p=base.clone()
    .addScaledVector(outward,.007+Math.sin(t*Math.PI)*.023+t*.037)
    .addScaledVector(sideVec,Math.sin(i*1.61+t*6)*.009*t)
    .add(vec3(0,-tLen*t,0));
   const w=width*(1-t*.88);
   for(const sign of [-1,1]){
    const q=p.clone().addScaledVector(sideVec,w*sign);
    positions.push(q.x,q.y,q.z);
    uvs.push(i/groups,t);
   }
   if(k<4){
    const a=start+k*2;
    indices.push(a,a+1,a+2,a+1,a+3,a+2);
   }
  }
 }
 return surfaceMesh(positions,uvs,indices,'scalp-rooted-tapered-hair-strands');
}
export function attachCanonicalCharacterGroom({
 THREE:Engine=THREE,model,frames,headBone,profile,detail='high',
 attach,
}={}){
 if(!profile||profile.hair==='bald')return null;
 const scalp=measureCanonicalScalp(model,headBone);
 const fit={center:scalp.center,radius:scalp.radius,detail};
 const color=profile.hairColor??(
  profile.id==='seraph_guardian'?0xd7bd7c:
  profile.id==='forest_archer'?0xb4a77a:
  profile.id==='dragon_lord'?0x583a49:
  profile.id==='m044'?0x2e233c:
  profile.id==='m034'?0x392934:
  profile.sex==='female'?0x463846:0x302929
 );
 const crown=attach(frames.head,createCharacterCrownGeometry(fit),
  'hair','fitted-canonical-scalp-crown');
 const locks=attach(frames.head,createCharacterHairStrandsGeometry({
  ...fit,style:profile.hair,seed:(profile.id||'monster').split('')
   .reduce((n,c)=>n*31+c.charCodeAt(0),7)>>>0
 }), 'hair','continuous-rooted-hair-strands');
 for(const item of [crown,locks]){
  if(item.material?.color)item.material.color.setHex(color);
  item.userData.canonicalHairGroom=true;
  item.userData.scaffoldSamples=scalp.samples;
 }
 return {crown,locks,scalp};
}

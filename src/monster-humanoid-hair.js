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

export function measureCanonicalScalp(model,headBone,{groomFrame=null}={}){
 model.updateMatrixWorld(true,true);
 headBone.updateWorldMatrix(true,false);
 // The GLB's Head bone need not use local +Y as anatomical up. Sample in
 // the *same* model-upright frame that the hair geometry will attach to.
 if(groomFrame){
  if(groomFrame.parent!==headBone)throw Error('Scalp sample frame must belong to Head bone');
  groomFrame.updateWorldMatrix(true,false);
 }
 const inv=(groomFrame??headBone).matrixWorld.clone().invert();
 const points=[];
 model.traverse(mesh=>{
  if(!mesh.isSkinnedMesh||!mesh.geometry||!mesh.skeleton)return;
  // Donor helmets, hair caps, lashes and invisible accessories must NOT
  // determine the underlying skull silhouette. traverse() still visits
  // hidden children; sampling them expands the scalp into a floating wig.
  for(let parent=mesh;parent;parent=parent.parent){
   if(parent.visible===false)return;
   if(parent===model)break;
  }
  if(/hair|wig|helmet|hat|headgear|eyelash|eyebrow|cornea|iris|eye[_\\s-]?lash/i
   .test(mesh.name))return;
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
 const rx=clamp(Math.max(...scalp.map(p=>Math.abs(p.x-cx))),.085,.19);
 const rz=clamp(Math.max(...scalp.map(p=>Math.abs(p.z-cz))),.090,.20);
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
   // Canonical Quaternius characters face +Z. Keep front hairline
   // above the brows and let full-length hair flow toward -Z/back.
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
 // Near-LOD strands are batched into one BufferGeometry, never one mesh per lock.
 const groups=detail==='low'?72:
  (style==='long'||style==='seraph-face-open')?520:style==='swept'?300:
  style==='bob'?320:style==='short'?240:240;
 const positions=[],uvs=[],indices=[];
 const maxLength=(style==='long'||style==='seraph-face-open')?.39:style==='bob'?.19:
   style==='short'?.09:style==='swept'?.145:.20;
 let state=(seed>>>0)||1;
 const rand=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
 for(let i=0;i<groups;i++){
  const phi=(i+.3+rand()*.36)/groups*Math.PI*2;
  const front=Math.max(0,Math.sin(phi)),side=Math.abs(Math.cos(phi));
  // Include crown roots, not only the outer rim (helmet-like appearance).
  // Hair must originate under the actual crown shell. Prior roots ran
  // beyond the raised front hairline, leaving exposed temple patches.
  const maxTheta=1.68-.34*front;
  const theta=.40+rand()*Math.max(.02,maxTheta-.43);
  const sin=Math.sin(theta),cos=Math.cos(theta);
  const base=vec3(cx+rx*sin*Math.cos(phi),cy+ry*cos,
    cz+rz*sin*Math.sin(phi));
  // Frontal bangs are cropped above the eyes, while rear hair reaches
  // behind shoulder plates; side locks transition without bald temples.
  const tLen=maxLength*(front>.62?
    (style==='seraph-face-open'?.075+rand()*.085:.23+rand()*.17):
    side>.68?.63+rand()*.30:.80+rand()*.20)*
    (.65+.35*Math.sin(Math.min(1,theta/1.32)*Math.PI*.5));
  const width=detail==='low'?.010:.004+rand()*.004;
  const sideVec=vec3(-Math.sin(phi),0,Math.cos(phi));
  const outward=vec3(Math.cos(phi),.06,Math.sin(phi));
  const start=positions.length/3;
  for(let k=0;k<=4;k++){
   const t=k/4;
   // Bury roots in the cap (2 mm), let mid-strands carry volume, and
   // differentiate back-swept and bob hair from generic straight cuts.
   const sweep=style==='swept'?.045*t*t:0;
   const bobCurl=style==='bob'?-.025*t*t:0;
   const p=base.clone()
    .addScaledVector(outward,-.002+Math.sin(t*Math.PI)*.020+
      t*(.031+bobCurl))
    .addScaledVector(sideVec,Math.sin(i*1.61+t*6)*.007*t+sweep)
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
 // Outer locks begin ~0.40 radians below the crown and leave a bald disc.
 // Densely combed centre-to-rim ribbons bridge the pole all the way to the
 // existing long locks. Do not use a bright plastic helmet to hide the hole.
 const canopy=detail==='low'?48:168;
 for(let i=0;i<canopy;i++){
  const phi0=(i*.61803398875%1)*Math.PI*2;
  const startTheta=.022+Math.sqrt(rand())*.45;
  const sweep=.34+rand()*.34;
  const start=positions.length/3;
  for(let k=0;k<=4;k++){
   const t=k/4,theta=startTheta+sweep*t;
   const phi=phi0+.13*t*Math.sin(i*3.1);
   const st=Math.sin(theta),ct=Math.cos(theta),lift=.003+Math.sin(Math.PI*t)*.006;
   const centerPoint=vec3(cx+(rx+lift)*st*Math.cos(phi),
    cy+(ry+lift)*ct,cz+(rz+lift)*st*Math.sin(phi));
   const tangent=vec3(-Math.sin(phi),0,Math.cos(phi));
   const width=(detail==='low'?.009:.0056)*(1-t*.65);
   for(const sign of [-1,1]){
    const q=centerPoint.clone().addScaledVector(tangent,width*sign);
    positions.push(q.x,q.y,q.z);uvs.push(i/canopy,t);
   }
   if(k<4){
    const a=start+k*2;
    indices.push(a,a+1,a+2,a+1,a+3,a+2);
   }
  }
 }
 const g=surfaceMesh(positions,uvs,indices,'scalp-rooted-tapered-hair-strands');
 g.userData.crownCanopyStrands=canopy;
 g.userData.poleCoverage=true;
 return g;
}
/**
 * measureCanonicalScalp() returns coordinates in the source HEAD-BONE
 * local frame, whereas the costume frame counter-rotates into MODEL space
 * to position historically authored horns/makeup. Fitted hair must not be
 * attached to that counter-rotated frame: doing so reveals bald temples and
 * detaches the fringe whenever bind-pose head orientation is nonidentity.
 * Keep this group in the original bone's exact local coordinate system.
 */
export function createCanonicalHeadLocalGroomAnchor(headBone,model=null){
 if(!headBone?.isBone)throw Error('Canonical hair requires the original head bone');
 const anchor=new THREE.Group();
 anchor.name='monster-head-local-groom-anchor';
 if(model){
  // Follow genuine Head animation, but use the actor's upright basis for
  // the actual crown so donor head-local sideways axes cannot make bald caps.
  headBone.updateWorldMatrix(true,false);
  model.updateWorldMatrix(true,false);
  anchor.quaternion.copy(headBone.getWorldQuaternion(new THREE.Quaternion()).invert()
   .multiply(model.getWorldQuaternion(new THREE.Quaternion())));
  anchor.userData.modelUprightGroom=true;
 }
 headBone.add(anchor);
 anchor.userData.canonicalHeadBoneLocal=true;
 return anchor;
}
export function attachCanonicalCharacterGroom({
 THREE:Engine=THREE,model,frames,headBone,profile,detail='high',
 attach,
}={}){
 if(!profile||profile.hair==='bald')return null;
 const scalp=measureCanonicalScalp(model,headBone,{groomFrame:frames.head});
 const fit={center:scalp.center,radius:scalp.radius,detail};
 const color=profile.hairColor??(
  profile.id==='seraph_guardian'?0xe0c48e:
  profile.id==='forest_archer'?0xb4a77a:
  profile.id==='dragon_lord'?0x583a49:
  profile.id==='m044'?0x2e233c:
  profile.id==='m034'?0x392934:
  profile.sex==='female'?0x463846:0x302929
 );
 const crown=attach(frames.head,createCharacterCrownGeometry(fit),
  'hair','fitted-canonical-scalp-crown');
 const locks=attach(frames.head,createCharacterHairStrandsGeometry({
  ...fit,style:profile.faceOpenHair?'seraph-face-open':profile.hair,
  seed:(profile.id||'monster').split('')
   .reduce((n,c)=>n*31+c.charCodeAt(0),7)>>>0
 }), 'hair','continuous-rooted-hair-strands');
 for(const item of [crown,locks]){
  if(item.material?.color)item.material.color.setHex(color);
  item.userData.canonicalHairGroom=true;
  item.userData.scaffoldSamples=scalp.samples;
 }
 // Shade the scalp base below the fibre layer. A pale cream shell with
 // near-zero top roots previously looked exactly like exposed scalp.
 if(crown.material?.color)crown.material.color.setHex(color).multiplyScalar(.80);
 if(crown.material?.roughness!=null)crown.material.roughness=.97;
 crown.userData.crownBaseTinted=true;
 return {crown,locks,scalp};
}

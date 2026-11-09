import * as THREE from 'three';

/**
 * Actual 3D fantasy long hair for heroine 01.
 *
 * Locks originate from the measured CC0 head scalp, not from a flat image.
 * Side layers frame the face but remain outside the eyes. A long back curtain
 * falls below the shoulders toward the waist. This is a STATIC PREVIEW mesh,
 * not yet skinned/physics-driven; source GLB geometry is never modified.
 */
const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
const lerp=(a,b,t)=>a+(b-a)*t;

export function buildHeroineFantasyLongHair(scalp,{lengthInHeads=2.65}={}){
 const source=scalp?.geometry;
 const p=source?.getAttribute('position'),alpha=source?.getAttribute('color');
 if(!p||!alpha||alpha.itemSize<4||p.count<400)
  throw Error('Long heroine hair requires a real source-mesh scalp with alpha');
 source.computeBoundingBox();
 const box=source.boundingBox,dim=box.getSize(new THREE.Vector3());
 if(dim.x<.1||dim.y<.1||dim.z<.07)
  throw Error('Scalp source bounds invalid for long hairstyle');
 const cx=(box.min.x+box.max.x)*.5,cz=(box.min.z+box.max.z)*.5;
 const verts=[],uv=[],tones=[],indices=[];
 const candidate=[],v=new THREE.Vector3();
 for(let i=0;i<p.count;i++){
  if(alpha.getW(i)<.86)continue;
  v.fromBufferAttribute(p,i);
  const y=(v.y-box.min.y)/dim.y;
  if(y<.48||y>.91)continue;
  candidate.push(v.clone());
 }
 if(candidate.length<100)throw Error('Insufficient real scalp anchors for long hair');
 const nearest=(x,y,z,back=false)=>{
  let found=null,score=Infinity;
  for(const q of candidate){
   const dx=(q.x-x)/dim.x,dy=(q.y-y)/dim.y,dz=(q.z-z)/dim.z;
   const isBack=q.z<cz-dim.z*.06;
   if(back&&!isBack)continue;
   const d=dx*dx+dy*dy*.8+dz*dz*.10;
   if(d<score){score=d;found=q;}
  }
  return found?.clone()||null;
 };
 const material=new THREE.MeshStandardMaterial({
  color:0xffffff,vertexColors:true,roughness:.66,metalness:0,
  side:THREE.DoubleSide
 });
 let rearLocks=0,faceFramingLocks=0,lowestY=Infinity,aboveEyeFrontVertices=0;
 const segments=20,radial=5;
 const addLock=({root,sign,side=false,index=0,layer=0})=>{
  if(!root)return;
  const start=verts.length/3;
  const length=dim.y*lengthInHeads*(side?.78:1)*
   (1-.11*Math.abs((root.x-cx)/(dim.x*.5)))*
   (1-.085*layer);
  const width=dim.x*(side?.020:.024)*(layer?.88:1);
  const baseZ=Math.min(root.z,cz-dim.z*.12);
  for(let i=0;i<=segments;i++){
   const t=i/segments;
   const sway=Math.sin(t*Math.PI*1.45+index*.83)*dim.x*.04*t;
   const x=root.x+sign*dim.x*(side?.25:.08)*t+
    sign*dim.x*(side?.08:.03)*t*t+sway;
   const y=root.y-length*t;
   const z=side?
    lerp(root.z,cz+dim.z*.12,t)*1.0+dim.z*.07*t:
    baseZ-dim.z*(.09*t+.11*t*t)-layer*dim.z*.028;
   const r=width*(.95-.88*Math.pow(t,1.35));
   lowestY=Math.min(lowestY,y);
   for(let k=0;k<radial;k++){
    const u=k/(radial-1);
    // A shallow curved cross-section gives each long lock real volume.
    const offset=(u*2-1)*r;
    const pointX=x+offset;
    const pointZ=z+dim.z*.016*(1-(u*2-1)**2)*(1-t);
    verts.push(pointX,y,pointZ);
    uv.push(u,t);
    const light=.88+.085*Math.cos(u*Math.PI*1.1)+.033*Math.sin(index*1.67+layer);
    tones.push(light,light*.91,light*.72);
    if(side&&y>box.min.y+dim.y*.5&&
       Math.abs(pointX-cx)<dim.x*.34&&pointZ>cz+dim.z*.16)
      aboveEyeFrontVertices++;
    if(i<segments&&k<radial-1){
     const a=start+i*radial+k,b=a+radial;
     indices.push(a,b,a+1,a+1,b,b+1);
    }
   }
  }
  if(side)faceFramingLocks++;else rearLocks++;
 };
 // Layered occipital curtain: two deep rows flow over the upper back.
 for(const layer of [0,1]){
  const columns=layer===0?30:23;
  for(let i=0;i<columns;i++){
   const t=(i+.5)/columns;
   const x=box.min.x+dim.x*(.08+.84*t);
   const root=nearest(x,box.min.y+dim.y*(layer?.65:.77),
      box.min.z+dim.z*(layer?.16:.20),true);
   addLock({root,sign:Math.sign(x-cx)||1,index:i,layer});
  }
 }
 // Side lengths start at temple/behind ear and sweep OUTWARD before
 // dropping to the chest. Never place front-facing locks over pupils.
 for(const sign of [-1,1])for(let i=0;i<12;i++){
  const t=i/11;
  const x=cx+sign*dim.x*(.30+.11*t);
  const root=nearest(x,box.min.y+dim.y*(.83-.16*t),
   cz+dim.z*(.06-.20*t),false);
  addLock({root,sign,side:true,index:i+30});
 }
 if(rearLocks<35||faceFramingLocks<16||
   !(lowestY<box.min.y-dim.y*.8))
  throw Error('Long 3D heroine hairstyle does not reach shoulders/waist');
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));
 geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
 geometry.setAttribute('color',new THREE.Float32BufferAttribute(tones,3));
 geometry.setIndex(indices);
 geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
 const hair=new THREE.Mesh(geometry,material);
 hair.name='HEROINE_REAL_3D_LONG_GOLDEN_FLOWING_LOCKS';
 hair.matrixAutoUpdate=false;
 hair.matrix.copy(scalp.matrix);
 hair.castShadow=true;hair.receiveShadow=false;
 const report=Object.freeze({
  authoredStyle:'fantasy-long-blonde',
  scalpAnchored:true,originalSourceGeometryIntact:true,
  sourceHeadUnchanged:true,longHairPreviewOnly:true,
  staticUnrigged:true,
  rearLocks,faceFramingLocks,
  lengthInHeads:Number(lengthInHeads.toFixed(2)),
  lowestRelativeToScalpBottom:Number(((lowestY-box.min.y)/dim.y).toFixed(3)),
  triangleCount:indices.length/3,
  frontEyeZoneVertices:aboveEyeFrontVertices,
  noFloatingBun:true,backExtendsBelowShoulders:true
 });
 return {hair,report};
}

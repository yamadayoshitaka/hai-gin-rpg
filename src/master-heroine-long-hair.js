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

export function buildHeroineFantasyLongHair(scalp,{lengthInHeads=3.25}={}){
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
 let rearLocks=0,faceFramingLocks=0,bangLocks=0,lowestY=Infinity,aboveEyeFrontVertices=0;
 const segments=24,radial=7;
 const addLock=({root,sign,side=false,bang=false,index=0,layer=0})=>{
  if(!root)return;
  const start=verts.length/3;
  const length=bang?dim.y*(.18+.08*(index%5)/4):
   dim.y*lengthInHeads*(side?.88:1)*
   (1-.08*Math.abs((root.x-cx)/(dim.x*.5)))*
   (1-.055*layer);
  const width=dim.x*(bang?.018:side?.019:.024)*(layer?.92:1);
  const baseZ=Math.min(root.z,cz-dim.z*.12);
  for(let i=0;i<=segments;i++){
   const t=i/segments;
   const sway=Math.sin(t*Math.PI*2.45+index*.83)*dim.x*(bang?.006:.09)*t*t;
   const x=bang?
    root.x+sign*dim.x*.07*t+sway:
    root.x+sign*dim.x*(side?.33:.13)*t+
     sign*dim.x*(side?.12:.07)*t*t+sway;
   const y=root.y-length*t;
   const z=bang?
    root.z+dim.z*(.10*t+.035*Math.sin(Math.PI*t)):
    side?
     lerp(root.z,cz+dim.z*.77,t)*1.0+dim.z*.03*t:
     baseZ-dim.z*(.07*t+.08*t*t)-layer*dim.z*.032;
   const r=width*(.95-.93*Math.pow(t,1.52));
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
  if(bang){bangLocks++;}else if(side)faceFramingLocks++;else rearLocks++;
 };
 // Four staggered 3D curtain layers create the dense silhouette of the
 // image reference; each strand is a real curved polygonal strip. 
 for(const layer of [0,1,2,3]){
  const columns=[74,66,58,50][layer];
  for(let i=0;i<columns;i++){
   const t=(i+.5)/columns;
   const x=box.min.x+dim.x*(.06+.88*t);
   const root=nearest(x,box.min.y+dim.y*(.83-.085*layer),
      box.min.z+dim.z*(.17+.025*layer),true);
   addLock({root,sign:Math.sign(x-cx)||1,index:i+layer*83,layer});
  }
 }
 // Three thick face-framing layers drape along the shoulders and in front
 // of the outfit, staying outside the pupil/eyebrow silhouette.
 for(const layer of [0,1,2]){
  for(const sign of [-1,1])for(let i=0;i<32;i++){
   const t=i/31;
   const x=cx+sign*dim.x*(.35+.11*t);
   const root=nearest(x,box.min.y+dim.y*(.84-.16*t-.045*layer),
    cz+dim.z*(.07-.08*layer),false);
   addLock({root,sign,side:true,index:i+layer*37,layer});
  }
 }
 // Short layered fringe anchored on top of the genuine source scalp.
 // Its tips end at the upper forehead, above the eyes.
 for(let i=0;i<72;i++){
  const t=(i+.5)/72;
  const x=box.min.x+dim.x*(.18+.64*t);
  const root=nearest(x,box.min.y+dim.y*.91,box.max.z-dim.z*.23,false);
  addLock({root,sign:t<.5?-1:1,bang:true,index:i,layer:0});
 }
 if(rearLocks<35||faceFramingLocks<16||bangLocks<30||
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
  staticUnrigged:true,referenceBasedApproximation:true,
  rearLocks,faceFramingLocks,bangLocks,
  lengthInHeads:Number(lengthInHeads.toFixed(2)),
  lowestRelativeToScalpBottom:Number(((lowestY-box.min.y)/dim.y).toFixed(3)),
  triangleCount:indices.length/3,
  frontEyeZoneVertices:aboveEyeFrontVertices,
  noFloatingBun:true,backExtendsBelowShoulders:true
 });
 return {hair,report};
}

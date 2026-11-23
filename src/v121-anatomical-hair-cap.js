/**
 * Anatomical hair-root underlay for the independent wig studio.
 * A lightweight colored scalp cap sampled DIRECTLY from the actual v121
 * skin mesh. It never duplicates the head shape as an ellipsoid, and never
 * overwrites skin, brows, lashes, eyes, or facial vertex buffers.
 */
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
let strandTexture=null;
function makeRootTexture(THREE){
 if(strandTexture||typeof document==='undefined')return strandTexture;
 const canvas=document.createElement('canvas');canvas.width=canvas.height=512;
 const ctx=canvas.getContext('2d');if(!ctx)return null;
 // Near-neutral texture keeps the selected hair color consistent across
 // the actual hair GLB and this anatomical hairline underlay.
 ctx.fillStyle='#f7f3eb';ctx.fillRect(0,0,512,512);
 // Long flowing parallel fibers; colors wrap gently across UV seams.
 for(let i=0;i<970;i++){
  const x=(i*0.527)%512,a=.12+.22*Math.sin(i*12.9898)**2;
  ctx.strokeStyle=i%5===0?'rgba(73,58,38,'+a+')':
   'rgba(255,243,215,'+(.09+a*.64)+')';
  ctx.lineWidth=i%11===0?1.2:.45;
  ctx.beginPath();ctx.moveTo(x,0);
  for(let y=24;y<=512;y+=24)ctx.lineTo(x+Math.sin(y*.02+i)*.7,y);
  ctx.stroke();
 }
 strandTexture=new THREE.CanvasTexture(canvas);
 strandTexture.colorSpace=THREE.SRGBColorSpace;
 strandTexture.wrapS=strandTexture.wrapT=THREE.RepeatWrapping;
 return strandTexture;
}
/**
 * Fine visible crown fibers. These are actual mesh ribbons lying on the
 * anatomical scalp; unlike a generic spherical helmet, every sample is
 * projected onto vertices of the user's v121 head.
 * 180-260 deterministic short ribbons -> about 5k triangles/mobile-friendly.
 */
function buildCrownFiberRibbons(THREE,scalpGeometry,box,color){
 const pos=scalpGeometry.getAttribute('position'),normal=scalpGeometry.getAttribute('normal');
 const index=scalpGeometry.getIndex();
 if(!index||!normal)return null;
 const ids=new Set(Array.from(index.array));
 const points=[],rows=new Map(),step=.009;
 for(const id of ids){
  const x=pos.getX(id),y=pos.getY(id),z=pos.getZ(id);
  const point={x,y,z,nx:normal.getX(id),ny:normal.getY(id),nz:normal.getZ(id)};
  points.push(point);
  const k=Math.round(y/step);
  if(!rows.has(k))rows.set(k,[]);
  rows.get(k).push(point);
 }
 const top=box.max.y,midZ=(box.min.z+box.max.z)*.5;
 const seedPool=points.filter(p=>
  p.y<top-.025&&p.y>top-.075&&p.z<midZ-.009);
 seedPool.sort((a,b)=>a.x-b.x||a.z-b.z||b.y-a.y);
 const stride=Math.max(1,Math.ceil(seedPool.length/250));
 const seeds=seedPool.filter((p,i)=>i%stride===0).slice(0,250);
 const coords=[],uvs=[],indices=[],colors=[];
 const tone=new THREE.Color();
 const find=(x,y,prevZ)=>{
  const k=Math.round(y/step);
  let best=null,bestScore=.0007;
  for(let dy=-1;dy<=1;dy++)for(const p of rows.get(k+dy)||[]){
   if(p.z>midZ+.015)continue;
   const score=(p.x-x)**2*3.3+(p.y-y)**2*2.2+
    (p.z-prevZ)**2*.26;
   if(score<bestScore){bestScore=score;best=p;}
  }
  return best;
 };
 for(let s=0;s<seeds.length;s++){
  const seed=seeds[s],width=.0006+(s%5)*.00013;
  let last=seed,first=-1,length=0,previousIndex=-1;
  const maxLength=.08+(s%5)*.012;
  for(let j=0;j<15;j++){
   const y=seed.y-j*step;
   if(y<top-.18||seed.y-y>maxLength)break;
   const targetX=seed.x+Math.sin(s*2.37+j*.33)*.00075*j/10;
   const p=j===0?seed:find(targetX,y,last.z);
   if(!p)break;
   // Thin, raised hair locks follow the real v121 surface normal.
   let tx=p.nz,tz=-p.nx;
   const ln=Math.hypot(tx,tz)||1;tx/=ln;tz/=ln;
   const bump=.0042+.0007*Math.cos(s*1.81);
   const half=width*.5*Math.pow(1-j/Math.max(9,maxLength/step),.55);
   const centre=[p.x+p.nx*bump,p.y+p.ny*bump,p.z+p.nz*bump];
   const at=coords.length/3;
   for(const sign of [-1,1]){
    coords.push(centre[0]+tx*half*sign,centre[1],centre[2]+tz*half*sign);
    uvs.push((sign+1)*.5,j/13);
    const intensity=.77+((s*17)%13)/48;
    tone.setRGB(intensity,intensity,intensity);
    colors.push(tone.r,tone.g,tone.b);
   }
   if(previousIndex>=0)indices.push(previousIndex,previousIndex+1,at,
    previousIndex+1,at+1,at);
   previousIndex=at;last=p;length++;
  }
  if(length<2){
   // No dangling single-segment triangles.
   coords.splice(first>=0?first:coords.length-length*6,length*6);
   uvs.splice(uvs.length-length*4,length*4);
   colors.splice(colors.length-length*6,length*6);
  }
 }
 if(indices.length<90)return null;
 const geo=new THREE.BufferGeometry();
 geo.setAttribute('position',new THREE.Float32BufferAttribute(coords,3));
 geo.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
 geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
 geo.setIndex(indices);geo.computeVertexNormals();
 const mat=new THREE.MeshStandardMaterial({
  color,vertexColors:true,roughness:.73,metalness:0,
  side:THREE.DoubleSide
 });
 const fibers=new THREE.Mesh(geo,mat);
 fibers.name='v121-anatomical-flowing-scalp-fibers';
 fibers.frustumCulled=false;fibers.castShadow=false;fibers.receiveShadow=true;
 return fibers;
}
/** Head-local mask, exported to regression-test the eyebrow clearance. */
export function scalpHairlineIncludesLocal(x,y,z,box){
 const crownY=box.max.y,spanY=box.max.y-box.min.y;
 const centerZ=(box.min.z+box.max.z)*.5;
 const xHalf=(box.max.x-box.min.x)*.5;
 const forwardDepth=Math.max(.035,box.max.z-centerZ);
 const front=clamp((z-(centerZ+forwardDepth*.18))/(forwardDepth*.42),0,1);
 const side=clamp((Math.abs(x)/(xHalf||1)-.52)*2.7,0,1);
 const cut=crownY-spanY*(.39-.20*front-.075*side*(1-front));
 return y>=cut;
}
export function createV121AnatomicalHairCap(THREE,skinFace,{color='#c5a36f'}={}){
 if(!skinFace?.isMesh)throw Error('髪下地を取る実スキンヘッドがありません');
 const source=skinFace.geometry;
 const pos=source.getAttribute('position'),normal=source.getAttribute('normal');
 if(!pos||pos.count<1000||!normal)throw Error('正規のスキンヘッド頂点がありません');
 source.computeBoundingBox();
 const box=source.boundingBox;
 const crownY=box.max.y,spanY=box.max.y-box.min.y;
 // The exported v121 scalp also includes face, neck and shoulders.
 // Select scalp using the actual anatomical vertex positions, NOT the full
 // object's bounding box as a fake spherical shell.
 const kept=[];
 const index=source.getIndex(),count=Math.floor((index?.count||pos.count)/3);
 const onScalp=i=>scalpHairlineIncludesLocal(
  pos.getX(i),pos.getY(i),pos.getZ(i),box);
 for(let t=0;t<count;t++){
  const a=index?index.getX(t*3):t*3;
  const b=index?index.getX(t*3+1):t*3+1;
  const c=index?index.getX(t*3+2):t*3+2;
  if(onScalp(a)&&onScalp(b)&&onScalp(c))kept.push(a,b,c);
 }
 if(kept.length<900)throw Error('頭皮下地に十分な面がありません');
 const geom=source.clone();
 geom.setIndex(kept);geom.clearGroups();
 // Clone vertex data before offsetting normals. The original face MUST remain intact.
 const p=geom.getAttribute('position');
 const uv=new Float32Array(p.count*2);
 for(let i=0;i<p.count;i++){
  p.setXYZ(i,p.getX(i)+normal.getX(i)*.003,
   p.getY(i)+normal.getY(i)*.003,
   p.getZ(i)+normal.getZ(i)*.003);
  uv[i*2]=clamp((p.getX(i)-box.min.x)/(box.max.x-box.min.x),0,1)*2;
  uv[i*2+1]=clamp((crownY-p.getY(i))/Math.max(.08,spanY),0,1)*2.5;
 }
 p.needsUpdate=true;
 geom.setAttribute('uv',new THREE.BufferAttribute(uv,2));
 geom.computeBoundingSphere();
 const material=new THREE.MeshStandardMaterial({
  color,roughness:.84,metalness:0,side:THREE.DoubleSide,
  map:makeRootTexture(THREE),
  polygonOffset:true,polygonOffsetFactor:-1,
  polygonOffsetUnits:-1
 });
 const fibers=buildCrownFiberRibbons(THREE,geom,box,color);
  const overlay=new THREE.Mesh(geom,material);
 overlay.name='independent-hair-cap-from-real-v121-skin';
 overlay.castShadow=true;
 overlay.receiveShadow=true;
 overlay.frustumCulled=false;
 skinFace.add(overlay);
 if(fibers)skinFace.add(fibers);
 return {
  object:overlay,fibers,triangles:kept.length/3,
  fiberTriangles:fibers?.geometry.getIndex().count/3||0,
  setColor(value){material.color.set(value);
   fibers?.material.color.set(value);},
  dispose(){overlay.removeFromParent();geom.dispose();material.dispose();}
 };
}

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
 ctx.fillStyle='#e3dbd2';ctx.fillRect(0,0,512,512);
 for(let i=0;i<3500;i++){
  const x=(i*157.337)%512,y=(i*233.117)%512,length=18+(i%41);
  ctx.strokeStyle=i%5===0?'rgba(71,60,52,.36)':i%3===0?
   'rgba(255,251,240,.55)':'rgba(117,104,87,.19)';
  ctx.lineWidth=i%17===0?1.1:.5;
  ctx.beginPath();ctx.moveTo(x,y);
  ctx.bezierCurveTo(x+Math.sin(i)*1.8,y+length*.33,x-1,y+length*.72,x,y+length);
  ctx.stroke();
 }
 strandTexture=new THREE.CanvasTexture(canvas);
 strandTexture.colorSpace=THREE.SRGBColorSpace;
 strandTexture.wrapS=strandTexture.wrapT=THREE.RepeatWrapping;
 return strandTexture;
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
 const overlay=new THREE.Mesh(geom,material);
 overlay.name='independent-hair-cap-from-real-v121-skin';
 overlay.castShadow=true;
 overlay.receiveShadow=true;
 overlay.frustumCulled=false;
 skinFace.add(overlay);
 return {
  object:overlay,triangles:kept.length/3,
  setColor(value){material.color.set(value);},
  dispose(){overlay.removeFromParent();geom.dispose();material.dispose();}
 };
}

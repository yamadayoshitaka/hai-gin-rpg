// Hair grows from the imported, skinned head surface; no synthetic spherical helmet.
// 100k logical roots; render a capped, deterministic LOD as curved line segments.
export const HAIR_CATEGORIES=Object.freeze({
 short:{back:.055,side:.048,front:.04},bob:{back:.19,side:.16,front:.075},
 medium:{back:.27,side:.22,front:.09},long:{back:.43,side:.36,front:.11},
 wolf:{back:.32,side:.13,front:.08},ponytail:{back:.45,side:.13,front:.07},
 swept:{back:.11,side:.09,front:.065},spiky:{back:.055,side:.055,front:.05},
 curly:{back:.20,side:.17,front:.08},braid:{back:.39,side:.22,front:.08}
});
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const fract=x=>x-Math.floor(x);
const hash=x=>fract(Math.sin(x*127.1+13.7)*43758.5453);
export function attachMeasuredHair(THREE,model,{style='short',color='#30211b',logicalCount=100000,renderCount=6000}={}){
 model.updateWorldMatrix(true,true);
 const bones=[];model.traverse(n=>{if(n.isBone&&/head/i.test(n.name)&&!/end|hair/i.test(n.name))bones.push(n);});
 const head=bones[0];if(!head)return {ok:false,reason:'head bone missing'};
 head.updateWorldMatrix(true,false);
 const inv=head.matrixWorld.clone().invert(),temp=new THREE.Vector3();
 const candidate=[];
 model.traverse(mesh=>{
  if(!mesh.isMesh||/hair|wig|eye|brow|lash|teeth|mouth|tongue|cloth|armor|helmet/i.test(mesh.name))return;
  const pos=mesh.geometry?.getAttribute('position'),idx=mesh.geometry?.index;
  if(!pos||pos.count<20)return;
  const boneIndices=mesh.isSkinnedMesh?mesh.skeleton?.bones.map((b,i)=>/head/i.test(b.name)&&!/end|hair/i.test(b.name)?i:-1).filter(i=>i>=0):[];
  const skinI=mesh.geometry.getAttribute('skinIndex'),skinW=mesh.geometry.getAttribute('skinWeight');
  const isHeadName=/head|face|skin/i.test(mesh.name);
  if(!isHeadName&&(!boneIndices||!boneIndices.length))return;
  const qualifies=i=>{
   if(!skinI||!skinW)return isHeadName;
   let weight=0;
   for(let j=0;j<4;j++)if(boneIndices.includes(skinI.getComponent(i,j)))weight+=skinW.getComponent(i,j);
   return weight>.50 || (isHeadName&&!boneIndices.length);
  };
  const point=i=>{
   if(mesh.isSkinnedMesh&&mesh.getVertexPosition)mesh.getVertexPosition(i,temp);
   else temp.fromBufferAttribute(pos,i);
   return temp.clone().applyMatrix4(mesh.matrixWorld).applyMatrix4(inv);
  };
  const faces=Math.floor((idx?idx.count:pos.count)/3);
  const stride=Math.max(1,Math.floor(faces/10000));
  for(let f=0;f<faces;f+=stride){
   const ids=[0,1,2].map(k=>idx?idx.getX(f*3+k):f*3+k);
   if(!ids.every(qualifies))continue;
   const v=ids.map(point);
   if(v.every(p=>Number.isFinite(p.x+p.y+p.z)))candidate.push(v);
  }
 });
 if(candidate.length<12)return {ok:false,reason:'insufficient head triangles',triangles:candidate.length};
 const vertices=candidate.flat(),ys=vertices.map(v=>v.y).sort((a,b)=>a-b);
 const quant=(a,p)=>a[Math.floor((a.length-1)*p)];
 const top=quant(ys,.99),bottom=quant(ys,.10),height=top-bottom;
 if(!(height>.08&&height<.6))return {ok:false,reason:'invalid head height',height};
 // Scalp is the upper head only: exclude facial triangles, eyes, ears and neck.
 const scalp=candidate.filter(v=>v.every(p=>p.y>top-height*.38));
 if(scalp.length<8)return {ok:false,reason:'no scalp triangles',scalp:scalp.length};
 const points=scalp.flat(),xs=points.map(p=>p.x).sort((a,b)=>a-b),zs=points.map(p=>p.z).sort((a,b)=>a-b);
 const cx=(quant(xs,.05)+quant(xs,.95))/2,cz=(quant(zs,.05)+quant(zs,.95))/2;
 const rx=(quant(xs,.95)-quant(xs,.05))/2,rz=(quant(zs,.95)-quant(zs,.05))/2;
 if(!(rx>.025&&rz>.025))return {ok:false,reason:'invalid scalp bounds',rx,rz};
 const lengths=HAIR_CATEGORIES[style]||HAIR_CATEGORIES.short;
 const triAreas=scalp.map(v=>v[1].clone().sub(v[0]).cross(v[2].clone().sub(v[0])).length()*.5);
 const cumulative=[];let total=0;for(const a of triAreas){total+=a;cumulative.push(total);}
 if(total<=0)return {ok:false,reason:'zero scalp area'};
 const rootData=new Float32Array(logicalCount*3),lengthData=new Float32Array(logicalCount);
 const sampleRoot=i=>{
  const target=hash(i*1.17)*total;
  let lo=0,hi=cumulative.length-1;
  while(lo<hi){const mid=(lo+hi)>>1;if(cumulative[mid]<target)lo=mid+1;else hi=mid;}
  const tri=scalp[lo],r1=Math.sqrt(hash(i*2.3+1)),r2=hash(i*3.7+2);
  const a=1-r1,b=r1*(1-r2),c=r1*r2;
  return tri[0].clone().multiplyScalar(a).addScaledVector(tri[1],b).addScaledVector(tri[2],c);
 };
 for(let i=0;i<logicalCount;i++){
  const p=sampleRoot(i),j=i*3;
  rootData[j]=p.x;rootData[j+1]=p.y;rootData[j+2]=p.z;
  // Fringe remains above eyebrows; rear and sides grow to their selected length.
  const front=(p.z-cz)/rz,side=Math.abs((p.x-cx)/rx);
  const target=front>.32?lengths.front:side>.68?lengths.side:lengths.back;
  lengthData[i]=target*(.82+.18*hash(i*4.9));
 }
 // The underlying scalp shell is built from the SAME imported triangles.
 // A small normal offset prevents z-fighting while keeping the exact silhouette.
 const capPositions=[];
 const scalpCenter=new THREE.Vector3(cx,top-height*.25,cz);
 for(const tri of scalp){
  for(const p of tri){
   const normal=p.clone().sub(scalpCenter).normalize();
   capPositions.push(p.x+normal.x*.002,p.y+normal.y*.002,p.z+normal.z*.002);
  }
 }
 const capGeometry=new THREE.BufferGeometry();
 capGeometry.setAttribute('position',new THREE.Float32BufferAttribute(capPositions,3));
 capGeometry.computeVertexNormals();
 const capMaterial=new THREE.MeshStandardMaterial({color,roughness:1,side:THREE.DoubleSide});
 const cap=new THREE.Mesh(capGeometry,capMaterial);
 cap.name='measured-hair-scalp-base';
 head.add(cap);
 const segments=5,drawCount=Math.min(renderCount,logicalCount);
 const positions=new Float32Array(drawCount*segments*6);
 const indexMap=new Uint32Array(drawCount);
 for(let i=0;i<drawCount;i++)indexMap[i]=Math.floor(i*logicalCount/drawCount);
 const update=(time=0)=>{
  for(let i=0;i<drawCount;i++){
   const id=indexMap[i],j=id*3,x=rootData[j],y=rootData[j+1],z=rootData[j+2],length=lengthData[id];
   const radialX=(x-cx)/rx,radialZ=(z-cz)/rz;
   const front=radialZ>.32;
   // Hair initially follows scalp tangent, then bends downward; fringe sweeps sideways.
   const side=Math.sign(radialX||hash(id)-.5),wave=Math.sin(time*1.7+id*.23)*.004;
   const point=t=>{
    const bend=t*t;
    const outward=front?side*.035*bend:radialX*.025*bend;
    const dz=front?-.028*bend:radialZ*.026*bend;
    return [x+outward+wave*bend,y-length*t+Math.max(0,1-t)*.008,z+dz];
   };
   for(let k=0;k<segments;k++){
    const p0=point(k/segments),p1=point((k+1)/segments),o=(i*segments+k)*6;
    positions.set(p0,o);positions.set(p1,o+3);
   }
  }
  geometry.attributes.position.needsUpdate=true;
 };
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
 const mat=new THREE.LineBasicMaterial({color,transparent:true,opacity:.92,depthWrite:true});
 const lines=new THREE.LineSegments(geometry,mat);lines.name='measured-scalp-hair';
 head.add(lines);update();
 const old=[];model.traverse(n=>{if(n!==lines&&n.isMesh&&/hair|scalp|wig/i.test(n.name)){old.push([n,n.visible]);n.visible=false;}});
 const result={ok:true,head,lines,cap,rootData,lengthData,update,dispose(){lines.parent?.remove(lines);cap.parent?.remove(cap);geometry.dispose();capGeometry.dispose();mat.dispose();capMaterial.dispose();old.forEach(([n,v])=>n.visible=v);},stats:{logicalCount,renderedStrands:drawCount,scalpTriangles:scalp.length,scalpCapTriangles:scalp.length,rx,rz,style}};
 return result;
}

/**
 * Remove disconnected floating fragments without cutting legitimate long
 * hair cards. Works on an indexed or non-indexed THREE.BufferGeometry clone.
 * Use only for detachable hair - never for face / eyebrow meshes.
 */
const CELL=.022;
const clamp=(x,lo,hi)=>Math.max(lo,Math.min(hi,x));
function cellKey(x,y,z){
 return Math.floor(x/CELL)+','+Math.floor(y/CELL)+','+Math.floor(z/CELL);
}
function triArea(pos,a,b,c){
 const x=pos.getX(a),y=pos.getY(a),z=pos.getZ(a);
 const ux=pos.getX(b)-x,uy=pos.getY(b)-y,uz=pos.getZ(b)-z;
 const vx=pos.getX(c)-x,vy=pos.getY(c)-y,vz=pos.getZ(c)-z;
 return Math.hypot(uy*vz-uz*vy,uz*vx-ux*vz,ux*vy-uy*vx)*.5;
}
function qKey(pos,id){
 return Math.round(pos.getX(id)*10000)+','+
  Math.round(pos.getY(id)*10000)+','+
  Math.round(pos.getZ(id)*10000);
}
/**
 * @returns {{geometry:THREE.BufferGeometry, removedTriangles:number,
 *            removedComponents:number, keptTriangles:number}}
 */
export function cleanDetachedHairGeometry(geometry,{
 minArea=1e-11,fragmentMaxTriangles=18,
 fragmentMaxDiagonal=.044,isolationDistance=.031
}={}){
 const pos=geometry.getAttribute('position');
 if(!pos)throw Error('Hair has no POSITION');
 const index=geometry.getIndex(),triangleCount=Math.floor((index?.count??pos.count)/3);
 if(!triangleCount)return {geometry,removedTriangles:0,removedComponents:0,keptTriangles:0};
 // Weld coincident hair-card vertices only for connectivity detection.
 // Preserve original UVs, normals, tangents, indices and material slots.
 const vertexKeys=new Map(),canonical=new Int32Array(pos.count);
 let keyCount=0;
 for(let i=0;i<pos.count;i++){
  const k=qKey(pos,i);
  if(!vertexKeys.has(k))vertexKeys.set(k,keyCount++);
  canonical[i]=vertexKeys.get(k);
 }
 const parents=Array.from({length:keyCount},(_,i)=>i);
 const find=id=>{
  while(parents[id]!==id){parents[id]=parents[parents[id]];id=parents[id];}
  return id;
 };
 const unite=(a,b)=>{a=find(a);b=find(b);if(a!==b)parents[b]=a;};
 const triangles=[],groups=geometry.groups||[];
 const getMaterial=t=>{
  const start=t*3;
  for(const g of groups)if(start>=g.start&&start<g.start+g.count)return g.materialIndex;
  return 0;
 };
 for(let t=0;t<triangleCount;t++){
  const a=index?index.getX(3*t):3*t;
  const b=index?index.getX(3*t+1):3*t+1;
  const c=index?index.getX(3*t+2):3*t+2;
  const area=triArea(pos,a,b,c);
  if(!Number.isFinite(area)||area<minArea)continue;
  const pa=canonical[a],pb=canonical[b],pc=canonical[c];
  unite(pa,pb);unite(pa,pc);
  triangles.push({a,b,c,pa,material:getMaterial(t),
   x:(pos.getX(a)+pos.getX(b)+pos.getX(c))/3,
   y:(pos.getY(a)+pos.getY(b)+pos.getY(c))/3,
   z:(pos.getZ(a)+pos.getZ(b)+pos.getZ(c))/3});
 }
 const components=new Map();
 for(const t of triangles){
  const key=find(t.pa);
  if(!components.has(key))components.set(key,{
   triangles:[],min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity]
  });
  const c=components.get(key);c.triangles.push(t);
  for(const vertex of [t.a,t.b,t.c]){
   const coords=[pos.getX(vertex),pos.getY(vertex),pos.getZ(vertex)];
   for(let k=0;k<3;k++){
    c.min[k]=Math.min(c.min[k],coords[k]);c.max[k]=Math.max(c.max[k],coords[k]);
   }
  }
 }
 const big=[],small=[];
 for(const component of components.values()){
  const diagonal=Math.hypot(...component.max.map((x,i)=>x-component.min[i]));
  // A thin, long, two-triangle hair card is NOT garbage.
  if(component.triangles.length>fragmentMaxTriangles||diagonal>fragmentMaxDiagonal)
   big.push(component);
  else small.push(component);
 }
 const mainBuckets=new Map();
 for(const component of big)for(const t of component.triangles){
  const key=cellKey(t.x,t.y,t.z);
  if(!mainBuckets.has(key))mainBuckets.set(key,[]);
  mainBuckets.get(key).push(t);
 }
 const closeToMain=(component)=>{
  // When ALL hair cards are tiny there is no reliable main component.
  if(!big.length)return true;
  const limit=isolationDistance*isolationDistance,scan=Math.ceil(isolationDistance/CELL);
  for(const t of component.triangles){
   const cx=Math.floor(t.x/CELL),cy=Math.floor(t.y/CELL),cz=Math.floor(t.z/CELL);
   for(let dx=-scan;dx<=scan;dx++)
    for(let dy=-scan;dy<=scan;dy++)
     for(let dz=-scan;dz<=scan;dz++){
      const candidates=mainBuckets.get((cx+dx)+','+(cy+dy)+','+(cz+dz));
      if(!candidates)continue;
      for(const p of candidates){
       if((t.x-p.x)**2+(t.y-p.y)**2+(t.z-p.z)**2<limit)return true;
      }
     }
  }
  return false;
 };
 const keep=new Set(),removed=[];
 for(const component of big)for(const t of component.triangles)keep.add(t);
 for(const component of small){
  if(closeToMain(component))for(const t of component.triangles)keep.add(t);
  else removed.push(component);
 }
 if(keep.size===triangleCount){
  return {geometry,removedTriangles:0,removedComponents:0,keptTriangles:triangleCount};
 }
 const ordered=triangles.filter(t=>keep.has(t));
 // Regroup by original material index since filtered triangles changed offsets.
 const buckets=new Map();
 for(const t of ordered){
  if(!buckets.has(t.material))buckets.set(t.material,[]);
  buckets.get(t.material).push(t);
 }
 const output=[],outGroups=[];
 for(const [material,ts] of [...buckets].sort((a,b)=>a[0]-b[0])){
  const start=output.length;
  for(const t of ts)output.push(t.a,t.b,t.c);
  outGroups.push({start,count:output.length-start,materialIndex:material});
 }
 geometry.setIndex(output);geometry.clearGroups();
 for(const group of outGroups)geometry.addGroup(group.start,group.count,group.materialIndex);
 geometry.computeBoundingSphere();geometry.computeBoundingBox();
 return {geometry,removedTriangles:triangleCount-ordered.length,
  removedComponents:removed.length,keptTriangles:ordered.length};
}

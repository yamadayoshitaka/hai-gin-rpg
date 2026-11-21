/**
 * Smoothly tapered, faceted anatomical mineral shells (no human skin mesh).
 * Original 3D BufferGeometries, not intersecting icospheres or clothing.
 * Distinct source/high/medium/low geometry is produced from one profile.
 */
import * as THREE from 'three';
export const CONSTRUCT_ANATOMY_REVISION='golem-anatomical-facets-v3-20261121';
const sectionCount=d=>d==='source'?26:d==='high'?20:d==='medium'?14:9;
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
function loft(name,rings,detail='high',{frontRidge=0,rough=0,twist=0}={}){
 const segments=sectionCount(detail);
 const vs=[],uv=[],faces=[];
 for(let row=0;row<rings.length;row++){
  const {y,rx,rz,z=0}=rings[row];
  for(let k=0;k<=segments;k++){
   const theta=k*Math.PI*2/segments;
   const st=Math.sin(theta),ct=Math.cos(theta);
   const prism=1+.045*Math.cos(k*4.3+row*1.7)*rough;
   const x=rx*ct*prism;
   const front=Math.pow(clamp(-st,0,1),7);
   const zz=z+rz*st*prism-frontRidge*front+
    .013*rough*Math.cos(theta*11+row*.77);
   vs.push(x+(row%2===0?twist:-twist)*Math.sin(theta),y,zz);
   uv.push(k/segments,row/(rings.length-1));
   if(row<rings.length-1&&k<segments){
    const a=row*(segments+1)+k,b=a+segments+1;
    faces.push(a,a+1,b,a+1,b+1,b);
   }
  }
 }
 // Caps close the humanoid outline, including the low battle LOD.
 const cap=(index,up)=>{
  const {y,z=0}=rings[index],center=vs.length/3;
  vs.push(0,y,z);uv.push(.5,.5);
  const base=index*(segments+1);
  for(let i=0;i<segments;i++){
   if(up)faces.push(center,base+i+1,base+i);
   else faces.push(center,base+i,base+i+1);
  }
 };
 cap(0,true);cap(rings.length-1,false);
 const g=new THREE.BufferGeometry();
 g.setAttribute('position',new THREE.Float32BufferAttribute(vs,3));
 g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
 g.setIndex(faces);
 g.computeVertexNormals();
 g.userData={kind:name,detail,anatomicalSource:true};
 return g;
}
export function createConstructMineralTorso({detail='high',region='chest'}={}){
 const shape=region==='pelvis'?[
  {y:.20,rx:.215,rz:.165},{y:.12,rx:.275,rz:.207},
  {y:.00,rx:.284,rz:.203},{y:-.12,rx:.270,rz:.184},
  {y:-.26,rx:.205,rz:.165},{y:-.29,rx:.110,rz:.106}
 ]:[
  {y:.395,rx:.135,rz:.125},{y:.346,rx:.264,rz:.193},
  {y:.246,rx:.353,rz:.252},{y:.105,rx:.370,rz:.271},
  {y:-.048,rx:.330,rz:.264},{y:-.201,rx:.286,rz:.217},
  {y:-.333,rx:.227,rz:.195},{y:-.408,rx:.150,rz:.130}
 ];
 return loft('entire-mineral-'+region,shape,detail,{
  frontRidge:region==='chest'?.039:.012,rough:.62,twist:.012});
}
export function createConstructMineralCranium({detail='high'}={}){
 return loft('integrated-inhuman-mineral-cranium',[
  {y:.209,rx:.045,rz:.059,z:-.013},
  {y:.170,rx:.122,rz:.120,z:-.009},
  {y:.108,rx:.165,rz:.158,z:0},
  {y:.027,rx:.176,rz:.164,z:.002},
  {y:-.070,rx:.156,rz:.148,z:-.004},
  {y:-.146,rx:.111,rz:.116,z:-.026},
  {y:-.185,rx:.064,rz:.073,z:-.036}
 ],detail,{frontRidge:.028,rough:.65,twist:.006});
}
export function createConstructMineralLimb({detail='high',part='upperArm'}={}){
 const cfg={
  upperArm:{len:.45,up:.152,peak:.176,down:.119,front:.015},
  forearm:{len:.47,up:.130,peak:.157,down:.160,front:.011},
  thigh:{len:.55,up:.193,peak:.203,down:.147,front:.016},
  shin:{len:.53,up:.155,peak:.150,down:.123,front:.015},
 };
 const v=cfg[part];if(!v)throw Error('Unknown mineral limb '+part);
 const l=v.len,lo=detail==='low';
 const rings=[
  {y:.045,rx:v.up*.88,rz:v.up*.84},
  {y:-l*.15,rx:v.up,rz:v.up*.95},
  {y:-l*.38,rx:v.peak,rz:v.peak*.87},
  {y:-l*.64,rx:v.peak*.90,rz:v.peak*.80},
  {y:-l*.85,rx:v.down,rz:v.down*.90},
  {y:-l*1.035,rx:v.down*.83,rz:v.down*.79}
 ];
 if(lo)rings.splice(2,1);
 return loft('single-sculpted-faceted-'+part,rings,detail,{
  frontRidge:v.front,rough:.72,twist:.006});
}
export function createConstructCrystalBlade({detail='high',height=.30,waist=.07}={}){
 const count=detail==='low'?5:detail==='medium'?6:8;
 const verts=[],faces=[],uv=[];
 const levels=[
  {y:0,r:waist*.90},
  {y:.07,r:waist*1.20},
  {y:height*.70,r:waist*.72},
  {y:height,r:.004}
 ];
 for(let j=0;j<levels.length;j++){
  const {y,r}=levels[j];
  for(let i=0;i<=count;i++){
   const a=i*Math.PI*2/count;
   const flare=1+.12*Math.cos(i*5+j*4);
   verts.push(Math.cos(a)*r*flare,y,Math.sin(a)*r*(.78+.1*(i%2)));
   uv.push(i/count,j/(levels.length-1));
   if(j<levels.length-1&&i<count){
    const a0=j*(count+1)+i,b=a0+count+1;
    faces.push(a0,a0+1,b,a0+1,b+1,b);
   }
  }
 }
 const g=new THREE.BufferGeometry();
 g.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));
 g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
 g.setIndex(faces);g.computeVertexNormals();
 return g;
}

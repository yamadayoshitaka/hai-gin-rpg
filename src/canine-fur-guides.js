/**
 * Deterministic fur growth guides for mature canines.
 *
 * No pseudo-random per-frame allocations. Every guide follows the natural
 * surface normal of an elliptical torso/cheek, then sweeps backwards along
 * the coat. The renderer batches them into a few tapered ribbons, rather
 * than hundreds of individual cones or alpha-blended hair sprites.
 *
 * Shared by the summoned grey wolf and the five beast-family monsters.
 */
const noise=(a,b,seed=0)=>{
 const n=Math.sin((a+1)*127.13+(b+1)*311.71+seed*74.7)*43758.5453;
 return n-Math.floor(n);
};
const finite3=v=>Array.isArray(v)&&v.length===3&&v.every(Number.isFinite);
export function generateCanineFurGuides({
 center=[0,0,0],radii=[1,1,1],rows=14,around=22,
 length=.095,width=.018,seed=0,minVertical=-.40,maxVertical=1,
 gravity=.13,flow=-1,axis='z',
}={}){
 if(!finite3(center)||!finite3(radii)||radii.some(v=>v<=0)||
   !Number.isInteger(rows)||rows<2||rows>50||
   !Number.isInteger(around)||around<4||around>64||
   !Number.isFinite(length)||length<=0||length>.5||
   !Number.isFinite(width)||width<=0||width>.2||
   !Number.isFinite(minVertical)||!Number.isFinite(maxVertical)||
   minVertical< -1||maxVertical>1||minVertical>maxVertical||
   !['z','y'].includes(axis))
  throw Error('Invalid canine fur-guide dimensions');
 const guides=[];
 for(let row=0;row<rows;row++){
  const along=(row+.46)/rows*1.86-.93;
  const ring=Math.sqrt(Math.max(0,1-along*along));
  for(let col=0;col<around;col++){
   const theta=2*Math.PI*(col+(row%2)*.5+noise(row,col,seed)*.28)/around;
   const vertical=Math.sin(theta);
   const surfaceVertical=axis==='y'?along:vertical;
   if(surfaceVertical<minVertical||surfaceVertical>maxVertical)continue;
   const radial=Math.cos(theta);
   // Torso/cheek fur is longitudinal on Z; limbs use a Y-aligned
   // ellipsoid so fur follows the animated leg instead of floating.
   const origin=axis==='y'?
     [center[0]+radii[0]*radial*ring,
      center[1]+radii[1]*along,
      center[2]+radii[2]*vertical*ring]:
     [center[0]+radii[0]*radial*ring,
      center[1]+radii[1]*vertical*ring,
      center[2]+radii[2]*along];
   const n=axis==='y'?
     [radial*ring/radii[0],along/radii[1],vertical*ring/radii[2]]:
     [radial*ring/radii[0],vertical*ring/radii[1],along/radii[2]];
   const nLen=Math.hypot(...n)||1;
   const normal=n.map(v=>v/nLen);
   const wobble=noise(row*19,col*7,seed)-.5;
   const strandLength=length*(.74+.60*noise(row*3,col*11,seed));
   // Hair falls along shoulders and cheeks but retains its natural outward
   // silhouette, particularly at the neck and tail.
   const tip=axis==='y'?[
     origin[0]+normal[0]*strandLength*.46+wobble*strandLength*.12,
     origin[1]-strandLength*(.78+Math.max(.015,gravity)*.25)+
       normal[1]*strandLength*.18,
     origin[2]+normal[2]*strandLength*.48,
   ]:[
     origin[0]+normal[0]*strandLength*.44+wobble*strandLength*.15,
     origin[1]+normal[1]*strandLength*.40-Math.max(.015,gravity)*strandLength,
     origin[2]+flow*strandLength+normal[2]*strandLength*.17,
   ];
   const middle=[
     origin[0]*.47+tip[0]*.53+normal[0]*strandLength*.10,
     origin[1]*.47+tip[1]*.53+normal[1]*strandLength*.10,
     origin[2]*.47+tip[2]*.53+normal[2]*strandLength*.10,
   ];
   guides.push({
    root:origin,mid:middle,tip,
    normal,
    width:width*(.65+.62*noise(row*7,col*13,seed)),
    shade:((row*13+col*7+seed)%13===0)?'shadow':
      ((row*7+col*5+seed)%7===0)?'light':'skin',
   });
  }
 }
 return guides;
}
export function canineFurGuideStats(guides){
 const spread=new Set(guides.map(v=>v.shade));
 return {count:guides.length,shades:[...spread],
  invalid:guides.filter(v=>![...v.root,...v.mid,...v.tip,...v.normal,v.width].every(Number.isFinite)).length};
}

/**
 * Anatomically anchored coat, using exactly the same shoulder/rib/waist
 * stations as the real axial torso mesh. The old ellipsoid coat had hair
 * hovering over a tapered body and the whole animal looked cylindrical.
 * Stations and lengthProfile are nose(+Z)->tail(-Z), in model metres.
 */
export function generateCanineAxialFurGuides({
 stations,lengthProfile,rows=28,around=36,seed=0,width=.018,
 minVertical=-1,maxVertical=1,gravity=.17,
}={}){
 const ordered=arr=>Array.isArray(arr)&&arr.length>=3&&
  arr.every((p,i)=>Number.isFinite(p.z)&&(!i||arr[i-1].z>p.z));
 if(!ordered(stations)||!ordered(lengthProfile)||
    stations.some(p=>!['y','rx','ry'].every(k=>Number.isFinite(p[k]))||
      p.rx<=0||p.ry<=0)||
    lengthProfile.some(p=>!Number.isFinite(p.length)||p.length<=0||p.length>.5)||
    !Number.isInteger(rows)||rows<2||rows>50||
    !Number.isInteger(around)||around<4||around>64||
    !Number.isFinite(width)||width<=0||width>.2||
    !Number.isFinite(minVertical)||!Number.isFinite(maxVertical)||
    minVertical< -1||maxVertical>1||minVertical>maxVertical)
  throw Error('Invalid anatomically anchored canine coat profile');
 const interpolate=(nodes,z,key)=>{
  for(let i=1;i<nodes.length;i++)if(z>=nodes[i].z||i===nodes.length-1){
   const a=nodes[i-1],b=nodes[i],
    t=Math.max(0,Math.min(1,(a.z-z)/(a.z-b.z)));
   return a[key]+(b[key]-a[key])*t;
  }
  return nodes[0][key];
 };
 const guides=[];
 const zNear=stations[0].z,zFar=stations[stations.length-1].z;
 for(let row=0;row<rows;row++){
  const z=zNear-(zNear-zFar)*(row+.5)/rows;
  const y=interpolate(stations,z,'y');
  const rx=interpolate(stations,z,'rx'),ry=interpolate(stations,z,'ry');
  const localLength=interpolate(lengthProfile,z,'length');
  // Surface slope enters the true geometric normal, so roots follow the
  // taper and individual hair blades are not left inside the ribs or pelvis.
  const eps=.018;
  const dx=(interpolate(stations,z+eps,'rx')-
    interpolate(stations,z-eps,'rx'))/(eps*2);
  const dy=(interpolate(stations,z+eps,'y')-
    interpolate(stations,z-eps,'y'))/(eps*2);
  const dh=(interpolate(stations,z+eps,'ry')-
    interpolate(stations,z-eps,'ry'))/(eps*2);
  for(let col=0;col<around;col++){
   const theta=2*Math.PI*(col+(row%2)*.5+noise(row,col,seed)*.23)/around;
   const vertical=Math.sin(theta);
   if(vertical<minVertical||vertical>maxVertical)continue;
   const horizontal=Math.cos(theta);
   const nx=horizontal/rx,ny=vertical/ry,
     nz=-(nx*horizontal*dx+ny*(dy+vertical*dh));
   const mag=Math.hypot(nx,ny,nz)||1;
   const normal=[nx/mag,ny/mag,nz/mag];
   const root=[horizontal*(rx+.012),y+vertical*(ry+.012),z];
   // Guard hairs: longer below front chest, shorter atop the spines and
   // around the narrow waist. No uniform porcupine-like radial carpet.
   const region=vertical<-.30?(z>0?1.21:1.07):
     vertical>.60?.80:1;
   const strandLength=localLength*region*
     (.80+.38*noise(row*7,col*11,seed));
   const wobble=noise(row*19,col*7,seed)-.5;
   const tip=[
    root[0]+normal[0]*strandLength*.53+wobble*strandLength*.11,
    root[1]+normal[1]*strandLength*.45-gravity*strandLength,
    root[2]-strandLength*.90+normal[2]*strandLength*.10
   ];
   const mid=[
    root[0]*.44+tip[0]*.56+normal[0]*strandLength*.11,
    root[1]*.44+tip[1]*.56+normal[1]*strandLength*.11,
    root[2]*.44+tip[2]*.56+normal[2]*strandLength*.11
   ];
   guides.push({root,mid,tip,normal,
    width:width*(.68+.55*noise(row*11,col*13,seed)),
    shade:((row*13+col*7+seed)%13===0)?'shadow':
      ((row*7+col*5+seed)%7===0)?'light':'skin'});
  }
 }
 return guides;
}

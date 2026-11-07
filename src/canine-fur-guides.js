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
 length=.095,width=.018,seed=0,minVertical=-.40,
 gravity=.13,flow=-1,
}={}){
 if(!finite3(center)||!finite3(radii)||radii.some(v=>v<=0)||
   !Number.isInteger(rows)||rows<2||rows>50||
   !Number.isInteger(around)||around<4||around>64||
   !Number.isFinite(length)||length<=0||length>.5||
   !Number.isFinite(width)||width<=0||width>.2)
  throw Error('Invalid canine fur-guide dimensions');
 const guides=[];
 for(let row=0;row<rows;row++){
  const z=(row+.46)/rows*1.86-.93;
  const ring=Math.sqrt(Math.max(0,1-z*z));
  for(let col=0;col<around;col++){
   const theta=2*Math.PI*(col+(row%2)*.5+noise(row,col,seed)*.28)/around;
   const vertical=Math.sin(theta);
   if(vertical<minVertical)continue;
   const radial=Math.cos(theta);
   const origin=[
    center[0]+radii[0]*radial*ring,
    center[1]+radii[1]*vertical*ring,
    center[2]+radii[2]*z,
   ];
   const n=[radial*ring/radii[0],vertical*ring/radii[1],z/radii[2]];
   const nLen=Math.hypot(...n)||1;
   const normal=n.map(v=>v/nLen);
   const wobble=noise(row*19,col*7,seed)-.5;
   const strandLength=length*(.74+.60*noise(row*3,col*11,seed));
   // Hair falls along shoulders and cheeks but retains its natural outward
   // silhouette, particularly at the neck and tail.
   const tip=[
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

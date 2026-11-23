/**
 * Optional, reference-derived, reversible dual-gender facial shaping.
 * The Alina Ip GLB is NOT bundled, downloaded without permission or inferred
 * from a thumbnail. The caller provides real skin-surface vertices.
 * Each result is applied to an owned CC0 head clone only.
 */
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const bell=(v,c,r)=>Math.exp(-.5*((v-c)/r)**2);
const smooth=(a,b,v)=>{
 const t=clamp((v-a)/(b-a),0,1);return t*t*(3-2*t);
};
const q=(values,fraction)=>{
 if(!values.length)return NaN;
 values.sort((a,b)=>a-b);
 const at=(values.length-1)*fraction,left=Math.floor(at),right=Math.ceil(at);
 return values[left]*(1-(at-left))+values[right]*(at-left);
};
const boundsFor=points=>{
 let minX=Infinity,minY=Infinity,minZ=Infinity,maxX=-Infinity,maxY=-Infinity,maxZ=-Infinity;
 for(let i=0;i<points.length;i+=3){
  const x=points[i],y=points[i+1],z=points[i+2];
  if(![x,y,z].every(Number.isFinite))throw Error('Non-finite reference vertex');
  minX=Math.min(minX,x);maxX=Math.max(maxX,x);
  minY=Math.min(minY,y);maxY=Math.max(maxY,y);
  minZ=Math.min(minZ,z);maxZ=Math.max(maxZ,z);
 }
 const x=maxX-minX,y=maxY-minY,z=maxZ-minZ;
 if(x<.001||y<.001||z<.001)throw Error('The reference must be a real 3D face surface');
 return {minX,minY,minZ,maxX,maxY,maxZ,x,y,z,cx:(minX+maxX)/2};
};
/** Quantile landmarks avoid single noisy vertices; coordinate frame Y-up. */
function measure(points,frontSign){
 const b=boundsFor(points),nose=[],cheek=[],lip=[],jaw=[],middle=[];
 let cheekExtent=0,jawExtent=0;
 for(let i=0;i<points.length;i+=3){
  const xn=(points[i]-b.cx)/(b.x*.5),yn=(points[i+1]-b.minY)/b.y;
  const front=(frontSign>0?points[i+2]-b.minZ:b.maxZ-points[i+2])/b.z;
  if(Math.abs(xn)<.20&&yn>.46&&yn<.72)nose.push(front);
  if(Math.abs(xn)>.27&&Math.abs(xn)<.62&&yn>.43&&yn<.61)cheek.push(front);
  if(Math.abs(xn)<.23&&yn>.32&&yn<.48)lip.push(front);
  if(yn>.25&&yn<.41&&front>.44){jaw.push(Math.abs(xn));jawExtent=Math.max(jawExtent,Math.abs(xn));}
  if(yn>.47&&yn<.66&&front>.44){middle.push(Math.abs(xn));cheekExtent=Math.max(cheekExtent,Math.abs(xn));}
 }
 if(nose.length<10||cheek.length<10||lip.length<10||
  jaw.length<10||middle.length<10)throw Error('Face landmark regions are too sparse');
 const result={
  frontSign,faceDepth:b.z,vertexCount:points.length/3,
  noseFront:q(nose,.94),cheekFront:q(cheek,.94),lipFront:q(lip,.94),
  jawWidth:q(jaw,.88),midfaceWidth:q(middle,.88),
  samples:{nose:nose.length,cheek:cheek.length,lip:lip.length,jaw:jaw.length}
 };
 result.noseRelief=result.noseFront-result.cheekFront;
 result.jawToCheek=result.jawWidth/Math.max(.1,result.midfaceWidth);
 return result;
}
/** Automatically select which Z-facing direction contains a nose relief. */
export function analyzeFaceReference(points,{frontSign='auto'}={}){
 if(!(points instanceof Float32Array||points instanceof Float64Array||Array.isArray(points))||
   points.length<900||points.length%3!==0)throw Error('At least 300 real 3D face vertices are required');
 if(frontSign==='auto'){
  const options=[];
  for(const sign of [1,-1]){
   try{options.push(measure(points,sign));}catch{}
  }
  if(!options.length)throw Error('No analyzable face landmarks');
  options.sort((a,b)=>b.noseRelief-a.noseRelief);
  if(options[0].noseRelief<.015)throw Error('Unable to determine front of the source face');
  const r=options[0];
  return Object.freeze({...r,confidence:clamp((r.noseRelief-.015)*5,0,1),
   orientation:'inferred-from-real-vertices'});
 }
 if(frontSign!==1&&frontSign!==-1)throw Error('frontSign must be auto or +/-1');
 return Object.freeze({...measure(points,frontSign),orientation:'caller-specified'});
}
/**
 * Retarget only bounded soft-tissue proportions to a cloned female or male
 * head. The input is a neutral face *after* the legacy morph stack, so the
 * caller must never apply twice. Protect eyes, original lips, ears and scalp.
 */
export function transferFaceReference(geometry,{gender,reference,donorPositions}={}){
 if(gender!=='female'&&gender!=='male')throw Error('Invalid gender');
 const pos=geometry?.getAttribute?.('position');
 if(!pos||!(donorPositions instanceof Float32Array||
  donorPositions instanceof Float64Array)||donorPositions.length!==pos.array.length)
  throw Error('An owned CC0 mesh and immutable original vertices are required');
 if(!reference||!Number.isFinite(reference.cheekFront)||!Number.isFinite(reference.noseRelief))
  return {applied:false,reason:'no-verified-3d-reference'};
 // The original CC0 has +Z forward; the source orientation is normalized
 // by analyzeFaceReference before entering this pass.
 let target;
 try{target=analyzeFaceReference(donorPositions,{frontSign:1});}
 catch(error){return {applied:false,reason:'target-analysis-failed: '+String(error)};}
 const b=boundsFor(donorPositions),female=gender==='female';
 const cheekDelta=clamp((reference.cheekFront-target.cheekFront)*.20,-.022,.022);
 const noseDelta=clamp((reference.noseRelief-target.noseRelief)*.22,-.018,.018);
 const jawDelta=clamp((reference.jawToCheek-target.jawToCheek)*.065,-.015,.015);
 const strength=female?1:.64;
 let changed=0,maxOffset=0;
 for(let i=0;i<pos.count;i++){
  const x=donorPositions[i*3],y=donorPositions[i*3+1],z=donorPositions[i*3+2];
  const xn=(x-b.cx)/(b.x*.5),yn=(y-b.minY)/b.y,zn=(z-b.minZ)/b.z;
  const front=smooth(.48,.75,zn);
  // Mid-cheek refilling, confined away from lips and the orbital rim.
  const cheek=bell(Math.abs(xn),.44,.15)*bell(yn,.49,.063)*front;
  const nose=bell(xn,0,.15)*bell(yn,.574,.044)*front;
  const jaw=bell(yn,.33,.064)*smooth(.18,.36,Math.abs(xn))*
   (1-smooth(.59,.76,Math.abs(xn)))*front;
  const dz=b.z*strength*(cheekDelta*cheek+noseDelta*nose);
  const dx=-(x-b.cx)*strength*jawDelta*jaw;
  pos.setXYZ(i,pos.getX(i)+dx,pos.getY(i),pos.getZ(i)+dz);
  const move=Math.hypot(dx,dz);
  if(move>1e-8)changed++;
  maxOffset=Math.max(maxOffset,move);
 }
 if(changed===0)return {applied:false,reason:'reference-already-matches-target'};
 pos.needsUpdate=true;geometry.computeVertexNormals();
 geometry.computeBoundingBox();geometry.computeBoundingSphere();
 return {applied:true,referenceVertexCount:reference.vertexCount,gender,
  targetNoseRelief:target.noseRelief,targetCheekFront:target.cheekFront,
  cheekDelta,noseDelta,jawDelta,modifiedVertices:changed,maxOffset,
  sourceReferenceRetained:false};
}

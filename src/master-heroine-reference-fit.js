/**
 * The approved 2D female knight is the VISUAL TARGET, not a mesh.
 * Pixel landmarks were measured from the supplied 864x1536 screenshot's
 * actual face at x=~284..405 and y=~611..744. UI, hair and armour pixels
 * are intentionally excluded. A front view alone cannot recover the depth
 * of a nose or the rear of a head: depth is regularized from the existing
 * CC0 sculpt and 3/4 views still require independent art approval.
 *
 * Works on the existing face's 3D vertices; no picture is composited onto
 * the head. All ratios are normalized to the visible portrait half-width.
 */
export const REFERENCE_HEROINE_FACE=Object.freeze({
 id:'approved-female-knight-face-2026-11-09',
 source:'user supplied 2D target (right-hand screenshot)',
 imageSize:[864,1536],centerPixel:[345,679],
 landmarks:Object.freeze({
  leftEye:[322,666],rightEye:[370,666],
  leftBrow:[322,652],rightBrow:[369,652],
  noseTip:[347,695],mouthCenter:[347,715],
  chin:[346,743],leftEar:[288,675],rightEar:[406,675]
 }),
 // y is fraction chin -> hairline, r is projected half-width / cheek width.
 // The y/r outline is traced from a symmetric average of both facial sides.
 // Crucially the lower jaw TAPERS instead of expanding into a square 'エラ'.
 outline:Object.freeze([
  [0.00,0.16],[.07,.33],[.16,.51],[.26,.72],[.36,.83],
  [.47,.93],[.58,1.00],[.68,.99],[.79,.95],[.89,.91],[1.0,.85]
 ])
});
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t)};
function outlineRatio(y){
 const a=REFERENCE_HEROINE_FACE.outline;
 if(y<=a[0][0])return a[0][1];
 for(let i=1;i<a.length;i++)if(y<=a[i][0]){
  const t=smooth(a[i-1][0],a[i][0],y);
  return a[i-1][1]*(1-t)+a[i][1]*t;
 }
 return a[a.length-1][1];
}
function percentile(xs,q){
 if(!xs.length)return null;
 xs.sort((a,b)=>a-b);
 return xs[Math.min(xs.length-1,Math.floor((xs.length-1)*q))];
}
export function createReferenceHeroineFaceFitter(base,box){
 const width=box.max.x-box.min.x;
 const height=box.max.y-box.min.y;
 const depth=box.max.z-box.min.z;
 if(!base||base.length<3000||width<.08||height<.08||depth<.05)
  throw Error('Actual 3D face vertex positions and head bounds required');
 const cx=(box.max.x+box.min.x)*.5;
 const bands=49,radii=[];
 for(let i=0;i<bands;i++){
  const y=.12+.81*(i/(bands-1)), values=[];
  for(let j=0;j<base.length;j+=3){
   const yn=(base[j+1]-box.min.y)/height;
   const zn=(base[j+2]-box.min.z)/depth;
   if(Math.abs(yn-y)<.028&&zn>.35)values.push(Math.abs(base[j]-cx));
  }
  radii.push(percentile(values,.93));
 }
 const nonempty=radii.map((x,i)=>x==null?null:i).filter(x=>x!=null);
 if(nonempty.length<25)throw Error('No valid source face silhouette to fit');
 for(let i=0;i<bands;i++){
  if(radii[i]!=null)continue;
  const nearest=nonempty.reduce((best,j)=>Math.abs(i-j)<Math.abs(i-best)?j:best,nonempty[0]);
  radii[i]=radii[nearest];
 }
 // Use the actual cheek region as the stable size, not a generic sphere,
 // so the tracing does not shrink the eyes and upper head.
 const cheekRadius=percentile(radii.slice(20,36).slice(),.74);
 if(!(cheekRadius>width*.18))throw Error('Unusable source cheek width');
 const sampleRadius=y=>{
  const index=clamp((y-.12)/.81*(bands-1),0,bands-1);
  const lo=Math.floor(index),hi=Math.min(bands-1,lo+1),t=index-lo;
  return radii[lo]*(1-t)+radii[hi]*t;
 };
 const report=Object.freeze({
  source:REFERENCE_HEROINE_FACE.id,
  sourceIsUserPortrait:true,originalTopologyPreserved:true,
  sourceSculptProvidesDepth:true,referenceView:'front only',
  landmarkCount:Object.keys(REFERENCE_HEROINE_FACE.landmarks).length,
  contourKnots:REFERENCE_HEROINE_FACE.outline.length,
  note:'2D silhouette traced; profile/depth require side-view validation'
 });
 function deform(x,y,z,strength=1){
  const yn=(y-box.min.y)/height;
  const zn=(z-box.min.z)/depth;
  const yFace=(yn-.12)/.81;
  if(yFace<-.12||yFace>1.08)return {x,y,z};
  const source=sampleRadius(yn);
  const target=cheekRadius*outlineRatio(clamp(yFace,0,1));
  const xn=Math.abs(x-cx)/Math.max(.001,source);
  // Do not deform the centre of lips, nostrils or eyeball sockets.
  // An outer-shell displacement adapts the jaw silhouette, and smoothly
  // influences adjacent side geometry so the head stays three-dimensional.
  const side=smooth(.23,.75,xn),facing=smooth(.16,.50,zn);
  const vertical=smooth(-.12,.08,yFace)*(1-smooth(.91,1.08,yFace));
  const influence=side*facing*vertical*clamp(strength,0,1);
  const delta=clamp(target-source,-cheekRadius*.23,cheekRadius*.23);
  const sign=Math.sign(x-cx);
  const changedX=x+sign*delta*influence;
  // Keep existing skin depth; slightly round lateral cheek below the eye.
  const cheek=Math.exp(-.5*((yFace-.47)/.19)**2)*
   Math.exp(-.5*((xn-.75)/.32)**2);
  const changedZ=z+depth*.012*cheek*influence;
  return {x:changedX,y,z:changedZ};
 }
 return {deform,report,outlineRatio,faceWidthMeters:cheekRadius*2};
}

/**
 * Shared, geometry-level quality contract distilled from m001's accepted
 * wolf-king source sculpt. A cat variant does NOT copy the wolf silhouette:
 * it reuses the actual density/skin-fitting and seam-smoothing processes,
 * then subtracts the wolf morphology and applies feline proportions.
 *
 * All routines are deterministic, renderer-agnostic and allocate NO GPU
 * objects. Game low LOD bypasses the heavyweight output entirely.
 */
export const BEAST_REFERENCE_QUALITY_REVISION='m001-source-fur-joints-v1';
export const REFERENCE_CROWN_QUALITY=Object.freeze({
 high:Object.freeze({rows:53,columns:17,layers:2}),
 source:Object.freeze({rows:72,columns:20,layers:3}),
 low:Object.freeze({rows:0,columns:0,layers:0})
});
/** m001's eight REAL shoulder/rib/waist/pelvis loft station ratios.
 * This is the authoritative mother for wolf and cat body sculpt quality.
 * Morphs are in the last step: lean waist, dropped forequarter, shoulders.
 */
export function referenceBeastTorsoStations({
 width,length,centerY=1.15,shape='wolf'
}={}){
 if(![width,length,centerY].every(Number.isFinite)||width<=0||length<=0)
  throw Error('Reference beast body dimensions are invalid');
 const cat=shape==='feline';
 const fore=cat?.96:1.0;
 const waist=cat?.83:1;
 const y=cat?centerY+.088:centerY;
 return [
  {z:length*1.01,y:y+.085,rx:width*.257,ry:cat?.126:.140},
  {z:length*.77,y:y+.040,rx:width*1.08*fore,ry:cat?.305:.348},
  {z:length*.46,y:y+.008,rx:width*1.20*fore,ry:cat?.332:.374},
  {z:length*.13,y:y-.003,rx:width*1.02,ry:cat?.302:.330},
  {z:-length*.24,y:y-.008,rx:width*.83*waist,ry:cat?.251:.288},
  {z:-length*.56,y:y-.009,rx:width*.64*waist,ry:cat?.229:.249},
  {z:-length*.84,y:y+.001,rx:width*.52,ry:cat?.210:.217},
  {z:-length*1.03,y:y+.011,rx:cat?width*.256:.087,ry:cat?.095:.100}
 ];
}
/** Same two offset follicle strips used by m001's real sculpt. */
export function referenceDoubleCoat(guides){
 const pairs=[];
 for(const strand of guides){
  const normal=strand.normal||[0,1,0];
  const tangent=[normal[2],0,-normal[0]];
  const n=Math.hypot(...tangent)||1;
  const d=Math.max(.002,Math.min(.010,strand.width*.43));
  const offset=tangent.map(v=>v*d/n);
  for(const side of [-1,1]){
   const shift=(point,tipFactor)=>point.map((v,k)=>
    v+side*offset[k]+(k===2&&side>0?-d*.70*tipFactor:0));
   pairs.push({...strand,width:strand.width*.85,
    root:shift(strand.root,0),mid:shift(strand.mid,.45),
    tip:shift(strand.tip,1)});
  }
 }
 return pairs;
}
/** Exactly the S-shaped flow pattern accepted for m001 flank fur. */
export function referenceBeastFlow(guides,{amplitude=.009}={}){
 return guides.map((h,i)=>{
  const ripple=Math.sin(h.root[2]*12+i*.37)*amplitude;
  return {...h,mid:[h.mid[0]+ripple,
   h.mid[1]+.006*Math.cos(i*.45),h.mid[2]-.008],
   tip:[h.tip[0]+ripple*.50,h.tip[1],h.tip[2]-.012]};
 });
}
export function referenceFurLayerCount(detail){
 return REFERENCE_CROWN_QUALITY[detail]?.layers||0;
}

/**
 * Retargeted full-body combat clips often translate the skeleton origin while
 * a foot remains planted. A GPU-instanced mesh has no post-skinning IK: all
 * baked poses must share a single foot-contact plane before GPU blending.
 *
 * Sample ORIGINAL foot vertices, not the lowest vertex of a weapon, cloak or
 * shield (which may extend below the boot). The same delta is applied to ALL
 * human/outfit/weapon parts, preserving the clothing fit and armor seams.
 */
export function createCrowdGroundAnchor(parts,{footBand=.23,maxFootSamples=4096}={}){
  if(!parts?.length)return null;
  let floor=Infinity;
  // Covered feet may have their skin removed intentionally. In that case
  // the ACTUAL opaque boot-foot mesh supplies the anatomical contact plane.
  for(const p of parts)if((p.isHumanBody||p.isFootSurface)&&p.base){
    const a=p.base;
    for(let i=1;i<a.length;i+=3)if(Number.isFinite(a[i]))floor=Math.min(floor,a[i]);
  }
  if(!Number.isFinite(floor))return null;
  let all=[];
  for(let part=0;part<parts.length;part++){
    const p=parts[part];if(!(p.isHumanBody||p.isFootSurface)||!p.base)continue;
    const a=p.base;
    for(let index=1;index<a.length;index+=3)
      if(a[index]>=floor-.01&&a[index]<=floor+footBand)
        all.push({part,index});
  }
  if(!all.length)return null;
  if(all.length>maxFootSamples){
    const stride=all.length/maxFootSamples;
    all=Array.from({length:maxFootSamples},(_,i)=>all[Math.floor(i*stride)]);
  }
  return {floor,samples:all};
}

export function crowdGroundShift(anchor,poses,{dead=false,maxRise=.75,maxDrop=.22}={}){
  if(!anchor?.samples?.length||!poses?.length)return 0;
  let lowest=Infinity;
  if(dead){
    // The lying-down clip may put hands/head lower than feet: consider all
    // anatomical vertices, excluding weapons and loose garment ornaments.
    for(const part of new Set(anchor.samples.map(sample=>sample.part))){
      const a=poses[part]?.pose??poses[part]?.base;
      if(!a)continue;
      for(let i=1;i<a.length;i+=3)if(Number.isFinite(a[i]))lowest=Math.min(lowest,a[i]);
    }
  }else{
    for(const {part,index} of anchor.samples){
      const a=poses[part]?.pose??poses[part]?.base;
      const y=a?.[index];
      if(Number.isFinite(y))lowest=Math.min(lowest,y);
    }
  }
  if(!Number.isFinite(lowest))return 0;
  return Math.max(-maxDrop,Math.min(maxRise,anchor.floor-lowest));
}

export function applyCrowdGroundShift(pose,dy){
  if(!pose||!Number.isFinite(dy)||Math.abs(dy)<1e-6)return pose;
  const adjusted=new Float32Array(pose);
  for(let i=1;i<adjusted.length;i+=3)adjusted[i]+=dy;
  return adjusted;
}

/**
 * Place the source human's REAL foot-contact plane at local Y=0.
 * Source GLBs are not guaranteed to have an ankle-based root. A render root
 * placed at terrainY will bury the same negative foot offset in every
 * instance unless BOTH the bind and all motion pose buffers are corrected.
 *
 * Executed only once per job during GPU prototype construction, never for
 * each of 2000 live soldiers. Clothes/hair/weapons follow the same delta.
 */
export const CROWD_GROUND_POSE_CHANNELS=Object.freeze([
  'position','crowdWalkA','crowdWalkB','crowdAttack',
  'crowdHit','crowdDead','crowdRide'
]);
export function normalizeCrowdCaptureFootOrigin(sources,anchor){
  const floor=anchor?.floor;
  if(!Number.isFinite(floor))throw Error('Missing anatomical foot origin');
  const offset=-floor;
  if(Math.abs(offset)<1e-6)return {offset:0,correctedAttributes:0};
  let correctedAttributes=0;
  for(const source of sources||[]){
    const geometry=source.geometry;
    if(!geometry?.getAttribute)continue;
    for(const channel of CROWD_GROUND_POSE_CHANNELS){
      const attr=geometry.getAttribute(channel);
      if(!attr||attr.itemSize!==3)continue;
      const a=attr.array;
      for(let j=1;j<a.length;j+=3)a[j]+=offset;
      attr.needsUpdate=true;correctedAttributes++;
    }
    geometry.computeBoundingSphere?.();
    geometry.computeBoundingBox?.();
  }
  return {offset,correctedAttributes};
}

/** Two steps equal one complete left/right run cycle: four real render frames
 * at phases 0, 90, 180 and 270 degrees. The atlas never draws two translucent
 * humanoid silhouettes on top of each other.
 */
export function crowdRunFrame(phase){
  const fraction=((phase/(2*Math.PI))%1+1)%1;
  return Math.min(3,Math.floor(fraction*4));
}

/** CPU equivalent of the interpolated four-contact GPU stride. */
export function crowdGaitBlend(phase){
  const wrapped=((phase%(2*Math.PI))+2*Math.PI)%(2*Math.PI);
  return {frame:crowdRunFrame(wrapped),swing:Math.abs(Math.sin(wrapped)),
    alternate:wrapped>=Math.PI};
}

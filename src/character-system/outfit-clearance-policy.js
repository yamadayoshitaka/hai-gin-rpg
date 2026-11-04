// Keep cloth close to the original anatomically fitted circumference.
// Source garments can contain exaggerated bracers and decorative cuffs;
// using their 96th-percentile radius without a limit made sleeves and trousers
// balloon to 165% of the designed width. Body occlusion handles the remaining
// tiny skin intersections without sacrificing the silhouette.
export const CLOTH_FIT_POLICY=Object.freeze({
 minimumFactor:1.012,
 maximumFactor:1.065,
 quantile:.72,
 surfaceGap:0.002
});

export function resolveClothRadius(nominal,samples=[],policy=CLOTH_FIT_POLICY){
 if(!Number.isFinite(nominal)||nominal<=0)throw Error('Nominal cloth radius must be positive');
 const nearby=samples.filter(x=>Number.isFinite(x)&&x>0).sort((a,b)=>a-b);
 const measured=nearby.length>=12?
  nearby[Math.floor((nearby.length-1)*policy.quantile)]+policy.surfaceGap:
  nominal*1.025;
 return Math.max(nominal*policy.minimumFactor,Math.min(nominal*policy.maximumFactor,measured));
}

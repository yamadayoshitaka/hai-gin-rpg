/** Height-aware positioning for agile / ranged jobs.
 * Terrain is sampled once at battle start, never by a full-mesh query per unit.
 * Does not override collision, water, bridge closures or explicit orders.
 */
export const HIGH_GROUND_JOB_IDS=Object.freeze(['archer','ninja','thief']);
export function isHeightTactician(jobId){
  return HIGH_GROUND_JOB_IDS.includes(String(jobId??''));
}
export function heightAdvanceCost(jobId,currentHeight,nextHeight){
  if(!isHeightTactician(jobId)||!Number.isFinite(currentHeight)||!Number.isFinite(nextHeight))return 0;
  const rise=nextHeight-currentHeight;
  // Reward the safe elevated step, while avoiding a huge score change or
  // oscillating on narrow stairs. Each legal tile is still reserved by the AI.
  return rise>.1?-Math.min(2.4,rise*1.6):rise<-.1?Math.min(1.2,-rise*.55):0;
}
export function shouldSeekHighGround(jobId,currentHeight,neighborHeights,{
  enemyDistanceSquared=Infinity,healthRatio=1,hasForcedDestination=false
}={}){
  if(!isHeightTactician(jobId)||hasForcedDestination||
     !Number.isFinite(currentHeight)||enemyDistanceSquared<=4||
     healthRatio<.3)return false;
  return neighborHeights.some(height=>Number.isFinite(height)&&height-currentHeight>.45);
}

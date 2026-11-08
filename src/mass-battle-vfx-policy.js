/**
 * Budget the effects for the ACTUAL frame-time of the mass battle instead
 * of a fixed 9-accent/12-hit cap that looks empty at 1000v1000.
 * All work is on a bounded subset of the same GPU instanced VFX buffers.
 */
export function massCombatEffectBudget(sideCount,frameP95Ms=20){
  const large=sideCount>=1000,medium=sideCount>=100;
  const p95=Number.isFinite(frameP95Ms)&&frameP95Ms>0?frameP95Ms:24;
  if(p95>40)return large?{hits:14,bursts:10,scan:260,magic:3}:
    {hits:16,bursts:12,scan:210,magic:4};
  if(p95>30)return large?{hits:24,bursts:20,scan:440,magic:6}:
    {hits:24,bursts:18,scan:340,magic:6};
  return large?{hits:42,bursts:28,scan:680,magic:9}:
    medium?{hits:38,bursts:24,scan:420,magic:8}:
    {hits:32,bursts:22,scan:180,magic:7};
}
/** Stable 3-way strike pose selection, without adding a vertex attribute. */
export function massAttackVariant(unit){
  return ((Math.floor(unit?.id)||0)+(Math.floor(unit?.completedSteps)||0))%3;
}

/**
 * Rendering-only frame pacing. Combat authority, model fidelity, skeletal
 * animation and VFX remain untouched. No per-frame transient allocations.
 */
export function interpolatedSkirmishCameraAnchor(actor,out){
 const root=actor?.root?.position;
 if(!root||!out||typeof out.set!=='function')return null;
 const smooth=actor._skirmishRender;
 const x=Number.isFinite(smooth?.x)?smooth.x:root.x;
 const z=Number.isFinite(smooth?.z)?smooth.z:root.z;
 out.set(x,root.y,z);
 return out;
}
/**
 * Spread three independent, expensive spatial/DOM visibility maintenance tasks
 * over separate animation frames, without reducing their normal refresh rate.
 * round-robin guarantees every task advances even on devices below 30 FPS.
 */
export function createVisibilityWorkPacer({nearIntervalMs=100,farIntervalMs=240,phaseMs=35}={}){
 if(!(nearIntervalMs>0&&farIntervalMs>0&&phaseMs>=0))
  throw Error('Invalid scene visibility pacing interval');
 let start=null,cursor=0;
 const next=[0,0,0],counts=[0,0,0];
 return {
  pick(now,{near=false}={}){
   if(!Number.isFinite(now))return -1;
   if(start==null){start=now;for(let i=0;i<3;i++)next[i]=start+phaseMs*i;}
   for(let k=0;k<3;k++){
    const i=(cursor+k)%3;
    if(now<next[i])continue;
    next[i]=now+(near?nearIntervalMs:farIntervalMs);
    counts[i]++;cursor=(i+1)%3;
    return i;
   }
   return -1;
  },
  get stats(){return {counts:[...counts],nextDue:[...next]};}
 };
}

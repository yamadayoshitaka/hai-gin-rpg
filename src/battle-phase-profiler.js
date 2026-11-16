/**
 * Continuous, allocation-light MAIN THREAD phase profiler.
 * This reports CPU durations only. GPU timings come from disjoint queries,
 * if the browser supports them. No game state, AI tick or visual quality
 * is changed by sampling.
 */
const PHASES=['ai','scene','rig','objects','hud','submit'];
export class BattlePhaseProfiler{
 constructor({windowSize=120}={}){
  this.windowSize=windowSize;
  this.samples=Object.fromEntries(PHASES.map(p=>[p,new Float32Array(windowSize)]));
  this.indices=Object.fromEntries(PHASES.map(p=>[p,0]));
  this.counts=Object.fromEntries(PHASES.map(p=>[p,0]));
 }
 record(phase,ms){
  if(!this.samples[phase]||!Number.isFinite(ms)||ms<0)return;
  const index=this.indices[phase];
  this.samples[phase][index]=ms;
  this.indices[phase]=(index+1)%this.windowSize;
  this.counts[phase]=Math.min(this.windowSize,this.counts[phase]+1);
 }
 getStats(){
  const stats={};
  for(const phase of PHASES){
   const n=this.counts[phase];
   if(!n){stats[phase]={avg:0,p95:0,max:0};continue;}
   const sorted=Array.from(this.samples[phase].subarray(0,n)).sort((a,b)=>a-b);
   let sum=0;for(let i=0;i<n;i++)sum+=sorted[i];
   stats[phase]={avg:+(sum/n).toFixed(2),
    p95:+sorted[Math.min(n-1,Math.floor(n*.95))].toFixed(2),
    max:+sorted[n-1].toFixed(2)};
  }
  return stats;
 }
}

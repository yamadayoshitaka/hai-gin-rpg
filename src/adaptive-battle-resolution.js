/**
 * Bounded, hysteretic rendering scale for Android/browser WebGL battles.
 * The simulation tick, worker, camera projection, controls and UI viewport
 * are unaffected: only GPU drawing-buffer resolution is adjusted.
 */
export class AdaptiveBattleResolution {
 constructor({maxRatio=1,minRatio=.72,targetFps=45,downStep=.075,upStep=.04,intervalMs=1300}={}){
  if(!Number.isFinite(maxRatio)||!Number.isFinite(minRatio)||maxRatio<=0||
   minRatio<=0||minRatio>maxRatio)throw Error('Invalid adaptive resolution bounds');
  this.maxRatio=maxRatio;
  this.minRatio=minRatio;
  this.targetFps=targetFps;
  this.downStep=downStep;this.upStep=upStep;this.intervalMs=intervalMs;
  this.ratio=maxRatio;this.lowSamples=0;this.goodSamples=0;this.lastMs=-Infinity;
 }
 sample({fps=0,p95Ms=0,nowMs=0,paused=false}={}){
  if(paused||!Number.isFinite(fps)||fps<=0||!Number.isFinite(nowMs))return null;
  if(nowMs-this.lastMs<this.intervalMs)return null;
  this.lastMs=nowMs;
  // Do not bounce resolution around the 45 FPS target.
  if(fps<this.targetFps-7||p95Ms>35){
   this.lowSamples++;this.goodSamples=0;
  }else if(fps>=this.targetFps+9&&p95Ms>0&&p95Ms<23){
   this.goodSamples++;this.lowSamples=0;
  }else{this.lowSamples=0;this.goodSamples=0;}
  let next=this.ratio;
  if(this.lowSamples>=2){
   this.lowSamples=0;
   next=Math.max(this.minRatio,this.ratio-this.downStep);
  }else if(this.goodSamples>=4){
   this.goodSamples=0;
   next=Math.min(this.maxRatio,this.ratio+this.upStep);
  }
  next=Math.round(next*1000)/1000;
  if(Math.abs(next-this.ratio)<.005)return null;
  this.ratio=next;
  return next;
 }
 getStats(){return {ratio:this.ratio,min:this.minRatio,max:this.maxRatio,targetFps:this.targetFps};}
}

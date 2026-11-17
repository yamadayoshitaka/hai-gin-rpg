/** Gradual, hysteretic LOD controller for long-running 2000-soldier battles.
 * Only adjusts presentation; it never drops soldiers, AI ticks or effects.
 */
export class CrowdPerformanceBudget{
  constructor({targetFps=45,minPx=36,maxPx=60}={}){
    this.targetFps=targetFps;this.minPx=minPx;this.maxPx=maxPx;
    this.enterPx=minPx;this.slowSeconds=0;this.fastSeconds=0;
  }
  sample({fps,fullMeshVisible=0,drawCalls=0,paused=false}={}){
    if(paused||!Number.isFinite(fps)||fps<=0)return this.enterPx;
    // In a dense 1000v1000 scene the expensive fully dressed meshes must
    // yield promptly to the already-captured, high-resolution real-rig atlas.
    // Default (<=60px) battles retain their measured hysteresis unchanged.
    if(this.maxPx>60&&fps<this.targetFps-16&&fullMeshVisible>=35&&drawCalls>=1000){
      this.enterPx=Math.min(this.maxPx,this.enterPx+18);
      this.slowSeconds=0;this.fastSeconds=0;
    }else if(fps<this.targetFps-6&&fullMeshVisible>=55&&drawCalls>=450){
      this.slowSeconds++;this.fastSeconds=0;
      if(this.slowSeconds>=2){this.enterPx=Math.min(this.maxPx,this.enterPx+12);this.slowSeconds=0;}
    }else if(fps>this.targetFps+6){
      this.fastSeconds++;this.slowSeconds=0;
      if(this.fastSeconds>=4){this.enterPx=Math.max(this.minPx,this.enterPx-6);this.fastSeconds=0;}
    }else{this.slowSeconds=0;this.fastSeconds=0;}
    return this.enterPx;
  }
}

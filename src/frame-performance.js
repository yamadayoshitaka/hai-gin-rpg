/** Low-overhead GPU/CPU timing. Does not change rendering resolution or quality. */
export class FramePerformanceMonitor{
  constructor(renderer,{windowSize=120,gpuSampleInterval=15}={}){
    this.renderer=renderer;this.samples=new Float32Array(windowSize);
    this.cursor=0;this.count=0;this.frames=0;this.lastFrameAt=0;
    this.gpuMs=null;this.gpuSampleInterval=gpuSampleInterval;this.activeQuery=null;
    this.queries=[];
    try{
      this.gl=renderer.getContext();
      this.ext=typeof this.gl?.createQuery==='function'?this.gl.getExtension('EXT_disjoint_timer_query_webgl2'):null;
    }catch{this.ext=null;}
  }
  begin(){
    const now=performance.now();
    if(this.lastFrameAt){
      const interval=now-this.lastFrameAt;
      this.samples[this.cursor]=interval;
      this.cursor=(this.cursor+1)%this.samples.length;
      this.count=Math.min(this.count+1,this.samples.length);
    }
    this.lastFrameAt=now;this.frames++;
    if(!this.ext)return;
    this.pollGpu();
    if(this.frames%this.gpuSampleInterval!==0||this.activeQuery||this.queries.length>2)return;
    try{
      this.activeQuery=this.gl.createQuery();
      this.gl.beginQuery(this.ext.TIME_ELAPSED_EXT,this.activeQuery);
    }catch{this.activeQuery=null;this.ext=null;}
  }
  end(){
    if(!this.activeQuery||!this.ext)return;
    try{this.gl.endQuery(this.ext.TIME_ELAPSED_EXT);this.queries.push(this.activeQuery);}
    catch{this.ext=null;}
    this.activeQuery=null;
  }
  pollGpu(){
    if(!this.queries.length||!this.ext)return;
    const query=this.queries[0];
    try{
      if(!this.gl.getQueryParameter(query,this.gl.QUERY_RESULT_AVAILABLE))return;
      if(!this.gl.getParameter(this.ext.GPU_DISJOINT_EXT)){
        this.gpuMs=this.gl.getQueryParameter(query,this.gl.QUERY_RESULT)/1e6;
      }
      this.gl.deleteQuery(query);this.queries.shift();
    }catch{this.ext=null;}
  }
  getStats(){
    if(!this.count)return {fps:0,frameP95Ms:0,frameAvgMs:0,gpuFrameMs:this.gpuMs};
    const all=Array.from(this.samples.subarray(0,this.count)).sort((a,b)=>a-b);
    const sum=all.reduce((a,b)=>a+b,0),average=sum/this.count;
    return {fps:Math.round(1000/average),frameAvgMs:+average.toFixed(2),
      frameP95Ms:+all[Math.min(all.length-1,Math.floor(all.length*.95))].toFixed(2),
      gpuFrameMs:this.gpuMs==null?null:+this.gpuMs.toFixed(2),
      meets60fps:all[Math.min(all.length-1,Math.floor(all.length*.95))]<=1000/60};
  }
}
